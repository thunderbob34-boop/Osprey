import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingShell from '@/components/onboarding/OnboardingShell';
import { TimeRow, NumberField } from '@/components/BaselineInputs';
import { useOnboardingStore } from '@/store/onboardingStore';
import {
  parseSwimBaseline,
  parseRowingBaseline,
  parseRunBaseline,
  parseFTPBaseline,
  anchorKeyForGoal,
  type ThresholdAnchorMap,
  type AnchorKey,
} from '@/services/coaching/baseline';
import { estimateFTPFromTwentyMinPower } from '@/services/calculators/triathlon';
import { proposeAnchorFromHealthKit, type AnchorProposal } from '@/services/coaching/performance-anchor';
import { formatMinSec } from '@/services/calculators/types';
import { paceMi } from '@/services/pace-format';
import { Colors } from '@/constants/colors';
import { Theme, Radius } from '@/constants/theme';

const BODY_WEIGHT = '/(onboarding)/body-weight';
const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
const mmss = (m: string, s: string) => num(m) * 60 + num(s);

const CONFIDENCE_COPY: Record<AnchorProposal['confidence'], string> = {
  high: 'High confidence — several long efforts back this up.',
  moderate: 'Moderate confidence — a decent-length effort backs this up.',
  low: "Low confidence — I'll re-check this sooner and start conservatively.",
};

function formatAnchorValue(key: AnchorKey, value: number): string {
  if (key === 'run') return paceMi(value, 'imperial');
  return `${formatMinSec(value)}/500m`;
}

// Only run/row are ever HealthKit-derivable (performance-anchor.ts) — swim CSS
// needs a 400/200 time-trial pair and bike FTP needs power, neither present in
// a HealthKit workout sample. Those two go straight to self-report, same
// fields the old baseline.tsx collected.
const DERIVABLE: AnchorKey[] = ['run', 'row'];

