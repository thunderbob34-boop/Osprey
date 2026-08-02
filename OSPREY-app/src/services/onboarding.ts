import { supabase } from '@/services/supabase';
import { invokeGeneratePlan } from '@/services/coaching/build-envelope';
import { logWeight } from '@/services/body-metrics';
import { anchorPolicy } from '@/services/coaching/anchor-policy';
import type { AnchorConfidence, AnchorKey } from '@/services/coaching/baseline';
import type { OnboardingDraft, OnboardingRaceGoal, PrimaryGoal } from '@/types/onboarding';
import type { TrainingDaysPerWeek, TrainingGoal, UserPreferences } from '@/types/preferences';

const ANCHOR_UNIT: Record<AnchorKey, string> = {
  run: 'sec_per_mile',
  swim: 'sec_per_100m',
  row: 'sec_per_500m',
  bike: 'watts',
};

function anchorValue(entry: NonNullable<OnboardingDraft['thresholdAnchor']>[AnchorKey], key: AnchorKey): number {
  if (key === 'run') return (entry as { thresholdSecPerMile: number }).thresholdSecPerMile;
  if (key === 'swim') return (entry as { cssSecPer100: number }).cssSecPer100;
  if (key === 'row') return (entry as { splitSecPer500: number }).splitSecPer500;
  return (entry as { ftpWatts: number }).ftpWatts;
}

export interface AnchorHistoryRow {
  user_id: string;
  anchor_key: AnchorKey;
  value_numeric: number;
  unit: string;
  source: string;
  confidence: AnchorConfidence;
  effort_duration_s: number | null;
  qualifying_effort_count: number | null;
  reanchor_trigger: 'interval';
  reanchor_due_at: string;
  derived_from: object | null;
}

/**
 * One anchor_history row per entry in the athlete's just-confirmed threshold
 * map (baseline.tsx/the redesigned anchor screen only ever sets one key per
 * onboarding pass, but this handles the general case). anchor_history is
 * append-only (20260802000002_anchor_history.sql) — this is the FIRST row in
 * what becomes the athlete's fitness curve, not a value that gets overwritten.
 *
 * Self-reported anchors get 'moderate' confidence: anchor-policy.ts's duration/
 * count model measures extrapolation from a logged EFFORT, which doesn't apply
 * to a number the athlete typed directly — 'moderate' avoids both overclaiming
 * 'high' (unverified) and underclaiming 'low' (it's a deliberate, specific
 * answer, not a cold-start guess).
 */
export function buildAnchorHistoryRows(
  userId: string,
  draft: OnboardingDraft,
  now: Date = new Date(),
): AnchorHistoryRow[] {
  const map = draft.thresholdAnchor;
  if (!map) return [];

  return (Object.keys(map) as AnchorKey[])
    .filter((key) => map[key] != null)
    .map((key) => {
      const entry = map[key]!;
      const proposal = draft.anchorProposal?.key === key ? draft.anchorProposal : null;
      const confidence: AnchorConfidence = entry.confidence ?? proposal?.confidence ?? 'moderate';
      const dueAt = new Date(
        now.getTime() + anchorPolicy(confidence).reanchorIntervalDays * 24 * 60 * 60 * 1000,
      ).toISOString();

      return {
        user_id: userId,
        anchor_key: key,
        value_numeric: anchorValue(entry, key),
        unit: ANCHOR_UNIT[key],
        source: entry.source,
        confidence,
        effort_duration_s: proposal?.derivedFrom.timeS ?? null,
        qualifying_effort_count: proposal?.qualifyingEffortCount ?? null,
        reanchor_trigger: 'interval',
        reanchor_due_at: dueAt,
        derived_from: proposal?.derivedFrom ?? null,
      };
    });
}

// Onboarding's 5-value goal vocab -> the plan-builder's 6-value one — shared
// with app/preferences.tsx so a Preferences visit right after onboarding
// seeds from the same mapping instead of drifting apart.
export const ONBOARDING_GOAL_TO_PREFERENCES: Record<PrimaryGoal, TrainingGoal> = {
  run: 'run_performance',
  lift: 'strength',
  hybrid: 'hybrid',
  weight_loss: 'weight_loss',
  general_fitness: 'general',
  swim: 'swim',
  rowing: 'rowing',
  hyrox: 'hyrox',
  cycling: 'cycling',
  ultra: 'ultra',
  crossfit: 'crossfit',
};

// UserPreferences.longRunDay is 'saturday' | 'sunday' only, and — confirmed by
// grep across supabase/functions/ozzie-generate-plan/*.ts — it is never read
// server-side today; app/preferences.tsx sets it but nothing consumes it (a
// 2026-07-06 audit already flagged this as ignored). Widening the type or
// building real logic on it would be dressing up a dead field. This mapping is
// best-effort/future-proofing only: the real behavior change is that onboarding
// now persists the athlete's actual longSessionDay to user_goals.long_session_day
// (any of 7 days) for a later scheduling workstream to consume for real.
export function toLongRunDay(day: OnboardingDraft['longSessionDay']): 'saturday' | 'sunday' {
  return day === 'sunday' ? 'sunday' : 'saturday';
}

