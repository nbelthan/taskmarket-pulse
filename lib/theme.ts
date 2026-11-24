// Chart colours, all taken from the Taskmarket brand kit (or opacity of them).
// Magenta is reserved for one meaning across the page: money that never got
// paid out (expired / cancelled) — plus the single italic word in headlines.
import type { ChainKey } from "./api";
import type { Outcome } from "./derive";

export const C = {
  ground: "#12100E",
  maroon: "#3A1420",
  panel: "#221E1A",
  line: "#453E37",
  cream: "#EFE9E2",
  paper: "#FFF6E8",
  muted: "#B0A79D",
  magenta: "#E74079",
  salmon: "#D9A097",
};

export const CHAIN_COLOR: Record<ChainKey, string> = { tempo: C.cream, base: C.salmon };

export const OUTCOME_COLOR: Record<Outcome, string> = {
  completed: C.paper,
  open: C.salmon,
  in_progress: C.muted,
  expired: "rgba(231,64,121,0.55)",
  cancelled: C.magenta,
};

export const MODE_COLOR: Record<string, string> = {
  bounty: C.cream,
  claim: C.salmon,
  pitch: C.muted,
  benchmark: "rgba(239,233,226,0.45)",
  auction: "rgba(217,160,151,0.5)",
};

export const STATUS_COLOR: Record<string, string> = {
  completed: C.paper,
  open: C.salmon,
  claimed: C.muted,
  worker_selected: "rgba(176,167,157,0.75)",
  pending_approval: "rgba(176,167,157,0.55)",
  expired: "rgba(231,64,121,0.55)",
  cancelled: C.magenta,
};
