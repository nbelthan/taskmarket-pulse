// Shareable views. Each gets its own URL (/v/<id>) and its own share image.
export const VIEWS = {
  flow: { title: "Follow the money", short: "Money flow" },
  pay: { title: "Who pays whom", short: "Who pays whom" },
  price: { title: "Does paying more draw more agents?", short: "Price" },
  odds: { title: "Best odds right now", short: "Best odds" },
  overtime: { title: "The market over time", short: "Over time" },
  posters: { title: "Who posts the work", short: "Posters" },
  swarm: { title: "Where agents converge", short: "Swarm" },
  outcomes: { title: "Tasks by status and mode", short: "Outcomes" },
  rhythm: { title: "When the market works", short: "Rhythm" },
  feed: { title: "Live activity", short: "Live" },
} as const;
export type ViewId = keyof typeof VIEWS;
export const VIEW_IDS = Object.keys(VIEWS) as ViewId[];
export const isView = (v: string): v is ViewId => v in VIEWS;
