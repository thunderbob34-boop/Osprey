import { supabase } from '@/services/supabase';
import type { OnboardingDraft } from '@/types/onboarding';

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

  // Upsert, not insert: user_goals has a UNIQUE(user_id) constraint
  // (015_race_goal_tracking.sql), so a retry after a partial failure, or
  // re-running onboarding, would otherwise fail with a duplicate-key error
  // and leave onboarding permanently stuck.
  const { error: goalsError } = await supabase.from('user_goals').upsert(
    {
      user_id: userId,
      primary_goal: draft.primaryGoal,
      weekly_run_days: draft.weeklyRunDays,
      weekly_lift_days: draft.weeklyLiftDays,
      fitness_level: draft.experienceTier,
    },
    { onConflict: 'user_id' },
  );

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
