export interface LadderRung { label: '5K' | '10K' | 'Half' | 'Marathon'; km: number; }

export const LADDER: LadderRung[] = [
  { label: '5K', km: 5.0 },
  { label: '10K', km: 10.0 },
  { label: 'Half', km: 21.0975 },
  { label: 'Marathon', km: 42.195 },
];

/**
 * Extracts a goal distance from free text like the onboarding
 * user_goals.target_race field. Order matters: "half marathon" must be
 * checked before the unqualified "marathon" pattern, since the longer
 * word contains the shorter one as a substring.
 */
export function parseGoalDistanceFromText(text: string): number | null {
  const t = text.toLowerCase();
  if (/half[\s-]?marathon|\b13\.1\b/.test(t)) return 21.0975;
  if (/\b10\s?k\b/.test(t)) return 10.0;
  if (/\b5\s?k\b/.test(t)) return 5.0;
  if (/marathon/.test(t)) return 42.195;
  return null;
}

export interface SessionInput {
  id: string;
  weekId: string;
  sessionDate: string;
  sessionType: string;
  plannedDistanceKm: number | null;
}

export interface TuneUpWeek {
  sessionId: string;
  sessionDate: string;
  label: LadderRung['label'];
  ladderKm: number;
  plannedDistanceKm: number;
}

const TOLERANCE = 0.20;

/**
 * For every week's long run (the largest planned_distance_km run session
 * in that week), flags it as a tune-up opportunity if its distance is
 * within +/-20% of a ladder rung shorter than the goal distance.
 */
export function matchTuneUpWeeks(sessions: SessionInput[], goalDistanceKm: number | null): TuneUpWeek[] {
  if (goalDistanceKm == null) return [];
  const offered = LADDER.filter((r) => r.km < goalDistanceKm);
  if (offered.length === 0) return [];

  const longestByWeek = new Map<string, SessionInput>();
  for (const s of sessions) {
    if (s.sessionType !== 'run' || !s.plannedDistanceKm) continue;
    const cur = longestByWeek.get(s.weekId);
    if (!cur || s.plannedDistanceKm > (cur.plannedDistanceKm ?? 0)) longestByWeek.set(s.weekId, s);
  }

  const results: TuneUpWeek[] = [];
  for (const run of longestByWeek.values()) {
    const dist = run.plannedDistanceKm!;
    let best: LadderRung | null = null;
    let bestDiff = Infinity;
    for (const rung of offered) {
      const diff = Math.abs(dist - rung.km) / rung.km;
      if (diff < bestDiff) { bestDiff = diff; best = rung; }
    }
    if (best && bestDiff <= TOLERANCE) {
      results.push({ sessionId: run.id, sessionDate: run.sessionDate, label: best.label, ladderKm: best.km, plannedDistanceKm: dist });
    }
  }
  return results.sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
}
