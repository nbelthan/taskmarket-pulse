const nf = new Intl.NumberFormat("en-US");
export const int = (n: number) => nf.format(Math.round(n));
export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;
export function money(n: number): string {
  if (n >= 10_000) return `$${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k`;
  if (n >= 100) return `$${nf.format(Math.round(n))}`;
  return `$${n.toFixed(2)}`;
}
export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1e3).toFixed(n >= 100_000 ? 0 : 1)}k`;
  return int(n);
}
export function utc(iso: string): string {
  const d = new Date(iso);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
}
export function shortDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
