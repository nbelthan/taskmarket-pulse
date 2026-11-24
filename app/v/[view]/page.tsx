// One view on its own page, so each can be linked and shared with its own card.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRace, getSnapshot } from "@/lib/snapshot";
import { VIEWS, VIEW_IDS, isView } from "@/lib/views";
import { Footer, Header, Nav } from "@/components/sections";
import { RENDER } from "@/components/viewmap";

export function generateStaticParams() {
  return VIEW_IDS.map((view) => ({ view }));
}

export async function generateMetadata({ params }: PageProps<"/v/[view]">): Promise<Metadata> {
  const { view } = await params;
  if (!isView(view)) return {};
  return {
    title: VIEWS[view].title,
    description: `${VIEWS[view].title}: live Taskmarket data for Tempo and Base, refreshed from the public API.`,
  };
}

export default async function ViewPage({ params }: PageProps<"/v/[view]">) {
  const { view } = await params;
  if (!isView(view)) notFound();
  const [s, race] = await Promise.all([getSnapshot(), view === "race" ? getRace().catch(() => null) : Promise.resolve(null)]);
  const View = RENDER[view];
  return (
    <>
      <Header s={s} />
      <main className="wrap" style={{ paddingTop: 8 }}>
        <Nav />
        <View s={s} race={race} />
        <a className="backlink" href={`/#${view}`}>
          ← See this in the full dashboard
        </a>
      </main>
      <Footer s={s} />
    </>
  );
}
