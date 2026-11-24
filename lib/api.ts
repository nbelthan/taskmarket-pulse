// Thin, server-only client for the public Taskmarket API.
// The API does not allow cross-origin browser requests, so every call here
// runs on the server (inside a cached function or a route handler).

export const API_BASE = process.env.TASKMARKET_API ?? "https://api.taskmarket.dev";

export const CHAINS = {
  tempo: { id: 4217, name: "Tempo", token: "OUSD" },
  base: { id: 8453, name: "Base", token: "USDC" },
} as const;
export type ChainKey = keyof typeof CHAINS;
export const CHAIN_KEYS = Object.keys(CHAINS) as ChainKey[];

export const RANGES = ["7d", "30d", "90d", "all"] as const;
export type Range = (typeof RANGES)[number];

// ---------- raw API shapes (only the fields we read) ----------
export type MarketStats = {
  registeredWorkers: number;
  activeWorkers7d: number;
  activeAgents7d: number;
  openTasks: number;
  paidWorkers: number;
  activeWallets: number;
};
export type Breakdowns = {
  status: { status: string; count: number }[];
  mode: { mode: string; count: number }[];
  actorType: { actorType: string; count: number }[];
};
export type SeriesRow = {
  bucket: string;
  tasksCreated: number;
  rewardVolume: string;
  completedTasks: number;
  newAgents: number;
  activeAgents: number;
  paidVolume: string;
  settlements: number;
  ratings: number;
};
export type Heatmap = {
  rowKeys: string[];
  colKeys: string[];
  cells: { row: string; col: string; count: number; volume: string }[];
  maxCount?: number;
};
export type FeedItem = {
  type: string;
  timestamp: string;
  taskId: string | null;
  taskTitle: string | null;
  chainId: number;
  actor: string | null;
  actorType: string | null;
  amount: string | null;
  rating: number | null;
};
export type Feed = { items: FeedItem[]; nextCursor: string | null };
export type RawTask = {
  id: string;
  referenceCode: string | null;
  chainId: number;
  requester: string;
  requesterActorType: string | null;
  description: string | null;
  mode: string;
  status: string;
  reward: string;
  submissionCount: number;
  awardCount: number | null;
  primaryAward: { workerAddress: string } | null;
  createdAt: string;
  expiryTime: string | null;
};

export type Award = {
  workerAddress: string;
  rank: number | null;
  isPrimary: boolean;
  grossAmount: string | null;
  workerPayment: string | null;
  settledAt: string | null;
  submissionId: string | null;
};
export type TaskDetail = RawTask & { awards: Award[] | null };
export type Submission = { id: string; submittedAt: string; workerAddress: string; rejectedAt: string | null };

// ---------- fetching ----------
async function getJSON<T>(path: string, attempt = 0): Promise<T> {
  const url = `${API_BASE}${path}`;
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "taskmarket-pulse (open-source dashboard)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 429 && attempt < 5) {
      // Rate limited: honour Retry-After when given, else back off exponentially.
      const ra = Number(res.headers.get("retry-after"));
      await new Promise((r) => setTimeout(r, Number.isFinite(ra) && ra > 0 ? ra * 1000 : 800 * 2 ** attempt));
      return getJSON<T>(path, attempt + 1);
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
    return (await res.json()) as T;
  } catch (err) {
    if (attempt < 2 && !(err instanceof Error && /^4\d\d /.test(err.message))) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      return getJSON<T>(path, attempt + 1);
    }
    throw err;
  }
}

export const api = {
  stats: (chainId: number) => getJSON<MarketStats>(`/api/market/stats?chainId=${chainId}`),
  breakdowns: (chainId: number) => getJSON<Breakdowns>(`/api/stats/breakdowns?chainId=${chainId}`),
  series: (chainId: number, range: Range) =>
    getJSON<SeriesRow[]>(`/api/stats/platform-time-series?chainId=${chainId}&range=${range}&bucket=day`),
  heatmap: (chainId: number, dimension: "hourOfWeek" | "mode", range = "30d") =>
    getJSON<Heatmap>(`/api/stats/activity-heatmap?chainId=${chainId}&range=${range}&dimension=${dimension}`),
  feed: (chainId: number, limit = 50) => getJSON<Feed>(`/api/stats/activity-feed?chainId=${chainId}&limit=${limit}`),
  tasksPage: (chainId: number, status: string, limit = 100) =>
    getJSON<{ tasks: RawTask[] }>(`/api/tasks?chainId=${chainId}&status=${status}&sort=newest&limit=${limit}`).then((d) => d.tasks),
  task: (chainId: number, id: string) =>
    getJSON<TaskDetail | { task: TaskDetail }>(`/api/tasks/${id}?chainId=${chainId}`).then((d) => ("task" in d ? d.task : d)),
  submissions: (chainId: number, id: string) => getJSON<Submission[]>(`/api/tasks/${id}/submissions?chainId=${chainId}`),
  /** Every task on a chain, newest first, following the cursor to the end. */
  async allTasks(chainId: number): Promise<RawTask[]> {
    const out: RawTask[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 200; page++) {
      const q: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
      const d: { tasks: RawTask[]; nextCursor: string | null; hasMore: boolean } = await getJSON(
        `/api/tasks?chainId=${chainId}&sort=newest&limit=100${q}`,
      );
      out.push(...d.tasks);
      if (!d.hasMore || !d.nextCursor) break;
      cursor = d.nextCursor;
    }
    return out;
  },
};

/** Amounts come back as integer strings with 6 decimals (1000000 = 1.00). */
export function toUnits(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined || raw === "") return 0;
  return Number(raw) / 1e6;
}
