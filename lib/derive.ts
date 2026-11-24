// Pure functions that turn raw API responses into the numbers on the page.
// Nothing here fetches; everything is reproducible from the raw responses.
import { toUnits, type RawTask, type SeriesRow } from "./api";

export const OUTCOMES = ["completed", "open", "in_progress", "expired", "cancelled"] as const;
export type Outcome = (typeof OUTCOMES)[number];
export const OUTCOME_LABEL: Record<Outcome, string> = {
  completed: "Completed",
  open: "Still open",
  in_progress: "Claimed / in review",
  expired: "Expired",
  cancelled: "Cancelled",
};

/** API status -> the five outcome groups used on the page. */
export function outcomeOf(status: string): Outcome {
  switch (status) {
    case "completed":
      return "completed";
    case "open":
      return "open";
    case "expired":
      return "expired";
    case "cancelled":
      return "cancelled";
    default:
      return "in_progress"; // claimed, worker_selected, pending_approval, …
  }
}

export const MODES = ["bounty", "claim", "pitch", "benchmark", "auction"] as const;

export function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

/** Monday 00:00 UTC of the ISO week containing `iso`, as YYYY-MM-DD. */
export function weekStart(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7; // Mon = 0
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return m.toISOString().slice(0, 10);
}

export function taskTitle(t: Pick<RawTask, "description">): string {
  const first = (t.description ?? "").split("\n").find((l) => l.trim()) ?? "Untitled task";
  return first.length > 96 ? `${first.slice(0, 95).trimEnd()}…` : first.trim();
}

export type WeekPosters = { week: string; posters: number; tasks: number; newPosters: number };

/** Distinct requester wallets per ISO week (UTC), computed from the task list. */
export function postersPerWeek(tasks: RawTask[]): WeekPosters[] {
  const byWeek = new Map<string, { set: Set<string>; tasks: number }>();
  const firstSeen = new Map<string, string>();
  for (const t of tasks) {
    const w = weekStart(t.createdAt);
    const who = t.requester.toLowerCase();
    const e = byWeek.get(w) ?? { set: new Set<string>(), tasks: 0 };
    e.set.add(who);
    e.tasks++;
    byWeek.set(w, e);
    const prev = firstSeen.get(who);
    if (!prev || w < prev) firstSeen.set(who, w);
  }
  const newByWeek = new Map<string, number>();
  for (const w of firstSeen.values()) newByWeek.set(w, (newByWeek.get(w) ?? 0) + 1);
  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, e]) => ({ week, posters: e.set.size, tasks: e.tasks, newPosters: newByWeek.get(week) ?? 0 }));
}

export type Concentration = {
  posters: number;
  /** Lorenz curve points: x = share of posters (smallest first), y = share of tasks. */
  lorenz: [number, number][];
  gini: number;
  top: { n: number; taskShare: number; rewardShare: number }[];
  topPosters: { addr: string; tasks: number; reward: number }[];
};

export function concentration(tasks: RawTask[]): Concentration {
  const per = new Map<string, { tasks: number; reward: number }>();
  for (const t of tasks) {
    const k = t.requester.toLowerCase();
    const e = per.get(k) ?? { tasks: 0, reward: 0 };
    e.tasks++;
    e.reward += toUnits(t.reward);
    per.set(k, e);
  }
  const rows = [...per.entries()].map(([addr, v]) => ({ addr, ...v }));
  const totalTasks = tasks.length || 1;
  const totalReward = rows.reduce((s, r) => s + r.reward, 0) || 1;
  const asc = rows.map((r) => r.tasks).sort((a, b) => a - b);
  const n = asc.length;
  const lorenz: [number, number][] = [[0, 0]];
  let cum = 0;
  asc.forEach((v, i) => {
    cum += v;
    lorenz.push([(i + 1) / n, cum / totalTasks]);
  });
  // Gini from the Lorenz curve (trapezoids).
  let area = 0;
  for (let i = 1; i < lorenz.length; i++) area += (lorenz[i][0] - lorenz[i - 1][0]) * (lorenz[i][1] + lorenz[i - 1][1]) / 2;
  const gini = n > 1 ? 1 - 2 * area : 0;
  const byTasks = [...rows].sort((a, b) => b.tasks - a.tasks || b.reward - a.reward);
  const top = [1, 3, 10].map((k) => ({
    n: k,
    taskShare: byTasks.slice(0, k).reduce((s, r) => s + r.tasks, 0) / totalTasks,
    rewardShare: [...rows].sort((a, b) => b.reward - a.reward).slice(0, k).reduce((s, r) => s + r.reward, 0) / totalReward,
  }));
  // Down-sample the curve for drawing.
  const step = Math.max(1, Math.floor(lorenz.length / 80));
  const sampled = lorenz.filter((_, i) => i % step === 0 || i === lorenz.length - 1);
  return { posters: n, lorenz: sampled, gini, top, topPosters: byTasks.slice(0, 5) };
}