export default function AnchorScreen() {
  const router = useRouter();
  const primaryGoal = useOnboardingStore((s) => s.primaryGoal);
  const healthConnected = useOnboardingStore((s) => s.healthConnected);
  const setThresholdAnchor = useOnboardingStore((s) => s.setThresholdAnchor);
  const setAnchorProposal = useOnboardingStore((s) => s.setAnchorProposal);
  const key = anchorKeyForGoal(primaryGoal);

  const [proposal, setProposal] = useState<AnchorProposal | null>(null);
  const [loadingProposal, setLoadingProposal] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Self-report fields (times as minutes+seconds; run distance in miles).
  const [swim400m, setSwim400m] = useState(''); const [swim400s, setSwim400s] = useState('');
  const [swim200m, setSwim200m] = useState(''); const [swim200s, setSwim200s] = useState('');
  const [row2kM, setRow2kM] = useState(''); const [row2kS, setRow2kS] = useState('');
  const [runMiles, setRunMiles] = useState(''); const [runMin, setRunMin] = useState(''); const [runSec, setRunSec] = useState('');
  const [ftp, setFtp] = useState(''); const [twentyMin, setTwentyMin] = useState('');

  useEffect(() => {
    if (!key || !DERIVABLE.includes(key) || !healthConnected) return;
    setLoadingProposal(true);
    proposeAnchorFromHealthKit(key as 'run' | 'row')
      .then((p) => setProposal(p))
      .finally(() => setLoadingProposal(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function confirmProposal() {
    if (!proposal) return;
    const anchor: ThresholdAnchorMap =
      proposal.key === 'run'
        ? { run: { thresholdSecPerMile: proposal.value, source: 'derived', confidence: proposal.confidence } }
        : { row: { splitSecPer500: proposal.value, source: 'derived', confidence: proposal.confidence } };
    setThresholdAnchor(anchor);
    setAnchorProposal(proposal);
    router.push(BODY_WEIGHT);
  }

  function onSkip() {
    router.push(BODY_WEIGHT);
  }

  function onContinueManual() {
    setError(null);
    // Editing away from a proposal (or entering fresh) is always a self-report —
    // clearing anchorProposal here is what makes buildAnchorHistoryRows record
    // 'self_report', not silently keep a stale 'derived' provenance around.
    setAnchorProposal(null);

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
    router.push(BODY_WEIGHT);
  }

  const title =
    key === 'swim' ? 'Know your swim times?' : key === 'row' ? 'Know your 2k?' : key === 'bike' ? 'Know your FTP?' : 'A recent hard run?';
  const hint =
    'Threshold is the pace you could hold for about an hour — every other zone is set from it, and I re-check it every few weeks (docs/coaching/running.md).';

  if (loadingProposal) {
    return (
      <OnboardingShell step={10} totalSteps={13} title="Checking your training history…" onContinue={() => undefined} continueDisabled>
        <ActivityIndicator color={Theme.accent} />
      </OnboardingShell>
    );
  }

  if (proposal && !manualEntry) {
    return (
      <OnboardingShell
        step={10}
        totalSteps={13}
        title="Here's what I found"
        hint={hint}
        onContinue={confirmProposal}
        continueLabel="That's right →"
      >
        <View style={styles.proposalCard}>
          <Text style={styles.proposalValue}>{formatAnchorValue(proposal.key, proposal.value)}</Text>
          <Text style={styles.proposalMeta}>
            From a {proposal.derivedFrom.distanceMiles ?? proposal.derivedFrom.distanceKm} {proposal.key === 'run' ? 'mi' : 'km'} effort on{' '}
            {new Date(proposal.derivedFrom.startedAt).toLocaleDateString()}
          </Text>
          <Text style={styles.proposalConfidence}>{CONFIDENCE_COPY[proposal.confidence]}</Text>
        </View>
        <Pressable onPress={() => setManualEntry(true)} accessibilityRole="button">
          <Text style={styles.link}>That's not right — let me enter it myself</Text>
        </Pressable>
        <Pressable onPress={onSkip} accessibilityRole="button">
          <Text style={styles.skip}>Skip — estimate for me</Text>
        </Pressable>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell step={10} totalSteps={13} title={title} hint={hint} onContinue={onContinueManual} continueLabel="Use these numbers →">
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
            <TextInput style={styles.input} value={ftp} onChangeText={setFtp} keyboardType="number-pad" placeholder="240" placeholderTextColor={Theme.textMut} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>…or your best 20-min power (watts)</Text>
            <TextInput style={styles.input} value={twentyMin} onChangeText={setTwentyMin} keyboardType="number-pad" placeholder="253" placeholderTextColor={Theme.textMut} />
          </View>
        </>
      ) : (
        <>
          <NumberField label="Distance (miles)" value={runMiles} onChangeText={setRunMiles} placeholder="6.2" />
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

const styles = StyleSheet.create({
  field: { gap: 6, marginBottom: 12 },
  label: { fontSize: 13, color: Theme.textMut, fontWeight: '600' },
  input: { backgroundColor: Theme.ink, borderWidth: 1, borderColor: Theme.line, borderRadius: Radius.card, paddingHorizontal: 14, paddingVertical: 12, color: Theme.text, fontSize: 16 },
  error: { fontSize: 12, color: Colors.red, marginTop: 4 },
  skip: { fontSize: 13, color: Theme.textMut, textAlign: 'center', marginTop: 16, textDecorationLine: 'underline' },
  link: { fontSize: 13, color: Theme.accent, textAlign: 'center', marginTop: 12 },
  proposalCard: {
    backgroundColor: Theme.panel,
    borderWidth: 1,
    borderColor: Theme.accent,
    borderRadius: Radius.card,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  proposalValue: { fontSize: 28, fontWeight: '800', color: Theme.accent },
  proposalMeta: { fontSize: 13, color: Theme.textMut },
  proposalConfidence: { fontSize: 12, color: Theme.textSoft, textAlign: 'center', marginTop: 4 },
});
