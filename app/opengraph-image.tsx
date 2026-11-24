import { getSnapshot } from "@/lib/snapshot";
import { cardPng, pngResponse, OG_SIZE } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Taskmarket Pulse: where the reward money goes, live from the Taskmarket API";

export default async function Image() {
  const s = await getSnapshot();
  return pngResponse(await cardPng("home", s));
}
