// Page sections. All server components reading one snapshot.
import type { ReactNode } from "react";
import { CHAINS, CHAIN_KEYS, API_BASE, type ChainKey } from "@/lib/api";
import type { Snapshot } from "@/lib/snapshot";
import { OUTCOMES, OUTCOME_LABEL, MODES, shortAddr } from "@/lib/derive";
import { insights } from "@/lib/insights";
import { C, CHAIN_COLOR, MODE_COLOR, OUTCOME_COLOR, STATUS_COLOR } from "@/lib/theme";
import { compact, int, money, pct, utc } from "@/lib/format";
import { VIEWS, type ViewId } from "@/lib/views";
import { FlowSankey } from "./FlowSankey";
import { AreaChart, BarList, HeatGrid, Hive, Lorenz, StackBar, WeeklyBars } from "./charts";
import { Ago, ShareButton, Tabs } from "./client";
import { LiveFeed } from "./LiveFeed";

export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/nbelthan/taskmarket-pulse";

function Section({ id, kicker, sub, children, source, extra }: { id: ViewId; kicker: string; sub?: ReactNode; children: ReactNode; source?: ReactNode; extra?: ReactNode }) {
  return (
    <section className="section" id={id} aria-labelledby={`${id}-h`}>
      <div className="sechead">
        <div>
          <div className="kicker">{kicker}</div>
          <h2 id={`${id}-h`}>{VIEWS[id].title}</h2>
          {sub ? <p className="sub">{sub}</p> : null}
        </div>
        <div className="actions">
          {extra}
          <a className="sharebtn" href={`/v/${id}`}>
            Open view
          </a>
          <ShareButton path={`/v/${id}`} title={VIEWS[id].title} />
        </div>
      </div>
      {children}
      {source ? <p className="source">Source: {source}</p> : null}
    </section>
  );
}

const Code = ({ children }: { children: ReactNode }) => <code>{children}</code>;
const ChainDot = ({ k }: { k: ChainKey }) => <i className="swatch" style={{ background: CHAIN_COLOR[k] }} />;

// ------------------------------------------------------------------ header + hero
export function Header({ s }: { s: Snapshot }) {
  return (
    <header className="wrap top">
      <a href="/" className="brandline">
        <b>Taskmarket Pulse</b>
        <span className="mono muted" style={{ fontSize: 13 }}>
          for taskmarket.dev
        </span>
      </a>
      <span className="asof" title="Every number on this page comes from one API snapshot taken at this time">
        <i className="dot" aria-hidden="true" />
        Data as of <time className="mono" dateTime={s.asOf}>{utc(s.asOf)}</time>
        <Ago iso={s.asOf} />
      </span>
    </header>
  );
}

export function Nav() {
  return (
    <nav className="nav" aria-label="Views">
      {(Object.keys(VIEWS) as ViewId[]).map((v) => (
        <a key={v} href={`/#${v}`}>
          {VIEWS[v].short}
        </a>
      ))}
      <a href="/#methods">Methods</a>
    </nav>
  );
}

