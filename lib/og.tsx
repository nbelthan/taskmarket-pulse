// Share-card renderer (1200×630) used by every view's opengraph-image.
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CHAINS, CHAIN_KEYS } from "./api";
import type { Snapshot } from "./build";
import type { Race } from "./race";
import { OUTCOMES, OUTCOME_LABEL } from "./derive";
import { C, OUTCOME_COLOR } from "./theme";
import { compact, int, money, pct, utc } from "./format";
import { VIEWS, type ViewId } from "./views";

export const OG_SIZE = { width: 1200, height: 630 };

const font = (f: string) => readFile(join(process.cwd(), "assets/fonts", f));
const markData = () => readFile(join(process.cwd(), "assets/taskmarket-mark.png")).then((b) => `data:image/png;base64,${b.toString("base64")}`);

type Card = { headline: [string, string]; stats: { v: string; l: string; hot?: boolean }[]; spark?: number[]; bars?: { v: number; color: string; l: string }[] };

function cardFor(view: ViewId | "home", s: Snapshot, race: Race | null): Card {
  const t = s.chains.tempo;
  const b = s.chains.base;
  const sum = (f: (k: "tempo" | "base") => number) => CHAIN_KEYS.reduce((a, k) => a + f(k), 0);
  const d30 = s.series.tempo["30d"];
  switch (view) {
    case "home":
    case "flow":
      return {
        headline: ["Where the reward money", "goes."],
        stats: [
          { v: money(t.rewardTotal + b.rewardTotal), l: "rewards put up" },
          { v: money(sum((k) => s.chains[k].byOutcome.completed.reward)), l: "in completed tasks" },
          { v: money(sum((k) => s.chains[k].byOutcome.expired.reward + s.chains[k].byOutcome.cancelled.reward)), l: "expired or cancelled", hot: true },
        ],
        bars: OUTCOMES.map((o) => ({ v: sum((k) => s.chains[k].byOutcome[o].reward), color: OUTCOME_COLOR[o], l: OUTCOME_LABEL[o] })),
      };
    case "race": {
      const c = race?.chains.tempo ?? race?.chains.base ?? null;
      const fmt = (sec: number) => (sec < 3600 ? `${Math.round(sec / 60)} min` : sec < 172800 ? `${(sec / 3600).toFixed(1)} h` : `${(sec / 86400).toFixed(1)} d`);
      return {
        headline: ["Do early entries", "win?"],
        stats: [
          { v: c?.firstQuarterShare != null ? pct(c.firstQuarterShare) : "—", l: "of winners were in the first quarter to arrive", hot: true },
          { v: c?.decision ? fmt(c.decision.median) : "—", l: "median time to a decision" },
          { v: c?.firstEntry ? fmt(c.firstEntry.median) : "—", l: "median wait for the first entry" },
        ],
        bars: c ? c.winnerQuarters.map((v, i) => ({ v, color: i === 0 ? C.paper : C.muted, l: `q${i + 1}` })) : undefined,
      };
    }
    case "pay": {
      const k = t.pay.winners >= b.pay.winners ? "tempo" : "base";
      const p = s.chains[k].pay;
      return {
        headline: ["Who pays", "whom."],
        stats: [
          { v: int(p.winners), l: `${CHAINS[k].name} wallets picked as winner` },
          { v: pct(p.repeatShare), l: "picks of a repeat winner", hot: true },
          { v: money(p.total), l: "completed reward traced" },
        ],
      };
    }
    case "price": {
      const bands = t.price.bands.filter((x) => x.tasks > 0);
      return {
        headline: ["Does paying more", "work?"],
        stats: [
          { v: t.price.rho.toFixed(2), l: "Tempo reward vs entries (rank corr.)" },
          { v: b.price.rho.toFixed(2), l: "Base reward vs entries (rank corr.)" },
          { v: `${int(bands.at(-1)?.medianSubs ?? 0)} vs ${int(bands[0]?.medianSubs ?? 0)}`, l: "median entries: top vs bottom band", hot: true },
        ],
      };
    }
    case "odds": {
      const top = [...t.odds, ...b.odds].sort((x, y) => y.perEntrant - x.perEntrant)[0];
      return {
        headline: ["Best odds", "right now."],
        stats: [
          { v: money(top?.perEntrant ?? 0), l: "reward per entrant, best open task", hot: true },
          { v: int(top?.submissions ?? 0), l: "entries on it so far" },
          { v: int(t.open.count + b.open.count), l: "open tasks scanned" },
        ],
      };
    }
    case "overtime": {
      const avg = d30.reduce((a, p) => a + p.activeAgents, 0) / (d30.length || 1);
      return {
        headline: ["The market,", "day by day."],
        stats: [
          { v: int(avg), l: "active agents / day, 30d" },
          { v: compact(d30.reduce((a, p) => a + p.tasksCreated, 0)), l: "tasks posted, 30d" },
          { v: money(d30.reduce((a, p) => a + p.rewardPaid, 0)), l: "rewards paid, 30d" },
        ],
        spark: d30.map((p) => p.activeAgents),
      };
    }
    case "posters": {
      const lastFull = (k: "tempo" | "base") => s.chains[k].weekly.at(-2)?.posters ?? 0;
      return {
        headline: ["Who posts", "the work."],
        stats: [
          { v: int(lastFull("tempo")), l: "Tempo posters, last full week" },
          { v: int(lastFull("base")), l: "Base posters, last full week" },
          { v: pct(t.concentration.top[1].taskShare), l: "of Tempo tasks from 3 wallets", hot: true },
        ],
        spark: t.weekly.slice(-16).map((w) => w.posters),
      };
    }
    case "swarm": {
      const hot = [...t.open.top, ...b.open.top].sort((x, y) => y.submissions - x.submissions)[0];
      return {
        headline: ["Where agents", "converge."],
        stats: [
          { v: int(hot?.submissions ?? 0), l: "submissions on the top open task" },
          { v: int(t.open.count + b.open.count), l: "open tasks" },
          { v: int(t.open.zeroSubs + b.open.zeroSubs), l: "with no submissions yet" },
        ],
      };
    }
    case "outcomes":
      return {
        headline: ["How tasks", "end."],
        stats: [
          { v: int(sum((k) => s.chains[k].byOutcome.completed.tasks)), l: "completed" },
          { v: int(sum((k) => s.chains[k].byOutcome.open.tasks)), l: "still open" },
          { v: int(sum((k) => s.chains[k].byOutcome.expired.tasks + s.chains[k].byOutcome.cancelled.tasks)), l: "expired or cancelled", hot: true },
        ],
        bars: OUTCOMES.map((o) => ({ v: sum((k) => s.chains[k].byOutcome[o].tasks), color: OUTCOME_COLOR[o], l: OUTCOME_LABEL[o] })),
      };
    case "rhythm": {
      const h = s.heatmap.tempo.hourOfWeek;
      const top = h.cells.reduce((m, c) => (c.count > (m?.count ?? -1) ? c : m), h.cells[0]);
      const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return {
        headline: ["When the market", "works."],
        stats: [
          { v: top ? `${DOW[Number(top.row)]} ${top.col.padStart(2, "0")}:00` : "—", l: "busiest hour, UTC, 30d" },
          { v: int(top?.count ?? 0), l: "events in that hour" },
          { v: int(h.cells.reduce((a, c) => a + c.count, 0)), l: "events, 30 days" },
        ],
      };
    }
    case "feed":
      return {
        headline: ["The market,", "live."],
        stats: [
          { v: int(s.feed.length), l: "latest events shown" },
          { v: int(s.feed.filter((f) => f.type === "task_created").length), l: "new tasks among them" },
          { v: int(new Set(s.feed.map((f) => f.actor)).size), l: "distinct wallets" },
        ],
      };
  }
}

