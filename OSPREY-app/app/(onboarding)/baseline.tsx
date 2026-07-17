import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingShell from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import {
  parseSwimBaseline,
  parseRowingBaseline,
  parseRunBaseline,
  parseFTPBaseline,
  anchorKeyForGoal,
  type ThresholdAnchorMap,
} from '@/services/coaching/baseline';
import { estimateFTPFromTwentyMinPower } from '@/services/calculators/triathlon';
import { parseUltraParams, type UltraRaceDistance } from '@/services/coaching/ultra-params';
import { parseHyroxParams, type HyroxDivision } from '@/services/coaching/hyrox-params';
import { parseStrengthParams } from '@/services/coaching/strength-params';
import { parseCrossfitParams } from '@/services/coaching/crossfit-params';
import { bestE1rmForLift, fetchLiftAnalytics } from '@/services/lift-analytics';
import { Colors } from '@/constants/colors';

const HEALTH = '/(onboarding)/health';
const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
const mmss = (m: string, s: string) => num(m) * 60 + num(s);
const ULTRA_DISTANCES: UltraRaceDistance[] = ['50k', '50mi', '100k', '100mi'];
const HYROX_DIVISIONS: { value: HyroxDivision; label: string }[] = [
  { value: 'open_men', label: 'Open M' },
  { value: 'open_women', label: 'Open W' },
  { value: 'pro_men', label: 'Pro M' },
  { value: 'pro_women', label: 'Pro W' },
];

