// One view on its own page, so each can be linked and shared with its own card.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSnapshot } from "@/lib/snapshot";
import { VIEWS, VIEW_IDS, isView, type ViewId } from "@/lib/views";
import { FeedView, FlowView, Footer, Header, Nav, Outcomes, OverTime, Posters, Rhythm, Swarm } from "@/components/sections";
import type { Snapshot } from "@/lib/snapshot";

export function generateStaticParams() {
  return VIEW_IDS.map((view) => ({ view }));
}

export async function generateMetadata({ params }: PageProps<"/v/[view]">): Promise<Metadata> {
  const { view } = await params;
  if (!isView(view)) return {};
  return {
    title: VIEWS[view].title,
    description: `${VIEWS[view].title} — live Taskmarket data for Tempo and Base, refreshed from the public API.`,
  };
}

const RENDER: Record<ViewId, (p: { s: Snapshot }) => React.ReactNode> = {
  flow: FlowView,
  overtime: OverTime,
  posters: Posters,
  swarm: Swarm,
  outcomes: Outcomes,
  rhythm: Rhythm,
  feed: FeedView,
};

export default async function ViewPage({ params }: PageProps<"/v/[view]">) {
  const { view } = await params;
  if (!isView(view)) notFound();
  const s = await getSnapshot();
  const View = RENDER[view];
  return (
    <>
      <Header s={s} />
      <main className="wrap" style={{ paddingTop: 8 }}>
        <Nav />
        <View s={s} />
        <a className="backlink" href={`/#${view}`}>
          ← See this in the full dashboard
        </a>
      </main>
      <Footer s={s} />
    </>
  );
}
