import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingShell from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import { anchorKeyForGoal } from '@/services/coaching/baseline';
import type { Weekday } from '@/types/onboarding';
import { Theme, Radius } from '@/constants/theme';

const LABEL: Record<Weekday, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

/**
 * Weekend-first default among the athlete's chosen available days — the
 * conventional long-session slot (matches the app's existing 'saturday'
 * fallback in services/onboarding.ts's toLongRunDay). A full duration-weighted
 * HealthKit proposal (which day tends to carry the longest session) would need
 * a second workout-duration pass beyond available-days.tsx's day-frequency
 * histogram; this simpler default is proposed as confirmable either way, so
 * the athlete corrects it in one tap if it's wrong.
 */
function proposeLongDay(available: Weekday[]): Weekday | null {
  if (available.includes('saturday')) return 'saturday';
  if (available.includes('sunday')) return 'sunday';
  return available[0] ?? null;
}

export default function LongDayScreen() {
  const router = useRouter();
  const primaryGoal = useOnboardingStore((s) => s.primaryGoal);
  const availableDays = useOnboardingStore((s) => s.availableDays);
  const longSessionDay = useOnboardingStore((s) => s.longSessionDay);
  const setLongSessionDay = useOnboardingStore((s) => s.setLongSessionDay);

  useEffect(() => {
    if (longSessionDay == null || !availableDays.includes(longSessionDay)) {
      setLongSessionDay(proposeLongDay(availableDays));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const key = anchorKeyForGoal(primaryGoal);
  const sessionWord = key === 'swim' ? 'swim' : key === 'row' ? 'row' : key === 'bike' ? 'ride' : key === 'run' ? 'run' : 'session';

  return (
    <OnboardingShell
      step={9}
      totalSteps={13}
      title="Which is your long session?"
      hint={`One day each week carries your longest ${sessionWord} — everything else builds around it. I've proposed one below; tap to change it.`}
      continueDisabled={longSessionDay == null}
      // anchor.tsx only has content for goals with an endurance anchor
      // (anchorKeyForGoal !== null) — lift/crossfit/weight_loss/general_fitness
      // skip straight to body-weight, same set baseline.tsx used to gate on.
      onContinue={() => router.push(key ? '/(onboarding)/anchor' : '/(onboarding)/body-weight')}
    >
      <View style={styles.dayRow}>
        {availableDays.map((day) => (
          <Pressable
            key={day}
            style={[styles.dayChip, longSessionDay === day && styles.dayChipSelected]}
            onPress={() => setLongSessionDay(day)}
            accessibilityRole="radio"
            accessibilityLabel={LABEL[day]}
            accessibilityState={{ selected: longSessionDay === day }}
          >
            <Text style={[styles.dayChipText, longSessionDay === day && styles.dayChipTextSelected]}>
              {LABEL[day]}
            </Text>
          </Pressable>
        ))}
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: {
    backgroundColor: Theme.panel,
    borderWidth: 1,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dayChipSelected: { borderColor: Theme.accent },
  dayChipText: { fontSize: 14, fontWeight: '600', color: Theme.textMut },
  dayChipTextSelected: { color: Theme.accent },
});