export type FlowNode = { id: string; label: string; col: number; value: number; tasks: number; kind: string };
export type FlowLink = { source: string; target: string; value: number; tasks: number };
export type Flow = { nodes: FlowNode[]; links: FlowLink[]; direct: FlowLink[]; total: number };

/** Reward money: poster -> mode -> outcome. Top posters by reward, the rest grouped. */
export function rewardFlow(tasks: RawTask[], topN = 5): Flow {
  const perPoster = new Map<string, number>();
  for (const t of tasks) perPoster.set(t.requester.toLowerCase(), (perPoster.get(t.requester.toLowerCase()) ?? 0) + toUnits(t.reward));
  const ranked = [...perPoster.entries()].sort((a, b) => b[1] - a[1]);
  const top = new Set(ranked.slice(0, topN).map(([a]) => a));
  const others = ranked.length - top.size;
  const nodes = new Map<string, FlowNode>();
  const links = new Map<string, FlowLink>();
  const direct = new Map<string, FlowLink>();
  const node = (id: string, label: string, col: number, kind: string, v: number) => {
    const n = nodes.get(id) ?? { id, label, col, value: 0, tasks: 0, kind };
    n.value += v;
    n.tasks += 1;
    nodes.set(id, n);
  };
  const link = (s: string, t: string, v: number, into = links) => {
    const k = `${s}>${t}`;
    const l = into.get(k) ?? { source: s, target: t, value: 0, tasks: 0 };
    l.value += v;
    l.tasks += 1;
    into.set(k, l);
  };
  let total = 0;
  for (const t of tasks) {
    const v = toUnits(t.reward);
    total += v;
    const a = t.requester.toLowerCase();
    const p = top.has(a) ? `p:${a}` : "p:others";
    const pl = top.has(a) ? shortAddr(t.requester) : `${others} other posters`;
    const m = `m:${t.mode}`;
    const o = `o:${outcomeOf(t.status)}`;
    node(p, pl, 0, top.has(a) ? "poster" : "others", v);
    node(m, t.mode, 1, "mode", v);
    node(o, OUTCOME_LABEL[outcomeOf(t.status)], 2, outcomeOf(t.status), v);
    link(p, m, v);
    link(m, o, v);
    link(p, o, v, direct);
  }
  const order = (n: FlowNode) =>
    n.col === 0 ? (n.id === "p:others" ? 1e15 : -n.value) : n.col === 1 ? MODES.indexOf(n.label as (typeof MODES)[number]) : OUTCOMES.indexOf(n.kind as Outcome);
  return {
    nodes: [...nodes.values()].sort((a, b) => a.col - b.col || order(a) - order(b)),
    links: [...links.values()].filter((l) => l.value > 0),
    direct: [...direct.values()].filter((l) => l.value > 0),
    total,
  };
}

export type SwarmTask = { id: string; ref: string | null; title: string; reward: number; submissions: number; createdAt: string; expiry: string | null; mode: string };

