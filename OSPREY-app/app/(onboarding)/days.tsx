import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingShell, { DayCountPicker } from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import { primaryDayLabel } from '@/constants/sports';
import { Theme } from '@/constants/theme';

// Split out of the old goals.tsx's combined "weekly schedule" card — one
// question per screen. Helper line is sourced coaching rationale, not filler
// (docs/coaching/_index.md's 3:1 loading / ~10%-a-week progression principle).
export default function DaysScreen() {
  const router = useRouter();
  const primaryGoal = useOnboardingStore((s) => s.primaryGoal);
  const weeklyRunDays = useOnboardingStore((s) => s.weeklyRunDays);
  const setWeeklyRunDays = useOnboardingStore((s) => s.setWeeklyRunDays);

  return (
    <OnboardingShell
      step={6}
      totalSteps={13}
      title={`How many ${primaryDayLabel(primaryGoal).toLowerCase()}?`}
      hint="At most one more day than you train now — load should climb about 10% a week, no faster, or the ramp outpaces what your tendons and joints can absorb (docs/coaching/_index.md)."
      continueDisabled={weeklyRunDays === 0}
      onContinue={() =>
        router.push(primaryGoal === 'lift' ? '/(onboarding)/available-days' : '/(onboarding)/split')
      }
    >
      <DayCountPicker label={primaryDayLabel(primaryGoal)} value={weeklyRunDays} onChange={setWeeklyRunDays} />
      {weeklyRunDays === 0 ? <Text style={styles.zeroHint}>Pick at least one day to continue.</Text> : null}
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  zeroHint: { fontSize: 12, color: Theme.textMut, textAlign: 'center', marginTop: 8 },
});
