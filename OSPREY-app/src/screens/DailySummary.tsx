import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import type { DailySummaryProps, TrainingReadiness } from '@/types/daily-summary';
import NutritionCard from '@/components/NutritionCard';
import OzzieAvatar from '@/components/OzzieAvatar';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { formatDistanceKm, kmToMiles } from '@/services/units';
import { Card, Badge } from '@/components/ui';
import { Theme } from '@/constants/theme';

export type { RecoveryData, SessionData, QuickStats } from '@/types/daily-summary';

// ─── Body Battery Tank ────────────────────────────────────────────────────────

function BodyBatteryTank({ score, recommendation }: { score: number; recommendation: string }) {
  const fillPercent = Math.max(0, Math.min(100, score));
  const isGreen = recommendation === 'train';
  const fillColor = isGreen
    ? Colors.green
    : recommendation === 'easy'
    ? Colors.amber
    : Colors.recoveryRed;

  return (
    <View style={styles.batteryWrapper}>
      {/* Nub cap */}
      <View style={styles.batteryNub} />
      {/* Shell */}
      <View style={styles.batteryShell}>
        {/* Fill */}
        <View
          style={[
            styles.batteryFill,
            {
              height: `${fillPercent}%`,
              backgroundColor: fillColor,
            },
          ]}
        />
        {/* Score overlay */}
        <View style={styles.batteryScoreOverlay}>
          <Text style={styles.batteryScore}>{score}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function DailySummaryScreen({
  userName = 'Athlete',
  recovery,
  session = {
    type: 'No Session Planned',
    duration: 'Free day',
    ozzieNote: "Ozzie is still crunching today's read.",
  },
  weekDistanceKm = 0,
  weekTargetKm,
  habitTip,
  quickStats = {
    streak: '—',
    monthDistanceKm: 0,
    load: '—',
  },
  isLoading = false,
  error = null,
  onRetry,
  isRefreshing = false,
  onRefresh,
  onStartSession,
  onSwapSession,
  onCompressSession,
  fuelStatus,
  trainingReadiness,
  onActivityPress,
  onOzziePress,
  onViewWeekPress,
  onConnectHealthPress,
  headerBanner,
  weatherCard,
  hydration,
  onAddHydration,
  hydrationEmphasized,
}: DailySummaryProps) {
  const weekProgress = weekTargetKm ? Math.min(1, weekDistanceKm / weekTargetKm) : 0;
  const greeting = getGreeting();
  const { units } = useUnitPreference();

  const [whyExpanded, setWhyExpanded] = useState(false);
  const [adjustSheetOpen, setAdjustSheetOpen] = useState(false);

  function handleSwap(newType: 'run' | 'lift' | 'cross' | 'rest') {
    setAdjustSheetOpen(false);
    onSwapSession?.(newType);
  }

  function handleCompress(minutes: number) {
    setAdjustSheetOpen(false);
    onCompressSession?.(minutes);
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
        <View style={styles.centeredState}>
          <ActivityIndicator color={Colors.teal} size="large" />
          <Text style={styles.stateText}>Loading your daily summary…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
        <View style={styles.centeredState}>
          <Text style={styles.errorTitle}>Couldn&apos;t load summary</Text>
          <Text style={styles.stateText}>{error}</Text>
          {onRetry ? (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={Colors.teal}
            />
          ) : undefined
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}, {userName}.</Text>
            <Text style={styles.date}>{formatDate()}</Text>
          </View>
          <View style={styles.headerRight}>
            {onActivityPress ? (
              <TouchableOpacity
                style={styles.activityBtn}
                onPress={onActivityPress}
                accessibilityRole="button"
                accessibilityLabel="View activity"
              >
                <Ionicons name="people-outline" size={20} color={Colors.teal} />
              </TouchableOpacity>
            ) : null}
            {onOzziePress ? (
              <TouchableOpacity
                style={styles.avatarBtn}
                onPress={onOzziePress}
                accessibilityRole="button"
                accessibilityLabel="Ask Ozzie"
              >
                <OzzieAvatar size={36} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* ── Recovery Card ── */}
        {recovery ? (
          <Card style={{ marginBottom: 14 }}>
            <View style={styles.recoveryRow}>
              <View style={styles.recoveryLeft}>
                <Text style={styles.recoveryTitle}>Body Battery</Text>
                <Text
                  style={[
                    styles.recoveryLabel,
                    {
                      color:
                        recovery.recommendation === 'train'
                          ? Colors.green
                          : recovery.recommendation === 'easy'
                            ? Colors.amber
                            : Colors.recoveryRed,
                    },
                  ]}
                >
                  {recovery.label}
                </Text>
                <Text style={styles.recoverySubtext}>HRV · Sleep · Load</Text>
              </View>
              <BodyBatteryTank
                score={recovery.score}
                recommendation={recovery.recommendation}
              />
            </View>
          </Card>
        ) : (
          <Card style={{ marginBottom: 14 }}>
            <TouchableOpacity
              style={styles.recoveryRow}
              activeOpacity={onConnectHealthPress ? 0.7 : 1}
              onPress={onConnectHealthPress}
              disabled={!onConnectHealthPress}
              accessibilityRole={onConnectHealthPress ? 'button' : undefined}
              accessibilityLabel={onConnectHealthPress ? 'Connect Apple Health in Settings' : undefined}
            >
              <View style={styles.recoveryLeft}>
                <Text style={styles.recoveryTitle}>Body Battery</Text>
                <Text style={styles.recoveryLabel}>No score yet</Text>
                <Text style={styles.recoverySubtext}>
                  {onConnectHealthPress
                    ? 'Tap to connect Apple Health, or log a workout to unlock recovery scoring.'
                    : 'Connect Apple Health or log a workout to unlock recovery scoring.'}
                </Text>
              </View>
            </TouchableOpacity>
          </Card>
        )}

        {/* ── Training Readiness (OSPREY+) ── */}
        {trainingReadiness ? (
          <ReadinessCard readiness={trainingReadiness} />
        ) : null}

        {headerBanner ?? null}

        {/* ── Today's Session Card — the day's #1 question, so it sits right
             under Battery/Readiness rather than below the Nutrition card. ── */}
        <View style={styles.sessionCard}>
          <View style={styles.sessionHeader}>
            <Text style={styles.sessionLabel}>TODAY&apos;S SESSION</Text>
            {onViewWeekPress ? (
              <TouchableOpacity
                onPress={onViewWeekPress}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="View full week"
              >
                <Text style={styles.viewWeekLink}>Full week ›</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={styles.sessionType}>{session.type}</Text>

          <View style={styles.sessionChips}>
            <View style={styles.sessionChip}>
              <Text style={styles.sessionChipText}>{session.duration}</Text>
            </View>
            {session.distanceKm != null ? (
              <View style={styles.sessionChip}>
                <Text style={styles.sessionChipText}>{formatDistanceKm(session.distanceKm, units)}</Text>
              </View>
            ) : null}
            {session.zone ? (
              <View style={[styles.sessionChip, styles.sessionChipAccent]}>
                <Text style={[styles.sessionChipText, styles.sessionChipAccentText]}>
                  {session.zone}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Ozzie note — tap to see the reasoning */}
          <Card emphasis style={{ marginBottom: 14 }}>
            <TouchableOpacity
              style={styles.ozzieNote}
              activeOpacity={session.whyReasoning ? 0.7 : 1}
              onPress={() => session.whyReasoning && setWhyExpanded((v) => !v)}
              accessibilityRole={session.whyReasoning ? 'button' : undefined}
              accessibilityLabel={session.whyReasoning ? (whyExpanded ? 'Hide reasoning' : 'Why this session') : undefined}
            >
              <OzzieAvatar size={24} />
              <View style={styles.ozzieNoteBody}>
                <Text style={styles.ozzieNoteText}>{session.ozzieNote}</Text>
                {session.whyReasoning ? (
                  <Text style={styles.whyToggleText}>
                    {whyExpanded ? 'Hide reasoning ▴' : 'Why this session? ▾'}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
            {whyExpanded && session.whyReasoning ? (
              <View style={styles.whyPanel}>
                <Text style={styles.whyPanelText}>{session.whyReasoning}</Text>
              </View>
            ) : null}
          </Card>

          <View style={styles.sessionActionsRow}>
            <TouchableOpacity
              style={[styles.startBtn, session.sessionType === 'rest' && styles.startBtnDisabled]}
              onPress={() => onStartSession?.(session)}
              disabled={session.sessionType === 'rest'}
              accessibilityRole="button"
              accessibilityLabel={session.sessionType === 'rest' ? 'Rest day' : 'Start session'}
              accessibilityState={{ disabled: session.sessionType === 'rest' }}
            >
              <Text style={styles.startBtnText}>
                {session.sessionType === 'rest' ? 'Rest Day' : 'Start Session →'}
              </Text>
            </TouchableOpacity>
            {(onSwapSession || onCompressSession) &&
            session.sessionId &&
            session.sessionType !== 'rest' ? (
              <TouchableOpacity
                style={styles.adjustBtn}
                onPress={() => setAdjustSheetOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Adjust today's session"
              >
                <Text style={styles.adjustBtnText}>Adjust</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {weatherCard ?? null}

        {/* ── Nutrition (fuel targets + hydration + meal timing) ── */}
        <NutritionCard
          hydration={hydration}
          onAddHydration={onAddHydration}
          hydrationEmphasized={hydrationEmphasized}
          fuelStatus={fuelStatus}
          showFuelTip={session.sessionType !== 'rest'}
        />

        {/* ── Weekly Progress ── */}
        <View style={styles.weekCard}>
          <View style={styles.weekRow}>
            <Text style={styles.weekLabel}>{units === 'metric' ? 'WEEK DISTANCE' : 'WEEK MILEAGE'}</Text>
            <Text style={styles.weekNumbers}>
              <Text style={styles.weekMiles}>
                {units === 'metric' ? Math.round(weekDistanceKm * 10) / 10 : Math.round(kmToMiles(weekDistanceKm) * 10) / 10}
              </Text>
              {weekTargetKm != null ? (
                <Text style={styles.weekTarget}>
                  {' '}
                  / {units === 'metric' ? Math.round(weekTargetKm * 10) / 10 : Math.round(kmToMiles(weekTargetKm) * 10) / 10}{' '}
                  {units === 'metric' ? 'km' : 'mi'}
                </Text>
              ) : (
                <Text style={styles.weekTarget}> {units === 'metric' ? 'km' : 'mi'} this week</Text>
              )}
            </Text>
          </View>
          {weekTargetKm != null ? (
            <View style={styles.weekTrack}>
              <View style={[styles.weekFill, { width: `${weekProgress * 100}%` }]} />
            </View>
          ) : null}
        </View>

        {/* ── Quick Stats Row ── */}
        <View style={styles.statsRow}>
          <StatChip label="Consistency" value={quickStats.streak} tone="accent" />
          <StatChip label="This Month" value={formatDistanceKm(quickStats.monthDistanceKm, units)} />
          <StatChip label="Load" value={quickStats.load} />
        </View>

        {habitTip ? (
          <Card style={{ marginTop: 16 }}>
            <Badge tone="accent">Habit Tip</Badge>
            <Text style={[styles.habitTipText, { marginTop: 6 }]}>{habitTip}</Text>
          </Card>
        ) : null}

      </ScrollView>

      {/* ── Adjust session bottom sheet — replaces the old chained Alert.alert
           menus (Adjust → Swap/Compress → specific choice) with every option
           visible at once. ── */}
      <Modal
        visible={adjustSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAdjustSheetOpen(false)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setAdjustSheetOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Adjust Today&apos;s Session</Text>

          {onSwapSession ? (
            <>
              <Text style={styles.sheetSectionLabel}>SWAP TO</Text>
              <View style={styles.sheetRowGroup}>
                <TouchableOpacity
                  style={styles.sheetRow}
                  onPress={() => handleSwap('run')}
                  accessibilityRole="button"
                  accessibilityLabel="Swap to Run"
                >
                  <Text style={styles.sheetRowText}>🏃 Run</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sheetRow}
                  onPress={() => handleSwap('lift')}
                  accessibilityRole="button"
                  accessibilityLabel="Swap to Lift"
                >
                  <Text style={styles.sheetRowText}>🏋️ Lift</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sheetRow}
                  onPress={() => handleSwap('cross')}
                  accessibilityRole="button"
                  accessibilityLabel="Swap to Cross Training"
                >
                  <Text style={styles.sheetRowText}>🔁 Cross Training</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sheetRow, styles.sheetRowLast]}
                  onPress={() => handleSwap('rest')}
                  accessibilityRole="button"
                  accessibilityLabel="Make it a rest day"
                >
                  <Text style={[styles.sheetRowText, styles.sheetRowTextDestructive]}>
                    😴 Make it a Rest Day
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {onCompressSession ? (
            <>
              <Text style={styles.sheetSectionLabel}>SHORT ON TIME?</Text>
              <View style={styles.sheetRowGroup}>
                <TouchableOpacity
                  style={styles.sheetRow}
                  onPress={() => handleCompress(15)}
                  accessibilityRole="button"
                  accessibilityLabel="Shrink to 15 minutes"
                >
                  <Text style={styles.sheetRowText}>15 min</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sheetRow}
                  onPress={() => handleCompress(20)}
                  accessibilityRole="button"
                  accessibilityLabel="Shrink to 20 minutes"
                >
                  <Text style={styles.sheetRowText}>20 min</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sheetRow, styles.sheetRowLast]}
                  onPress={() => handleCompress(30)}
                  accessibilityRole="button"
                  accessibilityLabel="Shrink to 30 minutes"
                >
                  <Text style={styles.sheetRowText}>30 min</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          <TouchableOpacity
            style={styles.sheetCloseBtn}
            onPress={() => setAdjustSheetOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.sheetCloseBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ReadinessCard({ readiness }: { readiness: TrainingReadiness }) {
  return (
    <View style={[styles.readinessCard, { borderColor: readiness.color + '33' }]}>
      <View style={styles.readinessLeft}>
        <Text style={styles.readinessTitle}>Training Readiness</Text>
        <Text style={[styles.readinessLabel, { color: readiness.color }]}>
          {readiness.label}
        </Text>
        <Text style={styles.readinessSub}>TSB {readiness.tsb > 0 ? '+' : ''}{readiness.tsb.toFixed(1)}</Text>
      </View>
      <View style={styles.readinessRight}>
        <Text style={styles.readinessCtlLabel}>FITNESS</Text>
        <Text style={[styles.readinessCtlValue, { color: Colors.teal }]}>{readiness.ctl.toFixed(0)}</Text>
        <Text style={styles.readinessCtlSub}>CTL</Text>
      </View>
    </View>
  );
}

function StatChip({ label, value, tone }: { label: string; value: string; tone?: 'accent' | 'neutral' }) {
  return (
    <Card style={styles.statChip}>
      <Text style={[styles.statValue, { color: tone === 'accent' ? Theme.accent : Theme.text }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
  },
  stateText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  retryBtn: {
    marginTop: 8,
    backgroundColor: Colors.teal,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 32,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  date: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.teal,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityBtnText: { fontSize: 18 },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Training readiness card
  readinessCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  readinessLeft: { gap: 2 },
  readinessTitle: { fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.8 },
  readinessLabel: { fontSize: 18, fontWeight: '800' },
  readinessSub: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  readinessRight: { alignItems: 'center', gap: 1 },
  readinessCtlLabel: { fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.8 },
  readinessCtlValue: { fontSize: 22, fontWeight: '800' },
  readinessCtlSub: { fontSize: 9, color: Colors.textMuted },

  // Recovery card
  recoveryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recoveryLeft: {
    flex: 1,
  },
  recoveryTitle: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Theme.accent,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  recoveryLabel: {
    fontSize: 20,
    fontWeight: '800',
    color: Theme.text,
    marginBottom: 4,
  },
  recoverySubtext: {
    fontSize: 11,
    color: Theme.textSoft,
  },

  // Body Battery tank
  batteryWrapper: {
    alignItems: 'center',
    width: 44,
  },
  batteryNub: {
    width: 18,
    height: 7,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 3,
    marginBottom: -1,
  },
  batteryShell: {
    width: 44,
    height: 86,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(0,0,0,0.4)',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  batteryFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 6,
  },
  batteryScoreOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  batteryScore: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Session card
  sessionCard: {
    backgroundColor: 'rgba(0,200,200,0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(0,200,200,0.35)',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sessionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.teal,
    letterSpacing: 1.5,
  },
  viewWeekLink: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  sessionType: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  sessionChips: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  sessionChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sessionChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sessionChipAccent: {
    backgroundColor: 'rgba(0,200,200,0.18)',
  },
  sessionChipAccentText: {
    color: Colors.teal,
  },
  ozzieNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  ozzieNoteBody: {
    flex: 1,
    gap: 6,
  },
  ozzieNoteText: {
    fontSize: 13,
    color: Theme.textSoft,
    lineHeight: 19,
  },
  whyToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.accent,
    letterSpacing: 0.3,
  },
  whyPanel: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Theme.line,
  },
  whyPanelText: {
    fontSize: 12,
    color: Theme.textMut,
    lineHeight: 18,
  },
  sessionActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  startBtn: {
    flex: 1,
    backgroundColor: Colors.teal,
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  startBtnDisabled: {
    opacity: 0.45,
  },
  adjustBtn: {
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  // Week progress
  weekCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  weekLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  weekNumbers: {
    fontSize: 13,
  },
  weekMiles: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  weekTarget: {
    color: Colors.textMuted,
  },
  weekTrack: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  weekFill: {
    height: 5,
    backgroundColor: Colors.teal,
    borderRadius: 3,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  habitTipText: {
    fontSize: 13,
    color: Theme.textSoft,
    lineHeight: 19,
  },
  statChip: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 10,
    color: Theme.textMut,
    letterSpacing: 0.5,
  },

  // ── Adjust session bottom sheet ──
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#0D1424',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    gap: 4,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 4,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  sheetSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 6,
  },
  sheetRowGroup: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  sheetRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sheetRowLast: { borderBottomWidth: 0 },
  sheetRowText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  sheetRowTextDestructive: { color: Colors.red },
  sheetCloseBtn: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseBtnText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
});
