import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Theme, Radius, BorderWidth, StatusPalette } from '@/constants/theme';
import { Button, Card } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { hyroxStationWeights, type HyroxDivision } from '@/services/calculators/hyrox';
import { saveHyroxWorkout } from '@/services/workouts';
import {
  HYROX_RUN_ICON,
  HYROX_STATIONS,
  buildHyroxSegments,
  deriveHyroxSplits,
  type HyroxSegment,
} from '@/types/hyrox';

const DIVISIONS: { id: HyroxDivision; label: string }[] = [
  { id: 'open_men', label: 'Open Men' },
  { id: 'open_women', label: 'Open Women' },
  { id: 'pro_men', label: 'Pro Men' },
  { id: 'pro_women', label: 'Pro Women' },
];

type Phase = 'division' | 'overview' | 'running';

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function segmentIcon(segment: HyroxSegment): string {
  if (segment.type === 'run') return HYROX_RUN_ICON;
  return HYROX_STATIONS.find((s) => s.id === segment.stationId)?.icon ?? '💪';
}

function segmentLabel(segment: HyroxSegment): string {
  if (segment.type === 'run') return `Run ${segment.index}`;
  return HYROX_STATIONS.find((s) => s.id === segment.stationId)?.label ?? '';
}

function segmentKey(segment: Pick<HyroxSegment, 'type' | 'index'>): string {
  return `${segment.type}-${segment.index}`;
}

const ALL_SEGMENT_KEYS = buildHyroxSegments().map(segmentKey);

