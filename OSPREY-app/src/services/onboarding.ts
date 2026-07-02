import { supabase } from '@/services/supabase';
import type { OnboardingDraft } from '@/types/onboarding';

export async function completeOnboarding(userId: string, draft: OnboardingDraft): Promise<void> {
  // Goals and prefs are written (as upserts, so a retry after a partial
  // failure doesn't hit the UNIQUE(user_id) constraint on user_goals) before
  // users.onboarding_complete flips to true. Otherwise a failure between the
  // users update and the goals insert leaves onboarding_complete = true with
  // no goals row — the user skips onboarding on next launch with nothing set.
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
      health_connected: draft.healthConnected,
    },
    { onConflict: 'user_id' },
  );

  if (prefsError) throw prefsError;

  const { error: userError } = await supabase
    .from('users')
    .update({
      display_name: draft.displayName.trim(),
      experience_tier: draft.experienceTier,
      onboarding_complete: true,
    })
    .eq('id', userId);

  if (userError) throw userError;
}
