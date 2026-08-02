import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingShell from '@/components/onboarding/OnboardingShell';
import { NumberField } from '@/components/BaselineInputs';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { parseUltraParams, type UltraRaceDistance } from '@/services/coaching/ultra-params';
import { parseHyroxParams, HYROX_DIVISIONS, type HyroxDivision } from '@/services/coaching/hyrox-params';
import { parseStrengthParams } from '@/services/coaching/strength-params';
import { parseCrossfitParams } from '@/services/coaching/crossfit-params';
import { bestE1rmForLift, fetchLiftAnalytics } from '@/services/lift-analytics';
import { nextAfterEventParams } from '@/services/onboarding-routes';
import { Colors } from '@/constants/colors';
import { Theme, Radius } from '@/constants/theme';

const ULTRA_DISTANCES: UltraRaceDistance[] = ['50k', '50mi', '100k', '100mi'];
const HYROX_DIVISION_LABEL: Record<HyroxDivision, string> = {
  open_men: 'Open M', open_women: 'Open W', pro_men: 'Pro M', pro_women: 'Pro W',
  doubles_men: 'Dbl M', doubles_women: 'Dbl W', doubles_mixed: 'Dbl Mix',
};
const HYROX_DIVISION_OPTIONS: { value: HyroxDivision; label: string }[] = HYROX_DIVISIONS.map((value) => ({
  value,
  label: HYROX_DIVISION_LABEL[value],
}));

