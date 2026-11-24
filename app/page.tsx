import { getRace, getSnapshot } from "@/lib/snapshot";
import { RaceView, PayView, PriceView, OddsView, WalletView, FeedView, FlowView, Footer, Header, Hero, Insights, Kpis, Methods, Outcomes, OverTime, Posters, Rhythm, Swarm } from "@/components/sections";

export default async function Home() {
  const [s, race] = await Promise.all([getSnapshot(), getRace().catch(() => null)]);
  return (
    <>
      <Header s={s} />
      <main>
        <Hero s={s} race={race} />
        <div className="wrap">
          <FlowView s={s} />
          <RaceView race={race} />
          <PayView s={s} />
        </div>
        <Kpis s={s} />
        <Insights s={s} race={race} />
        <div className="wrap">
          <PriceView s={s} />
          <OddsView s={s} />
          <OverTime s={s} />
          <Posters s={s} />
          <Swarm s={s} />
          <Outcomes s={s} />
          <Rhythm s={s} />
          <FeedView s={s} />
          <WalletView />
        </div>
        <Methods s={s} />
      </main>
      <Footer s={s} />
    </>
  );
}
