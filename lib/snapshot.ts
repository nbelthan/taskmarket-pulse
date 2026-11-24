import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { api, CHAINS, type FeedItem } from "./api";
import { buildSnapshot, type Snapshot } from "./build";
import { buildRace, type Race } from "./race";

export type { Snapshot, Race };

/**
 * Cached snapshot. Served instantly from cache; after 5 minutes the next
 * request triggers a background rebuild (stale-while-revalidate). If a rebuild
 * fails, the last good snapshot keeps being served.
 */
export async function getSnapshot(): Promise<Snapshot> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 60 * 60 * 24 * 7 });
  cacheTag("snapshot");
  return buildSnapshot();
}

/** The live feed is cached separately, for 60 seconds. */
export async function getFeed(): Promise<{ asOf: string; items: FeedItem[] }> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 60, expire: 60 * 60 });
  cacheTag("feed");
  const f = await api.feed(CHAINS.tempo.id, 50);
  return { asOf: new Date().toISOString(), items: f.items };
}

/**
 * Race data (time to decision, swarm replays) goes one level deeper than the
 * task list, so it is sampled and cached for an hour. A partial result (the API
 * rate-limited us) is kept for 2 minutes only, so a full one replaces it soon.
 */
export async function getRace(): Promise<Race> {
  "use cache";
  cacheTag("race");
  const r = await buildRace();
  if (r.degraded) cacheLife({ stale: 60, revalidate: 120, expire: 60 * 60 * 24 * 7 });
  else cacheLife({ stale: 60, revalidate: 3600, expire: 60 * 60 * 24 * 7 });
  return r;
}
