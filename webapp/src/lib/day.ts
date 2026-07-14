// Local-day semantics everywhere. Never toISOString().slice(0,10) for day math —
// that's UTC and shifted the mobile home screen to "tomorrow" after ~5pm for
// negative-offset users (2026-07-12 audit, fix #2).

export function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** For <input type="datetime-local">, which reads/writes in local time, not UTC. */
export function toDateTimeInputValue(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${toDateInputValue(d)}T${hh}:${mm}`;
}

function parseLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function localDayRange(dateStr: string): { start: string; end: string } {
  const start = parseLocal(dateStr);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function addDays(dateStr: string, delta: number): string {
  const d = parseLocal(dateStr);
  d.setDate(d.getDate() + delta);
  return toDateInputValue(d);
}

export function loggedAtFor(dateStr: string, now: Date = new Date()): string {
  if (dateStr === toDateInputValue(now)) return now.toISOString();
  const noon = parseLocal(dateStr);
  noon.setHours(12, 0, 0, 0);
  return noon.toISOString();
}
