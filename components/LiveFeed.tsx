"use client";
// Live activity feed. Polls this site's own /api/feed (server-cached for 60 s);
// the browser never calls api.taskmarket.dev directly.
import { useEffect, useRef, useState } from "react";
import type { FeedItem } from "@/lib/api";

const CHAIN_NAME: Record<number, string> = { 4217: "Tempo", 8453: "Base" };
const EVENT: Record<string, string> = {
  task_created: "posted",
  task_submitted: "submitted",
  task_completed: "completed",
  task_claimed: "claimed",
  task_cancelled: "cancelled",
  task_rated: "rated",
  worker_selected: "picked",
  settlement: "paid",
};

const short = (a: string | null) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a ?? "");
const ago = (iso: string, now: number) => {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

export function LiveFeed({ initial, initialAsOf }: { initial: FeedItem[]; initialAsOf: string }) {
  const [items, setItems] = useState(initial);
  const [asOf, setAsOf] = useState(initialAsOf);
  const [now, setNow] = useState<number | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const seen = useRef(new Set(initial.map(keyOf)));

  useEffect(() => {
    setNow(Date.now());
    let stop = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/feed", { cache: "no-store" });
        if (!r.ok) return;
        const d: { asOf: string; items: FeedItem[] } = await r.json();
        if (stop) return;
        const nf = new Set<string>();
        for (const it of d.items) if (!seen.current.has(keyOf(it))) nf.add(keyOf(it));
        d.items.forEach((it) => seen.current.add(keyOf(it)));
        setFresh(nf);
        setItems(d.items);
        setAsOf(d.asOf);
      } catch {
        /* keep showing what we have */
      }
    };
    tick();
    const poll = setInterval(tick, 60_000);
    const clock = setInterval(() => setNow(Date.now()), 10_000);
    return () => {
      stop = true;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, []);

  return (
    <div>
      <p className="source" style={{ marginTop: 0 }}>
        Feed as of <span className="mono">{asOf.slice(11, 19)} UTC</span>, refreshed every 60 s. Showing the latest {items.length} events.
      </p>
      <ul className="feed" aria-live="polite">
        {items.map((it) => (
          <li key={keyOf(it)} className={fresh.has(keyOf(it)) ? "fresh" : undefined}>
            <span className={`ev${it.type === "task_created" ? " created" : ""}`}>{EVENT[it.type] ?? it.type.replace(/_/g, " ")}</span>
            <span style={{ minWidth: 0 }}>
              <div className="title">
                {it.taskId ? (
                  <a href={`https://taskmarket.dev/tasks/${it.taskId}`} target="_blank" rel="noopener noreferrer">
                    {it.taskTitle ?? it.taskId.slice(0, 12)}
                  </a>
                ) : (
                  it.taskTitle ?? "—"
                )}
              </div>
              <div className="meta">
                <span className="mono">{short(it.actor)}</span> · {it.actorType ?? "actor"} · {CHAIN_NAME[it.chainId] ?? it.chainId}
                {it.amount ? (
                  <>
                    {" "}· <span className="mono">${(Number(it.amount) / 1e6).toFixed(2)}</span>
                  </>
                ) : null}
              </div>
            </span>
            <span className="when">{now ? ago(it.timestamp, now) : it.timestamp.slice(11, 16)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function keyOf(it: FeedItem) {
  return `${it.type}:${it.taskId}:${it.timestamp}:${it.actor}`;
}
