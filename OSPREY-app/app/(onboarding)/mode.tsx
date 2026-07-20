import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingShell, { OptionCard } from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import { onboardingTotalSteps } from '@/services/coaching/baseline';
import { Theme } from '@/constants/theme';

export default function ModeScreen() {
  const router = useRouter();
  const experienceTier = useOnboardingStore((s) => s.experienceTier);
  const setExperienceTier = useOnboardingStore((s) => s.setExperienceTier);
  const primaryGoal = useOnboardingStore((s) => s.primaryGoal);

  return (
    <OnboardingShell
      step={2}
      totalSteps={onboardingTotalSteps(primaryGoal)}
      title="How would you describe your training right now?"
      hint="This sets how I talk to you and what metrics I focus on. You can change it any time."
      onContinue={() => router.push('/(onboarding)/goals')}
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
        description="You've trained consistently for 1–2 years. I'll add structure and show you the metrics."
        selected={experienceTier === 'intermediate'}
        onPress={() => setExperienceTier('intermediate')}
      />
      <OptionCard
        icon="🏆"
        title="Racing and chasing PRs"
        description="You train regularly with race goals or lifting PRs. I'll get into the data and push you."
        selected={experienceTier === 'advanced'}
        onPress={() => setExperienceTier('advanced')}
      />
      <Text style={styles.note}>You can change this any time in Settings → Training Preferences.</Text>
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
