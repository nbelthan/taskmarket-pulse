// Live feed proxy: this site's server fetches the Taskmarket feed and caches it
// for 60 s, so browsers never call api.taskmarket.dev directly.
import { getFeed } from "@/lib/snapshot";

export async function GET() {
  const feed = await getFeed();
  return Response.json(feed, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
