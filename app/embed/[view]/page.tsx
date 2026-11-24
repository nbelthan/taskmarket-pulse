// Embeddable view: the section alone, for an <iframe> on another site.
// <iframe src="https://<host>/embed/flow" width="100%" height="760" style="border:0"></iframe>
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRace, getSnapshot } from "@/lib/snapshot";
import { VIEWS, VIEW_IDS, isView } from "@/lib/views";
import { RENDER } from "@/components/viewmap";
import { utc } from "@/lib/format";

export function generateStaticParams() {
  return VIEW_IDS.map((view) => ({ view }));
}

export async function generateMetadata({ params }: PageProps<"/embed/[view]">): Promise<Metadata> {
  const { view } = await params;
  return { title: isView(view) ? VIEWS[view].title : "Embed", robots: { index: false } };
}

export default async function EmbedPage({ params }: PageProps<"/embed/[view]">) {
  const { view } = await params;
  if (!isView(view)) notFound();
  const [s, race] = await Promise.all([getSnapshot(), view === "race" ? getRace().catch(() => null) : Promise.resolve(null)]);
  const View = RENDER[view];
  return (
    <main className="wrap embed">
      <View s={s} race={race} />
      <p className="source">
        <a href={`/v/${view}`} target="_blank" rel="noopener">Taskmarket Pulse</a> · data as of {utc(s.asOf)} · made for a paid Taskmarket bounty, not an official
        Taskmarket product.
      </p>
    </main>
  );
}