export default function HyroxWorkoutScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);

  const [phase, setPhase] = useState<Phase>('division');
  const [division, setDivision] = useState<HyroxDivision | null>(null);
  // Defaults to the full race — deselect segments to practice a subset
  // (a handful of stations, just the runs, whatever the session calls for).
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set(ALL_SEGMENT_KEYS));
  const [segments, setSegments] = useState<HyroxSegment[]>(buildHyroxSegments());
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const startedAtRef = useRef(0);

  const weights = division ? hyroxStationWeights(division) : null;
  const currentSegment = segments[segmentIndex];
  const isFullRace = selectedKeys.size === ALL_SEGMENT_KEYS.length;

  // dismissTo dismisses (the correct "closing a modal" animation, not a
  // forward-navigation transition) while walking the stack until it finds
  // this exact route — unlike back(), which just pops one step and proved
  // unreliable about where that landed from this screen.
  function exitToWorkoutTab() {
    router.dismissTo('/(tabs)/workout');
  }

  function pickDivision(selectedDivision: HyroxDivision) {
    setDivision(selectedDivision);
    setPhase('overview');
  }

  function toggleSegment(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function startRace() {
    const initial = buildHyroxSegments().filter((s) => selectedKeys.has(segmentKey(s)));
    if (initial.length === 0) return;
    const now = Date.now();
    initial[0].startedAtMs = now;
    startedAtRef.current = now;
    setSegments(initial);
    setSegmentIndex(0);
    setSessionComplete(false);
    setPhase('running');
  }

  useEffect(() => {
    if (phase !== 'running' || sessionComplete) return;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, sessionComplete]);

  function handleMarkComplete() {
    const now = Date.now();
    setSegments((prev) =>
      prev.map((seg, i) => {
        if (i === segmentIndex) return { ...seg, completedAtMs: now };
        if (i === segmentIndex + 1) return { ...seg, startedAtMs: now };
        return seg;
      }),
    );

    if (segmentIndex + 1 >= segments.length) {
      setElapsed(Math.floor((now - startedAtRef.current) / 1000));
      setSessionComplete(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } else {
      setSegmentIndex((i) => i + 1);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    }
  }

  async function handleSave() {
    if (!userId || !division) return;
    setSaving(true);
    try {
      const splits = deriveHyroxSplits(segments);
      const durationS = Math.floor(
        ((segments[segments.length - 1].completedAtMs ?? Date.now()) - startedAtRef.current) / 1000,
      );
      const workoutId = await saveHyroxWorkout({
        userId,
        division,
        startedAt: startedAtRef.current,
        durationS,
        splits,
      });
      router.replace({ pathname: '/workout/recap', params: { workoutId } });
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Try again.');
      setSaving(false);
    }
  }

  function confirmDiscard() {
    Alert.alert('Discard this session?', 'Your splits so far will not be saved.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard & Exit', style: 'destructive', onPress: exitToWorkoutTab },
    ]);
  }

  // ── Division picker ──────────────────────────────────────────────────────
  if (phase === 'division') {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={exitToWorkoutTab}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Ionicons name="close" size={20} color={Theme.textMut} />
        </TouchableOpacity>
        <View style={styles.pickerContent}>
          <Text style={styles.pickerTitle}>Which division?</Text>
          <Text style={styles.pickerSubtitle}>Sets your station weights — 8 runs, 8 stations, race order.</Text>
          <View style={styles.divisionGrid}>
            {DIVISIONS.map((d) => (
              <TouchableOpacity
                key={d.id}
                style={styles.divisionTile}
                onPress={() => pickDivision(d.id)}
                accessibilityRole="button"
                accessibilityLabel={`${d.label} division`}
              >
                <Text style={styles.divisionTileLabel}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Race overview — see the whole thing, trim it down if it's not race day ──
  if (phase === 'overview') {
    const preview = buildHyroxSegments();
    const selectedRunCount = preview.filter((s) => s.type === 'run' && selectedKeys.has(segmentKey(s))).length;
    const selectedStationCount = preview.filter((s) => s.type === 'station' && selectedKeys.has(segmentKey(s))).length;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.overviewHeader}>
          <TouchableOpacity
            onPress={() => setPhase('division')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back to division picker"
          >
            <Text style={styles.overviewBack}>‹ Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={exitToWorkoutTab}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Ionicons name="close" size={20} color={Theme.textMut} />
          </TouchableOpacity>
        </View>

        <Text style={styles.overviewTitle}>{isFullRace ? 'The race' : 'Your workout'}</Text>
        <Text style={styles.overviewSubtitle}>
          {DIVISIONS.find((d) => d.id === division)?.label} ·{' '}
          {isFullRace
            ? '8km running, 8 stations'
            : `${selectedRunCount} run${selectedRunCount === 1 ? '' : 's'}, ${selectedStationCount} station${selectedStationCount === 1 ? '' : 's'}`}
        </Text>

        <View style={styles.overviewToolbar}>
          <Text style={styles.overviewHint}>Tap to skip a segment — just practicing, not the full race?</Text>
          <View style={styles.overviewQuickActions}>
            <TouchableOpacity onPress={() => setSelectedKeys(new Set(ALL_SEGMENT_KEYS))} hitSlop={8}>
              <Text style={styles.overviewQuickAction}>Select all</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelectedKeys(new Set())} hitSlop={8}>
              <Text style={styles.overviewQuickAction}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.overviewList} contentContainerStyle={{ paddingBottom: 12 }}>
          {preview.map((segment, i) => {
            const isRun = segment.type === 'run';
            const key = segmentKey(segment);
            const selected = selectedKeys.has(key);
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.overviewRow,
                  isRun ? styles.overviewRowRun : styles.overviewRowStation,
                  !selected && styles.overviewRowSkipped,
                ]}
                onPress={() => toggleSegment(key)}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityLabel={segmentLabel(segment)}
                accessibilityState={{ checked: selected }}
              >
                <View
                  style={[
                    styles.overviewCheck,
                    selected && {
                      backgroundColor: isRun ? Theme.accent : StatusPalette.danger,
                      borderColor: isRun ? Theme.accent : StatusPalette.danger,
                    },
                  ]}
                >
                  {selected ? <Text style={styles.overviewCheckMark}>✓</Text> : null}
                </View>
                <Text style={styles.overviewIndex}>{i + 1}</Text>
                <Text style={[styles.overviewIcon, !selected && styles.dimmed]}>{segmentIcon(segment)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.overviewLabel, isRun && styles.overviewLabelRun, !selected && styles.dimmed]}>
                    {segmentLabel(segment)}
                  </Text>
                  <Text style={[styles.overviewTarget, !selected && styles.dimmed]}>
                    {isRun ? '1km' : weights ? HYROX_STATIONS[segment.index - 1].target(weights) : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Button
          onPress={startRace}
          disabled={selectedKeys.size === 0}
          accessibilityLabel={isFullRace ? 'Start race' : 'Start workout'}
          style={styles.startBtn}
        >
          {isFullRace ? 'Start Race →' : 'Start Workout →'}
        </Button>
        {selectedKeys.size === 0 ? (
          <Text style={styles.startHint}>Select at least one segment to start.</Text>
        ) : null}
      </SafeAreaView>
    );
  }

  // ── Running ───────────────────────────────────────────────────────────────
  const currentIsRun = currentSegment?.type === 'run';
  const accentColor = sessionComplete ? StatusPalette.success : currentIsRun ? Theme.accent : StatusPalette.danger;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={[styles.sessionBadge, { borderColor: accentColor + '55' }]}>
          <Text style={styles.sessionIcon}>💪</Text>
          <Text style={[styles.sessionLabel, { color: StatusPalette.danger }]}>HYROX IN PROGRESS</Text>
        </View>

        <View style={styles.progressStrip}>
          {segments.map((seg, i) => {
            const done = seg.completedAtMs != null;
            const isCurrent = i === segmentIndex && !sessionComplete;
            const tint = seg.type === 'run' ? Theme.accent : StatusPalette.danger;
            return (
              <View
                key={`${seg.type}-${seg.index}`}
                style={[
                  styles.progressDot,
                  { borderColor: tint },
                  done && { backgroundColor: tint },
                  isCurrent && styles.progressDotCurrent,
                ]}
              />
            );
          })}
        </View>

        <View style={styles.timerBlock}>
          <Text style={styles.timerValue}>{formatDuration(elapsed)}</Text>
          <Text style={styles.timerSub}>elapsed</Text>
        </View>

        {sessionComplete ? (
          <Card style={{ ...styles.segmentCard, borderColor: StatusPalette.success + '66' }}>
            <Text style={styles.segmentDoneIcon}>✓</Text>
            <Text style={styles.segmentDoneText}>
              {isFullRace ? 'Full race complete' : 'Workout complete'} — nice work
            </Text>
          </Card>
        ) : (
          <Card style={{ ...styles.segmentCard, borderColor: accentColor + '66' }}>
            <Text style={[styles.segmentProgress, { color: accentColor }]}>
              {currentIsRun ? 'RUN' : 'STATION'} · SEGMENT {segmentIndex + 1} OF {segments.length}
            </Text>
            <Text style={styles.segmentIcon}>{segmentIcon(currentSegment)}</Text>
            <Text style={styles.segmentLabel}>{segmentLabel(currentSegment)}</Text>
            <Text style={styles.segmentTarget}>
              {currentIsRun ? '1km' : weights ? HYROX_STATIONS[currentSegment.index - 1].target(weights) : ''}
            </Text>
            <TouchableOpacity
              style={[styles.completeBtn, { backgroundColor: accentColor }]}
              onPress={handleMarkComplete}
              accessibilityRole="button"
              accessibilityLabel="Mark segment complete"
            >
              <Text style={styles.completeBtnText}>Mark Complete</Text>
            </TouchableOpacity>
          </Card>
        )}

        {sessionComplete ? (
          <Button
            onPress={handleSave}
            disabled={saving}
            busy={saving}
            accessibilityLabel="End and save session"
            style={{ paddingVertical: 16 }}
          >
            {saving ? (
              <ActivityIndicator color={Theme.ink} />
            ) : (
              <Text style={styles.endBtnText}>End & Save</Text>
            )}
          </Button>
        ) : (
          <TouchableOpacity
            style={styles.discardBtn}
            onPress={confirmDiscard}
            accessibilityRole="button"
            accessibilityLabel="Discard session"
          >
            <Text style={styles.discardBtnText}>Discard & Exit</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.ink },
  content: { flex: 1, padding: 28, justifyContent: 'center', gap: 16 },

  closeBtn: { alignSelf: 'flex-end', padding: 16 },
  pickerContent: { flex: 1, padding: 28, paddingTop: 0, justifyContent: 'center', gap: 24 },
  pickerTitle: { fontSize: 26, fontWeight: '900', color: Theme.text, textAlign: 'center' },
  pickerSubtitle: { fontSize: 14, color: Theme.textMut, textAlign: 'center', marginTop: -12 },
  divisionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  divisionTile: {
    width: '46%',
    aspectRatio: 1.6,
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divisionTileLabel: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    color: Theme.textSoft,
    textAlign: 'center',
    textAlignVertical: 'center',
  },

  // Overview
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  overviewBack: { fontSize: 15, fontWeight: '700', color: Theme.accent },
  overviewTitle: { fontSize: 26, fontWeight: '900', color: Theme.text, paddingHorizontal: 20, marginTop: 8 },
  overviewSubtitle: { fontSize: 13, color: Theme.textMut, paddingHorizontal: 20, marginTop: 4, marginBottom: 12 },
  overviewToolbar: { paddingHorizontal: 20, marginBottom: 12, gap: 8 },
  overviewHint: { fontSize: 12, color: Theme.textMut, lineHeight: 17 },
  overviewQuickActions: { flexDirection: 'row', gap: 16 },
  overviewQuickAction: { fontSize: 13, fontWeight: '700', color: Theme.accent },
  overviewList: { flex: 1, paddingHorizontal: 20 },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: Radius.card,
    borderWidth: BorderWidth.card,
    padding: 12,
    marginBottom: 8,
  },
  // "Run" tint — the accent-recoloured counterpart of overviewRowStation
  // below (Task 5's run-vs-station resolution: run legs -> accent).
  overviewRowRun: { backgroundColor: Theme.accent + '0F', borderColor: Theme.accent + '33' },
  // FUNCTIONAL — station-leg marker, not a frosted-brand surface. Do not
  // flatten to Theme.panel; it carries the run/station alternating rhythm.
  overviewRowStation: { backgroundColor: 'rgba(255,68,68,0.06)', borderColor: 'rgba(255,68,68,0.2)' },
  overviewRowSkipped: { backgroundColor: Theme.panel, borderColor: Theme.line },
  overviewCheck: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Theme.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewCheckMark: { fontSize: 12, fontWeight: '900', color: Theme.ink },
  overviewIndex: { width: 18, fontSize: 12, fontWeight: '800', color: Theme.textMut, textAlign: 'center' },
  overviewIcon: { fontSize: 22 },
  overviewLabel: { fontSize: 15, fontWeight: '800', color: Theme.text },
  overviewLabelRun: { color: Theme.accent },
  overviewTarget: { fontSize: 12, color: Theme.textMut, marginTop: 1 },
  dimmed: { opacity: 0.35 },
  // Layout only — color/border/radius now come from the Button primitive.
  startBtn: { marginHorizontal: 20, marginTop: 12 },
  startHint: { textAlign: 'center', fontSize: 12, color: Theme.textMut, marginTop: 8 },

  // Progress strip
  progressStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center' },
  progressDot: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  progressDotCurrent: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
  },

  sessionBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Theme.panel,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sessionIcon: { fontSize: 20 },
  sessionLabel: { fontSize: 11, fontWeight: '800', fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 1.2 },
  timerBlock: { alignItems: 'center', gap: 6 },
  timerValue: { fontSize: 60, fontWeight: '800', color: Theme.text, letterSpacing: -2 },
  timerSub: { fontSize: 12, color: Theme.textMut, fontWeight: '600', letterSpacing: 0.5 },

  segmentCard: {
    alignItems: 'center',
    gap: 6,
    padding: 22,
  },
  segmentProgress: { fontSize: 11, fontWeight: '800', fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 0.8 },
  segmentIcon: { fontSize: 40, marginTop: 4 },
  segmentLabel: { fontSize: 26, fontWeight: '900', color: Theme.text, textAlign: 'center' },
  segmentTarget: { fontSize: 15, fontWeight: '700', color: Theme.textSoft },
  segmentDoneIcon: { fontSize: 32, color: StatusPalette.success, fontWeight: '900' },
  segmentDoneText: { fontSize: 15, fontWeight: '700', color: Theme.text, textAlign: 'center' },
  completeBtn: {
    marginTop: 10,
    borderRadius: Radius.card,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  // Fill is the dynamic accentColor, but this button only renders in the
  // !sessionComplete branch, so the fill is only ever Theme.accent or
  // StatusPalette.danger (green is unreachable here) — same dual-fill situation as
  // overviewCheckMark above, resolved the same way: Theme.ink.
  completeBtnText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    color: Theme.ink,
    textAlign: 'center',
    textAlignVertical: 'center',
  },

  endBtnText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    color: Theme.ink,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  // FUNCTIONAL — destructive "discard" chrome, kept red.
  discardBtn: {
    backgroundColor: 'rgba(255,68,68,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,68,68,0.25)',
    borderRadius: Radius.card,
    paddingVertical: 14,
    alignItems: 'center',
  },
  discardBtnText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    color: StatusPalette.danger,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
});
