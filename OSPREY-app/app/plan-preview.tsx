import { useEffect, useMemo, useState } from 'react';
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
import { useAuthStore } from '@/store/authStore';
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
}

function kmToMiles(km: number): number {
  return km * 0.621371;
}

/** Distance line under the session description — miles for run/bike, yards for swim. */
function formatDistance(session: SessionPreview): string | null {
  if (session.planned_distance_km == null) return null;
  if (session.session_type === 'swim') {
    const yards = Math.round(session.planned_distance_km * 1093.61);
    return `${yards} yd`;
  }
  if (session.session_type === 'run' || session.session_type === 'race' || session.session_type === 'bike') {
    const mi = kmToMiles(session.planned_distance_km);
    return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;
  }
  return null;
}

/** Target pace (min:sec / mi) — run sessions only, derived from distance + duration. */
function formatPace(session: SessionPreview): string | null {
  if (session.session_type !== 'run' && session.session_type !== 'race') return null;
  if (!session.planned_distance_km || !session.planned_minutes) return null;
  const miles = kmToMiles(session.planned_distance_km);
  if (miles <= 0) return null;
  const paceMinutes = session.planned_minutes / miles;
  const min = Math.floor(paceMinutes);
  const sec = Math.round((paceMinutes - min) * 60);
  return `${min}:${String(sec).padStart(2, '0')}/mi`;
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
  const totalMiles = sessions.reduce((sum, s) => {
    if (!s.planned_distance_km) return sum;
    if (s.session_type !== 'run' && s.session_type !== 'race' && s.session_type !== 'bike') return sum;
    return sum + kmToMiles(s.planned_distance_km);
  }, 0);

  const SESSION_ICONS: Record<string, string> = {
    run: '🏃',
    lift: '🏋️',
    swim: '🏊',
    bike: '🚴',
    cross: '🔁',
    rest: '😴',
  };

  return (
    <SafeAreaView style={styles.container}>
      {isViewOnly ? (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
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
          <TouchableOpacity style={styles.buildBtn} onPress={() => router.replace('/preferences')}>
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
                  <Text style={styles.summaryValue}>{totalMiles > 0 ? totalMiles.toFixed(1) : '0'}</Text>
                  <Text style={styles.summaryName}>Miles</Text>
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

            <Text style={styles.scheduleLabel}>SCHEDULE</Text>
            <View style={styles.scheduleCard}>
              {sessions.map((session, idx) => {
                const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                const dayOfWeek = idx; // sessions are in order Mon-Sun
                const dayName = dayNames[dayOfWeek] ?? `Day ${dayOfWeek}`;
                const distance = formatDistance(session);
                const pace = formatPace(session);

                return (
                  <View
                    key={`${session.session_date}-${idx}`}
                    style={[
                      styles.sessionRow,
                      idx < sessions.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border },
                    ]}
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
                    </View>
                  </View>
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
              <TouchableOpacity style={styles.homeBtn} onPress={() => router.back()}>
                <Text style={styles.homeBtnText}>Done</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.homeBtn} onPress={goHome}>
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
});
