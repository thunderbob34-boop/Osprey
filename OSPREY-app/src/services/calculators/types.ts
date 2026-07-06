/** A numeric band; either bound is null when the zone is open-ended (e.g. "92%+ max HR"). */
export interface Range {
  min: number | null;
  max: number | null;
}

export function midpoint(range: Range): number | null {
  if (range.min == null || range.max == null) return null;
  return (range.min + range.max) / 2;
}

export function formatMinSec(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '-' : '';
  const abs = Math.abs(Math.round(totalSeconds));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}
