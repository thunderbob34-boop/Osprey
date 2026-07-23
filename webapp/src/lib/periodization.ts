// Ported from OSPREY-app/src/services/coaching/periodization.ts + the two
// OSPREY-app/src/services/calculators/shared.ts helpers targetWeeklyLoad
// needs (applyVolumeCut, maxWeeklyProgression) — inlined here since nothing
// else in this port needs them. Keep in sync; parity: tests/periodization-parity.test.ts.
import type { RacePhaseName } from './race-phase';

/** Position in the repeating 3:1 loading cycle (docs/coaching/_index.md:18). */
function loadingWeek(weekNumber: number): 1 | 2 | 3 | 4 {
  return (((weekNumber - 1) % 4) + 1) as 1 | 2 | 3 | 4;
}

/** Relative volume multiplier by macrocycle phase. */
const PHASE_FACTOR: Record<RacePhaseName, number> = { Base: 0.85, Build: 1.0, Peak: 1.1, Taper: 0.55 };

function applyVolumeCut(baseline: number, cutFraction: number): number {
  return baseline * (1 - cutFraction);
}

function maxWeeklyProgression(currentWeekLoad: number, capFraction = 0.1): number {
  return currentWeekLoad * (1 + capFraction);
}

export function targetWeeklyLoad(input: {
  baselineLoad: number;
  phase: RacePhaseName;
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