export function buildPlanPreferences(draft: OnboardingDraft): UserPreferences {
  const totalDays = draft.weeklyRunDays + draft.weeklyLiftDays;
  return {
    primaryGoal: ONBOARDING_GOAL_TO_PREFERENCES[draft.primaryGoal],
    experienceLevel: draft.experienceTier,
    daysPerWeek: Math.min(6, Math.max(3, totalDays)) as TrainingDaysPerWeek,
    longRunDay: toLongRunDay(draft.longSessionDay),
    includeSwim: false,
    includeBike: false,
    // Mirrors app/preferences.tsx's handleGenerate: without this, the edge function's
    // plan-builder-branch `user_goals` upsert writes `goal_params: null`, clobbering the
    // real value completeOnboarding just inserted (see onboarding.test.ts for the pin).
    goalParams: draft.goalParams ?? null,
  };
}

// Same min-4/max-20-week clamp app/race-event.tsx's weeksUntilRace applies when
// building a plan for a searched race — reused here so a race picked in
// onboarding periodizes the same way one picked later from Races does.
const MIN_WEEKS_PLANNED = 4;
const MAX_WEEKS_PLANNED = 20;

/** Weeks from today to the race date, clamped to a sane periodization range. */
export function weeksPlannedForRace(race: OnboardingRaceGoal, now: Date = new Date()): number {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = race.date.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const weeks = Math.floor((target.getTime() - today.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.max(MIN_WEEKS_PLANNED, Math.min(MAX_WEEKS_PLANNED, weeks));
}

/**
 * Generates the user's first training plan straight from onboarding answers,
 * so they land on Home with a real plan instead of the "no plan yet" banner.
 * Best-effort: a failure here shouldn't block onboarding completion — the
 * banner is a perfectly fine fallback if this doesn't come back in time.
 */
export async function generateInitialPlan(draft: OnboardingDraft): Promise<void> {
  const { error } = await invokeGeneratePlan({ preferences: buildPlanPreferences(draft), force: true });
  if (error) throw error;
}

export async function completeOnboarding(userId: string, draft: OnboardingDraft): Promise<void> {
  const { error: userError } = await supabase
    .from('users')
    .update({
      display_name: draft.displayName.trim(),
      experience_tier: draft.experienceTier,
      onboarding_complete: true,
    })
    .eq('id', userId);

  if (userError) throw userError;

  const { error: goalsError } = await supabase.from('user_goals').insert({
    user_id: userId,
    primary_goal: draft.primaryGoal,
    weekly_run_days: draft.weeklyRunDays,
    weekly_lift_days: draft.weeklyLiftDays,
    fitness_level: draft.experienceTier,
    threshold_anchor: draft.thresholdAnchor,
    goal_params: draft.goalParams ?? null,
    // target_race/target_date/total_weeks_planned already existed as columns
    // (20260702000015_race_goal_tracking.sql) — build-envelope.ts already reads
    // them and feeds computeRacePhase(); onboarding simply never wrote them.
    // Written directly here (not via invokeGeneratePlan's raceTarget branch,
    // which is mutually exclusive with the preferences branch generateInitialPlan
    // below uses) so the very next call already sees a real race phase.
    target_race: draft.raceGoal?.name ?? null,
    target_date: draft.raceGoal?.date ?? null,
    total_weeks_planned: draft.raceGoal ? weeksPlannedForRace(draft.raceGoal) : null,
    // available_days/long_session_day/equipment: WS1's single availability
    // model (docs/superpowers/plans/2026-08-02-runna-gap-close.md WS1). No plan
    // effect yet — persisted now for a later scheduling workstream, rather than
    // asked for twice. injury_history is left NULL (its column default) —
    // reserved for WS2, never written here.
    available_days: draft.availableDays.length > 0 ? draft.availableDays : null,
    long_session_day: draft.longSessionDay,
    equipment: draft.equipment.length > 0 ? draft.equipment : null,
  });

  if (goalsError) throw goalsError;

  // Best-effort, like generateInitialPlan below: the ledger is valuable but
  // secondary to the account/goals/prefs writes above — a failed insert here
  // shouldn't block finishing onboarding. user_goals.threshold_anchor (just
  // written above) remains the source of truth for the CURRENT anchor either way.
  const historyRows = buildAnchorHistoryRows(userId, draft);
  if (historyRows.length > 0) {
    const { error: historyError } = await supabase.from('anchor_history').insert(historyRows);
    if (historyError) console.error('[onboarding] anchor_history insert failed', historyError);
  }

  // build-envelope.ts defaults to 70kg when body_metrics has no row, silently
  // falsifying every per-kg fuel number. Best-effort, like generateInitialPlan
  // below: a failed weight write shouldn't block finishing onboarding — the
  // 70kg default is a safe (if imprecise) fallback, and the athlete can log a
  // real weigh-in any time from Settings.
  if (draft.bodyWeightKg != null) {
    await logWeight(userId, draft.bodyWeightKg).catch(() => undefined);
  }

  const { error: prefsError } = await supabase.from('user_preferences').upsert(
    {
      user_id: userId,
      notification_enabled: true,
      audio_cues_enabled: true,
    },
    { onConflict: 'user_id' },
  );

  if (prefsError) throw prefsError;
}
