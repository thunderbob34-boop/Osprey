import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingShell, { OptionCard } from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import type { PrimaryGoal } from '@/types/onboarding';
import { Colors } from '@/constants/colors';

const GOALS: Array<{ id: PrimaryGoal; icon: string; title: string; desc: string }> = [
  { id: 'run', icon: '🏃', title: 'Run better', desc: '5K, 10K, half, full marathon' },
  { id: 'lift', icon: '🏋️', title: 'Get stronger', desc: 'Lift more, build muscle' },
  { id: 'hybrid', icon: '⚡', title: 'Hybrid athlete', desc: 'Run and lift — both matter' },
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
      totalSteps={5}
      title="What's your main goal right now?"
      hint="This shapes your entire plan. You can always change it later."
      onContinue={() => router.push('/(onboarding)/health')}
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
        <DayPicker label="Run days per week" value={weeklyRunDays} onChange={setWeeklyRunDays} />
        <DayPicker label="Lift days per week" value={weeklyLiftDays} onChange={setWeeklyLiftDays} />
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  scheduleCard: {
    marginTop: 8,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 16,
  },
  scheduleTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  dayPicker: {
    gap: 8,
  },
  dayLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
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
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBtnActive: {
    backgroundColor: Colors.tealDim,
    borderColor: Colors.borderTeal,
  },
  dayBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  dayBtnTextActive: {
    color: Colors.teal,
  },
});
