// Pure logic for the three "rebuild my plan" entry points (background regen,
// Preferences regen, race-target regen) so their fix behavior is unit-testable
// without a live Supabase client. index.ts is the only importer.

/** Bare `force: true` alone now triggers a rebuild — previously required
 *  `preferences` or `raceTarget` to ALSO be present, which silently no-op'd
 *  a bare-force call (the training-baseline "Rebuild this week?" offer relies
 *  on exactly this: it posts `{ force: true }` with neither field). */
export function resolveForceRebuild(body: { force?: unknown }): boolean {
  return body.force === true;
}

export interface PreferencesGoalsUpsert {
  primary_goal: string;
  weekly_run_days: number;
  weekly_lift_days: number;
  fitness_level: string;
  goal_params: unknown;
}

/** The preferences-regen upsert payload — deliberately omits target_race/
 *  target_date/total_weeks_planned so Supabase's upsert() ON CONFLICT clause
 *  leaves the athlete's existing race context untouched. Previously these
 *  three keys were included as explicit nulls, wiping any stored race on
 *  every "Regenerate My Plan" call from Preferences. */
export function buildPreferencesGoalsUpsert(
  primaryGoal: string,
  primaryDaysForStorage: number,
  weeklyLiftDays: number,
  fitnessLevel: string,
  goalParams: unknown,
): PreferencesGoalsUpsert {
  return {
    primary_goal: primaryGoal,
    weekly_run_days: primaryDaysForStorage,
    weekly_lift_days: weeklyLiftDays,
    fitness_level: fitnessLevel,
    goal_params: goalParams,
  };
}

/** total_weeks_planned for a raceTarget regen. Re-targeting the SAME race
 *  (same raceDate as what's already stored) preserves the existing stored
 *  value instead of recomputing weeksOut fresh from today — otherwise every
 *  rebuild of the same race resets the week-of-N counter to whatever
 *  weeks-remaining-from-today happens to be right now. A genuinely
 *  new/different race still gets its freshly computed weeksOut. */
export function resolveRaceWeeksPlanned(
  race: { raceDate?: string | null; weeksOut?: number },
  existingTargetDate: string | null | undefined,
  existingTotalWeeksPlanned: number | null | undefined,
): number | null {
  const isSameRace = race.raceDate != null && race.raceDate === existingTargetDate;
  return isSameRace ? existingTotalWeeksPlanned ?? null : race.weeksOut ?? null;
}
