import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingShell from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import {
  parseSwimBaseline,
  parseRowingBaseline,
  parseRunBaseline,
  parseFTPBaseline,
  anchorKeyForGoal,
  type ThresholdAnchorMap,
} from '@/services/coaching/baseline';
import { Colors } from '@/constants/colors';

const HEALTH = '/(onboarding)/health';
const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
const mmss = (m: string, s: string) => num(m) * 60 + num(s);

export default function BaselineScreen() {
  const router = useRouter();
  const primaryGoal = useOnboardingStore((s) => s.primaryGoal);
  const setThresholdAnchor = useOnboardingStore((s) => s.setThresholdAnchor);
  const key = anchorKeyForGoal(primaryGoal);

  // Fields (times as minutes + seconds; run distance in miles).
  const [swim400m, setSwim400m] = useState(''); const [swim400s, setSwim400s] = useState('');
  const [swim200m, setSwim200m] = useState(''); const [swim200s, setSwim200s] = useState('');
  const [row2kM, setRow2kM] = useState(''); const [row2kS, setRow2kS] = useState('');
  const [runMiles, setRunMiles] = useState(''); const [runMin, setRunMin] = useState(''); const [runSec, setRunSec] = useState('');
  const [ftp, setFtp] = useState(''); const [twentyMin, setTwentyMin] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onContinue() {
    setError(null);
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
      const ftpW = num(ftp) || (num(twentyMin) ? Math.round(num(twentyMin) * 0.95) : NaN);
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
    key === 'swim' ? 'Know your swim times?' : key === 'row' ? 'Know your 2k?' : key === 'bike' ? 'Know your FTP?' : 'A recent hard run?';

  return (
    <OnboardingShell
      step={4}
      totalSteps={5}
      title={title}
      hint="Optional — it sharpens your training zones. Skip and Ozzie estimates from your experience, then refines as you log."
      onContinue={onContinue}
      continueLabel="Use these numbers →"
    >
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
      ) : (
        <>
          <View style={styles.field}>
            <Text style={styles.label}>Distance (miles)</Text>
            <TextInput style={styles.input} value={runMiles} onChangeText={setRunMiles} keyboardType="decimal-pad" placeholder="6.2" placeholderTextColor={Colors.textMuted} />
          </View>
          <TimeRow label="Time" m={runMin} s={runSec} setM={setRunMin} setS={setRunSec} />
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={() => router.push(HEALTH)} accessibilityRole="button">
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

const styles = StyleSheet.create({
  field: { gap: 6, marginBottom: 12 },
  label: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.textPrimary, fontSize: 16 },
  timeInput: { flex: 1, textAlign: 'center' },
  colon: { color: Colors.textMuted, fontSize: 18, fontWeight: '700' },
  error: { fontSize: 12, color: Colors.red, marginTop: 4 },
  skip: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginTop: 16, textDecorationLine: 'underline' },
});
