// Spot-checks a deployed snapshot against the live API.
// Usage: npm run verify -- https://your-app.vercel.app
// Numbers can drift between the snapshot time and now; small differences on
// fast-moving counts are expected, the check prints both sides.
const site = process.argv[2] ?? "http://localhost:3000";
const API = "https://api.taskmarket.dev";
const j = async (u: string) => (await fetch(u)).json();

async function main() {
  const s = await j(`${site}/api/snapshot`);
  console.log(`snapshot asOf ${s.asOf}\n`);
  const rows: [string, unknown, unknown][] = [];
  for (const [k, id] of [["tempo", 4217], ["base", 8453]] as const) {
    const st = await j(`${API}/api/market/stats?chainId=${id}`);
    rows.push([`${k} paidWorkers`, s.stats[k].paidWorkers, st.paidWorkers]);
    rows.push([`${k} activeWallets`, s.stats[k].activeWallets, st.activeWallets]);
    const bd = await j(`${API}/api/stats/breakdowns?chainId=${id}`);
    const c = (x: { status: string; count: number }[], n: string) => x.find((r) => r.status === n)?.count;
    rows.push([`${k} breakdown completed`, c(s.breakdowns[k].status, "completed"), c(bd.status, "completed")]);
    const ts = await j(`${API}/api/stats/platform-time-series?chainId=${id}&range=30d&bucket=day`);
    const day = ts.at(-2);
    const mine = s.series[k]["30d"].find((p: { day: string }) => p.day === day.bucket);
    rows.push([`${k} activeAgents ${day.bucket}`, mine?.activeAgents, day.activeAgents]);
    rows.push([`${k} tasksCreated ${day.bucket}`, mine?.tasksCreated, day.tasksCreated]);
  }
  for (const [name, a, b] of rows) console.log(`${a === b ? "✓" : "≠"} ${name.padEnd(34)} page=${a}  api=${b}`);
}
main();
