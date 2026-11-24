import { getSnapshot } from "@/lib/snapshot";
import { FeedView, FlowView, Footer, Header, Hero, Insights, Kpis, Methods, Outcomes, OverTime, Posters, Rhythm, Swarm } from "@/components/sections";

export default async function Home() {
  const s = await getSnapshot();
  return (
    <>
      <Header s={s} />
      <main>
        <Hero s={s} />
        <div className="wrap">
          <FlowView s={s} />
        </div>
        <Kpis s={s} />
        <Insights s={s} />
        <div className="wrap">
          <OverTime s={s} />
          <Posters s={s} />
          <Swarm s={s} />
          <Outcomes s={s} />
          <Rhythm s={s} />
          <FeedView s={s} />
        </div>
        <Methods s={s} />
      </main>
      <Footer s={s} />
    </>
  );
}
