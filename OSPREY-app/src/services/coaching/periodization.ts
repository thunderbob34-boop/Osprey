import { applyVolumeCut, maxWeeklyProgression } from '@/services/calculators/shared';

export type Phase = 'Base' | 'Build' | 'Peak' | 'Taper';

/** Position in the repeating 3:1 loading cycle (docs/coaching/_index.md:18). */
export function loadingWeek(weekNumber: number): 1 | 2 | 3 | 4 {
  return (((weekNumber - 1) % 4) + 1) as 1 | 2 | 3 | 4;
}

/**
 * Relative volume multiplier by macrocycle phase. Peak eases volume below
 * Build's while intensity/specificity rise (docs/coaching/*.md — every sport
 * blueprint describes Peak as "lower volume" / "volume easing", never a
 * volume increase over Build).
 */
const PHASE_FACTOR: Record<Phase, number> = { Base: 0.85, Build: 1.0, Peak: 0.9, Taper: 0.55 };

export function targetWeeklyLoad(input: {
  baselineLoad: number;
  phase: Phase;
  weekNumber: number;
  prevWeekLoad: number | null;
}): number {
  const { baselineLoad, phase, weekNumber, prevWeekLoad } = input;

  if (phase === 'Taper') {
    // Cut volume, keep intensity (handled by zones). 45% off the prior week.
    return applyVolumeCut(prevWeekLoad ?? baselineLoad, 0.45);
  }

  let target = baselineLoad * PHASE_FACTOR[phase];
  if (loadingWeek(weekNumber) === 4) target = applyVolumeCut(target, 0.3); // recovery week

  // Never grow more than 10%/week vs the prior week (3:1 progression cap).
  if (prevWeekLoad != null) target = Math.min(target, maxWeeklyProgression(prevWeekLoad, 0.1));
  return Math.round(target);
}
