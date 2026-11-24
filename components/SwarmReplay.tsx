"use client";
// Swarm replay: a real task's entries arriving at their real (compressed) times,
// then the poster's pick lighting up and the reward flowing to it.
// Canvas, so hundreds of dots stay smooth on a phone. Pauses off-screen;
// shows the final frame when the viewer prefers reduced motion.
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReplayTask } from "@/lib/race";

const COL = { ground: "#12100E", panel: "#221E1A", line: "#453E37", cream: "239,233,226", paper: "#FFF6E8", salmon: "#D9A097", muted: "#B0A79D" };
const PLAY = 11; // seconds of replay
const HOLD = 3.2; // seconds holding the final frame before looping
const FLY = 0.9; // seconds for a dot to fly in

function fmtDur(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${String(m % 60).padStart(2, "0")}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
const money = (n: number) => (n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`);
const hash = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export function SwarmReplay({ tasks, compact = false }: { tasks: ReplayTask[]; compact?: boolean }) {
  const [pick, setPick] = useState(0);
  const [playing, setPlaying] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const noteRef = useRef<HTMLSpanElement>(null);
  const startRef = useRef<number>(0);
  const pausedAt = useRef<number | null>(null);
  const task = tasks[Math.min(pick, tasks.length - 1)];

  // Replay timeline on a log scale of real minutes: the first rush is visible
  // even when the last entries arrive days later.
  const tl = useMemo(() => {
    if (!task) return null;
    const last = task.offsets.at(-1) ?? 0;
    const end = Math.max(last, task.decidedAt ?? 0, 60) * 1.04;
    const warp = (s: number) => Math.log1p(s / 60) / Math.log1p(end / 60);
    const unwarp = (u: number) => 60 * Math.expm1(u * Math.log1p(end / 60));
    return { end, warp, unwarp, arrive: task.offsets.map((o) => warp(o) * PLAY), decide: task.decidedAt !== null ? warp(task.decidedAt) * PLAY : null };
  }, [task]);

  useEffect(() => {
    startRef.current = performance.now();
    pausedAt.current = null;
  }, [pick]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !task || !tl) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, raf = 0, visible = true;
    const monoFamily = getComputedStyle(document.documentElement).getPropertyValue("--font-mono") || "monospace";

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = wrap.clientWidth;
      H = compact ? Math.min(340, Math.max(260, W * 0.75)) : Math.min(440, Math.max(300, W * 0.55));
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.05 });
    io.observe(canvas);

    const N = task.offsets.length;
    const golden = Math.PI * (3 - Math.sqrt(5));

    const draw = (t: number) => {
      const cx = W / 2;
      const cy = H / 2;
      const core = Math.max(10, Math.min(W, H) * 0.045);
      const rMax = Math.min(W, H) / 2 - 10;
      const dotR = N > 400 ? 1.6 : N > 150 ? 2.1 : 2.8;
      ctx.clearRect(0, 0, W, H);

      // faint rings
      ctx.strokeStyle = COL.line;
      ctx.lineWidth = 1;
      for (const f of [0.45, 0.75, 1]) {
        ctx.beginPath();
        ctx.arc(cx, cy, core + 8 + (rMax - core - 8) * f, 0, Math.PI * 2);
        ctx.globalAlpha = 0.35;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      const decided = tl.decide !== null && t >= tl.decide;
      let arrived = 0;
      let wx = cx, wy = cy;
      for (let i = 0; i < N; i++) {
        const at = tl.arrive[i];
        const r = core + 8 + (rMax - core - 8) * Math.sqrt((i + 1) / N);
        const a = i * golden;
        const fx = cx + r * Math.cos(a);
        const fy = cy + r * Math.sin(a);
        if (i === task.winner) {
          wx = fx;
          wy = fy;
        }
        if (t < at) continue;
        arrived++;
        const p = Math.min(1, (t - at) / FLY);
        const e = 1 - Math.pow(1 - p, 3);
        const sa = hash(i) * Math.PI * 2;
        const sd = Math.max(W, H) * 0.7;
        const x = cx + sd * Math.cos(sa) + (fx - (cx + sd * Math.cos(sa))) * e;
        const y = cy + sd * Math.sin(sa) + (fy - (cy + sd * Math.sin(sa))) * e;
        const fresh = p < 1;
        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, Math.PI * 2);
        ctx.fillStyle = fresh ? COL.salmon : `rgba(${COL.cream},${decided && i !== task.winner ? 0.35 : 0.8})`;
        ctx.fill();
      }

      // the task
      ctx.beginPath();
      ctx.arc(cx, cy, core, 0, Math.PI * 2);
      ctx.fillStyle = COL.salmon;
      ctx.fill();
      ctx.fillStyle = COL.ground;
      ctx.font = `${Math.round(core * 0.62)}px ${monoFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(money(task.reward), cx, cy + 1);

      // the pick: winner glows, reward flows to it
      if (decided && task.winner !== null) {
        const since = t - (tl.decide as number);
        ctx.strokeStyle = COL.paper;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(wx, wy);
        ctx.stroke();
        ctx.globalAlpha = 1;
        for (let k = 0; k < 6; k++) {
          const f = (since * 0.9 + k / 6) % 1;
          ctx.beginPath();
          ctx.arc(cx + (wx - cx) * f, cy + (wy - cy) * f, 2.4, 0, Math.PI * 2);
          ctx.fillStyle = COL.paper;
          ctx.fill();
        }
        const pulse = 7 + 3 * Math.sin(since * 5);
        ctx.beginPath();
        ctx.arc(wx, wy, pulse, 0, Math.PI * 2);
        ctx.strokeStyle = COL.paper;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(wx, wy, dotR + 1.5, 0, Math.PI * 2);
        ctx.fillStyle = COL.paper;
        ctx.fill();
      }

      // captions (DOM, updated without re-rendering React)
      const real = Math.min(tl.end, tl.unwarp(Math.min(1, t / PLAY)));
      if (clockRef.current) clockRef.current.textContent = `+${fmtDur(real)}`;
      if (countRef.current) countRef.current.textContent = `${Math.round((arrived / N) * task.entries)}`;
      if (noteRef.current) {
        noteRef.current.textContent =
          decided && task.winner !== null
            ? `Top pick: entry ${task.winner + 1} of ${N}${N < task.entries ? " shown" : ""}, which arrived ${fmtDur(task.offsets[task.winner])} after posting${task.winnerPayment !== null ? ` · paid ${money(task.winnerPayment)}` : ""}`
            : task.decidedAt === null && t >= PLAY
              ? `Still open: ${task.entries} entries so far, no pick yet`
              : "Entries arriving…";
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible) return;
      if (pausedAt.current !== null) return;
      let t = (now - startRef.current) / 1000;
      if (t > PLAY + HOLD) {
        startRef.current = now;
        t = 0;
      }
      draw(t);
    };

    if (reduce) {
      draw(PLAY + 0.01);
    } else {
      raf = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [task, tl, compact]);

  useEffect(() => {
    if (playing) {
      if (pausedAt.current !== null) startRef.current = performance.now() - pausedAt.current * 1000;
      pausedAt.current = null;
    } else {
      pausedAt.current = (performance.now() - startRef.current) / 1000;
    }
  }, [playing]);

  if (!task) return null;
  const hours = task.decidedAt !== null ? fmtDur(task.decidedAt) : null;
  return (
    <div className={`replay${compact ? " compact" : ""}`}>
      {!compact && tasks.length > 1 ? (
        <div className="seg" role="group" aria-label="Pick a task to replay" style={{ marginBottom: 12 }}>
          {tasks.map((t, i) => (
            <button key={t.id} type="button" aria-pressed={i === pick} onClick={() => setPick(i)}>
              {i === 0 ? "Most contested" : t.status === "open" ? "Open now" : "Biggest reward"}
            </button>
          ))}
        </div>
      ) : null}
      <div ref={wrapRef} className="replay-stage">
        <canvas ref={canvasRef} role="img" aria-label={`Replay of ${task.entries} entries arriving on task ${task.ref ?? task.id.slice(0, 10)}${hours ? `, decided ${hours} after posting` : ", still open"}`} />
        <div className="replay-hud">
          <span className="mono big">
            <span ref={clockRef}>+0s</span>
          </span>
          <span className="muted">
            <span ref={countRef} className="mono">0</span> entries
          </span>
        </div>
      </div>
      <p className="replay-note">
        <span ref={noteRef}>Entries arriving…</span>
      </p>
      <p className="source" style={{ marginTop: 4 }}>
        <a href={`https://taskmarket.dev/tasks/${task.id}`} target="_blank" rel="noopener noreferrer">
          {task.title}
        </a>{" "}
        · <span className="mono">{task.ref}</span> · {money(task.reward)} · {task.entries} entries
        {hours ? ` · first payout ${hours} after posting` : " · open"}. Time runs on a log scale so the first rush is visible.
        {!compact ? (
          <>
            {" "}
            <button type="button" className="linkbtn" onClick={() => setPlaying((p) => !p)}>
              {playing ? "Pause" : "Play"}
            </button>{" "}
            <button
              type="button"
              className="linkbtn"
              onClick={() => {
                startRef.current = performance.now();
                pausedAt.current = null;
                setPlaying(true);
              }}
            >
              Restart
            </button>
          </>
        ) : null}
      </p>
    </div>
  );
}
