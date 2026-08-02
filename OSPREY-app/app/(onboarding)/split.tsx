import { useRouter } from 'expo-router';
import OnboardingShell, { DayCountPicker } from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';

// Second half of the old goals.tsx's combined day-picker card. Not shown for
// primaryGoal === 'lift' — days.tsx already asked "how many lift days" as ITS
// primary question there (primaryDayLabel('lift') === 'Lift days per week'),
// so asking it again here would render the exact same label twice — a live
// instance of the "same screen twice" pattern the teardown calls out in Runna
// (running-days asked identically for both running and strength availability).
// days.tsx routes 'lift' straight past this screen.
export default function SplitScreen() {
  const router = useRouter();
  const weeklyLiftDays = useOnboardingStore((s) => s.weeklyLiftDays);
  const setWeeklyLiftDays = useOnboardingStore((s) => s.setWeeklyLiftDays);

  return (
    <OnboardingShell
      step={7}
      totalSteps={13}
      title="How many lift days per week?"
      hint="More isn't always best — 1-2 focused strength sessions alongside your other training beats squeezing in a fourth that just adds fatigue."
      onContinue={() => router.push('/(onboarding)/available-days')}
    >
      <DayCountPicker label="Lift days per week" value={weeklyLiftDays} onChange={setWeeklyLiftDays} />
    </OnboardingShell>
  );
}
