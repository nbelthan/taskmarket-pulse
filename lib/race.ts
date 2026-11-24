// "The race": how fast agents arrive on a task, how long the poster takes to
// decide, and whether early entries win. Built from two public endpoints that
// go one level deeper than the task list:
//   /api/tasks/<id>?chainId=…              -> awards[].settledAt, workerPayment, submissionId
//   /api/tasks/<id>/submissions?chainId=…  -> every entry's submittedAt
// The API rate-limits bursts, so this samples recent tasks with low concurrency
// and returns whatever it managed to fetch instead of failing the page.
import { API_BASE, CHAINS, CHAIN_KEYS, toUnits, type ChainKey, type RawTask, type Submission, type TaskDetail } from "./api";
import { taskTitle } from "./derive";

export type ReplayTask = {
  id: string;
  ref: string | null;
  title: string;
  chain: ChainKey;
  reward: number;
  status: string;
  createdAt: string;
  /** Seconds after posting at which each entry arrived, ascending. */
  offsets: number[];
  /** Total entries (offsets may be thinned for very large tasks). */
  entries: number;
  /** Index into offsets of the primary winning entry, if known. */
  winner: number | null;
  winnerPayment: number | null;
  /** Seconds after posting of the first payout, if decided. */
  decidedAt: number | null;
};

export type RaceChain = {
  sample: number;
  oldest: string | null;
  firstEntry: { median: number; p25: number; p75: number } | null;
  decision: { median: number; p25: number; p75: number; n: number } | null;
  decisionBins: { label: string; n: number }[];
  /** Primary winner's arrival quarter among the task's entries: [first, second, third, last]. */
  winnerQuarters: [number, number, number, number];
  firstQuarterShare: number | null;
  entriesAtDecision: number | null;
  paid: number;
};

export type Race = { asOf: string; chains: Record<ChainKey, RaceChain | null>; replays: ReplayTask[]; degraded: boolean; calls: number };

const SAMPLE = 40; // recent completed tasks per chain
const BUDGET_MS = 25_000; // stop sampling after this; keep what we have

/** Race-local fetch: short timeout, one gentle retry on 429, hard deadline. */
function makeGet(deadline: number) {
  return async function get<T>(path: string, retried = false): Promise<T> {
    if (Date.now() > deadline) throw new Error("race: time budget spent");
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { accept: "application/json", "user-agent": "taskmarket-pulse (open-source dashboard)" },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.status === 429 && !retried) {
      await new Promise((r) => setTimeout(r, 1_500));
      return get<T>(path, true);
    }
    if (!res.ok) throw new Error(`${res.status} for ${path}`);
    return (await res.json()) as T;
  };
}
const MIN_ENTRIES = 3;
const MAX_DOTS = 700;

const ts = (iso: string) => new Date(iso).getTime();

function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  const p = (s.length - 1) * q;
  const lo = Math.floor(p);
  const hi = Math.ceil(p);
  return s[lo] + (s[hi] - s[lo]) * (p - lo);
}
const q3 = (xs: number[]) => (xs.length ? { p25: quantile(xs, 0.25), median: quantile(xs, 0.5), p75: quantile(xs, 0.75) } : null);

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<(R | null)[]> {
  const out: (R | null)[] = new Array(items.length).fill(null);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        try {
          out[k] = await fn(items[k]);
        } catch {
          out[k] = null;
        }
      }
    }),
  );
  return out;
}

type Deep = { t: RawTask; d: TaskDetail; subs: Submission[] };

function toReplay(chain: ChainKey, x: Deep): ReplayTask {
  const created = ts(x.d.createdAt);
  const sorted = [...x.subs].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  const awards = x.d.awards ?? [];
  const primary = awards.find((a) => a.isPrimary) ?? awards[0];
  const settled = awards.map((a) => a.settledAt).filter((v): v is string => !!v).map(ts);
  let idx = primary?.submissionId ? sorted.findIndex((s) => s.id === primary.submissionId) : -1;
  // Thin very large tasks evenly, always keeping the winner.
  let keep = sorted.map((_, i) => i);
  if (sorted.length > MAX_DOTS) {
    const step = sorted.length / MAX_DOTS;
    keep = Array.from({ length: MAX_DOTS }, (_, i) => Math.floor(i * step));
    if (idx >= 0 && !keep.includes(idx)) {
      let j = 0;
      while (j + 1 < keep.length && keep[j + 1] < idx) j++;
      keep[j] = idx; // stays sorted: keep[j] < idx < keep[j + 1]
    }
  }
  const offsets = keep.map((i) => Math.max(0, (ts(sorted[i].submittedAt) - created) / 1000));
  idx = idx >= 0 ? keep.indexOf(idx) : -1;
  return {
    id: x.d.id,
    ref: x.d.referenceCode,
    title: taskTitle(x.d),
    chain,
    reward: toUnits(x.d.reward),
    status: x.d.status,
    createdAt: x.d.createdAt,
    offsets,
    entries: sorted.length,
    winner: idx >= 0 ? idx : null,
    winnerPayment: primary?.workerPayment ? toUnits(primary.workerPayment) : null,
    decidedAt: settled.length ? Math.max(0, (Math.min(...settled) - created) / 1000) : null,
  };
}

