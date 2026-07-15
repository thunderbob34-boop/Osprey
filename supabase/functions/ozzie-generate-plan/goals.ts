// Pure day-count routing for the weekly plan generator.
//
// The athlete's "primary endurance days" count (persisted historically as
// user_goals.weekly_run_days) is routed to whichever discipline their
// primary_goal implies — so a swimmer's training days become SWIM days, not
// run days. Cross-training toggles (includeSwim/includeBike) add one secondary
// day each, but never override a primary swim count.
//
// Invariant: for primaryGoal 'run' and 'hybrid' the output is identical to the
// pre-2b logic (run gets the primary days; swim/bike come only from the
// toggles; row is 0). Do not regress this.

export type EnduranceDiscipline = 'run' | 'swim' | 'rowing' | 'cycling';

// Goals whose *primary* training discipline is an endurance sport. Anything not
// listed (lift, weight_loss, general_fitness, triathlon, unknown) falls back to
// 'run', preserving the historical run-weighted split for those goals.
export const ENDURANCE_PRIMARY: Record<string, EnduranceDiscipline> = {
  run: 'run',
  hybrid: 'run',
  hyrox: 'run',
  swim: 'swim',
  rowing: 'rowing',
  cycling: 'cycling',
  ultra: 'run',
};

export interface DisciplineDays {
  weeklyRunDays: number;
  weeklyLiftDays: number;
  weeklySwimDays: number;
  weeklyBikeDays: number;
  weeklyRowDays: number;
}

export function routeDisciplineDays(
  primaryGoal: string,
  primaryDays: number,
  liftDays: number,
  includeSwim: boolean,
  includeBike: boolean,
): DisciplineDays {
  if (primaryGoal === 'lift') {
    // Strength-primary: the bulk of days are lifting; keep 1-2 easy-cardio days for
    // recovery (docs/coaching/powerlifting.md §5). primaryDays is the bigger share.
    return {
      weeklyRunDays: Math.min(2, liftDays),
      weeklyLiftDays: primaryDays,
      weeklySwimDays: includeSwim ? 1 : 0,
      weeklyBikeDays: includeBike ? 1 : 0,
      weeklyRowDays: 0,
    };
  }
  const discipline = ENDURANCE_PRIMARY[primaryGoal] ?? 'run';
  return {
    weeklyRunDays: discipline === 'run' ? primaryDays : 0,
    weeklyLiftDays: liftDays,
    weeklySwimDays: discipline === 'swim' ? primaryDays : includeSwim ? 1 : 0,
    weeklyBikeDays: discipline === 'cycling' ? primaryDays : includeBike ? 1 : 0,
    weeklyRowDays: discipline === 'rowing' ? primaryDays : 0,
  };
}
