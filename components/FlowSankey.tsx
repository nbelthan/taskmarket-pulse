// Server-rendered sankey: reward money from posters, through task modes, to outcomes.
// Hand-rolled layout (no chart library) so the page ships zero chart JS.
import type { Flow, FlowLink, FlowNode } from "@/lib/derive";
import { OUTCOME_COLOR, C } from "@/lib/theme";
import { money } from "@/lib/format";
import type { Outcome } from "@/lib/derive";

type Props = {
  flow: Flow;
  compact?: boolean;
  title: string;
  /** Which columns to draw. Default: all three, or poster → outcome when compact. */
  cols?: number[];
  /** Colour bands by their source node instead of their target. */
  colorBySource?: boolean;
  /** Draw moving particles along each band (disabled for reduced motion via CSS). */
  animate?: boolean;
};

const SOURCE_PALETTE = [C.paper, C.salmon, C.cream, C.muted, "rgba(217,160,151,0.6)", "rgba(239,233,226,0.55)", "rgba(176,167,157,0.6)"];

type Placed = FlowNode & { x: number; y: number; h: number; outOff: number; inOff: number };

export function FlowSankey({ flow, compact = false, title, cols: colsProp, colorBySource = false, animate = true }: Props) {
  const cols = colsProp ?? (compact ? [0, 2] : [0, 1, 2]);
  const W = compact ? 360 : 960;
  const nodeW = compact ? 8 : 12;
  const labelL = compact ? 96 : 150; // room for left labels
  const labelR = compact ? 108 : 170; // room for right labels
  const gap = compact ? 10 : 12;
  const nodes = flow.nodes.filter((n) => cols.includes(n.col) && n.value > 0);
  const links: FlowLink[] = cols.includes(1) ? flow.links : flow.direct;
  const total = flow.total || 1;

  // Height scale from the tallest column (including gaps).
  const perCol = cols.map((c) => nodes.filter((n) => n.col === c));
  const maxN = Math.max(...perCol.map((c) => c.length));
  const H = compact ? 380 : 440;
  const usable = H - gap * (maxN - 1);
  const k = usable / total;
  const minH = 2;

  const xFor = (ci: number) => labelL + (ci * (W - labelL - labelR - nodeW)) / (cols.length - 1);
  const placed = new Map<string, Placed>();
  perCol.forEach((colNodes, ci) => {
    const heights = colNodes.map((n) => Math.max(minH, n.value * k));
    const colH = heights.reduce((a, b) => a + b, 0) + gap * (colNodes.length - 1);
    let y = (H - colH) / 2;
    colNodes.forEach((n, i) => {
      placed.set(n.id, { ...n, x: xFor(ci), y, h: heights[i], outOff: 0, inOff: 0 });
      y += heights[i] + gap;
    });
  });

  // Order links so bands don't cross needlessly.
  const pos = (id: string) => placed.get(id)?.y ?? 0;
  const ordered = [...links]
    .filter((l) => placed.has(l.source) && placed.has(l.target))
    .sort((a, b) => pos(a.source) - pos(b.source) || pos(a.target) - pos(b.target));
  const bySourceThenTarget = ordered;
  const byTargetThenSource = [...ordered].sort((a, b) => pos(a.target) - pos(b.target) || pos(a.source) - pos(b.source));
  const sy = new Map<FlowLink, number>();
  const ty = new Map<FlowLink, number>();
  for (const l of bySourceThenTarget) {
    const s = placed.get(l.source)!;
    const scale = s.h / Math.max(s.value, 1e-9);
    sy.set(l, s.y + s.outOff);
    s.outOff += l.value * scale;
  }
  for (const l of byTargetThenSource) {
    const t = placed.get(l.target)!;
    const scale = t.h / Math.max(t.value, 1e-9);
    ty.set(l, t.y + t.inOff);
    t.inOff += l.value * scale;
  }

  const sources = [...placed.values()].filter((n) => n.col === cols[0]).map((n) => n.id);
  const colorFor = (l: FlowLink) => {
    if (colorBySource) return l.source.endsWith("others") ? C.muted : SOURCE_PALETTE[sources.indexOf(l.source) % SOURCE_PALETTE.length];
    const t = placed.get(l.target)!;
    if (t.col === 2) return OUTCOME_COLOR[t.kind as Outcome] ?? C.muted;
    return C.cream;
  };
  const opacityFor = (l: FlowLink) => (colorBySource ? 0.36 : placed.get(l.target)!.col === 2 ? 0.42 : 0.14);

  const fs = compact ? 10.5 : 13;
  const fsSmall = compact ? 9.5 : 11.5;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
      <title>{title}</title>
      {ordered.map((l, i) => {
        const s = placed.get(l.source)!;
        const t = placed.get(l.target)!;
        const sh = l.value * (s.h / Math.max(s.value, 1e-9));
        const th = l.value * (t.h / Math.max(t.value, 1e-9));
        const x0 = s.x + nodeW;
        const x1 = t.x;
        const y0 = sy.get(l)!;
        const y1 = ty.get(l)!;
        const mx = (x0 + x1) / 2;
        const d = `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1} L${x1},${y1 + th} C${mx},${y1 + th} ${mx},${y0 + sh} ${x0},${y0 + sh} Z`;
        return (
          <path key={i} d={d} fill={colorFor(l)} fillOpacity={opacityFor(l)}>
            <title>{`${s.label} → ${t.label}: ${money(l.value)} across ${l.tasks} tasks`}</title>
          </path>
        );
      })}
      {animate && (
        <g className="flowdots" aria-hidden="true">
          {ordered.map((l, i) => {
            if (l.value / total < 0.012) return null;
            const s = placed.get(l.source)!;
            const t = placed.get(l.target)!;
            const sh = l.value * (s.h / Math.max(s.value, 1e-9));
            const th = l.value * (t.h / Math.max(t.value, 1e-9));
            const x0 = s.x + nodeW;
            const x1 = t.x;
            const y0 = sy.get(l)! + sh / 2;
            const y1 = ty.get(l)! + th / 2;
            const mx = (x0 + x1) / 2;
            const dur = 2.2 + ((i * 7) % 10) / 10;
            return (
              <path
                key={i}
                d={`M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1}`}
                fill="none"
                stroke={C.paper}
                strokeWidth={Math.min(3, 1 + sh / 30)}
                strokeLinecap="round"
                strokeDasharray="0.5 22"
                style={{ animationDuration: `${dur}s` }}
              />
            );
          })}
        </g>
      )}
      {[...placed.values()].map((n) => {
        const isLast = n.col === cols[cols.length - 1];
        const isFirst = n.col === cols[0];
        const fill = n.kind === "others" ? C.muted : n.col === 2 ? (OUTCOME_COLOR[n.kind as Outcome] ?? C.paper) : C.cream;
        const tx = isLast ? n.x + nodeW + 8 : isFirst ? n.x - 8 : n.x + nodeW / 2;
        const anchor = isLast ? "start" : isFirst ? "end" : "middle";
        const cy = n.y + n.h / 2;
        const showLabel = n.h > 4 || !compact;
        return (
          <g key={n.id}>
            <rect x={n.x} y={n.y} width={nodeW} height={n.h} rx={2} fill={fill}>
              <title>{`${n.label}: ${money(n.value)} across ${n.tasks} tasks`}</title>
            </rect>
            {showLabel && n.col !== 1 && (
              <a href={/^[pw]:0x/.test(n.id) ? `/?wallet=${n.id.slice(2)}#wallet` : undefined}>
              <text x={tx} y={cy} textAnchor={anchor} dominantBaseline="middle" fontSize={fs} fill={C.cream} className={n.kind === "poster" || n.kind === "winner" ? "num" : undefined}>
                {n.label}
                <tspan dx={6} fill={C.muted} fontSize={fsSmall} className="num">
                  {money(n.value)}
                </tspan>
              </text>
              </a>
            )}
            {n.col === 1 && n.h > 14 && (
              <text x={n.x + nodeW + 6} y={cy} dominantBaseline="middle" fontSize={fsSmall} fill={C.muted}>
                {n.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
