// Which section renders each shareable view (used by /v/<view> and /embed/<view>).
import type { ReactNode } from "react";
import type { Race, Snapshot } from "@/lib/snapshot";
import type { ViewId } from "@/lib/views";
import { FeedView, FlowView, OddsView, Outcomes, OverTime, PayView, Posters, PriceView, RaceView, Rhythm, Swarm } from "./sections";

export const RENDER: Record<ViewId, (p: { s: Snapshot; race: Race | null }) => ReactNode> = {
  flow: ({ s }) => <FlowView s={s} />,
  race: ({ race }) => <RaceView race={race} />,
  pay: ({ s }) => <PayView s={s} />,
  price: ({ s }) => <PriceView s={s} />,
  odds: ({ s }) => <OddsView s={s} />,
  overtime: ({ s }) => <OverTime s={s} />,
  posters: ({ s }) => <Posters s={s} />,
  swarm: ({ s }) => <Swarm s={s} />,
  outcomes: ({ s }) => <Outcomes s={s} />,
  rhythm: ({ s }) => <Rhythm s={s} />,
  feed: ({ s }) => <FeedView s={s} />,
};