export async function renderCard(view: ViewId | "home", s: Snapshot, race: Race | null = null) {
  const [mark, serif, serifItalic, sans500, sans700, mono] = await Promise.all([
    markData(),
    font("InstrumentSerif-Regular.ttf"),
    font("InstrumentSerif-Italic.ttf"),
    font("InterTight-500.ttf"),
    font("InterTight-700.ttf"),
    font("DepartureMono-Regular.otf"),
  ]);
  const card = cardFor(view, s, race);
  const label = view === "home" ? "Live market data" : VIEWS[view].title;
  const spark = card.spark?.length ? card.spark : null;
  const max = spark ? Math.max(1, ...spark) : 1;
  const sparkPath = spark ? spark.map((v, i) => `${i ? "L" : "M"}${((i * 1040) / Math.max(1, spark.length - 1)).toFixed(1)},${(90 - (v / max) * 84).toFixed(1)}`).join("") : "";
  const barTotal = card.bars?.reduce((a, x) => a + x.v, 0) || 1;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.ground, backgroundImage: `radial-gradient(900px 520px at 0% 0%, ${C.maroon} 0%, rgba(58,20,32,0) 70%)`, color: C.cream, padding: "56px 80px", fontFamily: "Inter Tight" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24 }}>
          <div style={{ display: "flex", fontWeight: 700 }}>Taskmarket Pulse</div>
          <div style={{ display: "flex", fontFamily: "Departure Mono", fontSize: 20, color: C.muted }}>{label}</div>
        </div>
        <div style={{ display: "flex", fontFamily: "Instrument Serif", fontSize: 92, lineHeight: 1.02, marginTop: 34, letterSpacing: -1 }}>
          {card.headline[0]}&nbsp;<span style={{ fontStyle: "italic", color: C.magenta }}>{card.headline[1]}</span>
        </div>
        <div style={{ display: "flex", gap: 56, marginTop: 38 }}>
          {card.stats.map((st) => (
            <div key={st.l} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontFamily: "Departure Mono", fontSize: 54, color: C.paper }}>{st.v}</div>
              <div style={{ display: "flex", fontSize: 22, color: C.muted, marginTop: 4 }}>{st.l}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexGrow: 1, alignItems: "flex-end", marginTop: 24 }}>
          {spark ? (
            <svg width="1040" height="96" viewBox="0 0 1040 96">
              <path d={`${sparkPath}L1040,96L0,96Z`} fill={C.cream} fillOpacity={0.12} />
              <path d={sparkPath} fill="none" stroke={C.cream} strokeWidth={3} />
            </svg>
          ) : card.bars ? (
            <div style={{ display: "flex", width: 1040, height: 30, borderRadius: 8, overflow: "hidden" }}>
              {card.bars.filter((x) => x.v > 0).map((x) => (
                <div key={x.l} style={{ display: "flex", width: `${(100 * x.v) / barTotal}%`, height: 30, background: x.color, marginRight: 3 }} />
              ))}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 26, fontSize: 19, color: C.muted }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: "Departure Mono", color: C.cream }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mark} width={64} height={64} alt="" style={{ borderRadius: 12 }} />
            taskmarket.dev
          </div>
          <div style={{ display: "flex" }}>
            {CHAIN_KEYS.map((k) => CHAINS[k].name).join(" + ")} · data as of {utc(s.asOf)} · unofficial
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Instrument Serif", data: serif, style: "normal", weight: 400 },
        { name: "Instrument Serif", data: serifItalic, style: "italic", weight: 400 },
        { name: "Inter Tight", data: sans500, style: "normal", weight: 500 },
        { name: "Inter Tight", data: sans700, style: "normal", weight: 700 },
        { name: "Departure Mono", data: mono, style: "normal", weight: 400 },
      ],
    },
  );
}

/** Cached PNG bytes for a card, so share images are as fast as the page. */
export async function cardPng(view: ViewId | "home", s: Snapshot, race: Race | null = null): Promise<Uint8Array> {
  "use cache";
  const { cacheLife } = await import("next/cache");
  cacheLife({ stale: 60, revalidate: 600, expire: 60 * 60 * 24 * 7 });
  const res = await renderCard(view, s, race);
  return new Uint8Array(await res.arrayBuffer());
}

export function pngResponse(bytes: Uint8Array) {
  return new Response(bytes as BodyInit, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=86400" } });
}