// The sport-specific structured inputs each blueprint needs beyond the shared
// engine (docs/coaching/_index.md's 4 inputs): ultra race shape, lift maxes,
// hyrox division, crossfit numbers. Split out of the old baseline.tsx, which
// combined these with the endurance threshold anchor on one screen — that
// screen is now anchor.tsx; this one is everything anchor.tsx doesn't cover.
// Locked as one screen per sport (not one screen per field) — three lifts is
// one question with three numbers, not three questions.
export default function EventParamsScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const primaryGoal = useOnboardingStore((s) => s.primaryGoal);
  const setGoalParams = useOnboardingStore((s) => s.setGoalParams);

  const [ultraDistance, setUltraDistance] = useState<UltraRaceDistance>('50k');
  const [ultraVert, setUltraVert] = useState('');
  const [gutTrained, setGutTrained] = useState(false);
  const [division, setDivision] = useState<HyroxDivision>('open_men');
  const [squat, setSquat] = useState(''); const [bench, setBench] = useState(''); const [deadlift, setDeadlift] = useState('');
  const [goalSquat, setGoalSquat] = useState(''); const [goalBench, setGoalBench] = useState(''); const [goalDeadlift, setGoalDeadlift] = useState('');
  const [backSquat, setBackSquat] = useState(''); const [crossfitDeadlift, setCrossfitDeadlift] = useState(''); const [press, setPress] = useState('');
  const [competing, setCompeting] = useState(false); const [fran, setFran] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Hybrid pre-fill: seed each 1RM from the athlete's logged sets when a value
  // exists — they can still edit before continuing.
  useEffect(() => {
    if (primaryGoal !== 'lift' || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const analytics = await fetchLiftAnalytics(userId);
        if (cancelled) return;
        const sq = bestE1rmForLift(analytics, 'squat');
        const be = bestE1rmForLift(analytics, 'bench');
        const dl = bestE1rmForLift(analytics, 'deadlift');
        if (sq != null) setSquat((v) => (v === '' ? String(sq) : v));
        if (be != null) setBench((v) => (v === '' ? String(be) : v));
        if (dl != null) setDeadlift((v) => (v === '' ? String(dl) : v));
      } catch {
        // Best-effort pre-fill — the athlete can still enter values manually.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [primaryGoal, userId]);

  function onContinue() {
    setError(null);
    const next = nextAfterEventParams(primaryGoal);
    if (primaryGoal === 'ultra') {
      const u = parseUltraParams({ raceDistance: ultraDistance, vertGainM: ultraVert, gutTrained });
      if (!u.ok) return setError(u.error);
      setGoalParams(u.value);
    } else if (primaryGoal === 'lift') {
      const s = parseStrengthParams({ squat, bench, deadlift, goalSquat, goalBench, goalDeadlift });
      if (!s.ok) return setError(s.error);
      setGoalParams(s.value);
    } else if (primaryGoal === 'crossfit') {
      const c = parseCrossfitParams({ backSquat, deadlift: crossfitDeadlift, press, competing, fran });
      if (!c.ok) return setError(c.error);
      setGoalParams(c.value);
    } else if (primaryGoal === 'hyrox') {
      const h = parseHyroxParams({ division, targetTimeMinutes: '' });
      if (!h.ok) return setError(h.error);
      setGoalParams(h.value);
    }
    router.push(next);
  }

  const title =
    primaryGoal === 'ultra' ? 'Your ultra race' :
    primaryGoal === 'hyrox' ? 'Your division' :
    primaryGoal === 'lift' ? 'Know your current maxes?' :
    'Know your crossfit numbers?';

  return (
    <OnboardingShell step={12} totalSteps={13} title={title} onContinue={onContinue} continueLabel="Continue →">
      {primaryGoal === 'ultra' ? (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>Race distance</Text>
            <View style={styles.chipRow}>
              {ULTRA_DISTANCES.map((d) => (
                <Pressable
                  key={d}
                  style={[styles.chip, ultraDistance === d && styles.chipSelected]}
                  onPress={() => setUltraDistance(d)}
                  accessibilityRole="button"
                  accessibilityLabel={d}
                  accessibilityState={{ selected: ultraDistance === d }}
                >
                  <Text style={[styles.chipText, ultraDistance === d && styles.chipTextSelected]}>{d}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Total race vert, metres (optional)</Text>
            <TextInput style={styles.input} value={ultraVert} onChangeText={setUltraVert} keyboardType="number-pad" placeholder="e.g. 2000" placeholderTextColor={Theme.textMut} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Fueling</Text>
            <View style={styles.chipRow}>
              <Pressable
                style={[styles.chip, gutTrained && styles.chipSelected]}
                onPress={() => setGutTrained((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityLabel="Gut-trained for race-day fueling"
                accessibilityState={{ checked: gutTrained }}
              >
                <Text style={[styles.chipText, gutTrained && styles.chipTextSelected]}>
                  🥤 Gut-trained (practiced high-carb fueling)
                </Text>
              </Pressable>
            </View>
          </View>
        </>
      ) : primaryGoal === 'lift' ? (
        <>
          <NumberField label="Squat — 1RM (kg)" value={squat} onChangeText={setSquat} placeholder="140" />
          <NumberField label="Bench — 1RM (kg)" value={bench} onChangeText={setBench} placeholder="100" />
          <NumberField label="Deadlift — 1RM (kg)" value={deadlift} onChangeText={setDeadlift} placeholder="180" />
          <NumberField label="Goal squat — 3rd attempt (kg, optional)" value={goalSquat} onChangeText={setGoalSquat} placeholder="150" />
          <NumberField label="Goal bench — 3rd attempt (kg, optional)" value={goalBench} onChangeText={setGoalBench} placeholder="105" />
          <NumberField label="Goal deadlift — 3rd attempt (kg, optional)" value={goalDeadlift} onChangeText={setGoalDeadlift} placeholder="190" />
        </>
      ) : primaryGoal === 'crossfit' ? (
        <>
          <NumberField label="Back squat — 1RM (kg, optional)" value={backSquat} onChangeText={setBackSquat} placeholder="120" />
          <NumberField label="Deadlift — 1RM (kg, optional)" value={crossfitDeadlift} onChangeText={setCrossfitDeadlift} placeholder="160" />
          <NumberField label="Press — 1RM (kg, optional)" value={press} onChangeText={setPress} placeholder="60" />
          <View style={styles.field}>
            <Text style={styles.label}>Competing?</Text>
            <View style={styles.chipRow}>
              <Pressable
                style={[styles.chip, competing && styles.chipSelected]}
                onPress={() => setCompeting((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityLabel="Training to compete (Open, etc.)"
                accessibilityState={{ checked: competing }}
              >
                <Text style={[styles.chipText, competing && styles.chipTextSelected]}>
                  🏆 Training to compete (Open, regionals, etc.)
                </Text>
              </Pressable>
            </View>
          </View>
          <NumberField label="Fran time — seconds (optional)" value={fran} onChangeText={setFran} placeholder="240" />
        </>
      ) : primaryGoal === 'hyrox' ? (
        <View style={styles.field}>
          <Text style={styles.label}>Division</Text>
          <View style={styles.chipRow}>
            {HYROX_DIVISION_OPTIONS.map((d) => (
              <Pressable
                key={d.value}
                style={[styles.chip, division === d.value && styles.chipSelected]}
                onPress={() => setDivision(d.value)}
                accessibilityRole="button"
                accessibilityLabel={d.label}
                accessibilityState={{ selected: division === d.value }}
              >
                <Text style={[styles.chipText, division === d.value && styles.chipTextSelected]}>{d.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6, marginBottom: 12 },
  label: { fontSize: 13, color: Theme.textMut, fontWeight: '600' },
  input: { backgroundColor: Theme.ink, borderWidth: 1, borderColor: Theme.line, borderRadius: Radius.card, paddingHorizontal: 14, paddingVertical: 12, color: Theme.text, fontSize: 16 },
  error: { fontSize: 12, color: Colors.red, marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: Theme.ink, borderWidth: 1, borderColor: Theme.line, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10 },
  chipSelected: { borderColor: Theme.accent },
  chipText: { fontSize: 14, fontWeight: '600', color: Theme.textMut },
  chipTextSelected: { color: Theme.accent },
});
