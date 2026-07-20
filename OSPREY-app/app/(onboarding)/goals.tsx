import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingShell, { OptionCard } from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import type { PrimaryGoal } from '@/types/onboarding';
import { Theme, Radius, BorderWidth } from '@/constants/theme';
import { primaryDayLabel } from '@/constants/sports';
import { hasBaselineStep, onboardingTotalSteps } from '@/services/coaching/baseline';

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

function DayPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.dayPicker}>
      <Text style={styles.dayLabel}>{label}</Text>
      <View style={styles.dayRow}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((day) => (
          <TouchableOpacity
            key={day}
            style={[styles.dayBtn, value === day && styles.dayBtnActive]}
            onPress={() => onChange(day)}
            accessibilityRole="button"
            accessibilityLabel={`${day} ${label}`}
            accessibilityState={{ selected: value === day }}
            hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
          >
            <Text style={[styles.dayBtnText, value === day && styles.dayBtnTextActive]}>
              {day}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function GoalsScreen() {
  const router = useRouter();
  const primaryGoal = useOnboardingStore((s) => s.primaryGoal);
  const weeklyRunDays = useOnboardingStore((s) => s.weeklyRunDays);
  const weeklyLiftDays = useOnboardingStore((s) => s.weeklyLiftDays);
  const setPrimaryGoal = useOnboardingStore((s) => s.setPrimaryGoal);
  const setWeeklyRunDays = useOnboardingStore((s) => s.setWeeklyRunDays);
  const setWeeklyLiftDays = useOnboardingStore((s) => s.setWeeklyLiftDays);

  return (
    <OnboardingShell
      step={3}
      totalSteps={onboardingTotalSteps(primaryGoal)}
      title="What's your main goal right now?"
      hint="This shapes your entire plan. You can always change it later."
      continueDisabled={weeklyRunDays + weeklyLiftDays === 0}
      onContinue={() =>
        router.push(hasBaselineStep(primaryGoal) ? '/(onboarding)/baseline' : '/(onboarding)/health')
      }
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

      <View style={styles.scheduleCard}>
        <Text style={styles.scheduleTitle}>WEEKLY SCHEDULE</Text>
        <DayPicker label={primaryDayLabel(primaryGoal)} value={weeklyRunDays} onChange={setWeeklyRunDays} />
        <DayPicker label="Lift days per week" value={weeklyLiftDays} onChange={setWeeklyLiftDays} />
      </View>
      {weeklyRunDays + weeklyLiftDays === 0 ? (
        <Text style={styles.zeroDaysHint}>Pick at least one training day to continue.</Text>
      ) : null}
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  zeroDaysHint: {
    fontSize: 12,
    color: Theme.textMut,
    textAlign: 'center',
    marginTop: 8,
  },
  scheduleCard: {
    marginTop: 8,
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 16,
    gap: 16,
  },
  scheduleTitle: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Theme.accent,
    letterSpacing: 1,
  },
  dayPicker: {
    gap: 8,
  },
  dayLabel: {
    fontSize: 13,
    color: Theme.textMut,
    fontWeight: '600',
  },
  dayRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  dayBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.card,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: Theme.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBtnActive: {
    borderColor: Theme.accent,
  },
  dayBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.textMut,
  },
  dayBtnTextActive: {
    color: Theme.accent,
  },
});
