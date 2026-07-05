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
  Alert,
} from 'react-native';
import { Colors } from '@/constants/colors';
import type { DailySummaryProps, TrainingReadiness } from '@/types/daily-summary';
import MacroTargetCard from '@/components/MacroTargetCard';
import OzzieAvatar from '@/components/OzzieAvatar';

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
  weekMiles = 0,
  weekTarget,
  habitTip,
  quickStats = {
    streak: '—',
    monthMiles: '—',
    load: '—',
  },
  showBottomNav = true,
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
  onViewWeekPress,
  headerBanner,
  macroTargets,
  macroTargetsLoading,
  macroTargetsError,
}: DailySummaryProps) {
  const weekProgress = weekTarget ? Math.min(1, weekMiles / weekTarget) : 0;
  const greeting = getGreeting();

  function handleSwapPress() {
    Alert.alert('Swap today\'s session', 'Same training effect, different shape.', [
      { text: 'Run', onPress: () => onSwapSession?.('run') },
      { text: 'Lift', onPress: () => onSwapSession?.('lift') },
      { text: 'Cross Training', onPress: () => onSwapSession?.('cross') },
      { text: 'Make it Rest', onPress: () => onSwapSession?.('rest'), style: 'destructive' },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function handleCompressPress() {
    Alert.alert('Short on time?', "I'll shrink today's session to fit — same effort, less volume.", [
      { text: '15 min', onPress: () => onCompressSession?.(15) },
      { text: '20 min', onPress: () => onCompressSession?.(20) },
      { text: '30 min', onPress: () => onCompressSession?.(30) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }
  const [whyExpanded, setWhyExpanded] = useState(false);

  function formatFuelTime(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  function fuelCardCopy(): { title: string; body: string } | null {
    if (!fuelStatus) return null;
    if (fuelStatus.lastLoggedMinutesAgo == null) {
      return {
        title: '🍽 Fuel up before training',
        body: "No meals logged yet today. Eat a carb-rich snack 60-90 min before your session for best performance.",
      };
    }
    const timeAgo = formatFuelTime(fuelStatus.lastLoggedMinutesAgo);
    if (fuelStatus.recommendation === 'recently_fueled') {
      return {
        title: '🍽 Recently fueled',
        body: `Last meal logged ${timeAgo} ago. Give it a little time to digest before going hard.`,
      };
    }
    if (fuelStatus.recommendation === 'good_timing') {
      return {
        title: '🍽 Good timing',
        body: `Last meal logged ${timeAgo} ago — that's a solid fueling window for today's session.`,
      };
    }
    return {
      title: '🍽 Fuel up before training',
      body: `It's been ${timeAgo} since your last logged meal. Grab a carb-rich snack 60-90 min before training.`,
    };
  }
  const fuelCard = fuelCardCopy();

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
            <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
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
              <TouchableOpacity style={styles.activityBtn} onPress={onActivityPress}>
                <Text style={styles.activityBtnText}>👥</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.avatarBtn} onPress={onActivityPress}>
              <OzzieAvatar size={36} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Recovery Card ── */}
        {recovery ? (
          <View style={styles.recoveryCard}>
            <View style={styles.recoveryLeft}>
              <Text style={styles.recoveryTitle}>Body Battery</Text>
              <Text
                style={[
                  styles.recoveryLabel,
                  { color: recovery.recommendation === 'train' ? Colors.green : Colors.amber },
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
        ) : (
          <View style={styles.recoveryCard}>
            <View style={styles.recoveryLeft}>
              <Text style={styles.recoveryTitle}>Body Battery</Text>
              <Text style={styles.recoveryLabel}>No score yet</Text>
              <Text style={styles.recoverySubtext}>
                Connect Apple Health or log a workout to unlock recovery scoring.
              </Text>
            </View>
          </View>
        )}

        {/* ── Training Readiness (OSPREY+) ── */}
        {trainingReadiness ? (
          <ReadinessCard readiness={trainingReadiness} />
        ) : null}

        {/* ── Nutrition Periodization ── */}
        <MacroTargetCard targets={macroTargets} isLoading={macroTargetsLoading} isError={macroTargetsError} />

        {headerBanner ?? null}

        {/* ── Today's Session Card ── */}
        <View style={styles.sessionCard}>
          <View style={styles.sessionHeader}>
            <Text style={styles.sessionLabel}>TODAY&apos;S SESSION</Text>
            <View style={styles.sessionHeaderRight}>
              {session.zone ? (
                <View style={styles.sessionBadge}>
                  <Text style={styles.sessionBadgeText}>{session.zone}</Text>
                </View>
              ) : null}
              {onViewWeekPress ? (
                <TouchableOpacity onPress={onViewWeekPress} hitSlop={8}>
                  <Text style={styles.viewWeekLink}>Full week ›</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <Text style={styles.sessionType}>{session.type}</Text>
          <Text style={styles.sessionMeta}>
            {session.duration}
            {session.distance ? `  ·  ${session.distance}` : ''}
          </Text>

          {/* Ozzie note */}
          <View style={styles.ozzieNote}>
            <OzzieAvatar size={24} />
            <Text style={styles.ozzieNoteText}>"{session.ozzieNote}"</Text>
          </View>

          {session.whyReasoning ? (
            <View>
              <TouchableOpacity
                style={styles.whyToggle}
                onPress={() => setWhyExpanded((v) => !v)}
              >
                <Text style={styles.whyToggleText}>
                  {whyExpanded ? '▾ Why?' : '▸ Why?'}
                </Text>
              </TouchableOpacity>
              {whyExpanded ? (
                <View style={styles.whyPanel}>
                  <Text style={styles.whyPanelText}>{session.whyReasoning}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.sessionActionsRow}>
            <TouchableOpacity
              style={[styles.startBtn, session.sessionType === 'rest' && styles.startBtnDisabled]}
              onPress={() => onStartSession?.(session)}
              disabled={session.sessionType === 'rest'}
            >
              <Text style={styles.startBtnText}>
                {session.sessionType === 'rest' ? 'Rest Day' : 'Start Session →'}
              </Text>
            </TouchableOpacity>
            {onSwapSession && session.sessionId && session.sessionType !== 'rest' ? (
              <TouchableOpacity style={styles.swapBtn} onPress={handleSwapPress}>
                <Text style={styles.swapBtnText}>Swap</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {onCompressSession && session.sessionId && session.sessionType !== 'rest' ? (
            <TouchableOpacity style={styles.compressLink} onPress={handleCompressPress}>
              <Text style={styles.compressLinkText}>⏱ Short on time?</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {fuelCard && session.sessionType !== 'rest' ? (
          <View style={styles.fuelCard}>
            <Text style={styles.fuelCardTitle}>{fuelCard.title}</Text>
            <Text style={styles.fuelCardBody}>{fuelCard.body}</Text>
          </View>
        ) : null}

        {/* ── Weekly Progress ── */}
        <View style={styles.weekCard}>
          <View style={styles.weekRow}>
            <Text style={styles.weekLabel}>WEEK MILEAGE</Text>
            <Text style={styles.weekNumbers}>
              <Text style={styles.weekMiles}>{weekMiles}</Text>
              {weekTarget != null ? (
                <Text style={styles.weekTarget}> / {weekTarget} mi</Text>
              ) : (
                <Text style={styles.weekTarget}> mi this week</Text>
              )}
            </Text>
          </View>
          {weekTarget != null ? (
            <View style={styles.weekTrack}>
              <View style={[styles.weekFill, { width: `${weekProgress * 100}%` }]} />
            </View>
          ) : null}
        </View>

        {/* ── Quick Stats Row ── */}
        <View style={styles.statsRow}>
          <StatChip label="Consistency" value={quickStats.streak} color={Colors.gold} />
          <StatChip label="This Month" value={quickStats.monthMiles} color={Colors.teal} />
          <StatChip label="Load" value={quickStats.load} color={Colors.amber} />
        </View>

        {habitTip ? (
          <View style={styles.habitTipCard}>
            <Text style={styles.habitTipLabel}>HABIT TIP</Text>
            <Text style={styles.habitTipText}>{habitTip}</Text>
          </View>
        ) : null}

      </ScrollView>

      {showBottomNav ? (
        <View style={styles.bottomNav}>
          <NavItem icon="🏠" label="Today" active />
          <NavItem icon="📅" label="Plan" />
          <NavItem icon="▶️" label="Workout" />
          <NavItem icon="📊" label="Stats" />
          <NavItem icon="⚙️" label="Settings" />
        </View>
      ) : null}
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

function StatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.statChip}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function NavItem({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress}>
      <Text style={styles.navIcon}>{icon}</Text>
      <Text style={[styles.navLabel, active && { color: Colors.teal }]}>
        {label}
      </Text>
    </TouchableOpacity>
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
    padding: 20,
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
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  date: {
    fontSize: 13,
    color: Colors.textMuted,
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
  recoveryCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  recoveryLeft: {
    flex: 1,
  },
  recoveryTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.teal,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  recoveryLabel: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  recoverySubtext: {
    fontSize: 11,
    color: Colors.textSecondary,
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
    inset: 0,
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
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sessionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.teal,
    letterSpacing: 1.5,
  },
  sessionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  viewWeekLink: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  sessionBadge: {
    backgroundColor: 'rgba(0,200,200,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sessionBadgeText: {
    fontSize: 10,
    color: Colors.teal,
    fontWeight: '600',
  },
  sessionType: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  sessionMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 14,
  },
  ozzieNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.surfaceGold,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  ozzieNoteText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  whyToggle: {
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  whyToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.teal,
    letterSpacing: 0.3,
  },
  whyPanel: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  whyPanelText: {
    fontSize: 12,
    color: Colors.textMuted,
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
  swapBtn: {
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  compressLink: {
    marginTop: 10,
    alignSelf: 'center',
  },
  compressLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.teal,
  },
  fuelCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 4,
  },
  fuelCardTitle: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  fuelCardBody: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },

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
  habitTipCard: {
    marginTop: 16,
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 14,
    padding: 14,
  },
  habitTipLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.teal,
    letterSpacing: 1,
    marginBottom: 6,
  },
  habitTipText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  statChip: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },

  // Bottom nav
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: 'rgba(6,9,18,0.92)',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: 20,
    paddingTop: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  navIcon: {
    fontSize: 20,
  },
  navLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '500',
  },

});