const BINS: [string, number][] = [
  ["< 1 h", 3600],
  ["1–6 h", 6 * 3600],
  ["6–24 h", 24 * 3600],
  ["1–3 days", 72 * 3600],
  ["3+ days", Infinity],
];

function stats(rows: Deep[]): RaceChain | null {
  if (!rows.length) return null;
  const first: number[] = [];
  const decision: number[] = [];
  const atDecision: number[] = [];
  const quarters: [number, number, number, number] = [0, 0, 0, 0];
  let paid = 0;
  for (const x of rows) {
    const created = ts(x.d.createdAt);
    const sorted = [...x.subs].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    if (sorted.length) first.push((ts(sorted[0].submittedAt) - created) / 1000);
    const awards = x.d.awards ?? [];
    for (const a of awards) paid += toUnits(a.workerPayment);
    const settled = awards.map((a) => a.settledAt).filter((v): v is string => !!v).map(ts);
    if (settled.length) {
      const dAt = Math.min(...settled);
      decision.push(Math.max(0, (dAt - created) / 1000));
      atDecision.push(sorted.filter((s) => ts(s.submittedAt) <= dAt).length);
    }
    const primary = awards.find((a) => a.isPrimary) ?? awards[0];
    const idx = primary?.submissionId ? sorted.findIndex((s) => s.id === primary.submissionId) : -1;
    if (idx >= 0 && sorted.length >= 4) quarters[Math.min(3, Math.floor((idx * 4) / sorted.length))]++;
  }
  const qn = quarters.reduce((a, b) => a + b, 0);
  const d = q3(decision);
  return {
    sample: rows.length,
    oldest: rows.reduce<string | null>((m, x) => (!m || x.d.createdAt < m ? x.d.createdAt : m), null),
    firstEntry: q3(first),
    decision: d ? { ...d, n: decision.length } : null,
    decisionBins: BINS.map(([label, max], i) => ({ label, n: decision.filter((v) => v < max && v >= (i ? BINS[i - 1][1] : 0)).length })),
    winnerQuarters: quarters,
    firstQuarterShare: qn ? quarters[0] / qn : null,
    entriesAtDecision: atDecision.length ? quantile(atDecision, 0.5) : null,
    paid,
  };
}

export async function buildRace(): Promise<Race> {
  const get = makeGet(Date.now() + BUDGET_MS);
  const api = {
    tasksPage: (chainId: number, status: string) =>
      get<{ tasks: RawTask[] }>(`/api/tasks?chainId=${chainId}&status=${status}&sort=newest&limit=100`).then((d) => d.tasks),
    task: (chainId: number, id: string) =>
      get<TaskDetail | { task: TaskDetail }>(`/api/tasks/${id}?chainId=${chainId}`).then((d) => ("task" in d ? d.task : d)),
    submissions: (chainId: number, id: string) => get<Submission[]>(`/api/tasks/${id}/submissions?chainId=${chainId}`),
  };
  let calls = 0;
  let failures = 0;
  const deep = async (chain: ChainKey, t: RawTask): Promise<Deep> => {
    calls += 2;
    try {
      const [d, subs] = await Promise.all([api.task(CHAINS[chain].id, t.id), api.submissions(CHAINS[chain].id, t.id)]);
      return { t, d, subs };
    } catch (e) {
      failures++;
      throw e;
    }
  };

  const chains = {} as Race["chains"];
  const decided: ReplayTask[] = [];
  for (const k of CHAIN_KEYS) {
    let list: RawTask[] = [];
    try {
      calls++;
      list = (await api.tasksPage(CHAINS[k].id, "completed")).filter((t) => (t.submissionCount ?? 0) >= MIN_ENTRIES).slice(0, SAMPLE);
    } catch {
      failures++;
    }
    const rows = (await pool(list, 3, (t) => deep(k, t))).filter((r): r is Deep => !!r);
    chains[k] = stats(rows);
    decided.push(...rows.map((r) => toReplay(k, r)));
  }

  // Replays: the most contested decided task, the biggest decided reward, and
  // the most contested task still open right now.
  const replays: ReplayTask[] = [];
  const withWinner = decided.filter((r) => r.winner !== null && r.decidedAt !== null);
  // Prefer a task with real money at stake for the headline replay.
  const pool1 = withWinner.filter((r) => r.reward >= 1 && r.entries >= 10);
  const mostContested = [...(pool1.length ? pool1 : withWinner)].sort((a, b) => b.entries - a.entries)[0];
  if (mostContested) replays.push(mostContested);
  const biggest = [...withWinner].filter((r) => r.id !== mostContested?.id && r.entries >= 8).sort((a, b) => b.reward - a.reward)[0];
  if (biggest) replays.push(biggest);
  try {
    calls++;
    const open = await api.tasksPage(CHAINS.tempo.id, "open");
    const hot = [...open].sort((a, b) => (b.submissionCount ?? 0) - (a.submissionCount ?? 0))[0];
    if (hot && (hot.submissionCount ?? 0) >= MIN_ENTRIES) {
      const x = await deep("tempo", hot);
      replays.push(toReplay("tempo", x));
    }
  } catch {
    failures++;
  }

  return { asOf: new Date().toISOString(), chains, replays, degraded: failures > 0, calls };
}
