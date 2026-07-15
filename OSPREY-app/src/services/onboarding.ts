import { supabase } from '@/services/supabase';
import { invokeGeneratePlan } from '@/services/coaching/build-envelope';
import type { OnboardingDraft, PrimaryGoal } from '@/types/onboarding';
import type { TrainingDaysPerWeek, TrainingGoal, UserPreferences } from '@/types/preferences';

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
};

export function buildPlanPreferences(draft: OnboardingDraft): UserPreferences {
  const totalDays = draft.weeklyRunDays + draft.weeklyLiftDays;
  return {
    primaryGoal: ONBOARDING_GOAL_TO_PREFERENCES[draft.primaryGoal],
    experienceLevel: draft.experienceTier,
    daysPerWeek: Math.min(6, Math.max(3, totalDays)) as TrainingDaysPerWeek,
    longRunDay: 'saturday',
    includeSwim: false,
    includeBike: false,
    // Mirrors app/preferences.tsx's handleGenerate: without this, the edge function's
    // plan-builder-branch `user_goals` upsert writes `goal_params: null`, clobbering the
    // real value completeOnboarding just inserted (see onboarding.test.ts for the pin).
    goalParams: draft.goalParams ?? null,
  };
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
  });

  if (goalsError) throw goalsError;

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
