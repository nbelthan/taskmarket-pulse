import { getRace, getSnapshot } from "@/lib/snapshot";
import { cardPng, pngResponse, OG_SIZE } from "@/lib/og";
import { VIEW_IDS, isView } from "@/lib/views";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Taskmarket Pulse share card with live market numbers";

export function generateStaticParams() {
  return VIEW_IDS.map((view) => ({ view }));
}

export default async function Image({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  const [s, race] = await Promise.all([getSnapshot(), view === "race" ? getRace().catch(() => null) : Promise.resolve(null)]);
  return pngResponse(await cardPng(isView(view) ? view : "home", s, race));
}
