import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';
import { useSubscription } from '@/hooks/useSubscription';
import {
  useChallengeLeaderboard,
  useChallenges,
  type Challenge,
} from '@/hooks/useChallenges';
import {
  CHALLENGE_TYPE_LABELS,
  currentMonthRange,
  formatChallengeValue,
  type ChallengeType,
} from '@/services/challenges';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function daysLeftLabel(challenge: Pick<Challenge, 'daysLeft' | 'daysUntilStart' | 'status'>): string {
  const { daysLeft, daysUntilStart, status } = challenge;
  if (status === 'past')    return 'Ended';
  if (status === 'upcoming') {
    if (daysUntilStart <= 0) return 'Starts today';
    if (daysUntilStart === 1) return 'Starts tomorrow';
    return `Starts in ${daysUntilStart} days`;
  }
  if (daysLeft === 0)  return 'Last day!';
  if (daysLeft === 1)  return '1 day left';
  return `${daysLeft} days left`;
}

function medalFor(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

const CHALLENGE_TYPES: ChallengeType[] = ['mileage', 'workouts', 'duration'];

// ── Leaderboard panel ─────────────────────────────────────────────────────────

interface LeaderboardPanelProps {
  challenge: Challenge;
  currentUserId: string | undefined;
  onClose: () => void;
}

function LeaderboardPanel({ challenge, currentUserId, onClose }: LeaderboardPanelProps) {
  const { data, isLoading, refetch, isFetching } = useChallengeLeaderboard(challenge.id);

  return (
    <View style={styles.lbPanel}>
      <View style={styles.lbHeader}>
        <Text style={styles.lbTitle}>Leaderboard</Text>
        <View style={styles.lbHeaderRight}>
          <TouchableOpacity onPress={() => refetch()} disabled={isFetching} style={styles.refreshBtn}>
            {isFetching ? (
              <ActivityIndicator color={Colors.teal} size="small" />
            ) : (
              <Text style={styles.refreshBtnText}>↺</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Text style={styles.lbClose}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.teal} style={{ marginVertical: 12 }} />
      ) : !data || data.length === 0 ? (
        <Text style={styles.lbEmpty}>No workouts logged yet. Go get it!</Text>
      ) : (
        data.map((entry) => {
          const isMe = entry.userId === currentUserId;
          return (
            <View key={entry.userId} style={[styles.lbRow, isMe && styles.lbRowMe]}>
              <Text style={styles.lbMedal}>{medalFor(entry.rank)}</Text>
              <Text style={[styles.lbName, isMe && styles.lbNameMe]} numberOfLines={1}>
                {isMe ? 'You' : entry.displayName}
              </Text>
              <Text style={[styles.lbValue, isMe && styles.lbValueMe]}>
                {formatChallengeValue(entry.value, challenge.type)}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ChallengesScreen() {
  const router = useRouter();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { isPlus } = useSubscription();
  const { challenges, friends, isLoading, error, create, leave, remove } = useChallenges();

  // ── form state ──
  const [showForm, setShowForm] = useState(false);
  const defaultDates = currentMonthRange();
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<ChallengeType>('mileage');
  const [formStart, setFormStart] = useState(defaultDates.start);
  const [formEnd, setFormEnd] = useState(defaultDates.end);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  // ── expanded leaderboard ──
  const [lbChallengeId, setLbChallengeId] = useState<string | null>(null);

  function resetForm() {
    const d = currentMonthRange();
    setFormName('');
    setFormType('mileage');
    setFormStart(d.start);
    setFormEnd(d.end);
    setInvitedIds(new Set());
    setShowForm(false);
  }

  function toggleInvite(friendId: string) {
    setInvitedIds((prev) => {
      const next = new Set(prev);
      next.has(friendId) ? next.delete(friendId) : next.add(friendId);
      return next;
    });
  }

  async function handleCreate() {
    if (!isPlus) {
      router.push('/paywall');
      return;
    }
    if (!formName.trim()) {
      Alert.alert('Name the challenge', 'What are you competing for?');
      return;
    }
    if (!isValidDate(formStart) || !isValidDate(formEnd)) {
      Alert.alert('Check the dates', 'Use YYYY-MM-DD for both start and end.');
      return;
    }
    if (formEnd < formStart) {
      Alert.alert('Check the dates', 'End date must be on or after start date.');
      return;
    }
    try {
      await create.mutateAsync({
        name: formName.trim(),
        type: formType,
        startsOn: formStart,
        endsOn: formEnd,
        invitedFriendIds: [...invitedIds],
      });
      resetForm();
    } catch (err) {
      Alert.alert('Create failed', err instanceof Error ? err.message : 'Try again.');
    }
  }

  function handleLeave(challenge: Challenge) {
    const isCreator = challenge.creatorUserId === currentUserId;
    if (isCreator && (challenge.memberCount ?? 1) > 1) {
      Alert.alert(
        'Delete challenge?',
        'You created this challenge. Deleting it removes it for all members.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => remove.mutate(challenge.id),
          },
        ],
      );
    } else {
      Alert.alert(
        isCreator ? 'Delete challenge?' : 'Leave challenge?',
        `${isCreator ? 'Delete' : 'Leave'} "${challenge.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: isCreator ? 'Delete' : 'Leave',
            style: 'destructive',
            onPress: () =>
              isCreator
                ? remove.mutate(challenge.id)
                : leave.mutate(challenge.id),
          },
        ],
      );
    }
  }

  // Group challenges by status.
  const active   = challenges?.filter((c) => c.status === 'active')   ?? [];
  const upcoming = challenges?.filter((c) => c.status === 'upcoming') ?? [];
  const past     = challenges?.filter((c) => c.status === 'past')     ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Challenges</Text>
        <TouchableOpacity onPress={() => setShowForm((v) => !v)} hitSlop={12}>
          <Text style={styles.add}>{showForm ? '−' : '+'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ── Create form ── */}
          {showForm ? (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>New challenge</Text>

              <TextInput
                style={styles.input}
                placeholder="Challenge name (e.g. July Mileage Madness)"
                placeholderTextColor={Colors.textMuted}
                value={formName}
                onChangeText={setFormName}
              />

              <Text style={styles.fieldLabel}>TYPE</Text>
              <View style={styles.chipRow}>
                {CHALLENGE_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, formType === t && styles.chipActive]}
                    onPress={() => setFormType(t)}
                  >
                    <Text style={[styles.chipText, formType === t && styles.chipTextActive]}>
                      {CHALLENGE_TYPE_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>START DATE</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
                value={formStart}
                onChangeText={setFormStart}
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>END DATE</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
                value={formEnd}
                onChangeText={setFormEnd}
                autoCapitalize="none"
              />

              {friends && friends.length > 0 ? (
                <>
                  <Text style={styles.fieldLabel}>INVITE FRIENDS</Text>
                  <View style={styles.friendInviteRow}>
                    {friends.map((f) => {
                      const invited = invitedIds.has(f.friendUserId);
                      return (
                        <TouchableOpacity
                          key={f.friendUserId}
                          style={[styles.inviteChip, invited && styles.inviteChipActive]}
                          onPress={() => toggleInvite(f.friendUserId)}
                        >
                          <Text style={[styles.inviteChipText, invited && styles.inviteChipTextActive]}>
                            {invited ? '✓ ' : ''}{f.friendDisplayName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleCreate}
                disabled={create.isPending}
              >
                {create.isPending ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.saveBtnText}>Create Challenge</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          {/* ── Challenge lists ── */}
          {isLoading ? (
            <ActivityIndicator color={Colors.teal} style={{ marginTop: 32 }} />
          ) : error ? (
            <Text style={styles.errorText}>Couldn&apos;t load challenges.</Text>
          ) : challenges?.length === 0 && !showForm ? (
            <Text style={styles.empty}>
              No challenges yet. Tap + to create one and compete with friends on mileage,
              workout count, or total minutes.
            </Text>
          ) : (
            <>
              {active.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>ACTIVE</Text>
                  {active.map((c) => (
                    <View key={c.id}>
                      <ChallengeCard
                        challenge={c}
                        currentUserId={currentUserId}
                        isLbOpen={lbChallengeId === c.id}
                        onToggleLb={() =>
                          setLbChallengeId((id) => (id === c.id ? null : c.id))
                        }
                        onLeave={() => handleLeave(c)}
                      />
                      {lbChallengeId === c.id ? (
                        <LeaderboardPanel
                          challenge={c}
                          currentUserId={currentUserId}
                          onClose={() => setLbChallengeId(null)}
                        />
                      ) : null}
                    </View>
                  ))}
                </>
              ) : null}

              {upcoming.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>UPCOMING</Text>
                  {upcoming.map((c) => (
                    <View key={c.id}>
                      <ChallengeCard
                        challenge={c}
                        currentUserId={currentUserId}
                        isLbOpen={lbChallengeId === c.id}
                        onToggleLb={() =>
                          setLbChallengeId((id) => (id === c.id ? null : c.id))
                        }
                        onLeave={() => handleLeave(c)}
                      />
                      {lbChallengeId === c.id ? (
                        <LeaderboardPanel
                          challenge={c}
                          currentUserId={currentUserId}
                          onClose={() => setLbChallengeId(null)}
                        />
                      ) : null}
                    </View>
                  ))}
                </>
              ) : null}

              {past.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>PAST</Text>
                  {past.map((c) => (
                    <View key={c.id}>
                      <ChallengeCard
                        challenge={c}
                        currentUserId={currentUserId}
                        isLbOpen={lbChallengeId === c.id}
                        onToggleLb={() =>
                          setLbChallengeId((id) => (id === c.id ? null : c.id))
                        }
                        onLeave={() => handleLeave(c)}
                      />
                      {lbChallengeId === c.id ? (
                        <LeaderboardPanel
                          challenge={c}
                          currentUserId={currentUserId}
                          onClose={() => setLbChallengeId(null)}
                        />
                      ) : null}
                    </View>
                  ))}
                </>
              ) : null}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Challenge card ────────────────────────────────────────────────────────────

interface ChallengeCardProps {
  challenge: Challenge;
  currentUserId: string | undefined;
  isLbOpen: boolean;
  onToggleLb: () => void;
  onLeave: () => void;
}

function ChallengeCard({ challenge: c, currentUserId, isLbOpen, onToggleLb, onLeave }: ChallengeCardProps) {
  const isCreator = c.creatorUserId === currentUserId;
  return (
    <View style={styles.challengeCard}>
      <View style={styles.challengeCardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.challengeName}>{c.name}</Text>
          <Text style={styles.challengeMeta}>
            {CHALLENGE_TYPE_LABELS[c.type]} · {c.startsOn} – {c.endsOn}
          </Text>
          <Text style={styles.challengeSubMeta}>
            {c.memberCount} {c.memberCount === 1 ? 'member' : 'members'} · {daysLeftLabel(c)}
          </Text>
        </View>
        {c.status === 'active' ? (
          <View style={styles.activePip} />
        ) : null}
      </View>
      <View style={styles.actionRow}>
        <TouchableOpacity onPress={onToggleLb}>
          <Text style={[styles.actionLink, isLbOpen && styles.actionLinkActive]}>
            Leaderboard
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onLeave}>
          <Text style={styles.actionDelete}>
            {isCreator ? 'Delete' : 'Leave'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  close: { color: Colors.textMuted, fontSize: 18, fontWeight: '700' },
  add: { color: Colors.teal, fontSize: 24, fontWeight: '700' },
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  scroll: { padding: 20, paddingBottom: 48, gap: 10 },
  empty: { color: Colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 8 },
  errorText: { color: Colors.red, fontSize: 14, marginTop: 16 },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 2,
  },

  // ── Form ──
  formCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    marginBottom: 6,
  },
  formTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: 2 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginTop: 6,
  },
  input: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  chipActive: { backgroundColor: Colors.surfaceTeal, borderColor: Colors.borderTeal },
  chipText: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: Colors.teal },
  friendInviteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inviteChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  inviteChipActive: { backgroundColor: Colors.surfaceTeal, borderColor: Colors.borderTeal },
  inviteChipText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  inviteChipTextActive: { color: Colors.teal },
  saveBtn: {
    marginTop: 10,
    backgroundColor: Colors.teal,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtnText: { color: '#000', fontSize: 14, fontWeight: '800' },

  // ── Challenge card ──
  challengeCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  challengeCardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  challengeName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  challengeMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 3, lineHeight: 17 },
  challengeSubMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  activePip: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.green,
    marginTop: 5,
    marginLeft: 8,
  },
  actionRow: { flexDirection: 'row', gap: 18 },
  actionLink: { color: Colors.teal, fontSize: 13, fontWeight: '700' },
  actionLinkActive: { color: Colors.gold },
  actionDelete: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },

  // ── Leaderboard panel ──
  lbPanel: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 14,
    gap: 6,
    marginTop: -2,
  },
  lbHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  lbTitle: { color: Colors.teal, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  lbHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  refreshBtn: { padding: 4 },
  refreshBtnText: { color: Colors.teal, fontSize: 16, fontWeight: '700' },
  lbClose: { color: Colors.textMuted, fontSize: 16, fontWeight: '700' },
  lbEmpty: { color: Colors.textMuted, fontSize: 13, fontStyle: 'italic', marginVertical: 6 },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    gap: 10,
  },
  lbRowMe: {
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
  },
  lbMedal: { fontSize: 16, width: 30, textAlign: 'center' },
  lbName: { flex: 1, color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  lbNameMe: { color: Colors.textPrimary, fontWeight: '800' },
  lbValue: { color: Colors.textMuted, fontSize: 14, fontWeight: '700' },
  lbValueMe: { color: Colors.teal },
});
