import { supabase } from '@/services/supabase';
import type { OnboardingDraft } from '@/types/onboarding';

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Whole weeks between today and the target date, rounded up, minimum 1.
 * Returns null when there's no target date (matches user_goals.total_weeks_planned
 * being nullable for athletes without a race goal).
 */
function computeTotalWeeksPlanned(targetDate: string | null): number | null {
  if (!targetDate) return null;

  const target = new Date(`${targetDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;

  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const diffMs = target.getTime() - todayMidnight.getTime();
  const weeks = Math.ceil(diffMs / MS_PER_WEEK);
  return Math.max(1, weeks);
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
    target_race: draft.targetRaceName,
    target_date: draft.targetDate,
    injury_notes: draft.injuryNotes,
    constraint_tags: draft.constraintTags,
    total_weeks_planned: computeTotalWeeksPlanned(draft.targetDate),
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
