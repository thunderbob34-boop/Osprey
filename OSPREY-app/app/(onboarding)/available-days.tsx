import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingShell from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import { fetchHealthKitWorkouts } from '@/services/healthkit';
import { ANCHOR_LOOKBACK_DAYS } from '@/services/coaching/performance-anchor';
import type { Weekday } from '@/types/onboarding';
import { Theme, Radius } from '@/constants/theme';

const DAYS: { id: Weekday; label: string }[] = [
  { id: 'monday', label: 'Mon' },
  { id: 'tuesday', label: 'Tue' },
  { id: 'wednesday', label: 'Wed' },
  { id: 'thursday', label: 'Thu' },
  { id: 'friday', label: 'Fri' },
  { id: 'saturday', label: 'Sat' },
  { id: 'sunday', label: 'Sun' },
];
const WEEKDAY_BY_JS_INDEX: Weekday[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Which weekdays the athlete actually trained most, from 90 days of HealthKit
 *  workouts — the single availability model this screen proposes from instead
 *  of asking blank (docs/design-references/RUNNA-app-teardown.md's "propose,
 *  don't interrogate", and the fix for Runna asking this exact 7-day picker
 *  twice with no data behind either pass). */
async function proposeAvailableDays(minCount: number): Promise<Weekday[]> {
  const since = new Date(Date.now() - ANCHOR_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const workouts = await fetchHealthKitWorkouts(since);
  if (workouts.length === 0) return [];

  const counts = new Map<Weekday, number>();
  for (const w of workouts) {
    const day = WEEKDAY_BY_JS_INDEX[new Date(w.startedAt).getDay()];
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(minCount, 1))
    .map(([day]) => day);
}

export default function AvailableDaysScreen() {
  const router = useRouter();
  const healthConnected = useOnboardingStore((s) => s.healthConnected);
  const weeklyRunDays = useOnboardingStore((s) => s.weeklyRunDays);
  const weeklyLiftDays = useOnboardingStore((s) => s.weeklyLiftDays);
  const availableDays = useOnboardingStore((s) => s.availableDays);
  const setAvailableDays = useOnboardingStore((s) => s.setAvailableDays);
  const [proposing, setProposing] = useState(false);

  const minCount = weeklyRunDays + weeklyLiftDays;

  useEffect(() => {
    if (!healthConnected || availableDays.length > 0) return;
    setProposing(true);
    proposeAvailableDays(minCount)
      .then((proposed) => {
        if (proposed.length > 0) setAvailableDays(proposed);
      })
      .finally(() => setProposing(false));
    // Runs once on mount for a HealthKit-connected athlete with nothing chosen
    // yet — re-running on every render would fight the athlete's own taps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleDay(day: Weekday) {
    setAvailableDays(
      availableDays.includes(day) ? availableDays.filter((d) => d !== day) : [...availableDays, day],
    );
  }

  return (
    <OnboardingShell
      step={8}
      totalSteps={13}
      title="Which days are you free to train?"
      hint={
        healthConnected
          ? "I've highlighted the days you train most often — tap to adjust."
          : `Pick at least ${minCount} day${minCount === 1 ? '' : 's'} — one for each session you told me about.`
      }
      continueDisabled={availableDays.length < minCount}
      onContinue={() => router.push('/(onboarding)/long-day')}
    >
      {proposing ? <ActivityIndicator color={Theme.accent} style={styles.spinner} /> : null}
      <View style={styles.dayRow}>
        {DAYS.map((d) => (
          <Pressable
            key={d.id}
            style={[styles.dayChip, availableDays.includes(d.id) && styles.dayChipSelected]}
            onPress={() => toggleDay(d.id)}
            accessibilityRole="checkbox"
            accessibilityLabel={d.label}
            accessibilityState={{ checked: availableDays.includes(d.id) }}
          >
            <Text style={[styles.dayChipText, availableDays.includes(d.id) && styles.dayChipTextSelected]}>
              {d.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {availableDays.length < minCount ? (
        <Text style={styles.hint}>
          {availableDays.length}/{minCount} selected
        </Text>
      ) : null}
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  spinner: { marginBottom: 12 },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: {
    width: 46,
    height: 46,
    borderRadius: Radius.card,
    backgroundColor: Theme.panel,
    borderWidth: 1,
    borderColor: Theme.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipSelected: { borderColor: Theme.accent },
  dayChipText: { fontSize: 13, fontWeight: '700', color: Theme.textMut },
  dayChipTextSelected: { color: Theme.accent },
  hint: { fontSize: 12, color: Theme.textMut, textAlign: 'center', marginTop: 12 },
});
