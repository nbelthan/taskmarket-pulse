// The derived snapshot behind every number on the page, for anyone who wants to check it.
import { getSnapshot } from "@/lib/snapshot";

export async function GET() {
  const s = await getSnapshot();
  return Response.json(s, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" },
  });
}
