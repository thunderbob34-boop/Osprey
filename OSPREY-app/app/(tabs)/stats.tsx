import { useState } from 'react';
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
import Svg, { Line, Path, Polyline, Rect } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Theme, ChartPalette, Radius, BorderWidth, StatusPalette } from '@/constants/theme';
import { useStats } from '@/hooks/useStats';
import { useDeleteWorkoutLog } from '@/hooks/useTodayLog';
import { usePerformance } from '@/hooks/usePerformance';
import { useSubscription } from '@/hooks/useSubscription';
import { useLiftAnalytics } from '@/hooks/useLiftAnalytics';
import { formatRaceTimeSec } from '@/services/performance';
import { kgToLb } from '@/services/body-metrics';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { formatDistanceKm, milesToKm, type UnitSystem } from '@/services/units';
import type { SportType } from '@/types/stats';
import { friendlyError } from '@/utils/errorMessage';

const SESSION_ICON: Record<string, string> = {
  run:    '🏃',
  lift:   '🏋️',
  swim:   '🏊',
  bike:   '🚴',
  cross:  '🔁',
  race:   '🏁',
  rowing: '🚣',
  hyrox:  '💪',
};

// Fixed stacking order (bottom to top) + color per sport for the per-sport
// volume chart.
const SPORT_ORDER: SportType[] = ['run', 'bike', 'swim', 'rowing', 'lift', 'hyrox', 'cross', 'race'];
const SPORT_COLOR: Record<SportType, string> = {
  run: ChartPalette.run,
  bike: ChartPalette.bike,
  swim: ChartPalette.swim,
  lift: ChartPalette.lift,
  cross: ChartPalette.cross,
  race: ChartPalette.race,
  rowing: ChartPalette.rowing,
  hyrox: ChartPalette.hyrox,
};
const SPORT_LABEL: Record<SportType, string> = {
  run: 'Run',
  bike: 'Bike',
  swim: 'Swim',
  lift: 'Lift',
  cross: 'Cross',
  race: 'Race',
  rowing: 'Rowing',
  hyrox: 'Hyrox',
};

function formatSessionType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Raw numeric weight in the display unit — for chart plotting, not text. */
function toDisplayWeight(kg: number, units: UnitSystem): number {
  return units === 'metric' ? kg : kgToLb(kg);
}

// ── Fitness chart (CTL/ATL line chart) ───────────────────────────────────────

const CHART_H = 90;
const CHART_PAD = { t: 8, b: 8, l: 4, r: 4 };

function FitnessChart({
  series,
  width,
}: {
  series: Array<{ date: string; atl: number; ctl: number }>;
  width: number;
}) {
  if (series.length < 2 || width <= 0) return null;

  const maxVal = Math.max(1, ...series.map((s) => Math.max(s.atl, s.ctl)));
  const innerW = width - CHART_PAD.l - CHART_PAD.r;
  const innerH = CHART_H - CHART_PAD.t - CHART_PAD.b;

  function xOf(i: number) {
    return CHART_PAD.l + (i / (series.length - 1)) * innerW;
  }
  function yOf(val: number) {
    return CHART_PAD.t + innerH - (val / maxVal) * innerH;
  }

  const ctlPoints = series.map((s, i) => `${xOf(i)},${yOf(s.ctl)}`).join(' ');
  const atlPoints = series.map((s, i) => `${xOf(i)},${yOf(s.atl)}`).join(' ');

  return (
    <Svg width={width} height={CHART_H} viewBox={`0 0 ${width} ${CHART_H}`}>
      <Polyline
        points={ctlPoints}
        fill="none"
        stroke={ChartPalette.run}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.9}
      />
      <Polyline
        points={atlPoints}
        fill="none"
        stroke={ChartPalette.neutral}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.75}
      />
    </Svg>
  );
}

// ── e1RM trend sparkline (single lift) ────────────────────────────────────────

