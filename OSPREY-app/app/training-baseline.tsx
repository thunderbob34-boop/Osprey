import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { Theme } from '@/constants/theme';
import { Card, Button } from '@/components/ui';
import ScreenHeader from '@/components/ScreenHeader';
import FieldError from '@/components/FieldError';
import { TimeRow, NumberField } from '@/components/BaselineInputs';
import { useAuthStore } from '@/store/authStore';
import { useTrainingGoal } from '@/hooks/useTrainingGoal';
import { useThresholdAnchor, useUpdateThresholdAnchor } from '@/hooks/useThresholdAnchor';
import { useDisplayZones } from '@/hooks/useDisplayZones';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { supabase, extractFunctionErrorMessage } from '@/services/supabase';
import { invokeGeneratePlan } from '@/services/coaching/build-envelope';
import { rowsForZones } from '@/services/coaching/zone-rows';
import type { PrimaryGoalEnum } from '@/services/coaching/goal-map';
import { runningPaceZones } from '@/services/calculators/running';
import { swimPaceZones } from '@/services/calculators/swimming';
import { rowingTrainingZones } from '@/services/calculators/rowing';
import { cyclingPowerZones } from '@/services/calculators/cycling';
import { estimateFTPFromTwentyMinPower } from '@/services/calculators/triathlon';
import {
  parseSwimBaseline,
  parseRowingBaseline,
  parseRunBaseline,
  parseFTPBaseline,
  anchorKeyForGoal,
  setAnchorEntry,
  clearAnchorEntry,
  type AnchorKey,
  type ThresholdAnchorMap,
} from '@/services/coaching/baseline';
import type { HrZoneInfo } from '@/services/coaching/envelope';
import type { ZoneSet } from '@/services/coaching/zones';
import type { UnitSystem } from '@/services/units';

const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
const mmss = (m: string, s: string) => num(m) * 60 + num(s);

const SPORT_TITLE: Record<AnchorKey, string> = {
  run: 'Run',
  swim: 'Swim',
  row: 'Rowing',
  bike: 'Cycling',
};

