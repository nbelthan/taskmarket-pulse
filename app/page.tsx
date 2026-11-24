import { getSnapshot } from "@/lib/snapshot";
import { PayView, PriceView, OddsView, WalletView, FeedView, FlowView, Footer, Header, Hero, Insights, Kpis, Methods, Outcomes, OverTime, Posters, Rhythm, Swarm } from "@/components/sections";

export default async function Home() {
  const s = await getSnapshot();
  return (
    <>
      <Header s={s} />
      <main>
        <Hero s={s} />
        <div className="wrap">
          <FlowView s={s} />
          <PayView s={s} />
        </div>
        <Kpis s={s} />
        <Insights s={s} />
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
