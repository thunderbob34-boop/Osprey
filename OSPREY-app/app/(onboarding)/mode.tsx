import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingShell, { OptionCard } from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import { Colors } from '@/constants/colors';

export default function ModeScreen() {
  const router = useRouter();
  const experienceTier = useOnboardingStore((s) => s.experienceTier);
  const setExperienceTier = useOnboardingStore((s) => s.setExperienceTier);

  return (
    <OnboardingShell
      step={2}
      totalSteps={5}
      title="How would you describe yourself as a trainer right now?"
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
      <Text style={styles.note}>You can switch modes any time in Settings</Text>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  note: {
    marginTop: 4,
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
