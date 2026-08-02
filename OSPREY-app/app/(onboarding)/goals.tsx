import { useRouter } from 'expo-router';
import OnboardingShell, { OptionCard } from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import type { PrimaryGoal } from '@/types/onboarding';

const GOALS: Array<{ id: PrimaryGoal; icon: string; title: string; desc: string }> = [
  { id: 'run', icon: '🏃', title: 'Run better', desc: '5K, 10K, half, full marathon' },
  { id: 'ultra', icon: '⛰️', title: 'Go ultra', desc: '50k to 100 miles — trail & mountain' },
  { id: 'lift', icon: '🏋️', title: 'Get stronger', desc: 'Lift more, build muscle' },
  { id: 'hybrid', icon: '⚡', title: 'Hybrid athlete', desc: 'Run and lift — both matter' },
  { id: 'swim', icon: '🏊', title: 'Swim faster', desc: 'Pool or open water — CSS-paced zones' },
  { id: 'rowing', icon: '🚣', title: 'Row stronger', desc: 'Erg or water — 2k-split zones' },
  { id: 'hyrox', icon: '🏋️‍♂️', title: 'Hyrox', desc: 'Run + functional strength stations' },
  { id: 'crossfit', icon: '🤸', title: 'CrossFit', desc: 'Squat, deadlift, press — plus benchmark WODs' },
  { id: 'cycling', icon: '🚴', title: 'Ride faster', desc: 'Road or indoor — power & HR zones' },
  { id: 'weight_loss', icon: '⚖️', title: 'Lose weight', desc: 'Performance + body composition' },
];

// WS1: one question per screen (docs/design-references/RUNNA-app-teardown.md
// Part II). Weekly schedule used to live on this same screen as two day-picker
// widgets — split into days.tsx/split.tsx so this screen is just the goal.
export default function GoalsScreen() {
  const router = useRouter();
  const primaryGoal = useOnboardingStore((s) => s.primaryGoal);
  const setPrimaryGoal = useOnboardingStore((s) => s.setPrimaryGoal);

  return (
    <OnboardingShell
      step={3}
      totalSteps={13}
      title="What's your main goal right now?"
      hint="This shapes your entire plan. You can always change it later."
      onContinue={() => router.push('/(onboarding)/race')}
    >
      {GOALS.map((goal) => (
        <OptionCard
          key={goal.id}
          icon={goal.icon}
          title={goal.title}
          description={goal.desc}
          selected={primaryGoal === goal.id}
          onPress={() => setPrimaryGoal(goal.id)}
        />
      ))}
    </OnboardingShell>
  );
}
