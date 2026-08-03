import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingShell from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import { distanceLabelToKm } from '@/services/races';
import { Colors } from '@/constants/colors';
import { Theme, Radius } from '@/constants/theme';

const EXPERIENCE = '/(onboarding)/mode';
const DISTANCES = ['5K', '10K', 'Half', 'Marathon', 'Other'] as const;

// One race, entered directly — Runna's searchable race DB + "add it manually"
// fallback (docs/design-references/RUNNA-app-teardown.md screen #2) is a
// significant chunk of extra surface (live search, an external API, result
// caching); the manual path alone already satisfies WS1's acceptance
// criterion (a race with a date drives a real computeRacePhase()), so it's
// what ships here. A live-search entry point is a natural fast-follow, not a
// WS1 blocker.
export default function RaceScreen() {
  const router = useRouter();
  const raceGoal = useOnboardingStore((s) => s.raceGoal);
  const setRaceGoal = useOnboardingStore((s) => s.setRaceGoal);

  const [racing, setRacing] = useState(raceGoal != null);
  const [name, setName] = useState(raceGoal?.name ?? '');
  const [date, setDate] = useState(raceGoal?.date ?? '');
  const [distance, setDistance] = useState<(typeof DISTANCES)[number]>('Half');
  const [error, setError] = useState<string | null>(null);

  function onContinue() {
    setError(null);
    if (!racing) {
      setRaceGoal(null);
      router.push(EXPERIENCE);
      return;
    }
    if (!name.trim()) return setError('Give the race a name.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return setError('Enter the date as YYYY-MM-DD.');

    setRaceGoal({
      name: name.trim(),
      date: date.trim(),
      distanceKm: distance === 'Other' ? null : distanceLabelToKm(distance),
    });
    router.push(EXPERIENCE);
  }

  return (
    <OnboardingShell
      step={4}
      totalSteps={13}
      title="Racing something?"
      hint="A real date turns your plan into Base → Build → Peak → Taper instead of open-ended maintenance (docs/coaching/_index.md). Skip if you're not racing yet."
      onContinue={onContinue}
      continueLabel={racing ? 'Continue →' : "I'm not racing yet →"}
    >
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggle, racing && styles.toggleActive]}
          onPress={() => setRacing(true)}
          accessibilityRole="radio"
          accessibilityState={{ selected: racing }}
        >
          <Text style={[styles.toggleText, racing && styles.toggleTextActive]}>Yes, I have a race</Text>
        </Pressable>
        <Pressable
          style={[styles.toggle, !racing && styles.toggleActive]}
          onPress={() => setRacing(false)}
          accessibilityRole="radio"
          accessibilityState={{ selected: !racing }}
        >
          <Text style={[styles.toggleText, !racing && styles.toggleTextActive]}>Not yet</Text>
        </Pressable>
      </View>

      {racing ? (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>Race name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Novant Health Charlotte Marathon"
              placeholderTextColor={Theme.textMut}
              autoCapitalize="words"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Race date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="2026-11-14"
              placeholderTextColor={Theme.textMut}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Distance</Text>
            <View style={styles.chipRow}>
              {DISTANCES.map((d) => (
                <Pressable
                  key={d}
                  style={[styles.chip, distance === d && styles.chipSelected]}
                  onPress={() => setDistance(d)}
                  accessibilityRole="button"
                  accessibilityLabel={d}
                  accessibilityState={{ selected: distance === d }}
                >
                  <Text style={[styles.chipText, distance === d && styles.chipTextSelected]}>{d}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  toggle: {
    flex: 1,
    backgroundColor: Theme.panel,
    borderWidth: 1,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    paddingVertical: 14,
    alignItems: 'center',
  },
  toggleActive: { borderColor: Theme.accent },
  toggleText: { fontSize: 14, fontWeight: '700', color: Theme.textMut },
  toggleTextActive: { color: Theme.accent },
  field: { gap: 6, marginBottom: 12 },
  label: { fontSize: 13, color: Theme.textMut, fontWeight: '600' },
  input: {
    backgroundColor: Theme.ink,
    borderWidth: 1,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Theme.text,
    fontSize: 16,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: Theme.ink,
    borderWidth: 1,
    borderColor: Theme.line,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipSelected: { borderColor: Theme.accent },
  chipText: { fontSize: 14, fontWeight: '600', color: Theme.textMut },
  chipTextSelected: { color: Theme.accent },
  error: { fontSize: 12, color: Colors.red, marginTop: 4 },
});