function E1rmChart({ points, width }: { points: number[]; width: number }) {
  if (points.length < 2 || width <= 0) return null;
  const maxVal = Math.max(...points);
  const minVal = Math.min(...points);
  const range = Math.max(1, maxVal - minVal);
  const innerW = width - CHART_PAD.l - CHART_PAD.r;
  const innerH = CHART_H - CHART_PAD.t - CHART_PAD.b;

  const coords = points
    .map((v, i) => {
      const x = CHART_PAD.l + (i / (points.length - 1)) * innerW;
      const y = CHART_PAD.t + innerH - ((v - minVal) / range) * innerH;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <Svg width={width} height={CHART_H} viewBox={`0 0 ${width} ${CHART_H}`}>
      <Polyline
        points={coords}
        fill="none"
        stroke={ChartPalette.lift}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ── Per-sport weekly volume (stacked bars) ────────────────────────────────────

function SportVolumeChart({
  weeks,
}: {
  weeks: Array<{ weekStartIso: string; label: string; totalHours: number; hoursBySport: Partial<Record<SportType, number>> }>;
}) {
  const maxHours = Math.max(1, ...weeks.map((w) => w.totalHours));

  return (
    <View style={styles.chartBars}>
      {weeks.map((week) => (
        <View key={week.weekStartIso} style={styles.barColumn}>
          <Text style={styles.barValue}>{week.totalHours > 0 ? `${week.totalHours}h` : ''}</Text>
          <View style={[styles.barTrack, styles.stackedBarTrack]}>
            {SPORT_ORDER.filter((sport) => (week.hoursBySport[sport] ?? 0) > 0).map((sport) => (
              <View
                key={sport}
                style={{ flex: week.hoursBySport[sport] ?? 0, backgroundColor: SPORT_COLOR[sport] }}
              />
            ))}
            {/* Spacer last so, in a column-reverse track, it lands at the top —
                representing headroom up to the tallest week in the window. */}
            <View style={{ flex: Math.max(0, maxHours - week.totalHours) }} />
          </View>
          <Text style={styles.barLabel}>{week.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function StatsTab() {
  const router = useRouter();
  const { data, isLoading, error } = useStats();
  const { isPlus } = useSubscription();
  const { data: perf, isLoading: perfLoading } = usePerformance();
  const { data: liftStats } = useLiftAnalytics();
  const { units } = useUnitPreference();
  const deleteWorkoutLog = useDeleteWorkoutLog();
  const [chartWidth, setChartWidth] = useState(0);

  function handleDeleteWorkout(id: string, label: string) {
    Alert.alert(`Delete ${label}?`, 'This will remove it from your history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteWorkoutLog.mutate(id, {
            onError: (err) =>
              Alert.alert('Delete failed', friendlyError(err, 'Try again.')),
          }),
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Stats</Text>
        <Text style={styles.subtitle}>Training trends and progress at a glance.</Text>

        <View style={styles.navChipRow}>
          <TouchableOpacity
            style={styles.navChip}
            onPress={() => router.push('/races')}
            accessibilityRole="button"
            accessibilityLabel="Races"
          >
            <Ionicons name="flag-outline" size={14} color={Theme.accent} />
            <Text style={styles.navChipText}>Races</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navChip}
            onPress={() => router.push('/challenges')}
            accessibilityRole="button"
            accessibilityLabel="Challenges"
          >
            <Ionicons name="trophy-outline" size={14} color={Theme.accent} />
            <Text style={styles.navChipText}>Challenges</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navChip}
            onPress={() => router.push('/calendar')}
            accessibilityRole="button"
            accessibilityLabel="Calendar"
          >
            <Ionicons name="calendar-outline" size={14} color={Theme.accent} />
            <Text style={styles.navChipText}>Calendar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navChip}
            onPress={() => router.push('/routes')}
            accessibilityRole="button"
            accessibilityLabel="Routes"
          >
            <Ionicons name="map-outline" size={14} color={Theme.accent} />
            <Text style={styles.navChipText}>Routes</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator color={Theme.accent} style={{ marginTop: 24 }} />
        ) : error ? (
          <Text style={styles.errorText}>Couldn&apos;t load stats.</Text>
        ) : (
          <>
            <View style={styles.statsRow}>
              <StatBlock label="WORKOUTS" value={`${data?.totalWorkouts30d ?? 0}`} sub="Last 30 days" />
              <StatBlock
                label="DISTANCE"
                value={formatDistanceKm(milesToKm(data?.totalMiles30d ?? 0), units)}
                sub="Last 30 days"
              />
              <StatBlock
                label="TIME"
                value={`${Math.round((data?.totalMinutes30d ?? 0) / 60)} hr`}
                sub="Last 30 days"
              />
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.heroLabel}>WEEKLY TRAINING VOLUME</Text>
              {data ? <SportVolumeChart weeks={data.weeklySportVolume} /> : null}
              {data && data.sportTotalsPeriod.length > 0 ? (
                <View style={styles.sportLegend}>
                  {data.sportTotalsPeriod.map((total) => (
                    <View key={total.sessionType} style={styles.sportLegendItem}>
                      <View
                        style={[styles.legendDot, { backgroundColor: SPORT_COLOR[total.sessionType] }]}
                      />
                      <Text style={styles.sportLegendText}>
                        {SPORT_LABEL[total.sessionType]} · {total.hours}h
                        {total.miles != null ? ` · ${formatDistanceKm(milesToKm(total.miles), units)}` : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {/* ── Performance Intelligence (OSPREY+) ── */}
            {isPlus ? (
              perfLoading ? (
                <ActivityIndicator color={Theme.accent} style={{ marginTop: 8 }} />
              ) : perf ? (
                <>
                  {/* Injury risk banner — only shown when not in the safe zone */}
                  {perf.injuryRisk.level !== 'low' ? (
                    <View
                      style={[
                        styles.riskBanner,
                        perf.injuryRisk.level === 'high'
                          ? styles.riskBannerHigh
                          : perf.injuryRisk.level === 'moderate'
                          ? styles.riskBannerMod
                          : styles.riskBannerInfo,
                      ]}
                    >
                      <Text style={styles.riskIcon}>
                        {perf.injuryRisk.level === 'high'
                          ? '⚠️'
                          : perf.injuryRisk.level === 'moderate'
                          ? '📊'
                          : 'ℹ️'}
                      </Text>
                      <Text style={styles.riskText}>{perf.injuryRisk.message}</Text>
                    </View>
                  ) : null}

                  <Text style={styles.sectionLabel}>FITNESS & FORM</Text>
                  <View style={styles.fitnessCard}>
                    <View style={styles.fitnessMetrics}>
                      <FitnessMetric
                        label="FITNESS"
                        sublabel="CTL"
                        value={perf.ctl.toFixed(1)}
                        color={ChartPalette.run}
                      />
                      <FitnessMetric
                        label="FATIGUE"
                        sublabel="ATL"
                        value={perf.atl.toFixed(1)}
                        color={ChartPalette.neutral}
                      />
                      <FitnessMetric
                        label="FORM"
                        sublabel="TSB"
                        value={perf.tsb > 0 ? `+${perf.tsb.toFixed(1)}` : perf.tsb.toFixed(1)}
                        color={perf.tsb >= 0 ? StatusPalette.success : StatusPalette.danger}
                      />
                    </View>

                    {perf.series.length >= 2 ? (
                      <>
                        <View style={styles.chartLegend}>
                          <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: ChartPalette.run }]} />
                            <Text style={styles.legendText}>Fitness (CTL)</Text>
                          </View>
                          <View style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: ChartPalette.neutral }]} />
                            <Text style={styles.legendText}>Fatigue (ATL)</Text>
                          </View>
                        </View>
                        <View style={styles.svgWrap} onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
                          <FitnessChart series={perf.series} width={chartWidth} />
                        </View>
                        <Text style={styles.chartDateRange}>
                          {perf.series[0]?.date} — {perf.series[perf.series.length - 1]?.date}
                        </Text>
                      </>
                    ) : null}
                  </View>

                  {perf.triathlonPredictor ? (
                    <>
                      <Text style={styles.sectionLabel}>
                        {perf.triathlonPredictor.raceLabel.toUpperCase()} PREDICTOR
                      </Text>
                      <View style={styles.predictorCard}>
                        {perf.triathlonPredictor.splits.map((split) => (
                          <View key={split.leg} style={styles.predictorRow}>
                            <Text style={styles.predictorDist}>
                              {SESSION_ICON[split.leg]} {split.label}
                            </Text>
                            {split.predictedTimeS != null ? (
                              <Text style={styles.predictorTime}>
                                {formatRaceTimeSec(split.predictedTimeS)}
                              </Text>
                            ) : (
                              <Text style={styles.predictorPlaceholder}>Log a {split.leg} to unlock</Text>
                            )}
                          </View>
                        ))}
                        <View style={[styles.predictorRow, styles.predictorTotalRow]}>
                          <Text style={styles.predictorTotalLabel}>
                            Est. finish (+{Math.round(perf.triathlonPredictor.transitionEstimateS / 60)}
                            min transitions)
                          </Text>
                          {perf.triathlonPredictor.totalTimeS != null ? (
                            <Text style={styles.predictorTotalValue}>
                              {formatRaceTimeSec(perf.triathlonPredictor.totalTimeS)}
                            </Text>
                          ) : (
                            <Text style={styles.predictorPlaceholder}>
                              Log all 3 disciplines to unlock
                            </Text>
                          )}
                        </View>
                      </View>
                    </>
                  ) : perf.racePredictor && perf.racePredictor.predictions.length > 0 ? (
                    <>
                      <Text style={styles.sectionLabel}>RACE PREDICTOR</Text>
                      <View style={styles.predictorCard}>
                        <Text style={styles.predictorBase}>
                          Based on your best recent {perf.racePredictor.baseMiles.toFixed(1)}-mile effort
                        </Text>
                        {perf.racePredictor.predictions.map((p) => (
                          <View key={p.label} style={styles.predictorRow}>
                            <Text style={styles.predictorDist}>{p.label}</Text>
                            <Text style={styles.predictorTime}>
                              {formatRaceTimeSec(p.predictedTimeS)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : null}
                </>
              ) : null
            ) : (
              /* Gate upsell for non-plus users */
              <TouchableOpacity
                style={styles.upsellCard}
                onPress={() => router.push('/paywall')}
                accessibilityRole="button"
                accessibilityLabel="Unlock Performance Intelligence"
              >
                <Text style={styles.upsellIcon}>📈</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.upsellTitle}>Performance Intelligence</Text>
                  <Text style={styles.upsellDesc}>
                    Fitness/fatigue/form trends, injury risk score, and race time predictions.
                  </Text>
                </View>
                <Text style={styles.upsellArrow}>→</Text>
              </TouchableOpacity>
            )}

            {liftStats && (liftStats.weekVolumeKg > 0 || liftStats.prs.length > 0) ? (
              <>
                <Text style={styles.sectionLabel}>LIFT VOLUME</Text>
                <View style={styles.liftCard}>
                  <View style={styles.liftVolumeRow}>
                    <Text style={styles.liftVolumeValue}>
                      {Math.round(toDisplayWeight(liftStats.weekVolumeKg, units)).toLocaleString()}{' '}
                      {units === 'metric' ? 'kg' : 'lbs'}
                    </Text>
                    <Text style={styles.liftVolumeSub}>moved this week</Text>
                  </View>
                  {liftStats.weekMuscleGroups.length > 0 ? (
                    <View style={styles.muscleChipRow}>
                      {liftStats.weekMuscleGroups.map((m) => (
                        <View key={m.muscleGroup} style={styles.muscleChip}>
                          <Text style={styles.muscleChipText}>{m.muscleGroup}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {liftStats.primaryLift && liftStats.primaryLift.trend.length >= 2 ? (
                    <>
                      <Text style={styles.liftTrendLabel}>
                        {liftStats.primaryLift.exerciseName} · EST. 1RM TREND
                      </Text>
                      <View style={styles.svgWrap} onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}>
                        <E1rmChart
                          points={liftStats.primaryLift.trend.map((p) => toDisplayWeight(p.e1rmKg, units))}
                          width={chartWidth}
                        />
                      </View>
                    </>
                  ) : null}
                </View>

                {liftStats.prs.length > 0 ? (
                  <View style={styles.prList}>
                    {liftStats.prs.map((pr, index) => (
                      <View
                        key={pr.exerciseName}
                        style={[styles.prRow, index === liftStats.prs.length - 1 && styles.workoutRowLast]}
                      >
                        <Text style={styles.prMedal}>{index === 0 ? '🏆' : `#${index + 1}`}</Text>
                        <View style={styles.workoutInfo}>
                          <Text style={styles.workoutType}>{pr.exerciseName}</Text>
                          <Text style={styles.workoutMeta}>
                            Est. 1RM · {new Date(pr.achievedOn).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </Text>
                        </View>
                        <Text style={styles.prValue}>
                          {Math.round(toDisplayWeight(pr.bestE1rmKg, units))} {units === 'metric' ? 'kg' : 'lbs'}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}

            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>RECENT WORKOUTS</Text>
              <TouchableOpacity
                onPress={() => router.push('/calendar')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="View all workouts in Calendar"
              >
                <Text style={styles.viewAllLink}>View all ›</Text>
              </TouchableOpacity>
            </View>
            {data && data.recentWorkouts.length > 0 ? (
              <View style={styles.workoutList}>
                {data.recentWorkouts.map((w, index) => (
                  <View
                    key={w.id}
                    style={[
                      styles.workoutRow,
                      index === data.recentWorkouts.length - 1 && styles.workoutRowLast,
                    ]}
                  >
                    <Text style={styles.workoutIcon}>{SESSION_ICON[w.sessionType] ?? '•'}</Text>
                    <View style={styles.workoutInfo}>
                      <Text style={styles.workoutType}>{formatSessionType(w.sessionType)}</Text>
                      <Text style={styles.workoutMeta}>
                        {formatDate(w.startedAt)} · {w.durationMinutes} min
                        {w.distanceMiles ? ` · ${formatDistanceKm(milesToKm(w.distanceMiles), units)}` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteWorkout(w.id, formatSessionType(w.sessionType))}
                      hitSlop={8}
                      style={styles.workoutDeleteBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${formatSessionType(w.sessionType)} workout`}
                    >
                      <Ionicons name="trash-outline" size={16} color={Theme.textMut} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No workouts logged yet this period.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBlock({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

function FitnessMetric({
  label, sublabel, value, color,
}: {
  label: string; sublabel: string; value: string; color: string;
}) {
  return (
    <View style={styles.fitnessMetric}>
      <Text style={styles.fmLabel}>{label}</Text>
      <Text style={[styles.fmValue, { color }]}>{value}</Text>
      <Text style={styles.fmSub}>{sublabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.ink },
  scrollContent: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '900', color: Theme.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Theme.textMut, lineHeight: 20, marginBottom: 16 },
  navChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  navChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Theme.panel,
    borderWidth: 1,
    borderColor: Theme.accent,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  navChipText: { fontSize: 12, fontWeight: '700', color: Theme.accent },
  errorText: { fontSize: 13, color: StatusPalette.danger },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statBlock: {
    flex: 1,
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 12,
    alignItems: 'center',
    gap: 2,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Theme.textMut,
    letterSpacing: 0.8,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: Theme.text, marginTop: 2 },
  statSub: { fontSize: 10, color: Theme.textMut },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  viewAllLink: { fontSize: 12, fontWeight: '700', color: Theme.accent },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Theme.accent,
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 4,
  },
  chartCard: {
    backgroundColor: Theme.accent + '1A',
    borderWidth: BorderWidth.card,
    borderColor: Theme.accent + '59',
    borderRadius: Radius.card,
    padding: 16,
    marginBottom: 24,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Theme.accent,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 140 },
  barColumn: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barValue: { fontSize: 10, fontWeight: '700', color: Theme.accent, marginBottom: 4 },
  barTrack: {
    width: 18,
    flex: 1,
    // The unfilled track behind the stacked bars. Was a raw rgba byte-identical
    // to the OLD Colors.bgCard — a leftover the migration missed, caught by the
    // no-old-colours screen test. Same call as OnboardingShell's progressTrack.
    backgroundColor: Theme.line,
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', backgroundColor: Theme.accent, borderRadius: 6 },
  barLabel: { fontSize: 9, color: Theme.textMut, marginTop: 6 },
  stackedBarTrack: { flexDirection: 'column-reverse' },
  sportLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Theme.line,
  },
  sportLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sportLegendText: { fontSize: 10, color: Theme.textSoft, fontWeight: '600' },

  // ── Risk banner ──
  riskBanner: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: Radius.card,
    padding: 12,
    borderWidth: BorderWidth.card,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  // FUNCTIONAL — severity tier, not a surface
  riskBannerHigh: {
    backgroundColor: 'rgba(255,68,68,0.07)',
    borderColor: 'rgba(255,68,68,0.25)',
  },
  riskBannerMod: {
    backgroundColor: Theme.accent + '12',
    borderColor: Theme.accent + '40',
  },
  riskBannerInfo: {
    backgroundColor: Theme.panel,
    borderColor: Theme.line,
  },
  riskIcon: { fontSize: 16 },
  riskText: { flex: 1, fontSize: 13, color: Theme.textSoft, lineHeight: 18 },

  // ── Fitness card ──
  fitnessCard: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  fitnessMetrics: { flexDirection: 'row', justifyContent: 'space-around' },
  fitnessMetric: { alignItems: 'center', gap: 2 },
  fmLabel: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Theme.textMut,
    letterSpacing: 0.8,
  },
  fmValue: { fontSize: 22, fontWeight: '800' },
  fmSub: { fontSize: 9, color: Theme.textMut },
  chartLegend: { flexDirection: 'row', gap: 16, marginBottom: -4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: Theme.textMut, fontWeight: '600' },
  svgWrap: { width: '100%', alignItems: 'center' },
  chartDateRange: { fontSize: 9, color: Theme.textMut, textAlign: 'right', marginTop: -4 },

  // ── Race predictor ──
  predictorCard: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 16,
    marginBottom: 24,
    gap: 0,
  },
  predictorBase: {
    fontSize: 11,
    color: Theme.textMut,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  predictorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: Theme.line,
  },
  predictorDist: { fontSize: 14, fontWeight: '700', color: Theme.text },
  predictorTime: { fontSize: 14, fontWeight: '800', color: Theme.accent },
  predictorPlaceholder: { fontSize: 11, color: Theme.textMut, fontStyle: 'italic' },
  predictorTotalRow: { borderBottomWidth: 0, paddingTop: 12, marginTop: 2 },
  predictorTotalLabel: { fontSize: 12, fontWeight: '700', color: Theme.textSoft, flexShrink: 1 },
  predictorTotalValue: { fontSize: 16, fontWeight: '800', color: Theme.accent },

  // ── Upsell card ──
  upsellCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.accent,
    borderRadius: Radius.card,
    padding: 16,
    marginBottom: 24,
  },
  upsellIcon: { fontSize: 28 },
  upsellTitle: { fontSize: 14, fontWeight: '700', color: Theme.accent, marginBottom: 3 },
  upsellDesc: { fontSize: 12, color: Theme.textSoft, lineHeight: 17 },
  upsellArrow: { fontSize: 18, color: Theme.accent, fontWeight: '700' },

  // ── Lift analytics ──
  liftCard: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  liftVolumeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  liftVolumeValue: { fontSize: 22, fontWeight: '800', color: Theme.accent },
  liftVolumeSub: { fontSize: 12, color: Theme.textMut, fontWeight: '600' },
  muscleChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  muscleChip: {
    // Nested inside liftCard (Theme.panel) — a solid Theme.panel fill here
    // would match its parent and read as flat, so this recedes to Theme.ink.
    // Matches routes.tsx's routeTagChip (ink fill + accent text), which is the
    // same thing: a passive tag inside a card. The accent-tint treatment is
    // reserved for ACTIVE/selected chips (routes.tsx chipActive), not labels.
    backgroundColor: Theme.ink,
    borderRadius: Radius.card,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  muscleChipText: { fontSize: 11, fontWeight: '700', color: Theme.accent },
  liftTrendLabel: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Theme.textMut,
    letterSpacing: 0.8,
    marginTop: 4,
  },
  prList: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    overflow: 'hidden',
    marginBottom: 24,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Theme.line,
  },
  prMedal: { fontSize: 16, width: 28, textAlign: 'center' },
  prValue: { fontSize: 14, fontWeight: '800', color: Theme.accent },

  // ── Recent workouts ──
  workoutList: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Theme.line,
  },
  workoutRowLast: { borderBottomWidth: 0 },
  workoutIcon: { fontSize: 20 },
  workoutInfo: { flex: 1 },
  workoutType: { fontSize: 14, fontWeight: '700', color: Theme.text },
  workoutMeta: { fontSize: 12, color: Theme.textSoft, marginTop: 2 },
  workoutDeleteBtn: { padding: 4 },
  emptyCard: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 16,
  },
  emptyText: { fontSize: 13, color: Theme.textMut },
});