export default function TrainingBaselineScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const { data: goal, isLoading: goalLoading } = useTrainingGoal();
  const { units } = useUnitPreference();
  const display = useDisplayZones();
  const anchor = useThresholdAnchor();
  const update = useUpdateThresholdAnchor();
  const queryClient = useQueryClient();
  const [showRebuildOffer, setShowRebuildOffer] = useState(false);

  const activePlanQuery = useQuery({
    queryKey: ['has-active-plan', userId],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from('training_plans')
        .select('id')
        .eq('user_id', userId!)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data != null;
    },
    enabled: Boolean(userId),
  });

  const rebuildMutation = useMutation({
    mutationFn: async () => {
      const { error } = await invokeGeneratePlan({ force: true });
      if (error) {
        const message = await extractFunctionErrorMessage(error);
        throw new Error(message);
      }
    },
    onSuccess: () => {
      setShowRebuildOffer(false);
      queryClient.invalidateQueries({ queryKey: ['display-zones', userId] });
    },
    onError: (err) => {
      Alert.alert('Rebuild failed', err instanceof Error ? err.message : 'Something went wrong.');
    },
  });

  // useTrainingGoal() types primaryGoal via the onboarding-only PrimaryGoal union, which
  // omits 'triathlon' (see @/types/onboarding vs. the superset PrimaryGoalEnum documented
  // in goal-map.ts) even though user_goals.primary_goal really can hold it. Widen to the
  // proper superset here rather than casting to a bare string, so this comparison stays
  // checked against the real DB enum's value space. A type ASSERTION, not just a wider
  // contextual annotation, is required: for a never-reassigned const, TS's control-flow
  // analysis keeps comparing against the narrower initializer type at each read site
  // (only `as` actually changes the tracked type of the expression).
  const primaryGoal = (goal?.primaryGoal ?? null) as PrimaryGoalEnum | null;
  const soloKey = primaryGoal ? anchorKeyForGoal(primaryGoal) : null;
  const keys: AnchorKey[] = primaryGoal === 'triathlon' ? ['run', 'swim', 'bike'] : soloKey ? [soloKey] : [];

  if (goalLoading || anchor.isLoading || !display) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Training Baseline" />
        <ActivityIndicator color={Theme.accent} style={{ marginTop: 32 }} />
      </SafeAreaView>
    );
  }

  const map = anchor.data ?? {};

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Training Baseline" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Enter a real recent effort and Ozzie uses it — not a guess from your experience level — for every pace and zone in your plan.
          </Text>

          {keys.length === 0 ? (
            <Text style={styles.hint}>Your current goal doesn't use a pace or power zone.</Text>
          ) : (
            // `update` is one shared mutation across every row (mirrors the webapp's
            // TrainingZonesCard, which also shares one mutation across all sport rows):
            // a save in flight disables every row's Save button, not just its own. This
            // is deliberate, not an oversight — it prevents a fast second-sport save from
            // building its patch off a stale pre-save map and dropping the first save.
            keys.map((key) => (
              <AnchorRow
                key={key}
                anchorKey={key}
                entry={map[key]}
                hrZones={display.hrZones}
                units={units}
                saving={update.isPending}
                onSave={(value) => {
                  update.mutate(setAnchorEntry(map, key, value), {
                    onSuccess: () => setShowRebuildOffer(true),
                  });
                }}
                onClear={() => update.mutate(clearAnchorEntry(map, key))}
              />
            ))
          )}

          {update.error ? (
            <FieldError message={update.error instanceof Error ? update.error.message : 'Could not save.'} />
          ) : null}

          {showRebuildOffer && activePlanQuery.data ? (
            <Card emphasis style={styles.cardGap}>
              <Text style={styles.rebuildTitle}>Rebuild this week on your new zones?</Text>
              <Text style={styles.rebuildBody}>Your saved sessions still reflect the old zones until you rebuild.</Text>
              <View style={styles.rowButtons}>
                <Button
                  variant="secondary"
                  onPress={() => setShowRebuildOffer(false)}
                  disabled={rebuildMutation.isPending}
                  wrapperStyle={{ flex: 1 }}
                  accessibilityLabel="Not now"
                >
                  Not now
                </Button>
                <Button
                  onPress={() => rebuildMutation.mutate()}
                  disabled={rebuildMutation.isPending}
                  busy={rebuildMutation.isPending}
                  wrapperStyle={{ flex: 1 }}
                  accessibilityLabel="Rebuild this week"
                >
                  {rebuildMutation.isPending ? <ActivityIndicator color={Theme.ink} /> : 'Rebuild this week'}
                </Button>
              </View>
            </Card>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface AnchorRowProps {
  anchorKey: AnchorKey;
  entry: ThresholdAnchorMap[AnchorKey];
  hrZones: HrZoneInfo;
  units: UnitSystem;
  saving: boolean;
  onSave: (value: NonNullable<ThresholdAnchorMap[AnchorKey]>) => void;
  onClear: () => void;
}

function AnchorRow({ anchorKey, entry, hrZones, units, saving, onSave, onClear }: AnchorRowProps) {
  const [swim400m, setSwim400m] = useState(''); const [swim400s, setSwim400s] = useState('');
  const [swim200m, setSwim200m] = useState(''); const [swim200s, setSwim200s] = useState('');
  const [row2kM, setRow2kM] = useState(''); const [row2kS, setRow2kS] = useState('');
  const [runMiles, setRunMiles] = useState(''); const [runMin, setRunMin] = useState(''); const [runSec, setRunSec] = useState('');
  const [ftp, setFtp] = useState(''); const [twentyMin, setTwentyMin] = useState('');
  const [error, setError] = useState<string | null>(null);

  let preview: number | null = null;
  if (anchorKey === 'swim') { const r = parseSwimBaseline(mmss(swim400m, swim400s), mmss(swim200m, swim200s)); if (r.ok) preview = r.value; }
  else if (anchorKey === 'row') { const r = parseRowingBaseline(mmss(row2kM, row2kS)); if (r.ok) preview = r.value; }
  else if (anchorKey === 'bike') {
    const ftpW = num(ftp) || (num(twentyMin) ? estimateFTPFromTwentyMinPower(num(twentyMin)) : NaN);
    const r = parseFTPBaseline(ftpW); if (r.ok) preview = r.value;
  } else { const r = parseRunBaseline(num(runMiles), mmss(runMin, runSec)); if (r.ok) preview = r.value; }

  const stored =
    anchorKey === 'swim' ? (entry && 'cssSecPer100' in entry ? entry.cssSecPer100 : null)
    : anchorKey === 'row' ? (entry && 'splitSecPer500' in entry ? entry.splitSecPer500 : null)
    : anchorKey === 'bike' ? (entry && 'ftpWatts' in entry ? entry.ftpWatts : null)
    : (entry && 'thresholdSecPerMile' in entry ? entry.thresholdSecPerMile : null);
  const shown = preview ?? stored;

  const zoneSet: ZoneSet | null =
    shown == null ? null
    : anchorKey === 'swim' ? { kind: 'swim', cssSecPer100: shown, bands: swimPaceZones(shown) }
    : anchorKey === 'row' ? { kind: 'rowing', splitSecPer500: shown, bands: rowingTrainingZones(shown) }
    : anchorKey === 'bike' ? { kind: 'cycling', ftpWatts: shown, bands: cyclingPowerZones(shown) }
    : { kind: 'run', thresholdSecPerMile: shown, bands: runningPaceZones(shown) };
  const previewRows = zoneSet ? rowsForZones(zoneSet, hrZones, units) : [];

  function save() {
    setError(null);
    let payload: NonNullable<ThresholdAnchorMap[AnchorKey]>;
    if (anchorKey === 'swim') {
      const r = parseSwimBaseline(mmss(swim400m, swim400s), mmss(swim200m, swim200s));
      if (!r.ok) return setError(r.error);
      payload = { cssSecPer100: r.value, source: 'self_report' };
    } else if (anchorKey === 'row') {
      const r = parseRowingBaseline(mmss(row2kM, row2kS));
      if (!r.ok) return setError(r.error);
      payload = { splitSecPer500: r.value, source: 'self_report' };
    } else if (anchorKey === 'bike') {
      const ftpW = num(ftp) || (num(twentyMin) ? estimateFTPFromTwentyMinPower(num(twentyMin)) : NaN);
      const r = parseFTPBaseline(ftpW);
      if (!r.ok) return setError(r.error);
      payload = { ftpWatts: r.value, source: 'self_report' };
    } else {
      const r = parseRunBaseline(num(runMiles), mmss(runMin, runSec));
      if (!r.ok) return setError(r.error);
      payload = { thresholdSecPerMile: r.value, source: 'self_report' };
    }
    onSave(payload);
  }

  return (
    <Card style={styles.cardGap}>
      <Text style={styles.cardTitle}>{SPORT_TITLE[anchorKey]}</Text>

      {anchorKey === 'swim' ? (
        <>
          <TimeRow label="400m time" m={swim400m} s={swim400s} setM={setSwim400m} setS={setSwim400s} />
          <TimeRow label="200m time" m={swim200m} s={swim200s} setM={setSwim200m} setS={setSwim200s} />
        </>
      ) : anchorKey === 'row' ? (
        <TimeRow label="2k time" m={row2kM} s={row2kS} setM={setRow2kM} setS={setRow2kS} />
      ) : anchorKey === 'bike' ? (
        <>
          <NumberField label="FTP (watts)" value={ftp} onChangeText={setFtp} placeholder="240" />
          <NumberField label="…or your best 20-min power (watts)" value={twentyMin} onChangeText={setTwentyMin} placeholder="253" />
        </>
      ) : (
        <>
          <NumberField label="Distance (miles)" value={runMiles} onChangeText={setRunMiles} placeholder="6.2" />
          <TimeRow label="Time" m={runMin} s={runSec} setM={setRunMin} setS={setRunSec} />
        </>
      )}

      {previewRows.length > 0 ? (
        <View style={styles.previewRows}>
          {previewRows.map((row) => (
            <View key={row.label} style={styles.previewRow}>
              <View style={[styles.dot, { backgroundColor: row.tone === 'aerobic' ? Colors.green : Colors.amber }]} />
              <Text style={styles.previewLabel}>{row.label}</Text>
              <Text style={styles.previewValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.hint}>Not set — Ozzie estimates this from your experience level.</Text>
      )}

      <FieldError message={error} />

      <View style={styles.rowButtons}>
        <Button
          onPress={save}
          disabled={saving || preview == null}
          busy={saving}
          wrapperStyle={{ flex: 1 }}
          accessibilityLabel={`Save ${SPORT_TITLE[anchorKey]} baseline`}
        >
          {saving ? <ActivityIndicator color={Theme.ink} /> : 'Save'}
        </Button>
        {entry ? (
          <Button
            variant="secondary"
            onPress={onClear}
            disabled={saving}
            wrapperStyle={{ flex: 1 }}
            accessibilityLabel={`Clear ${SPORT_TITLE[anchorKey]} baseline`}
          >
            Clear
          </Button>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.ink },
  scroll: { padding: 16, gap: 16 },
  intro: { fontSize: 13, color: Theme.textMut, lineHeight: 18, marginBottom: 4 },
  cardGap: { gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: Theme.text },
  previewRows: { gap: 6 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  previewLabel: { fontSize: 13, fontWeight: '600', color: Theme.textSoft, flex: 1 },
  previewValue: { fontSize: 13, fontWeight: '800', color: Theme.text },
  hint: { fontSize: 12, color: Theme.textMut, lineHeight: 16 },
  rowButtons: { flexDirection: 'row', gap: 10 },
  rebuildTitle: { fontSize: 14, fontWeight: '800', color: Theme.text },
  rebuildBody: { fontSize: 12, color: Theme.textMut, lineHeight: 16 },
});
