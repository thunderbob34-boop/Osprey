import { Fragment, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { ZonesCard } from '@/components/ZonesCard';
import { useAuthStore } from '@/store/authStore';
import { useNutritionCoaching } from '@/hooks/useNutritionCoaching';
import { useHydration } from '@/hooks/useHydration';
import { useWeatherCoach } from '@/hooks/useWeatherCoach';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { formatDistanceKm, formatFluidOz, formatPacePerUnit, kmToMiles, type UnitSystem } from '@/services/units';
import { estimateDayMacros, type DayMacroEstimate } from '@/services/nutrition-estimate';
import { totalIntervalDistanceM } from '@/services/intervals';
import type { WeatherSeverity } from '@/services/weather-coach';
import type { IntervalPrescription, LiftPrescription } from '@/types/workout';
import {
  computeRacePhase,
  fetchCurrentWeekSessions,
  fetchRaceGoal,
  type RaceGoal,
  type RacePhaseInfo,
  type WeekSession,
} from '@/services/plan';

interface SessionPreview {
  session_date: string;
  session_type: string;
  intensity: string;
  planned_minutes: number | null;
  planned_distance_km: number | null;
  description: string;
  ozzie_notes?: string | null;
  lift_prescription?: LiftPrescription | null;
  interval_prescription?: IntervalPrescription | null;
}

// Keep in sync with HEAT_CAUTION_F in services/weather-coach.ts.
const HEAT_CAUTION_F = 85;

const INTENSITY_COLORS: Record<string, { bg: string; fg: string }> = {
  easy: { bg: 'rgba(76,222,128,0.15)', fg: Colors.green },
  moderate: { bg: 'rgba(245,166,35,0.15)', fg: Colors.amber },
  threshold: { bg: 'rgba(245,166,35,0.15)', fg: Colors.amber },
  interval: { bg: 'rgba(255,68,68,0.15)', fg: Colors.red },
  race: { bg: 'rgba(255,68,68,0.15)', fg: Colors.red },
  rest: { bg: 'rgba(255,255,255,0.08)', fg: Colors.textMuted },
};

const EFFORT_COLORS: Record<string, string> = {
  easy: Colors.green,
  moderate: Colors.teal,
  threshold: Colors.amber,
  hard: Colors.red,
  max: Colors.red,
};

interface WeatherNote {
  text: string;
  severity: WeatherSeverity;
}

/** Distance line under the session description — respects the global unit; yards/meters for swim. */
function formatDistance(session: SessionPreview, units: UnitSystem): string | null {
  if (session.planned_distance_km == null) return null;
  if (session.session_type === 'swim') {
    return units === 'metric'
      ? `${Math.round(session.planned_distance_km * 1000)} m`
      : `${Math.round(session.planned_distance_km * 1093.61)} yd`;
  }
  if (session.session_type === 'run' || session.session_type === 'race' || session.session_type === 'bike') {
    return formatDistanceKm(session.planned_distance_km, units);
  }
  return null;
}

/** Target pace — run sessions only, derived from distance + duration. */
function formatPace(session: SessionPreview, units: UnitSystem): string | null {
  if (session.session_type !== 'run' && session.session_type !== 'race') return null;
  if (!session.planned_distance_km || !session.planned_minutes) return null;
  return formatPacePerUnit(session.planned_minutes * 60, session.planned_distance_km, units);
}

/** Weekday name from the session's own date — not row order, which breaks for
 * any short/reordered week (a race-week taper, a skipped day, etc). Parsed as
 * a local date, same as calendar.tsx's day-sheet formatter. */
function dayNameForDate(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' });
}

interface SessionDetailPanelProps {
  session: SessionPreview;
  isViewOnly: boolean;
  macros: DayMacroEstimate | null;
  hydrationTargetOz: number | null;
  weatherNote: WeatherNote | null;
  isLast: boolean;
  units: UnitSystem;
}

function SessionDetailPanel({
  session,
  isViewOnly,
  macros,
  hydrationTargetOz,
  weatherNote,
  units,
  isLast,
}: SessionDetailPanelProps) {
  const intensityColor = INTENSITY_COLORS[session.intensity];
  const totalDistanceM = session.interval_prescription
    ? totalIntervalDistanceM(session.interval_prescription)
    : null;

  return (
    <View style={[styles.detailPanel, !isLast && styles.detailPanelDivider]}>
      {/* ── Workout ── */}
      <View style={styles.detailSection}>
        <Text style={styles.detailSectionLabel}>WORKOUT</Text>
        <View style={styles.detailMetaRow}>
          <View style={[styles.intensityChip, intensityColor && { backgroundColor: intensityColor.bg }]}>
            <Text style={[styles.intensityChipText, intensityColor && { color: intensityColor.fg }]}>
              {session.intensity}
            </Text>
          </View>
          {session.planned_minutes ? (
            <Text style={styles.detailMetaText}>{session.planned_minutes} min</Text>
          ) : null}
          {totalDistanceM ? (
            <Text style={styles.detailMetaText}>{Math.round(totalDistanceM)} m total</Text>
          ) : null}
        </View>

        {session.lift_prescription ? (
          <View style={styles.exerciseList}>
            {session.lift_prescription.exercises.map((exercise, i) => (
              <View key={`${exercise.name}-${i}`} style={styles.exerciseRow}>
                <View style={styles.exerciseNameRow}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseMeta}>
                    {exercise.sets}×{exercise.reps}
                  </Text>
                </View>
                {exercise.note ? <Text style={styles.exerciseNote}>{exercise.note}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {session.interval_prescription ? (
          <View style={styles.segmentList}>
            {session.interval_prescription.segments.map((segment, i) => (
              <View key={`${segment.label}-${i}`} style={styles.segmentRow}>
                <Text style={styles.segmentReps}>{segment.reps}×</Text>
                <Text style={styles.segmentLabel}>{segment.label}</Text>
                <Text style={[styles.segmentEffort, { color: EFFORT_COLORS[segment.effort] ?? Colors.textMuted }]}>
                  {segment.effort}
                </Text>
                {segment.restS > 0 ? <Text style={styles.segmentRest}>{segment.restS}s rest</Text> : null}
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* ── Why ── */}
      {session.ozzie_notes ? (
        <View style={styles.detailSection}>
          <Text style={styles.detailSectionLabel}>WHY THIS SESSION</Text>
          <Text style={styles.detailBodyText}>{session.ozzie_notes}</Text>
        </View>
      ) : null}

      {/* ── Fuel & Hydration ── */}
      {isViewOnly && macros ? (
        <View style={styles.detailSection}>
          <Text style={styles.detailSectionLabel}>FUEL &amp; HYDRATION</Text>
          <View style={styles.macroGrid}>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{macros.proteinG}g</Text>
              <Text style={styles.macroLabel}>Protein</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{macros.carbsG}g</Text>
              <Text style={styles.macroLabel}>Carbs</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{macros.fatG}g</Text>
              <Text style={styles.macroLabel}>Fat</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{macros.calories.toLocaleString()}</Text>
              <Text style={styles.macroLabel}>{macros.isExact ? 'Calories' : 'Calories (est.)'}</Text>
            </View>
          </View>
          {hydrationTargetOz != null ? (
            <Text style={styles.hydrationLine}>
              💧 {formatFluidOz(hydrationTargetOz, units)} {units === 'metric' ? 'ml' : 'oz'} water target
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* ── Anything else ── */}
      {weatherNote ? (
        <Text style={[styles.heatNote, weatherNote.severity === 'alert' && styles.heatNoteAlert]}>
          {weatherNote.severity === 'alert' ? '🔴' : '⚠️'} {weatherNote.text}
        </Text>
      ) : null}
    </View>
  );
}

export default function PlanPreviewScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const { sessions: sessionsJson } = useLocalSearchParams<{ sessions?: string }>();

  // Post-generation flow passes sessions directly; opening this screen on its
  // own (e.g. from Settings) fetches the active plan's current week live.
  const isViewOnly = !sessionsJson;
  const [liveSessions, setLiveSessions] = useState<WeekSession[] | null>(null);
  const [loading, setLoading] = useState(isViewOnly);
  const [loadError, setLoadError] = useState(false);
  const [raceGoal, setRaceGoal] = useState<RaceGoal | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const { data: nutritionCoaching } = useNutritionCoaching();
  const { data: hydration } = useHydration();
  const { data: weatherCoach } = useWeatherCoach(nutritionCoaching?.todaySessionType ?? null);
  const { units } = useUnitPreference();

  useEffect(() => {
    if (!isViewOnly || !userId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    fetchCurrentWeekSessions(userId)
      .then((data) => {
        if (!cancelled) setLiveSessions(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isViewOnly, userId]);

  // Race countdown fetches regardless of view mode — it's relevant right
  // after generating a race-target plan too, not just when browsing later.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchRaceGoal(userId)
      .then((goal) => {
        if (!cancelled) setRaceGoal(goal);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const racePhase: RacePhaseInfo | null = useMemo(() => {
    if (!raceGoal) return null;
    return computeRacePhase(raceGoal);
  }, [raceGoal]);

  function goHome() {
    queryClient.invalidateQueries({ queryKey: ['daily-summary'] });
    queryClient.invalidateQueries({ queryKey: ['calendar-month'] });
    queryClient.invalidateQueries({ queryKey: ['stats'] });
    router.replace('/(tabs)');
  }

  const sessions: SessionPreview[] = useMemo(() => {
    if (isViewOnly) return liveSessions ?? [];
    if (!sessionsJson) return [];
    try {
      return JSON.parse(sessionsJson);
    } catch {
      return [];
    }
  }, [isViewOnly, liveSessions, sessionsJson]);

  const sessionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    sessions.forEach((s) => {
      if (s.session_type !== 'rest') {
        counts[s.session_type] = (counts[s.session_type] ?? 0) + 1;
      }
    });
    return counts;
  }, [sessions]);

  const totalSessions = sessions.filter((s) => s.session_type !== 'rest').length;
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.planned_minutes ?? 0), 0);
  const totalDistanceKm = sessions.reduce((sum, s) => {
    if (!s.planned_distance_km) return sum;
    if (s.session_type !== 'run' && s.session_type !== 'race' && s.session_type !== 'bike') return sum;
    return sum + s.planned_distance_km;
  }, 0);

  const SESSION_ICONS: Record<string, string> = {
    run: '🏃',
    lift: '🏋️',
    swim: '🏊',
    bike: '🚴',
    cross: '🔁',
    rest: '😴',
  };

  // Local date, not toISOString() — that flips to tomorrow before local
  // midnight for anyone west of UTC (e.g. ~5pm Pacific), misattributing
  // today's macro/weather annotations to the wrong day.
  const todayIso = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const tomorrowIso = useMemo(() => {
    const d = new Date(`${todayIso}T00:00:00`);
    d.setDate(d.getDate() + 1);
    return format(d, 'yyyy-MM-dd');
  }, [todayIso]);
  const todaySession = useMemo(
    () => sessions.find((s) => s.session_date === todayIso) ?? null,
    [sessions, todayIso],
  );

  function macrosForSession(session: SessionPreview): DayMacroEstimate | null {
    if (!nutritionCoaching?.target) return null;
    if (session.session_date === todayIso) {
      return { ...nutritionCoaching.target, isExact: true };
    }
    return estimateDayMacros(
      nutritionCoaching.target,
      todaySession?.session_type ?? null,
      todaySession?.planned_minutes ?? null,
      session.session_type,
      session.planned_minutes,
    );
  }

  function weatherNoteForDate(dateIso: string): WeatherNote | null {
    if (!weatherCoach) return null;
    if (dateIso === todayIso) {
      if (weatherCoach.severity === 'info') return null;
      return { text: weatherCoach.headline, severity: weatherCoach.severity };
    }
    if (dateIso === tomorrowIso && weatherCoach.tomorrow && weatherCoach.tomorrow.maxF >= HEAT_CAUTION_F) {
      return {
        text: `${Math.round(weatherCoach.tomorrow.maxF)}° tomorrow — start hydrating early.`,
        severity: 'caution',
      };
    }
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      {isViewOnly ? (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>This Week's Plan</Text>
          <View style={{ width: 24 }} />
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.teal} size="large" />
        </View>
      ) : loadError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Could not load your plan. Try again.</Text>
        </View>
      ) : isViewOnly && sessions.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>No active plan yet.</Text>
          <TouchableOpacity
            style={styles.buildBtn}
            onPress={() => router.replace('/preferences')}
            accessibilityRole="button"
            accessibilityLabel="Build my plan"
          >
            <Text style={styles.buildBtnText}>Build My Plan →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {!isViewOnly ? (
              <>
                <Text style={styles.title}>Your Plan</Text>
                <Text style={styles.subtitle}>This week's workouts and schedule</Text>
              </>
            ) : null}

            {raceGoal && racePhase ? (
              <View style={styles.raceCard}>
                <Text style={styles.raceCardLabel}>TRAINING FOR</Text>
                <Text style={styles.raceCardName}>{raceGoal.targetRace}</Text>
                <Text style={styles.raceCardMeta}>
                  {racePhase.weeksRemaining === 0
                    ? 'Race week!'
                    : `${racePhase.weeksRemaining} week${racePhase.weeksRemaining === 1 ? '' : 's'} to go`}
                  {'  ·  '}Week {racePhase.currentWeekNumber} of {racePhase.totalWeeks}
                </Text>

                <View style={styles.phaseTrack}>
                  {(['Base', 'Build', 'Peak', 'Taper'] as const).map((phaseName) => (
                    <View
                      key={phaseName}
                      style={[
                        styles.phaseSegment,
                        phaseName === racePhase.phase
                          ? styles.phaseSegmentActive
                          : styles.phaseSegmentInactive,
                      ]}
                    />
                  ))}
                </View>
                <View style={styles.phaseLabelsRow}>
                  {(['Base', 'Build', 'Peak', 'Taper'] as const).map((phaseName) => (
                    <Text
                      key={phaseName}
                      style={[
                        styles.phaseLabel,
                        phaseName === racePhase.phase && styles.phaseLabelActive,
                      ]}
                    >
                      {phaseName}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>THIS WEEK</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{totalSessions}</Text>
                  <Text style={styles.summaryName}>Sessions</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {totalDistanceKm > 0
                      ? (units === 'metric' ? totalDistanceKm : kmToMiles(totalDistanceKm)).toFixed(1)
                      : '0'}
                  </Text>
                  <Text style={styles.summaryName}>{units === 'metric' ? 'Km' : 'Miles'}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{Math.round(totalMinutes / 60)}</Text>
                  <Text style={styles.summaryName}>Hours</Text>
                </View>
              </View>
              <View style={styles.typesRow}>
                {Object.entries(sessionCounts).map(([type, count]) => (
                  <View key={type} style={styles.typeChip}>
                    <Text style={styles.typeIcon}>{SESSION_ICONS[type]}</Text>
                    <Text style={styles.typeCount}>{count}</Text>
                  </View>
                ))}
              </View>
            </View>

            <ZonesCard />

            <Text style={styles.scheduleLabel}>SCHEDULE</Text>
            <View style={styles.scheduleCard}>
              {sessions.map((session, idx) => {
                const dayName = dayNameForDate(session.session_date);
                const distance = formatDistance(session, units);
                const pace = formatPace(session, units);
                const isExpanded = expandedDate === session.session_date;
                const isLast = idx === sessions.length - 1;

                return (
                  <Fragment key={`${session.session_date}-${idx}`}>
                    <TouchableOpacity
                      style={[
                        styles.sessionRow,
                        !isLast && !isExpanded && { borderBottomWidth: 1, borderBottomColor: Colors.border },
                      ]}
                      onPress={() =>
                        setExpandedDate((d) => (d === session.session_date ? null : session.session_date))
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`${isExpanded ? 'Hide' : 'Show'} details for ${dayName}`}
                      accessibilityState={{ expanded: isExpanded }}
                    >
                      <View style={styles.sessionLeft}>
                        <Text style={styles.dayName}>{dayName}</Text>
                        <Text style={styles.sessionDesc}>{session.description}</Text>
                        {distance ? (
                          <Text style={styles.sessionDistance}>
                            {distance}
                            {pace ? ` · ${pace}` : ''}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.sessionRight}>
                        <Text style={styles.sessionIcon}>{SESSION_ICONS[session.session_type] ?? '○'}</Text>
                        {session.planned_minutes ? (
                          <Text style={styles.sessionTime}>{session.planned_minutes}m</Text>
                        ) : null}
                        <Text style={styles.chevron}>{isExpanded ? '▾' : '▸'}</Text>
                      </View>
                    </TouchableOpacity>
                    {isExpanded ? (
                      <SessionDetailPanel
                        session={session}
                        isViewOnly={isViewOnly}
                        macros={macrosForSession(session)}
                        hydrationTargetOz={isViewOnly ? hydration?.targetOz ?? null : null}
                        weatherNote={weatherNoteForDate(session.session_date)}
                        isLast={isLast}
                        units={units}
                      />
                    ) : null}
                  </Fragment>
                );
              })}
            </View>

            {!isViewOnly ? (
              <View style={styles.noteCard}>
                <Text style={styles.noteText}>
                  ✓ Your plan is saved. You can view it anytime from Settings.
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            {isViewOnly ? (
              <TouchableOpacity
                style={styles.homeBtn}
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Done"
              >
                <Text style={styles.homeBtnText}>Done</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.homeBtn}
                onPress={goHome}
                accessibilityRole="button"
                accessibilityLabel="Let's go"
              >
                <Text style={styles.homeBtnText}>Let's Go →</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  errorText: { color: Colors.textMuted, fontSize: 15, textAlign: 'center' },
  buildBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  buildBtnText: { fontSize: 15, fontWeight: '800', color: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backText: { color: Colors.teal, fontSize: 22, fontWeight: '700' },
  headerTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  scroll: { padding: 20, paddingBottom: 32 },
  title: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary, marginBottom: 6 },
  subtitle: { fontSize: 14, color: Colors.textMuted, marginBottom: 20 },
  raceCard: {
    backgroundColor: Colors.surfaceGold,
    borderWidth: 1,
    borderColor: Colors.borderGold,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 4,
  },
  raceCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.gold,
    letterSpacing: 1,
  },
  raceCardName: { fontSize: 18, fontWeight: '900', color: Colors.textPrimary, marginTop: 2 },
  raceCardMeta: { fontSize: 12, color: Colors.textSecondary, marginBottom: 12 },
  phaseTrack: {
    flexDirection: 'row',
    gap: 4,
    height: 8,
  },
  phaseSegment: { flex: 1, borderRadius: 4 },
  phaseSegmentActive: { backgroundColor: Colors.gold },
  phaseSegmentInactive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  phaseLabelsRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  phaseLabel: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    textAlign: 'center',
  },
  phaseLabelActive: { color: Colors.gold },
  summaryCard: {
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.teal,
    letterSpacing: 1,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: 'rgba(0,200,200,0.1)',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  summaryValue: { fontSize: 24, fontWeight: '900', color: Colors.teal },
  summaryName: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  typesRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  typeChip: { alignItems: 'center', gap: 4 },
  typeIcon: { fontSize: 20 },
  typeCount: { fontSize: 12, fontWeight: '700', color: Colors.teal },
  scheduleLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 8,
  },
  scheduleCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 0,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sessionLeft: { flex: 1 },
  dayName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  sessionDesc: { fontSize: 12, color: Colors.textSecondary },
  sessionDistance: { fontSize: 11, color: Colors.teal, fontWeight: '600', marginTop: 2 },
  sessionRight: { alignItems: 'flex-end', gap: 4 },
  sessionIcon: { fontSize: 18 },
  sessionTime: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  noteCard: {
    backgroundColor: Colors.surfaceTeal,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
  },
  noteText: { fontSize: 12, color: Colors.teal, fontWeight: '500', lineHeight: 18 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  homeBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },

  // ── Expandable day panel ──
  chevron: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  detailPanel: {
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.borderTeal,
    padding: 16,
    gap: 14,
  },
  detailPanelDivider: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailSection: { gap: 8 },
  detailSectionLabel: { color: Colors.teal, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  detailBodyText: { color: Colors.textPrimary, fontSize: 14, lineHeight: 21 },
  detailMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailMetaText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  intensityChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  intensityChipText: { fontSize: 11, fontWeight: '700', color: Colors.textPrimary, textTransform: 'capitalize' },

  exerciseList: { gap: 10, marginTop: 4 },
  exerciseRow: { gap: 2 },
  exerciseNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exerciseName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, flexShrink: 1 },
  exerciseMeta: { fontSize: 12, fontWeight: '700', color: Colors.teal },
  exerciseNote: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },

  segmentList: { gap: 8, marginTop: 4 },
  segmentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  segmentReps: { fontSize: 12, fontWeight: '800', color: Colors.textPrimary },
  segmentLabel: { fontSize: 12, color: Colors.textPrimary, flexShrink: 1 },
  segmentEffort: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  segmentRest: { fontSize: 11, color: Colors.textMuted },

  macroGrid: { flexDirection: 'row', gap: 8 },
  macroItem: {
    flex: 1,
    backgroundColor: 'rgba(0,200,200,0.1)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  macroValue: { fontSize: 16, fontWeight: '900', color: Colors.teal },
  macroLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 2, textAlign: 'center' },
  hydrationLine: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },

  heatNote: { fontSize: 12, color: Colors.amber, fontWeight: '600', lineHeight: 17 },
  heatNoteAlert: { color: Colors.red },
});
