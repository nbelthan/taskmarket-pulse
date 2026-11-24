"use client";
// Wallet lookup over per-wallet totals served by this site (/api/wallets).
// Runs only when someone searches; nothing is stored or sent anywhere else.
import { useEffect, useState } from "react";

type Row = [number, number, number, number];
type Data = { asOf: string; wallets: Record<"tempo" | "base", Record<string, Row>> };
const NAMES = { tempo: "Tempo", base: "Base" } as const;
const money = (n: number) => (n >= 100 ? `$${Math.round(n).toLocaleString("en-US")}` : `$${n.toFixed(2)}`);

export function WalletLookup() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [addr, setAddr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const a = new URLSearchParams(window.location.search).get("wallet");
    if (a) {
      setQ(a);
      void look(a);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function look(raw: string) {
    const a = raw.trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(a)) {
      setErr("Enter a full 0x… address (42 characters).");
      setAddr(null);
      return;
    }
    setErr(null);
    let d = data;
    if (!d) {
      try {
        d = (await (await fetch("/api/wallets")).json()) as Data;
        setData(d);
      } catch {
        setErr("Could not load wallet data. Try again.");
        return;
      }
    }
    setAddr(a);
    const u = new URL(window.location.href);
    u.searchParams.set("wallet", a);
    u.hash = "wallet";
    window.history.replaceState(null, "", u);
  }

  const rows = addr && data ? (["tempo", "base"] as const).map((k) => [k, data.wallets[k][addr]] as const) : [];
  const none = rows.length > 0 && rows.every(([, r]) => !r);

  return (
    <div>
      <form
        className="lookup"
        onSubmit={(e) => {
          e.preventDefault();
          void look(q);
        }}
      >
        <label htmlFor="wallet-q" className="sr">Wallet address</label>
        <input id="wallet-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="0x…" spellCheck={false} autoComplete="off" inputMode="text" />
        <button type="submit">Look up</button>
      </form>
      {err ? <p className="source" role="alert">{err}</p> : null}
      {none ? <p className="source">This address has not posted a task or held a top award in the task list.</p> : null}
      {rows.length > 0 && !none ? (
        <div className="stats3" style={{ marginTop: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {rows.map(([k, r]) => (
            <div key={k}>
              <span>{NAMES[k]}</span>
              {r ? (
                <>
                  <b>{r[0]} posted · {money(r[1])}</b>
                  <span>
                    {r[2]} top award{r[2] === 1 ? "" : "s"} on tasks worth {money(r[3])}
                  </span>
                </>
              ) : (
                <b style={{ color: "var(--muted)" }}>no activity</b>
              )}
            </div>
          ))}
        </div>
      ) : null}
      {data ? <p className="source">Wallet data as of <span className="mono">{data.asOf.slice(0, 16).replace("T", " ")} UTC</span>.</p> : null}
    </div>
  );
}