export type ChainDerived = {
  taskCount: number;
  rewardTotal: number;
  byOutcome: Record<Outcome, { tasks: number; reward: number }>;
  byStatus: Record<string, number>;
  byMode: Record<string, { tasks: number; reward: number }>;
  postersTotal: number;
  humanPostedShare: number;
  weekly: WeekPosters[];
  concentration: Concentration;
  flow: Flow;
  open: { count: number; zeroSubs: number; medianSubs: number; reward: number; top: SwarmTask[] };
  winners: { completed: number; distinctWinners: number; topWinnerShare: number };
  oldest: string | null;
};

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function deriveChain(tasks: RawTask[]): ChainDerived {
  const byOutcome = Object.fromEntries(OUTCOMES.map((o) => [o, { tasks: 0, reward: 0 }])) as ChainDerived["byOutcome"];
  const byStatus: Record<string, number> = {};
  const byMode: ChainDerived["byMode"] = {};
  let rewardTotal = 0;
  let humanTasks = 0;
  for (const t of tasks) {
    const v = toUnits(t.reward);
    rewardTotal += v;
    const o = byOutcome[outcomeOf(t.status)];
    o.tasks++;
    o.reward += v;
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    const m = (byMode[t.mode] ??= { tasks: 0, reward: 0 });
    m.tasks++;
    m.reward += v;
    if (t.requesterActorType === "human") humanTasks++;
  }
  const open = tasks.filter((t) => t.status === "open");
  const completed = tasks.filter((t) => t.status === "completed");
  const winners = new Map<string, number>();
  for (const t of completed) {
    const w = t.primaryAward?.workerAddress?.toLowerCase();
    if (w) winners.set(w, (winners.get(w) ?? 0) + 1);
  }
  const withWinner = [...winners.values()].reduce((s, v) => s + v, 0);
  const conc = concentration(tasks);
  return {
    taskCount: tasks.length,
    rewardTotal,
    byOutcome,
    byStatus,
    byMode,
    postersTotal: conc.posters,
    humanPostedShare: tasks.length ? humanTasks / tasks.length : 0,
    weekly: postersPerWeek(tasks),
    concentration: conc,
    flow: rewardFlow(tasks),
    open: {
      count: open.length,
      zeroSubs: open.filter((t) => !t.submissionCount).length,
      medianSubs: median(open.map((t) => t.submissionCount ?? 0)),
      reward: open.reduce((s, t) => s + toUnits(t.reward), 0),
      top: [...open]
        .sort((a, b) => (b.submissionCount ?? 0) - (a.submissionCount ?? 0) || toUnits(b.reward) - toUnits(a.reward))
        .slice(0, 12)
        .map((t) => ({
          id: t.id,
          ref: t.referenceCode,
          title: taskTitle(t),
          reward: toUnits(t.reward),
          submissions: t.submissionCount ?? 0,
          createdAt: t.createdAt,
          expiry: t.expiryTime,
          mode: t.mode,
        })),
    },
    winners: {
      completed: completed.length,
      distinctWinners: winners.size,
      topWinnerShare: withWinner ? Math.max(0, ...winners.values()) / withWinner : 0,
    },
    oldest: tasks.length ? tasks.reduce((m, t) => (t.createdAt < m ? t.createdAt : m), tasks[0].createdAt) : null,
  };
}

export type SeriesPoint = {
  day: string;
  activeAgents: number;
  tasksCreated: number;
  rewardPosted: number;
  rewardPaid: number;
  completedTasks: number;
  newAgents: number;
};

export function seriesPoints(rows: SeriesRow[]): SeriesPoint[] {
  return rows.map((r) => ({
    day: r.bucket,
    activeAgents: r.activeAgents,
    tasksCreated: r.tasksCreated,
    rewardPosted: toUnits(r.rewardVolume),
    rewardPaid: toUnits(r.paidVolume),
    completedTasks: r.completedTasks,
    newAgents: r.newAgents,
  }));
}
