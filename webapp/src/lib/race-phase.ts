// Ported from OSPREY-app/src/services/plan.ts (computeRacePhase). Keep in sync; parity: tests/race-phase.test.ts.
export type RacePhaseName = 'Base' | 'Build' | 'Peak' | 'Taper';

export interface RaceGoal {
  targetRace: string | null;
  targetDate: string | null;
  totalWeeksPlanned: number | null;
}

export interface RacePhaseInfo {
  weeksRemaining: number;
  currentWeekNumber: number;
  totalWeeks: number;
  phase: RacePhaseName;
}

export function computeRacePhase(goal: RaceGoal, now: Date = new Date()): RacePhaseInfo | null {
  if (!goal.targetDate || !goal.totalWeeksPlanned) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const raceDate = new Date(`${goal.targetDate}T00:00:00`);
  if (isNaN(raceDate.getTime())) return null;
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksRemaining = Math.max(0, Math.ceil((raceDate.getTime() - today.getTime()) / msPerWeek));
  const totalWeeks = goal.totalWeeksPlanned;
  const currentWeekNumber = Math.min(totalWeeks, Math.max(1, totalWeeks - weeksRemaining + 1));
  const progress = currentWeekNumber / totalWeeks;
  const taperWeeks = totalWeeks <= 6 ? 1 : totalWeeks <= 10 ? 2 : 3;
  let phase: RacePhaseName;
  if (weeksRemaining <= taperWeeks) phase = 'Taper';
  else if (progress <= 0.4) phase = 'Base';
  else if (progress <= 0.75) phase = 'Build';
  else phase = 'Peak';
  return { weeksRemaining, currentWeekNumber, totalWeeks, phase };
}

export function phaseOrBase(goal: RaceGoal, now?: Date): RacePhaseName {
  return computeRacePhase(goal, now)?.phase ?? 'Base';
}
