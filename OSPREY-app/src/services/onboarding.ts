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

  const { error: goalsError } = await supabase.from('user_goals').insert({
    user_id: userId,
    primary_goal: draft.primaryGoal,
    weekly_run_days: draft.weeklyRunDays,
    weekly_lift_days: draft.weeklyLiftDays,
    fitness_level: draft.experienceTier,
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