export function Hero({ s }: { s: Snapshot }) {
  const t = s.chains.tempo;
  const b = s.chains.base;
  const total = t.rewardTotal + b.rewardTotal;
  const paid = t.byOutcome.completed.reward + b.byOutcome.completed.reward;
  const died = t.byOutcome.expired.reward + t.byOutcome.cancelled.reward + b.byOutcome.expired.reward + b.byOutcome.cancelled.reward;
  return (
    <div className="wrap hero">
      <Nav />
      <h1>
        Where the reward money <span className="accent">goes.</span>
      </h1>
      <p className="lede">
        <strong>{money(total)}</strong> in rewards has been put up across <strong>{int(t.taskCount + b.taskCount)}</strong> tasks on Tempo and Base.{" "}
        <strong>{money(paid)}</strong> sits in tasks that completed, and <strong style={{ color: C.magenta }}>{money(died)}</strong> in tasks that
        expired or were cancelled. Follow it from the wallets that posted it, through each task mode, to how it ended.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------ flow
export function FlowView({ s }: { s: Snapshot }) {
  const pane = (k: ChainKey) => {
    const c = s.chains[k];
    return (
      <div className="panel">
        <div className="legend">
          {OUTCOMES.map((o) => (
            <span key={o}>
              <i className="swatch" style={{ background: OUTCOME_COLOR[o] }} />
              {OUTCOME_LABEL[o]} <span className="mono" style={{ color: C.paper }}>{money(c.byOutcome[o].reward)}</span>
            </span>
          ))}
        </div>
        <div className="only-desktop">
          <FlowSankey flow={c.flow} title={`${CHAINS[k].name}: reward money from posters through task modes to outcomes`} />
        </div>
        <div className="only-mobile">
          <FlowSankey flow={c.flow} compact title={`${CHAINS[k].name}: reward money from posters to outcomes`} />
        </div>
        <p className="source" style={{ marginTop: 8 }}>
          Left: the 5 wallets that put up the most reward on {CHAINS[k].name}, then everyone else. {k === "tempo" ? "Middle: task mode. " : "Middle: task mode. "}Right: where the
          task stands now. Band width = reward in {CHAINS[k].token}. {int(c.taskCount)} tasks, {money(c.rewardTotal)} in total.
        </p>
      </div>
    );
  };
  return (
    <Section
      id="flow"
      kicker="01 · Money flow"
      sub="Every task's reward, from the wallet that posted it to how the task ended. Wallets are shown only as addresses."
      source={
        <>
          every task from <Code>/api/tasks?chainId=…&sort=newest&limit=100</Code>, all pages. Reward = <Code>reward</Code> ÷ 10⁶.
        </>
      }
    >
      <Tabs label="Chain" param="chain" tabs={CHAIN_KEYS.map((k) => ({ key: k, label: CHAINS[k].name, content: pane(k) }))} />
    </Section>
  );
}

// ------------------------------------------------------------------ KPIs
export function Kpis({ s }: { s: Snapshot }) {
  const st = s.stats.tempo;
  const kpi = (v: string, l: string, sub?: string) => (
    <div className="kpi">
      <div className="v">{v}</div>
      <div className="l">{l}</div>
      {sub ? <div className="s">{sub}</div> : null}
    </div>
  );
  return (
    <section className="wrap section" style={{ paddingTop: 28 }} aria-label="Headline numbers">
      <div className="kicker" style={{ marginBottom: 10 }}>
        Headline numbers{s.sameAcrossChains.stats ? "" : " · platform-wide fields from /api/market/stats"}
      </div>
      <div className="kpis">
        {kpi(compact(st.registeredWorkers), "Registered workers", "all chains")}
        {kpi(int(st.activeAgents7d), "Active agents, 7 days", "all chains")}
        {kpi(int(st.activeWorkers7d), "Active workers, 7 days", "all chains")}
        {kpi(int(st.openTasks), "Open tasks", "as reported by /market/stats")}
        {kpi(`${int(s.stats.tempo.paidWorkers)} / ${int(s.stats.base.paidWorkers)}`, "Paid workers", "Tempo / Base")}
        {kpi(`${compact(s.stats.tempo.activeWallets)} / ${compact(s.stats.base.activeWallets)}`, "Active wallets", "Tempo / Base")}
      </div>
      <div className="chaincards">
        {CHAIN_KEYS.map((k) => {
          const c = s.chains[k];
          return (
            <div className="panel chaincard" key={k}>
              <h3>
                <ChainDot k={k} /> {CHAINS[k].name} <span className="mono muted" style={{ fontSize: 12, fontWeight: 400 }}>chainId {CHAINS[k].id} · {CHAINS[k].token}</span>
              </h3>
              <dl>
                <div><dt>Tasks</dt><dd>{int(c.taskCount)}</dd></div>
                <div><dt>Rewards put up</dt><dd>{money(c.rewardTotal)}</dd></div>
                <div><dt>Posting wallets</dt><dd>{int(c.postersTotal)}</dd></div>
                <div><dt>Open now</dt><dd>{int(c.open.count)}</dd></div>
                <div><dt>Completed</dt><dd>{int(c.byOutcome.completed.tasks)}</dd></div>
                <div><dt>Distinct winners</dt><dd>{int(c.winners.distinctWinners)}</dd></div>
              </dl>
            </div>
          );
        })}
      </div>
      <p className="source">
        Source: top row from <Code>/api/market/stats?chainId=…</Code>
        {s.sameAcrossChains.stats ? "" : " (registered workers, active agents/workers and open tasks are identical for both chain ids, so they are shown once as platform-wide; paid workers and active wallets differ by chain and are shown per chain)"}. Chain cards computed from{" "}
        <Code>/api/tasks</Code>.
      </p>
    </section>
  );
}

// ------------------------------------------------------------------ insights
export function Insights({ s }: { s: Snapshot }) {
  const list = insights(s);
  return (
    <section className="wrap section" aria-labelledby="insights-h">
      <div className="kicker">What the numbers say</div>
      <h2 id="insights-h" className="serif" style={{ fontSize: "clamp(30px,4.2vw,44px)", margin: "4px 0 16px", lineHeight: 1.05 }}>
        Not obvious at a glance
      </h2>
      <div className="insights">
        {list.map((i, n) => (
          <a key={i.id} href={`/#${i.view}`} className={`insight${n === 0 ? " lead" : ""}`}>
            <div className="kicker">{i.kicker}</div>
            <div className="fig">{i.figure}</div>
            <p>{i.text}</p>
          </a>
        ))}
      </div>
      <p className="source">Each line is generated from the same snapshot as the charts; nothing is written by hand.</p>
    </section>
  );
}

// ------------------------------------------------------------------ over time
const METRICS = [
  { key: "activeAgents", label: "Daily active agents", color: C.cream, agg: "avg", fmt: compact },
  { key: "tasksCreated", label: "Tasks posted", color: C.salmon, agg: "sum", fmt: compact },
  { key: "rewardPosted", label: "Rewards put up", color: C.paper, agg: "sum", fmt: money },
  { key: "rewardPaid", label: "Rewards paid", color: C.muted, agg: "sum", fmt: money },
] as const;

export function OverTime({ s }: { s: Snapshot }) {
  const pane = (r: "7d" | "30d" | "90d" | "all") => {
    const pts = s.series.tempo[r];
    return (
      <div className="multiples">
        {METRICS.map((m) => {
          const vals = pts.map((p) => p[m.key]);
          const sum = vals.reduce((a, b) => a + b, 0);
          const v = m.agg === "avg" ? sum / (vals.length || 1) : sum;
          return (
            <div className="panel multiple" key={m.key}>
              <div className="row">
                <h3>{m.label}</h3>
                <span>
                  <span className="big">{m.fmt(v)}</span> <span className="muted" style={{ fontSize: 12 }}>{m.agg === "avg" ? "avg / day" : "total"}</span>
                </span>
              </div>
              <AreaChart points={pts.map((p) => ({ x: p.day, y: p[m.key] }))} color={m.color} format={m.fmt} label={`${m.label}, ${r}, by day`} />
            </div>
          );
        })}
      </div>
    );
  };
  return (
    <Section
      id="overtime"
      kicker="02 · Over time"
      sub={`Day by day (UTC). The last day is still in progress.${s.sameAcrossChains.series ? " The API returns the same series for both chain ids, so this is the whole platform." : ""}`}
      source={
        <>
          <Code>/api/stats/platform-time-series?chainId=…&range=7d|30d|90d|all&bucket=day</Code>. Rewards = <Code>rewardVolume</Code>, paid = <Code>paidVolume</Code>, both ÷ 10⁶.
        </>
      }
    >
      <Tabs label="Range" param="range" tabs={(["30d", "7d", "90d", "all"] as const).map((r) => ({ key: r, label: r === "all" ? "All time" : r, content: pane(r) }))} />
    </Section>
  );
}

// ------------------------------------------------------------------ posters
export function Posters({ s }: { s: Snapshot }) {
  const weeks = [...new Set(CHAIN_KEYS.flatMap((k) => s.chains[k].weekly.map((w) => w.week)))].sort().slice(-16);
  return (
    <Section
      id="posters"
      kicker="03 · Posters"
      sub="How many different wallets post work each week, and how much of the work comes from a few of them."
      source={
        <>
          computed from every task in <Code>/api/tasks</Code>: distinct <Code>requester</Code> per ISO week (Monday, UTC) of <Code>createdAt</Code>.
        </>
      }
    >
      <div className="grid2 w32">
        <div className="panel">
          <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>Distinct task posters per week</h3>
          <div className="legend">
            {CHAIN_KEYS.map((k) => (
              <span key={k}>
                <ChainDot k={k} /> {CHAINS[k].name}
              </span>
            ))}
            <span>faded = week in progress</span>
          </div>
          <WeeklyBars
            weeks={weeks}
            label="Distinct task posters per week, Tempo and Base"
            series={CHAIN_KEYS.map((k) => ({ name: CHAINS[k].name, color: CHAIN_COLOR[k], values: Object.fromEntries(s.chains[k].weekly.map((w) => [w.week, w.posters])) }))}
          />
          <table className="sr">
            <caption>Distinct posters per week</caption>
            <thead><tr><th>Week</th>{CHAIN_KEYS.map((k) => <th key={k}>{CHAINS[k].name}</th>)}</tr></thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w}><td>{w}</td>{CHAIN_KEYS.map((k) => <td key={k}>{s.chains[k].weekly.find((x) => x.week === w)?.posters ?? 0}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>How concentrated posting is</h3>
          <div className="legend">
            {CHAIN_KEYS.map((k) => (
              <span key={k}>
                <ChainDot k={k} /> {CHAINS[k].name} · Gini <span className="mono" style={{ color: C.paper }}>{s.chains[k].concentration.gini.toFixed(2)}</span>
              </span>
            ))}
          </div>
          <Lorenz label="Lorenz curve of tasks per posting wallet" curves={CHAIN_KEYS.map((k) => ({ name: CHAINS[k].name, color: CHAIN_COLOR[k], points: s.chains[k].concentration.lorenz, gini: s.chains[k].concentration.gini }))} />
          <BarList
            valueFmt={(n) => pct(n)}
            rows={CHAIN_KEYS.flatMap((k) =>
              s.chains[k].concentration.top.filter((t) => t.n !== 10).map((t) => ({ label: `${CHAINS[k].name}, top ${t.n}`, note: "", value: t.taskShare, color: CHAIN_COLOR[k] })),
            )}
          />
          <p className="source">Share of all tasks posted by the busiest 1 and 3 wallets. Gini 0 = everyone posts the same amount, 1 = one wallet posts everything.</p>
        </div>
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ swarm
export function Swarm({ s }: { s: Snapshot }) {
  const pane = (k: ChainKey) => {
    const c = s.chains[k];
    const maxR = Math.max(1, ...c.open.top.map((t) => t.reward));
    return (
      <div className="panel">
        <p className="sub" style={{ marginTop: 0, marginBottom: 14 }}>
          {int(c.open.count)} open tasks on {CHAINS[k].name} hold {money(c.open.reward)}. Median submissions per open task:{" "}
          <span className="mono" style={{ color: C.paper }}>{int(c.open.medianSubs)}</span>. {int(c.open.zeroSubs)} have none yet.
        </p>
        {c.open.top.length ? (
          <div className="swarm">
            {c.open.top.map((t) => (
              <a key={t.id} className="hive" href={`https://taskmarket.dev/tasks/${t.id}`} target="_blank" rel="noopener noreferrer">
                <Hive submissions={t.submissions} reward={t.reward} maxReward={maxR} />
                <div className="t">{t.title}</div>
                <div className="m">
                  <span>
                    <span className="mono">{int(t.submissions)}</span> submissions
                  </span>
                  <span className="mono">{money(t.reward)}</span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="muted">No open tasks right now.</p>
        )}
      </div>
    );
  };
  return (
    <Section
      id="swarm"
      kicker="04 · Swarm"
      sub="The open tasks drawing the most agents. Each dot is one submission spiralling in on the task; the centre is sized by reward. Tap a task to open it on taskmarket.dev."
      source={
        <>
          open tasks from <Code>/api/tasks?status=open</Code> (via the full task list), ranked by <Code>submissionCount</Code>.
        </>
      }
    >
      <Tabs label="Chain" tabs={CHAIN_KEYS.map((k) => ({ key: k, label: CHAINS[k].name, content: pane(k) }))} />
    </Section>
  );
}

// ------------------------------------------------------------------ outcomes
export function Outcomes({ s }: { s: Snapshot }) {
  const bd = s.breakdowns.tempo;
  const statusOrder = ["completed", "open", "claimed", "worker_selected", "pending_approval", "expired", "cancelled"];
  const st = [...bd.status].sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));
  const nice = (x: string) => x.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  return (
    <Section
      id="outcomes"
      kicker="05 · Outcomes"
      sub={s.sameAcrossChains.breakdowns ? "Platform totals from the breakdowns endpoint (it returns the same counts for both chain ids), then each chain from its own task list." : undefined}
      source={
        <>
          totals: <Code>/api/stats/breakdowns?chainId=…</Code>. Per chain: counted from <Code>/api/tasks</Code>. The two can differ slightly because the breakdowns may include
          tasks the public list does not return.
        </>
      }
    >
      <div className="grid2">
        <div className="panel">
          <h3 style={{ margin: 0, fontSize: 15 }}>By status · platform</h3>
          <StackBar label="Tasks by status" parts={st.map((x) => ({ key: x.status, label: nice(x.status), value: x.count, color: STATUS_COLOR[x.status] ?? C.muted }))} />
          <h3 style={{ margin: "18px 0 8px", fontSize: 15 }}>By mode · platform</h3>
          <BarList rows={[...bd.mode].sort((a, b) => b.count - a.count).map((m) => ({ label: nice(m.mode), value: m.count, color: MODE_COLOR[m.mode] ?? C.muted }))} />
          <h3 style={{ margin: "18px 0 8px", fontSize: 15 }}>By actor type · platform</h3>
          <BarList rows={bd.actorType.map((a) => ({ label: nice(a.actorType), value: a.count, color: a.actorType === "agent" ? C.cream : C.salmon }))} />
        </div>
        <div className="panel">
          {CHAIN_KEYS.map((k) => {
            const c = s.chains[k];
            return (
              <div key={k} style={{ marginBottom: 18 }}>
                <h3 style={{ margin: 0, fontSize: 15, display: "flex", gap: 8, alignItems: "center" }}>
                  <ChainDot k={k} /> {CHAINS[k].name} · {int(c.taskCount)} tasks
                </h3>
                <StackBar label={`${CHAINS[k].name} tasks by outcome`} parts={OUTCOMES.map((o) => ({ key: o, label: OUTCOME_LABEL[o], value: c.byOutcome[o].tasks, color: OUTCOME_COLOR[o] }))} />
                <BarList rows={MODES.filter((m) => c.byMode[m]).map((m) => ({ label: nice(m), value: c.byMode[m].tasks, color: MODE_COLOR[m], note: money(c.byMode[m].reward) }))} />
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ heatmap
export function Rhythm({ s }: { s: Snapshot }) {
  const h = s.heatmap.tempo;
  return (
    <Section
      id="rhythm"
      kicker="06 · Rhythm"
      sub={`Activity over the last 30 days, by hour of the week (UTC) or by task mode per day. The outlined cell is the busiest.${s.sameAcrossChains.heatmap ? " Same for both chain ids: platform-wide." : ""}`}
      source={
        <>
          <Code>/api/stats/activity-heatmap?chainId=…&range=30d&dimension=hourOfWeek|mode</Code>. Rows 0–6 read as Sunday–Saturday.
        </>
      }
    >
      <div className="panel">
        <Tabs
          label="Heatmap dimension"
          param="heat"
          tabs={[
            { key: "hour", label: "Hour of week", content: <div style={{ overflowX: "auto" }}><div style={{ minWidth: 520 }}><HeatGrid heat={h.hourOfWeek} kind="hourOfWeek" label="Activity by day and hour, UTC" /></div></div> },
            { key: "mode", label: "By mode", content: <div style={{ overflowX: "auto" }}><div style={{ minWidth: 520 }}><HeatGrid heat={h.mode} kind="mode" label="Activity by task mode and day" /></div></div> },
          ]}
        />
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ feed
export function FeedView({ s }: { s: Snapshot }) {
  return (
    <Section
      id="feed"
      kicker="07 · Live"
      sub="The latest events across the market, newest first. Addresses only; no names are attached to wallets."
      source={
        <>
          <Code>/api/stats/activity-feed?chainId=4217&limit=50</Code>, fetched by this site&apos;s server and cached for 60 seconds (events from both chains appear in it).
        </>
      }
    >
      <div className="panel">
        <LiveFeed initial={s.feed} initialAsOf={s.asOf} />
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ methods + footer
export function Methods({ s }: { s: Snapshot }) {
  const eps = [
    "/api/market/stats?chainId={4217|8453}",
    "/api/stats/breakdowns?chainId={4217|8453}",
    "/api/stats/platform-time-series?chainId={4217|8453}&range={7d|30d|90d|all}&bucket=day",
    "/api/stats/activity-heatmap?chainId={4217|8453}&range=30d&dimension={hourOfWeek|mode}",
    "/api/stats/activity-feed?chainId=4217&limit=50",
    "/api/tasks?chainId={4217|8453}&sort=newest&limit=100&cursor=… (every page)",
  ];
  return (
    <section className="wrap section" id="methods" aria-labelledby="methods-h">
      <div className="kicker">Methods</div>
      <h2 id="methods-h" className="serif" style={{ fontSize: "clamp(30px,4.2vw,44px)", margin: "4px 0 10px", lineHeight: 1.05 }}>
        How this is made
      </h2>
      <div className="panel methods">
        <p style={{ marginTop: 0 }}>
          All data comes from the public Taskmarket API at <code>{API_BASE}</code>, fetched on this site&apos;s server, never from your browser. One snapshot is taken of
          every endpoint below and every number on the page comes from it, so the page matches the API as of <code>{utc(s.asOf)}</code>.
        </p>
        <h3>Endpoints</h3>
        <ul>
          {eps.map((e) => (
            <li key={e}>
              <code>{e}</code>
            </li>
          ))}
        </ul>
        <h3>Refresh</h3>
        <ul>
          <li>The snapshot is cached and rebuilt in the background at most every 10 minutes when the page is requested; a scheduled job requests it every 15 minutes, so data is never more than about 30 minutes old. If a rebuild fails, the last good snapshot stays up.</li>
          <li>The live feed is cached for 60 seconds and the page re-checks it every 60 seconds.</li>
          <li>This snapshot took {int(s.fetchMs)} ms to build. The raw derived data is at <a href="/api/snapshot">/api/snapshot</a>.</li>
        </ul>
        <h3>Definitions</h3>
        <ul>
          <li>Amounts are integers with 6 decimals (<code>1000000</code> = 1.00 OUSD or USDC) and are shown in dollars.</li>
          <li>Distinct posters per week: unique <code>requester</code> addresses (lower-cased) per ISO week starting Monday 00:00 UTC, by <code>createdAt</code>.</li>
          <li>Outcomes: completed; open; claimed / in review (<code>claimed</code>, <code>worker_selected</code>, <code>pending_approval</code>); expired; cancelled.</li>
          <li>Winners: <code>primaryAward.workerAddress</code> on completed tasks.</li>
          <li>Concentration: Lorenz curve and Gini coefficient over tasks per requester.</li>
          {Object.values(s.sameAcrossChains).some(Boolean) ? (
            <li>
              The API returned identical results for both chain ids on:{" "}
              {Object.entries(s.sameAcrossChains).filter(([, v]) => v).map(([k]) => k).join(", ")}. Those are shown once, labelled platform-wide. Per-chain figures come from the
              task list, which does differ by chain.
            </li>
          ) : null}
        </ul>
        <h3>Privacy</h3>
        <p style={{ margin: 0 }}>Read-only. No wallet connection, no cookies, no analytics or tracking. Wallets appear only as shortened addresses; no names or identities are attached to them.</p>
      </div>
    </section>
  );
}

export function Footer({ s }: { s: Snapshot }) {
  return (
    <footer className="wrap foot">
      <p className="disclaimer">Made for a paid Taskmarket bounty. Not an official Taskmarket product.</p>
      <div className="row">
        <span>
          Data as of <span className="mono">{utc(s.asOf)}</span> · from the public API at <span className="mono">api.taskmarket.dev</span>
        </span>
        <span>
          <a href={REPO_URL}>Source code (MIT)</a> · <a href="/#methods">Methods</a> · <span className="mono">taskmarket.dev</span>
        </span>
      </div>
    </footer>
  );
}

export { shortAddr };
