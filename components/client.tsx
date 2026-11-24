"use client";
// Small interactive pieces. Everything else on the page is server-rendered.
import { useEffect, useState, type ReactNode } from "react";

/** Segmented tabs over server-rendered panes. Optional URL query sync (?key=value). */
export function Tabs({
  tabs,
  param,
  label,
}: {
  tabs: { key: string; label: string; content: ReactNode }[];
  param?: string;
  label: string;
}) {
  const [active, setActive] = useState(tabs[0]?.key);
  useEffect(() => {
    if (!param) return;
    const v = new URLSearchParams(window.location.search).get(param);
    if (v && tabs.some((t) => t.key === v)) setActive(v);
  }, [param, tabs]);
  const pick = (k: string) => {
    setActive(k);
    if (param) {
      const u = new URL(window.location.href);
      u.searchParams.set(param, k);
      window.history.replaceState(null, "", u);
    }
  };
  return (
    <div>
      <div className="seg" role="group" aria-label={label} style={{ marginBottom: 14 }}>
        {tabs.map((t) => (
          <button key={t.key} type="button" aria-pressed={active === t.key} onClick={() => pick(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} hidden={active !== t.key}>
          {t.content}
        </div>
      ))}
    </div>
  );
}

/** "Data as of" with a live relative time. Absolute UTC time is rendered on the server. */
export function Ago({ iso }: { iso: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return null;
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  const txt = s < 60 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`;
  return <span> · {txt}</span>;
}

/** Share a view: native share sheet on phones, copy link elsewhere. */
export function ShareButton({ path, title }: { path: string; title: string }) {
  const [done, setDone] = useState(false);
  const onClick = async () => {
    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      /* user cancelled */
    }
  };
  return (
    <button type="button" className="sharebtn" onClick={onClick} aria-label={`Share link to ${title}`}>
      <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6.5 9.5l3-3M7 4.5l1.3-1.3a2.8 2.8 0 014 4L11 8.5M9 11.5l-1.3 1.3a2.8 2.8 0 01-4-4L5 7.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {done ? "Link copied" : "Share"}
    </button>
  );
}
