// Builds one consistent snapshot of the market, built on the server and cached.
// Every number on the page comes from a single snapshot, so the page agrees
// with the API as of the snapshot's `asOf` time.
import {
  api,
  CHAINS,
  CHAIN_KEYS,
  RANGES,
  type Breakdowns,
  type ChainKey,
  type FeedItem,
  type Heatmap,
  type MarketStats,
  type Range,
} from "./api";
import { deriveChain, seriesPoints, wallets, type ChainDerived, type SeriesPoint, type WalletRow } from "./derive";

export type Snapshot = {
  asOf: string;
  stats: Record<ChainKey, MarketStats>;
  /** True when the API returned identical bodies for both chain ids. */
  sameAcrossChains: { stats: boolean; breakdowns: boolean; series: boolean; heatmap: boolean };
  breakdowns: Record<ChainKey, Breakdowns>;
  series: Record<ChainKey, Record<Range, SeriesPoint[]>>;
  heatmap: Record<ChainKey, { hourOfWeek: Heatmap; mode: Heatmap }>;
  feed: FeedItem[];
  chains: Record<ChainKey, ChainDerived>;
  /** Per-wallet totals per chain, for the wallet lookup (served separately at /api/wallets). */
  wallets: Record<ChainKey, Record<string, WalletRow>>;
  fetchMs: number;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Small concurrency limiter so we stay polite to the API. */
async function pool<T>(jobs: (() => Promise<T>)[], size = 6): Promise<T[]> {
  const out: T[] = new Array(jobs.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, jobs.length) }, async () => {
      while (i < jobs.length) {
        const k = i++;
        out[k] = await jobs[k]();
      }
    }),
  );
  return out;
}

export async function buildSnapshot(): Promise<Snapshot> {
  const t0 = Date.now();
  const [tempo, base] = [CHAINS.tempo.id, CHAINS.base.id];

  const [stats, breakdowns, heatHow, heatMode, feed] = await Promise.all([
    pool(CHAIN_KEYS.map((k) => () => api.stats(CHAINS[k].id))),
    pool(CHAIN_KEYS.map((k) => () => api.breakdowns(CHAINS[k].id))),
    pool(CHAIN_KEYS.map((k) => () => api.heatmap(CHAINS[k].id, "hourOfWeek"))),
    pool(CHAIN_KEYS.map((k) => () => api.heatmap(CHAINS[k].id, "mode"))),
    api.feed(tempo, 50),
  ]);
  const seriesJobs = CHAIN_KEYS.flatMap((k) => RANGES.map((r) => () => api.series(CHAINS[k].id, r)));
  const seriesRaw = await pool(seriesJobs, 4);
  const [tasksTempo, tasksBase] = await Promise.all([api.allTasks(tempo), api.allTasks(base)]);

  const series = {} as Snapshot["series"];
  CHAIN_KEYS.forEach((k, ci) => {
    series[k] = {} as Record<Range, SeriesPoint[]>;
    RANGES.forEach((r, ri) => (series[k][r] = seriesPoints(seriesRaw[ci * RANGES.length + ri])));
  });

  return {
    asOf: new Date().toISOString(),
    stats: { tempo: stats[0], base: stats[1] },
    sameAcrossChains: {
      stats: same(stats[0], stats[1]),
      breakdowns: same(breakdowns[0], breakdowns[1]),
      series: same(series.tempo, series.base),
      heatmap: same(heatHow[0], heatHow[1]) && same(heatMode[0], heatMode[1]),
    },
    breakdowns: { tempo: breakdowns[0], base: breakdowns[1] },
    series,
    heatmap: {
      tempo: { hourOfWeek: heatHow[0], mode: heatMode[0] },
      base: { hourOfWeek: heatHow[1], mode: heatMode[1] },
    },
    feed: feed.items,
    chains: { tempo: deriveChain(tasksTempo, t0), base: deriveChain(tasksBase, t0) },
    wallets: { tempo: wallets(tasksTempo), base: wallets(tasksBase) },
    fetchMs: Date.now() - t0,
  };
}
