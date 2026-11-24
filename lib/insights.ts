// Plain-language call-outs generated from the snapshot. No hand-written numbers:
// every figure below is computed from the same snapshot the charts use.
import { CHAINS, CHAIN_KEYS, type ChainKey } from "./api";
import type { Snapshot } from "./build";
import { money, pct, int } from "./format";

export type Insight = { id: string; view: string; kicker: string; text: string; figure: string };

function lastFullWeeks(s: Snapshot, k: ChainKey) {
  // The current week is partial, so compare the last two complete weeks.
  const w = s.chains[k].weekly;
  const thisWeek = w.at(-1);
  const full = w.slice(0, -1);
  return { prev: full.at(-2), last: full.at(-1), thisWeek };
}

export function insights(s: Snapshot): Insight[] {
  const out: Insight[] = [];
  const t = s.chains.tempo;
  const b = s.chains.base;

  // 1. Concentration of posting.
  const busiest = CHAIN_KEYS.map((k) => ({ k, c: s.chains[k].concentration })).sort((x, y) => y.c.top[1].taskShare - x.c.top[1].taskShare)[0];
  out.push({
    id: "concentration",
    view: "posters",
    kicker: "Who posts",
    figure: pct(busiest.c.top[1].taskShare),
    text: `of ${CHAINS[busiest.k].name} tasks come from just 3 of its ${int(busiest.c.posters)} posting wallets. The top wallet alone posted ${pct(busiest.c.top[0].taskShare)}.`,
  });

  // 2. Where new posters are showing up.
  const wk = CHAIN_KEYS.map((k) => ({ k, ...lastFullWeeks(s, k) }));
  const parts = wk
    .filter((x) => x.last)
    .map((x) => `${CHAINS[x.k].name} ${int(x.last!.posters)}${x.prev ? ` (prior week ${int(x.prev.posters)})` : ""}`);
  const lead = wk.filter((x) => x.last).sort((a, c) => c.last!.posters - a.last!.posters)[0];
  if (lead?.last)
    out.push({
      id: "posters-week",
      view: "posters",
      kicker: "Distinct posters, last full week",
      figure: int(lead.last.posters),
      text: `distinct wallets posted on ${CHAINS[lead.k].name} in the week of ${lead.last.week}. Across chains: ${parts.join(", ")}.`,
    });

  // 3. Tasks that died.
  const died = (k: ChainKey) => s.chains[k].byOutcome.expired.tasks + s.chains[k].byOutcome.cancelled.tasks;
  const diedReward = (k: ChainKey) => s.chains[k].byOutcome.expired.reward + s.chains[k].byOutcome.cancelled.reward;
  const worst = [...CHAIN_KEYS].sort((x, y) => died(y) / (s.chains[y].taskCount || 1) - died(x) / (s.chains[x].taskCount || 1))[0];
  out.push({
    id: "died",
    view: "flow",
    kicker: "Tasks that died",
    figure: pct(died(worst) / (s.chains[worst].taskCount || 1)),
    text: `of ${CHAINS[worst].name} tasks expired or were cancelled, with ${money(diedReward(worst))} in rewards never paid out. On ${CHAINS[worst === "tempo" ? "base" : "tempo"].name} it is ${pct(died(worst === "tempo" ? "base" : "tempo") / (s.chains[worst === "tempo" ? "base" : "tempo"].taskCount || 1))}.`,
  });

  // 4. The swarm: how contested open work is.
  const hot = [...t.open.top, ...b.open.top].sort((x, y) => y.submissions - x.submissions)[0];
  if (hot)
    out.push({
      id: "swarm",
      view: "swarm",
      kicker: "Most contested open task",
      figure: int(hot.submissions),
      text: `submissions on one open ${money(hot.reward)} task (${hot.ref ?? hot.id.slice(0, 10)}). Meanwhile ${int(t.open.zeroSubs + b.open.zeroSubs)} open tasks have none yet.`,
    });

  // 5. Growth: active agents, last 7 days vs the 7 before.
  const d30 = s.series.tempo["30d"];
  if (d30.length >= 15) {
    // Skip today's partial bucket.
    const full = d30.slice(0, -1);
    const avg = (xs: number[]) => xs.reduce((a, c) => a + c, 0) / (xs.length || 1);
    const last7 = avg(full.slice(-7).map((p) => p.activeAgents));
    const prev7 = avg(full.slice(-14, -7).map((p) => p.activeAgents));
    const delta = prev7 ? (last7 - prev7) / prev7 : 0;
    out.push({
      id: "growth",
      view: "overtime",
      kicker: "Daily active agents",
      figure: int(Math.round(last7)),
      text: `agents active on an average day over the last 7 full days, ${delta >= 0 ? "up" : "down"} ${pct(Math.abs(delta))} on the 7 days before.`,
    });

    // 6. Paid vs posted over 30 days.
    const posted = full.reduce((a, p) => a + p.rewardPosted, 0);
    const paid = full.reduce((a, p) => a + p.rewardPaid, 0);
    out.push({
      id: "paid",
      view: "overtime",
      kicker: "Paid vs put up, 30 days",
      figure: money(paid),
      text: `paid out to workers against ${money(posted)} in new rewards put up over the last 30 full days.`,
    });
  }

  // 7. Pricing: does reward pull entries?
  const pk = Math.abs(t.price.rho) >= Math.abs(b.price.rho) ? "tempo" : "base";
  const pr = s.chains[pk].price;
  const live = pr.bands.filter((x) => x.tasks >= 5);
  if (live.length >= 2) {
    const lo = live[0];
    const hi = live[live.length - 1];
    out.push({
      id: "price",
      view: "price",
      kicker: "Does paying more work?",
      figure: `${int(hi.medianSubs)} vs ${int(lo.medianSubs)}`,
      text: `median entries on ${CHAINS[pk].name} tasks paying ${hi.label} vs ${lo.label}. Rank correlation between reward and entries: ${pr.rho.toFixed(2)}.`,
    });
  }

  // 8. Repeat relationships between posters and winners.
  const rk = t.pay.completedWithWinner >= b.pay.completedWithWinner ? "tempo" : "base";
  out.push({
    id: "repeat",
    view: "pay",
    kicker: "Posters going back",
    figure: pct(s.chains[rk].pay.repeatShare),
    text: `of completed ${CHAINS[rk].name} tasks went to a wallet the same poster had already picked. ${int(s.chains[rk].pay.winners)} wallets have been picked at least once.`,
  });

  // 9. Least crowded money.
  const best = [...t.odds, ...b.odds].sort((x, y) => y.perEntrant - x.perEntrant)[0];
  if (best)
    out.push({
      id: "odds",
      view: "odds",
      kicker: "Least crowded money",
      figure: money(best.perEntrant),
      text: `per entrant on an open ${money(best.reward)} task with ${int(best.submissions)} entries so far (${best.ref ?? best.id.slice(0, 10)}).`,
    });

  return out;
}
