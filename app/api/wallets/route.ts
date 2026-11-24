// Per-wallet totals (posted / won) for the wallet lookup, from the same snapshot as the page.
import { getSnapshot } from "@/lib/snapshot";

export async function GET() {
  const s = await getSnapshot();
  return Response.json(
    { asOf: s.asOf, fields: ["tasksPosted", "rewardPosted", "topAwardsWon", "rewardOfTasksWon"], wallets: s.wallets },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } },
  );
}
