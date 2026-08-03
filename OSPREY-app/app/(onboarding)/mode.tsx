import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingShell, { OptionCard } from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import { Theme } from '@/constants/theme';

// Self-assessment stays self-report — unlike days/anchor/weight below, "how
// would you describe yourself" is a subjective read on your own training, not
// a fact HealthKit can propose without silently overriding how the athlete
// actually experiences their training. Repositioned from step 2 to after
// goal+race so the copy can reference "the plan" concretely.
export default function ModeScreen() {
  const router = useRouter();
  const experienceTier = useOnboardingStore((s) => s.experienceTier);
  const setExperienceTier = useOnboardingStore((s) => s.setExperienceTier);

  return (
    <OnboardingShell
      step={5}
      totalSteps={13}
      title="How would you describe yourself as a trainer right now?"
      hint="This sets how I talk to you and what metrics I focus on. You can change it any time."
      onContinue={() => router.push('/(onboarding)/days')}
    >
      <OptionCard
        icon="🌱"
        title="Just getting started"
        description="New to structured training or getting back into it. I'll keep it simple — pace and effort, not TSS and CTL."
        selected={experienceTier === 'beginner'}
        onPress={() => setExperienceTier('beginner')}
      />
      <OptionCard
        icon="📈"
        title="Building consistency"
        description="Training regularly for 1–2 years. I'm ready for structure and want to see the metrics."
        selected={experienceTier === 'intermediate'}
        onPress={() => setExperienceTier('intermediate')}
      />
      <OptionCard
        icon="🏆"
        title="I have a training base"
        description="You train regularly with race goals or lifting PRs. I'll get into the data and push you."
        selected={experienceTier === 'advanced'}
        onPress={() => setExperienceTier('advanced')}
      />
      <Text style={styles.note}>You can change this any time in Settings → Training Preferences</Text>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  note: {
    marginTop: 4,
    fontSize: 11,
    color: Theme.textMut,
    textAlign: 'center',
  },
});
