// Client-safe formatting.
export const short = (a?: string | null, n = 4) => (a ? `${a.slice(0, n)}...${a.slice(-n)}` : '');

export function compactUsd(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return '-';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}
export const sol = (v: number | null | undefined, d = 4) => (v == null ? '-' : `${v.toLocaleString('en-US', { maximumFractionDigits: d })} SOL`);
export const pct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;

export function ago(d: string | Date | null | undefined) {
  if (!d) return '';
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export const rarityText = (r?: string | null) => (r === 'ULTRA_RARE' ? 'Ultra rare' : r === 'RARE' ? 'Rare' : r === 'UNCOMMON' ? 'Uncommon' : r === 'COMMON' ? 'Common' : '');
