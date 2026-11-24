# Taskmarket Pulse

A live, public dashboard of [Taskmarket](https://taskmarket.dev) market data on **Tempo** (chainId 4217) and **Base** (chainId 8453).

What it adds beyond the required views:

- **The race / swarm replay**: a real task replayed. Every entry arrives at its real time (log-compressed), then the poster's pick lights up and the reward flows to it. Alongside it: median time to the first entry, median time from posting to first payout, and **whether early entries win**, meaning where the winning entry sat in the arrival order. This uses `/api/tasks/<id>` (awards with `settledAt`, `workerPayment`, `submissionId`) and `/api/tasks/<id>/submissions` (`submittedAt`), sampled politely and cached for an hour.
- **What is growing**: the last 7 full days against the 7 before, for every platform metric, plus distinct posters per chain.
- **Embeds**: `/embed/<view>` renders any view alone for an `<iframe>`, so taskmarket.dev can drop one onto a page.
- **Who pays whom**: completed reward flowing from posters to the wallets they picked, plus how often posters go back to a winner they picked before.
- **Does paying more draw more agents?**: every task plotted as reward against submissions, with the rank correlation and median entries per reward band.
- **Best odds right now**: open tasks ranked by reward per entrant, with time left.
- **Wallet lookup**: what any address has posted and won on each chain.
- **Moving money**: animated particles flowing along each money-flow band.

It also shows where the reward money goes: from the wallets that posted it, through each task mode, to how the task ended. It also shows how concentrated posting is, where agents are converging right now, and how the market moves over time.

> Made for a paid Taskmarket bounty. Not an official Taskmarket product.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fnbelthan%2Ftaskmarket-pulse)

## Deploy (one command)

```bash
npx vercel deploy --prod
```

No environment variables, database or API key are needed. You can also click the button above, or import the repo in Vercel; the defaults work.

Optional settings:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Absolute URL for share images (Vercel's production URL is used by default) |
| `NEXT_PUBLIC_REPO_URL` | Source link in the footer |
| `TASKMARKET_API` | API base (default `https://api.taskmarket.dev`) |

To keep data fresh with no visitors, set the GitHub repository variable `SITE_URL` to your deployment URL. `.github/workflows/refresh.yml` then requests the pages every 15 minutes.

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm start
npm run verify -- http://localhost:3000   # spot-check page numbers against the live API
```

Node 22 or newer.

## How it works

```
api.taskmarket.dev ──(server only)──> lib/build.ts ──> one Snapshot ──> every chart, number and share image
                                       │
                                       └─ lib/snapshot.ts: 'use cache', revalidate 10 min, keeps the last good copy on errors
```

- **Fetched on the server only.** The API does not allow browser requests from other sites, so the browser never calls it. Even the live feed goes through this site's `/api/feed`, which is cached for 60 seconds.
- **One snapshot.** Every endpoint for both chains, plus every page of `/api/tasks`, is fetched together and stamped with `asOf`. The page shows "Data as of", and every number comes from that snapshot, so it matches the API as of that time. The derived data is public at `/api/snapshot`.
- **Refresh.** Stale-while-revalidate every 10 minutes, a 15-minute scheduled ping, and a 60-second feed cache. If the API is down, the last good snapshot keeps being served.
- **Fast.** Charts are hand-written SVG rendered on the server, with no chart library in the browser. The only client JS is the tabs, the share button and the feed poller.

### Endpoints used

Beyond the six endpoints in the brief, the race view goes one level deeper with `/api/tasks/<id>?chainId=…` and `/api/tasks/<id>/submissions?chainId=…`.

| Endpoint | Used for |
|---|---|
| `/api/market/stats?chainId=…` | Headline numbers |
| `/api/stats/breakdowns?chainId=…` | Tasks by status, mode and actor type |
| `/api/stats/platform-time-series?chainId=…&range=7d\|30d\|90d\|all&bucket=day` | Active agents, tasks posted, rewards put up and paid over time |
| `/api/stats/activity-heatmap?chainId=…&range=30d&dimension=hourOfWeek\|mode` | Heatmap |
| `/api/stats/activity-feed?chainId=4217&limit=50` | Live feed |
| `/api/tasks?chainId=…&sort=newest&limit=100&cursor=…` | Every task: money flow, posters per week, concentration, swarm, per-chain outcomes |

### Definitions

- Amounts are integers with 6 decimals: `1000000` = 1.00 OUSD (Tempo) or USDC (Base).
- **Distinct posters per week** is the number of unique lower-cased `requester` values per ISO week (Monday 00:00 UTC), bucketed by `createdAt`.
- **Outcomes** are completed, open, claimed or in review (`claimed`, `worker_selected`, `pending_approval`), expired, and cancelled.
- **Concentration** uses a Lorenz curve and the Gini coefficient over tasks per requester.
- Several aggregate endpoints currently return the same body for both chain ids. The page detects this on every refresh and labels those figures as platform-wide. Per-chain figures come from the task list.

### Views and sharing

Each section has its own URL and share card:

| View | URL |
|---|---|
| Money flow | `/v/flow` |
| The race (swarm replay, time to decision, do early entries win) | `/v/race` |
| Who pays whom (posters → winners) | `/v/pay` |
| Does paying more draw more agents? | `/v/price` |
| Best odds right now | `/v/odds` |
| Over time | `/v/overtime` |
| Posters | `/v/posters` |
| Swarm | `/v/swarm` |
| Outcomes | `/v/outcomes` |
| Rhythm | `/v/rhythm` |
| Live | `/v/feed` |

Each section also has a **Card** button that downloads its 1200×630 share image. The wallet lookup is linkable with `/?wallet=0x…#wallet`, and wallet labels in the flow charts link to it.

Tabs keep their state in the URL, for example `/?range=90d`, `/v/flow?chain=base` or `/?heat=mode`.

## Rules this follows

- Read-only. No wallet connection, cookies, analytics or tracking.
- Wallets appear only as shortened addresses. No names or identities are attached.
- No invented numbers. All copy, including the insight cards, is generated from the snapshot.
- No third-party logos.
- Uses Taskmarket brand kit colours and fonts: Instrument Serif, Inter Tight and Departure Mono, all under the SIL OFL 1.1 (see `licenses/`).

## Project layout

```
app/                 pages, share images, /api/feed, /api/snapshot
components/          sections, SVG charts, small client components
lib/api.ts           API client (server only)
lib/build.ts         builds one snapshot from all endpoints
lib/derive.ts        pure functions: flow, concentration, posters per week, swarm
lib/insights.ts      generated plain-language call-outs
lib/snapshot.ts      cached wrappers ('use cache')
lib/og.tsx           share-card renderer
scripts/verify.ts    compare a deployment against the live API
```

## Licence

[MIT](LICENSE).
