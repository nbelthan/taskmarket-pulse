// Server-rendered SVG charts. No client JS; hover detail comes from <title>.
import { C } from "@/lib/theme";
import { compact, shortDay, int, pct } from "@/lib/format";
import type { Heatmap } from "@/lib/api";

// ---------------------------------------------------------------- area chart
export function AreaChart({
  points,
  color = C.cream,
  format = compact,
  label,
}: {
  points: { x: string; y: number }[];
  color?: string;
  format?: (n: number) => string;
  label: string;
}) {
  const W = 520;
  const H = 150;
  const padL = 4;
  const padR = 4;
  const padT = 12;
  const padB = 22;
  if (!points.length) return <p className="muted">No data in this range.</p>;
  const max = Math.max(1, ...points.map((p) => p.y));
  const n = points.length;
  const xs = (i: number) => padL + (n === 1 ? (W - padL - padR) / 2 : (i * (W - padL - padR)) / (n - 1));
  const ys = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const line = points.map((p, i) => `${i ? "L" : "M"}${xs(i).toFixed(1)},${ys(p.y).toFixed(1)}`).join("");
  const area = `${line}L${xs(n - 1).toFixed(1)},${H - padB}L${xs(0).toFixed(1)},${H - padB}Z`;
  const peak = points.reduce((m, p, i) => (p.y > points[m].y ? i : m), 0);
  const ticks = n > 2 ? [0, Math.floor((n - 1) / 2), n - 1] : [0, n - 1];
  const barW = Math.max(1, (W - padL - padR) / n - 1);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <title>{label}</title>
      <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke={C.line} />
      <line x1={padL} x2={W - padR} y1={padT} y2={padT} stroke={C.line} strokeDasharray="2 4" />
      <text x={W - padR} y={padT - 3} textAnchor="end" className="tick num">
        {format(max)}
      </text>
      <path d={area} fill={color} fillOpacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" />
      <circle cx={xs(peak)} cy={ys(points[peak].y)} r={3} fill={color} />
      {/* invisible hover targets */}
      {n <= 45 && points.map((p, i) => (
        <rect key={p.x} x={xs(i) - barW / 2} y={padT} width={barW} height={H - padT - padB} fill="transparent">
          <title>{`${shortDay(p.x)}: ${format(p.y)}`}</title>
        </rect>
      ))}
      {ticks.map((i) => (
        <text key={i} x={xs(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="tick">
          {shortDay(points[i].x)}
        </text>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------- grouped weekly bars
export function WeeklyBars({
  weeks,
  series,
  label,
}: {
  weeks: string[];
  series: { name: string; color: string; values: Record<string, number> }[];
  label: string;
}) {
  const W = 560;
  const H = 220;
  const padB = 24;
  const padT = 16;
  const max = Math.max(1, ...series.flatMap((s) => weeks.map((w) => s.values[w] ?? 0)));
  const gw = (W - 8) / weeks.length;
  const bw = Math.max(2, (gw - 6) / series.length);
  const ys = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <title>{label}</title>
      <line x1={0} x2={W} y1={H - padB} y2={H - padB} stroke={C.line} />
      <text x={W} y={padT - 4} textAnchor="end" className="tick num">
        {int(max)}
      </text>
      <line x1={0} x2={W} y1={padT} y2={padT} stroke={C.line} strokeDasharray="2 4" />
      {weeks.map((w, wi) => (
        <g key={w}>
          {series.map((s, si) => {
            const v = s.values[w] ?? 0;
            const x = 4 + wi * gw + 3 + si * bw;
            const isCurrent = wi === weeks.length - 1;
            return (
              <rect key={s.name} x={x} y={ys(v)} width={bw - 1.5} height={Math.max(0, H - padB - ys(v))} rx={2} fill={s.color} fillOpacity={isCurrent ? 0.45 : 0.92}>
                <title>{`${s.name}, week of ${w}${isCurrent ? " (in progress)" : ""}: ${int(v)} distinct posters`}</title>
              </rect>
            );
          })}
          {(wi % Math.ceil(weeks.length / 6) === 0 || wi === weeks.length - 1) && (
            <text x={4 + wi * gw + gw / 2} y={H - 7} textAnchor="middle" className="tick">
              {shortDay(w)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------- Lorenz curve
export function Lorenz({ curves, label }: { curves: { name: string; color: string; points: [number, number][]; gini: number }[]; label: string }) {
  const S = 260;
  const p = 28;
  const xs = (x: number) => p + x * (S - p - 8);
  const ys = (y: number) => S - p - y * (S - p - 8);
  return (
    <svg className="chart" viewBox={`0 0 ${S} ${S}`} role="img" aria-label={label} style={{ maxWidth: 360, margin: "0 auto" }}>
      <title>{label}</title>
      <rect x={xs(0)} y={ys(1)} width={xs(1) - xs(0)} height={ys(0) - ys(1)} fill="none" stroke={C.line} />
      <line x1={xs(0)} y1={ys(0)} x2={xs(1)} y2={ys(1)} stroke={C.muted} strokeDasharray="3 4" />
      <text x={xs(0.3) + 4} y={ys(0.3) - 6} className="tick" transform={`rotate(-45 ${xs(0.3) + 4} ${ys(0.3) - 6})`}>
        everyone posts equally
      </text>
      {curves.map((c) => (
        <path key={c.name} d={c.points.map(([x, y], i) => `${i ? "L" : "M"}${xs(x).toFixed(1)},${ys(y).toFixed(1)}`).join("")} fill="none" stroke={c.color} strokeWidth={2}>
          <title>{`${c.name}: Gini ${c.gini.toFixed(2)}`}</title>
        </path>
      ))}
      <text x={xs(0)} y={S - 8} className="tick">
        posters, fewest tasks → most
      </text>
      <text x={10} y={ys(0)} className="tick" transform={`rotate(-90 10 ${ys(0)})`}>
        share of tasks
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------- heatmap
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function HeatGrid({ heat, kind, label }: { heat: Heatmap; kind: "hourOfWeek" | "mode"; label: string }) {
  const rows = heat.rowKeys;
  const cols = heat.colKeys;
  const cell = new Map(heat.cells.map((c) => [`${c.row}|${c.col}`, c]));
  const max = Math.max(1, ...heat.cells.map((c) => c.count));
  const labelW = kind === "mode" ? 76 : 36;
  const cw = kind === "mode" ? Math.max(8, Math.min(22, 820 / cols.length)) : 26;
  const ch = kind === "mode" ? 26 : 22;
  const W = labelW + cols.length * cw;
  const H = rows.length * ch + 22;
  // find the busiest cell to call out
  const top = heat.cells.reduce((m, c) => (c.count > (m?.count ?? -1) ? c : m), heat.cells[0]);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <title>{label}</title>
      {rows.map((r, ri) => (
        <g key={r}>
          <text x={labelW - 6} y={ri * ch + ch / 2 + 4} textAnchor="end" className="tick">
            {kind === "hourOfWeek" ? DOW[Number(r)] ?? r : r}
          </text>
          {cols.map((c, ci) => {
            const v = cell.get(`${r}|${c}`)?.count ?? 0;
            const t = v / max;
            const isTop = top && top.row === r && top.col === c;
            return (
              <rect key={c} x={labelW + ci * cw + 1} y={ri * ch + 1} width={cw - 2} height={ch - 2} rx={3} fill={v ? C.salmon : C.panel} fillOpacity={v ? 0.12 + 0.88 * Math.sqrt(t) : 1} stroke={isTop ? C.paper : "none"} strokeWidth={isTop ? 1.5 : 0}>
                <title>{`${kind === "hourOfWeek" ? `${DOW[Number(r)] ?? r} ${c.padStart(2, "0")}:00 UTC` : `${r}, ${shortDay(c)}`}: ${int(v)} events`}</title>
              </rect>
            );
          })}
        </g>
      ))}
      {cols.map((c, ci) =>
        (kind === "hourOfWeek" ? ci % 3 === 0 : ci % Math.ceil(cols.length / 6) === 0) ? (
          <text key={c} x={labelW + ci * cw + cw / 2} y={H - 6} textAnchor="middle" className="tick">
            {kind === "hourOfWeek" ? `${c.padStart(2, "0")}h` : shortDay(c)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

// ---------------------------------------------------------------- stacked bar + bar list
export function StackBar({ parts, label }: { parts: { key: string; label: string; value: number; color: string }[]; label: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div>
      <div className="stack" role="img" aria-label={label}>
        {parts.filter((p) => p.value > 0).map((p) => (
          <div key={p.key} style={{ flex: p.value, background: p.color }} title={`${p.label}: ${int(p.value)} (${pct(p.value / total, 1)})`} />
        ))}
      </div>
      <div className="legend">
        {parts.map((p) => (
          <span key={p.key}>
            <i className="swatch" style={{ background: p.color }} /> {p.label} <b className="mono" style={{ color: C.paper, fontWeight: 400 }}>{int(p.value)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export function BarList({ rows, valueFmt = int }: { rows: { label: string; value: number; color: string; note?: string }[]; valueFmt?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="barlist">
      {rows.map((r) => (
        <li key={r.label}>
          <span>
            {r.label}
            {r.note ? <span className="muted"> {r.note}</span> : null}
          </span>
          <span className="track">
            <span className="fill" style={{ display: "block", width: `${(100 * r.value) / max}%`, background: r.color }} />
          </span>
          <span className="n">{valueFmt(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- swarm tile
/** One open task as a hive: each dot is one submission, spiralling in to the task. */
export function Hive({ submissions, reward, maxReward }: { submissions: number; reward: number; maxReward: number }) {
  const S = 120;
  const c = S / 2;
  const core = 7 + 13 * Math.sqrt(reward / Math.max(maxReward, 1e-9));
  const shown = Math.min(submissions, 160);
  const golden = Math.PI * (3 - Math.sqrt(5));
  // Dots drawn as three paths (by opacity band) instead of hundreds of elements.
  const bands = ["", "", ""];
  for (let i = 0; i < shown; i++) {
    const r = core + 5 + ((c - 4 - core - 5) * Math.sqrt(i + 1)) / Math.sqrt(Math.max(shown, 1));
    const a = i * golden;
    const x = c + r * Math.cos(a);
    const y = c + r * Math.sin(a);
    const b = Math.min(2, Math.floor((3 * i) / Math.max(shown, 1)));
    bands[b] += `M${(x - 1.9).toFixed(1)},${y.toFixed(1)}a1.9,1.9 0 1,0 3.8,0a1.9,1.9 0 1,0 -3.8,0`;
  }
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="chart" aria-hidden="true">
      {bands.map((d, i) => (d ? <path key={i} d={d} fill={C.cream} fillOpacity={0.85 - i * 0.25} /> : null))}
      <circle cx={c} cy={c} r={core} fill={C.salmon} />
    </svg>
  );
}

// ---------------------------------------------------------------- reward vs entries scatter
/** Every task as a dot: reward (log) across, submissions (log) up, coloured by outcome. */
export function PriceScatter({ points, colors, label, bands }: { points: [number, number, number][]; colors: string[]; label: string; bands: { min: number; max: number; medianSubs: number }[] }) {
  const W = 760;
  const H = 320;
  const pl = 40, pr = 10, pt = 12, pb = 30;
  const xmin = Math.log10(0.05), xmax = Math.log10(Math.max(200, ...points.map((p) => p[0])));
  const ymax = Math.log10(1 + Math.max(10, ...points.map((p) => p[1])));
  const xs = (v: number) => pl + ((Math.log10(Math.max(v, 0.05)) - xmin) / (xmax - xmin)) * (W - pl - pr);
  const ys = (v: number) => pt + (1 - Math.log10(1 + v) / ymax) * (H - pt - pb);
  // deterministic jitter so stacked dots stay visible
  const jit = (i: number) => (((i * 9301 + 49297) % 233280) / 233280 - 0.5) * 6;
  const paths = colors.map(() => "");
  points.forEach(([r, n, o], i) => {
    paths[o] += `M${(xs(r) + jit(i)).toFixed(1)},${(ys(n) + jit(i + 7) * 0.6).toFixed(1)}h0`;
  });
  const xticks = [0.1, 1, 10, 100, 1000].filter((v) => Math.log10(v) <= xmax + 0.01);
  const yticks = [0, 1, 10, 100, 1000].filter((v) => Math.log10(1 + v) <= ymax + 0.01);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <title>{label}</title>
      {yticks.map((v) => (
        <g key={v}>
          <line x1={pl} x2={W - pr} y1={ys(v)} y2={ys(v)} stroke={C.line} strokeDasharray="2 4" />
          <text x={pl - 6} y={ys(v) + 4} textAnchor="end" className="tick num">{v}</text>
        </g>
      ))}
      {xticks.map((v) => (
        <text key={v} x={xs(v)} y={H - 10} textAnchor="middle" className="tick num">${v >= 1 ? v : v.toFixed(1)}</text>
      ))}
      {paths.map((d, i) => (d ? <path key={i} d={d} stroke={colors[i]} strokeWidth={4} strokeLinecap="round" strokeOpacity={0.7} fill="none" /> : null))}
      {/* median entries per reward band */}
      {bands.filter((b) => b.medianSubs >= 0 && Number.isFinite(b.min)).map((b) => {
        const x0 = xs(Math.max(b.min, 0.05));
        const x1 = xs(Number.isFinite(b.max) ? b.max : Math.pow(10, xmax));
        return <line key={b.min} x1={x0 + 2} x2={x1 - 2} y1={ys(b.medianSubs)} y2={ys(b.medianSubs)} stroke={C.paper} strokeWidth={2.5}><title>{`median ${b.medianSubs} entries`}</title></line>;
      })}
      <text x={W - pr} y={H - 24} className="tick" textAnchor="end">reward →</text>
      <text x={pl + 4} y={pt + 10} className="tick">↑ submissions</text>
    </svg>
  );
}
