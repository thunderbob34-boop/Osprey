import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingShell from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import { goalLabel } from '@/constants/sports';
import { anchorKeyForGoal } from '@/services/coaching/baseline';
import { anchorPolicy } from '@/services/coaching/anchor-policy';
import { paceMi } from '@/services/pace-format';
import { formatMinSec } from '@/services/calculators/types';
import { kgToLb } from '@/services/body-metrics';
import { Theme, Radius, BorderWidth } from '@/constants/theme';

const DAY_LABEL: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValueWrap}>
        <Text style={styles.rowValue}>{value}</Text>
        {note ? <Text style={styles.rowNote}>{note}</Text> : null}
      </View>
    </View>
  );
}

/**
 * Echo-back: every collected value as a plain bullet before generation
 * (docs/design-references/RUNNA-app-teardown.md's highest-trust-payoff
 * pattern — "I was listening" right before asking the athlete to believe the
 * output). Every provenance note names the ACTUAL source or adjustment —
 * never a bare "Custom" label, which the teardown calls out as a database
 * value leaking into the UI.
 */
export default function SummaryScreen() {
  const router = useRouter();
  const draft = useOnboardingStore();
  const anchorKey = anchorKeyForGoal(draft.primaryGoal);
  const anchorEntry = anchorKey ? draft.thresholdAnchor?.[anchorKey] : null;

  const anchorProvenance = (() => {
    if (!anchorEntry) return null;
    if (anchorEntry.source === 'derived') {
      const policy = anchorEntry.confidence ? anchorPolicy(anchorEntry.confidence) : null;
      return policy?.provisional
        ? `from Apple Health — provisional, I'll re-check in ${policy.reanchorIntervalDays} days`
        : 'from Apple Health';
    }
    return 'you told me';
  })();

  const anchorDisplay = (() => {
    if (!anchorEntry || !anchorKey) return null;
    if (anchorKey === 'run') return paceMi((anchorEntry as { thresholdSecPerMile: number }).thresholdSecPerMile, 'imperial');
    if (anchorKey === 'row') return `${formatMinSec((anchorEntry as { splitSecPer500: number }).splitSecPer500)}/500m`;
    if (anchorKey === 'swim') return `${formatMinSec((anchorEntry as { cssSecPer100: number }).cssSecPer100)}/100m`;
    return `${(anchorEntry as { ftpWatts: number }).ftpWatts}W FTP`;
  })();

  return (
    <OnboardingShell
      step={13}
      totalSteps={13}
      title="Here's your plan, in short"
      hint="Check it over — nothing here is final, you can adjust any of it later in Settings."
      onContinue={() => router.push('/(onboarding)/generating')}
      continueLabel="Build my plan →"
    >
      <View style={styles.card}>
        <Row label="Name" value={draft.displayName || '—'} note="you told me" />
        <Row label="Goal" value={goalLabel(draft.primaryGoal) ?? draft.primaryGoal} note="you told me" />
        {draft.raceGoal ? (
          <Row label="Race" value={`${draft.raceGoal.name} — ${draft.raceGoal.date}`} note="you told me" />
        ) : (
          <Row label="Race" value="Not racing yet" />
        )}
        <Row label="Experience" value={draft.experienceTier} note="you told me" />
        <Row
          label="Training days"
          value={`${draft.weeklyRunDays + draft.weeklyLiftDays}/week`}
          note="you told me"
        />
        <Row
          label="Available days"
          value={draft.availableDays.map((d) => DAY_LABEL[d]).join(', ') || '—'}
          note={draft.healthConnected ? 'from Apple Health, you confirmed' : 'you told me'}
        />
        <Row
          label="Long session"
          value={draft.longSessionDay ? DAY_LABEL[draft.longSessionDay] : '—'}
          note="proposed, you confirmed"
        />
        {anchorDisplay ? <Row label="Threshold" value={anchorDisplay} note={anchorProvenance ?? undefined} /> : null}
        <Row
          label="Body weight"
          value={draft.bodyWeightKg != null ? `${kgToLb(draft.bodyWeightKg)} lbs` : 'estimated (70kg default)'}
          note={draft.bodyWeightKg != null ? (draft.healthConnected ? 'from Apple Health' : 'you told me') : undefined}
        />
        {draft.equipment.length > 0 ? (
          <Row label="Equipment" value={draft.equipment.join(', ').replace(/_/g, ' ')} note="you told me" />
        ) : null}
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 16,
    gap: 14,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  rowLabel: { fontSize: 13, color: Theme.textMut, fontWeight: '600', flex: 1 },
  rowValueWrap: { flex: 1.4, alignItems: 'flex-end' },
  rowValue: { fontSize: 14, color: Theme.text, fontWeight: '700', textAlign: 'right' },
  rowNote: { fontSize: 11, color: Theme.textSoft, textAlign: 'right', marginTop: 2 },
});