export default function BaselineScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const primaryGoal = useOnboardingStore((s) => s.primaryGoal);
  const setThresholdAnchor = useOnboardingStore((s) => s.setThresholdAnchor);
  const setGoalParams = useOnboardingStore((s) => s.setGoalParams);
  const key = anchorKeyForGoal(primaryGoal);

  // Fields (times as minutes + seconds; run distance in miles).
  const [swim400m, setSwim400m] = useState(''); const [swim400s, setSwim400s] = useState('');
  const [swim200m, setSwim200m] = useState(''); const [swim200s, setSwim200s] = useState('');
  const [row2kM, setRow2kM] = useState(''); const [row2kS, setRow2kS] = useState('');
  const [runMiles, setRunMiles] = useState(''); const [runMin, setRunMin] = useState(''); const [runSec, setRunSec] = useState('');
  const [ftp, setFtp] = useState(''); const [twentyMin, setTwentyMin] = useState('');
  const [ultraDistance, setUltraDistance] = useState<UltraRaceDistance>('50k');
  const [ultraVert, setUltraVert] = useState('');
  const [gutTrained, setGutTrained] = useState(false);
  const [division, setDivision] = useState<HyroxDivision>('open_men');
  const [squat, setSquat] = useState(''); const [bench, setBench] = useState(''); const [deadlift, setDeadlift] = useState('');
  const [goalSquat, setGoalSquat] = useState(''); const [goalBench, setGoalBench] = useState(''); const [goalDeadlift, setGoalDeadlift] = useState('');
  // CrossFit's deadlift is a separate field from lift's (different GoalParams shape) —
  // named distinctly to avoid colliding with the `deadlift` state above.
  const [backSquat, setBackSquat] = useState(''); const [crossfitDeadlift, setCrossfitDeadlift] = useState(''); const [press, setPress] = useState('');
  const [competing, setCompeting] = useState(false); const [fran, setFran] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Hybrid pre-fill: seed each 1RM from the athlete's logged sets (best e1RM
  // per lift) when a value exists. They can still edit before continuing.
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

  function onSkip() {
    // Preserve any race/sport params the athlete already entered on this screen
    // even when skipping the optional recent-effort anchor.
    if (primaryGoal === 'ultra') {
      const u = parseUltraParams({ raceDistance: ultraDistance, vertGainM: ultraVert, gutTrained });
      if (u.ok) setGoalParams(u.value);
    }
    if (primaryGoal === 'hyrox') {
      const h = parseHyroxParams({ division, targetTimeMinutes: '' });
      if (h.ok) setGoalParams(h.value);
    }
    if (primaryGoal === 'crossfit') {
      const c = parseCrossfitParams({ backSquat, deadlift: crossfitDeadlift, press, competing, fran });
      if (c.ok) setGoalParams(c.value);
    }
    router.push(HEALTH);
  }

  function onContinue() {
    setError(null);
    if (primaryGoal === 'ultra') {
      const u = parseUltraParams({ raceDistance: ultraDistance, vertGainM: ultraVert, gutTrained });
      if (!u.ok) return setError(u.error);
      setGoalParams(u.value);
      // The recent hard-effort anchor is optional for ultra — only require it
      // (and only error on it) if the athlete actually started filling it in.
      const hasRunInput = runMiles.trim() !== '' || runMin.trim() !== '' || runSec.trim() !== '';
      if (!hasRunInput) {
        router.push(HEALTH);
        return;
      }
    }
    if (primaryGoal === 'lift') {
      const s = parseStrengthParams({ squat, bench, deadlift, goalSquat, goalBench, goalDeadlift });
      if (!s.ok) return setError(s.error);
      setGoalParams(s.value);
      router.push(HEALTH);
      return;
    }
    if (primaryGoal === 'crossfit') {
      // No run anchor for crossfit — mirrors the lift branch above (early-return),
      // not the ultra/hyrox fall-through into run-anchor collection.
      const c = parseCrossfitParams({ backSquat, deadlift: crossfitDeadlift, press, competing, fran });
      if (!c.ok) return setError(c.error);
      setGoalParams(c.value);
      router.push(HEALTH);
      return;
    }
    if (primaryGoal === 'hyrox') {
      const h = parseHyroxParams({ division, targetTimeMinutes: '' });
      if (!h.ok) return setError(h.error);
      setGoalParams(h.value);
      // The recent hard-run anchor is optional for hyrox too — only require it
      // (and only error on it) if the athlete actually started filling it in.
      const hasRunInput = runMiles.trim() !== '' || runMin.trim() !== '' || runSec.trim() !== '';
      if (!hasRunInput) {
        router.push(HEALTH);
        return;
      }
    }
    let value: number;
    let anchor: ThresholdAnchorMap;
    if (key === 'swim') {
      const r = parseSwimBaseline(mmss(swim400m, swim400s), mmss(swim200m, swim200s));
      if (!r.ok) return setError(r.error);
      value = r.value; anchor = { swim: { cssSecPer100: value, source: 'self_report' } };
    } else if (key === 'row') {
      const r = parseRowingBaseline(mmss(row2kM, row2kS));
      if (!r.ok) return setError(r.error);
      value = r.value; anchor = { row: { splitSecPer500: value, source: 'self_report' } };
    } else if (key === 'bike') {
      // FTP entered directly, or derived from 20-min power (0.95×) when FTP is blank.
      const ftpW = num(ftp) || (num(twentyMin) ? estimateFTPFromTwentyMinPower(num(twentyMin)) : NaN);
      const r = parseFTPBaseline(ftpW);
      if (!r.ok) return setError(r.error);
      value = r.value; anchor = { bike: { ftpWatts: value, source: 'self_report' } };
    } else {
      const r = parseRunBaseline(num(runMiles), mmss(runMin, runSec));
      if (!r.ok) return setError(r.error);
      value = r.value; anchor = { run: { thresholdSecPerMile: value, source: 'self_report' } };
    }
    setThresholdAnchor(anchor);
    router.push(HEALTH);
  }

  const title =
    key === 'swim' ? 'Know your swim times?' : key === 'row' ? 'Know your 2k?' : key === 'bike' ? 'Know your FTP?' : primaryGoal === 'ultra' ? 'Your ultra race, and a recent hard effort' : primaryGoal === 'hyrox' ? 'Your division, and a recent hard run' : primaryGoal === 'lift' ? 'Know your current maxes?' : primaryGoal === 'crossfit' ? 'Know your crossfit numbers?' : 'A recent hard run?';

  return (
    <OnboardingShell
      step={4}
      totalSteps={5}
      title={title}
      hint="Optional — it sharpens your training zones. Skip and Ozzie estimates from your experience, then refines as you log."
      onContinue={onContinue}
      continueLabel="Use these numbers →"
    >
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
                  <Text style={[styles.chipText, ultraDistance === d && styles.chipTextSelected]}>
                    {d}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Total race vert, metres (optional)</Text>
            <TextInput
              style={styles.input}
              value={ultraVert}
              onChangeText={setUltraVert}
              keyboardType="number-pad"
              placeholder="e.g. 2000"
              placeholderTextColor={Colors.textMuted}
            />
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
      ) : null}

      {key === 'swim' ? (
        <>
          <TimeRow label="400m time" m={swim400m} s={swim400s} setM={setSwim400m} setS={setSwim400s} />
          <TimeRow label="200m time" m={swim200m} s={swim200s} setM={setSwim200m} setS={setSwim200s} />
        </>
      ) : key === 'row' ? (
        <TimeRow label="2k time" m={row2kM} s={row2kS} setM={setRow2kM} setS={setRow2kS} />
      ) : key === 'bike' ? (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>FTP (watts)</Text>
            <TextInput style={styles.input} value={ftp} onChangeText={setFtp} keyboardType="number-pad" placeholder="240" placeholderTextColor={Colors.textMuted} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>…or your best 20-min power (watts)</Text>
            <TextInput style={styles.input} value={twentyMin} onChangeText={setTwentyMin} keyboardType="number-pad" placeholder="253" placeholderTextColor={Colors.textMuted} />
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
      ) : (
        <>
          {primaryGoal === 'hyrox' ? (
            <View style={styles.field}>
              <Text style={styles.label}>Division</Text>
              <View style={styles.chipRow}>
                {HYROX_DIVISIONS.map((d) => (
                  <Pressable
                    key={d.value}
                    style={[styles.chip, division === d.value && styles.chipSelected]}
                    onPress={() => setDivision(d.value)}
                    accessibilityRole="button"
                    accessibilityLabel={d.label}
                    accessibilityState={{ selected: division === d.value }}
                  >
                    <Text style={[styles.chipText, division === d.value && styles.chipTextSelected]}>
                      {d.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          <View style={styles.field}>
            <Text style={styles.label}>Distance (miles)</Text>
            <TextInput style={styles.input} value={runMiles} onChangeText={setRunMiles} keyboardType="decimal-pad" placeholder="6.2" placeholderTextColor={Colors.textMuted} />
          </View>
          <TimeRow label="Time" m={runMin} s={runSec} setM={setRunMin} setS={setRunSec} />
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={onSkip} accessibilityRole="button">
        <Text style={styles.skip}>Skip — estimate for me</Text>
      </Pressable>
    </OnboardingShell>
  );
}

function TimeRow({ label, m, s, setM, setS }: { label: string; m: string; s: string; setM: (v: string) => void; setS: (v: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.timeRow}>
        <TextInput style={[styles.input, styles.timeInput]} value={m} onChangeText={setM} keyboardType="number-pad" placeholder="min" placeholderTextColor={Colors.textMuted} />
        <Text style={styles.colon}>:</Text>
        <TextInput style={[styles.input, styles.timeInput]} value={s} onChangeText={setS} keyboardType="number-pad" placeholder="sec" placeholderTextColor={Colors.textMuted} />
      </View>
    </View>
  );
}

function NumberField({ label, value, onChangeText, placeholder }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6, marginBottom: 12 },
  label: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.textPrimary, fontSize: 16 },
  timeInput: { flex: 1, textAlign: 'center' },
  colon: { color: Colors.textMuted, fontSize: 18, fontWeight: '700' },
  error: { fontSize: 12, color: Colors.red, marginTop: 4 },
  skip: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginTop: 16, textDecorationLine: 'underline' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipSelected: { backgroundColor: Colors.surfaceTeal, borderColor: Colors.borderTeal },
  chipText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  chipTextSelected: { color: Colors.teal },
});
