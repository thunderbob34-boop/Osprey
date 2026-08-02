import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingShell from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import { fetchLatestBodyWeightKg } from '@/services/healthkit';
import { kgToLb, lbToKg } from '@/services/body-metrics';
import { nextAfterBodyWeight } from '@/services/onboarding-routes';
import { Colors } from '@/constants/colors';
import { Theme, Radius } from '@/constants/theme';

// build-envelope.ts silently defaults to 70kg when body_metrics has no row —
// that default quietly falsifies every per-kg fuel number (carbs/hr, sodium,
// protein). Proposed from HealthKit rather than asked blank, per the same
// "propose, don't interrogate" rule as availability and the anchor screen.
export default function BodyWeightScreen() {
  const router = useRouter();
  const primaryGoal = useOnboardingStore((s) => s.primaryGoal);
  const healthConnected = useOnboardingStore((s) => s.healthConnected);
  const bodyWeightKg = useOnboardingStore((s) => s.bodyWeightKg);
  const setBodyWeightKg = useOnboardingStore((s) => s.setBodyWeightKg);
  const [input, setInput] = useState(bodyWeightKg != null ? String(kgToLb(bodyWeightKg)) : '');
  const [proposed, setProposed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!healthConnected || bodyWeightKg != null) return;
    setLoading(true);
    fetchLatestBodyWeightKg()
      .then((kg) => {
        if (kg != null) {
          setBodyWeightKg(kg);
          setInput(String(kgToLb(kg)));
          setProposed(true);
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onContinue() {
    setError(null);
    const lb = Number(input.trim());
    if (!Number.isFinite(lb) || lb <= 0 || lb > 1000) return setError('Enter your weight in lbs.');
    setBodyWeightKg(lbToKg(lb));
    router.push(nextAfterBodyWeight(primaryGoal));
  }

  function onSkip() {
    // Not a hard blocker — build-envelope.ts's 70kg default is imprecise but
    // safe, and the athlete can log a real weigh-in any time from Settings.
    setBodyWeightKg(null);
    router.push(nextAfterBodyWeight(primaryGoal));
  }

  return (
    <OnboardingShell
      step={11}
      totalSteps={13}
      title={proposed ? 'Confirm your weight' : "What's your body weight?"}
      hint="Your fuel plan — carbs and sodium per hour — scales off this, so it matters more than it sounds like it should (docs/coaching/_index.md)."
      onContinue={onContinue}
    >
      {loading ? <ActivityIndicator color={Theme.accent} style={styles.spinner} /> : null}
      <View style={styles.field}>
        <Text style={styles.label}>Weight (lbs)</Text>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={(v) => {
            setInput(v);
            setProposed(false);
          }}
          keyboardType="decimal-pad"
          placeholder="165"
          placeholderTextColor={Theme.textMut}
        />
      </View>
      {proposed ? <Text style={styles.proposedNote}>From your most recent Apple Health weigh-in.</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={onSkip} accessibilityRole="button">
        <Text style={styles.skip}>Skip — estimate for me</Text>
      </Pressable>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  spinner: { marginBottom: 12 },
  field: { gap: 6, marginBottom: 8 },
  label: { fontSize: 13, color: Theme.textMut, fontWeight: '600' },
  input: { backgroundColor: Theme.ink, borderWidth: 1, borderColor: Theme.line, borderRadius: Radius.card, paddingHorizontal: 14, paddingVertical: 12, color: Theme.text, fontSize: 16 },
  proposedNote: { fontSize: 12, color: Theme.textSoft },
  error: { fontSize: 12, color: Colors.red, marginTop: 4 },
  skip: { fontSize: 13, color: Theme.textMut, textAlign: 'center', marginTop: 16, textDecorationLine: 'underline' },
});
