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
import { Theme, Radius, BorderWidth, StatusPalette } from '@/constants/theme';
import { Button } from '@/components/ui';
import DateField from '@/components/DateField';
import FieldError from '@/components/FieldError';
import ScreenHeader from '@/components/ScreenHeader';
import { useAuthStore } from '@/store/authStore';
import { useSubscription } from '@/hooks/useSubscription';
import { useUnitPreference } from '@/hooks/useUnitPreference';
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

function daysLeftLabel(daysLeft: number, status: Challenge['status']): string {
  if (status === 'past')    return 'Ended';
  if (status === 'upcoming') {
    if (-daysLeft === 1) return 'Starts tomorrow';
    return `Starts in ${-daysLeft} days`;
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

const CHALLENGE_TYPES: ChallengeType[] = ['mileage', 'workouts', 'duration', 'lift_volume', 'streak'];

// ── Leaderboard panel ─────────────────────────────────────────────────────────

interface LeaderboardPanelProps {
  challenge: Challenge;
  currentUserId: string | undefined;
  onClose: () => void;
}

function LeaderboardPanel({ challenge, currentUserId, onClose }: LeaderboardPanelProps) {
  const { data, isLoading, refetch, isFetching } = useChallengeLeaderboard(challenge.id);
  const { units } = useUnitPreference();

  return (
    <View style={styles.lbPanel}>
      <View style={styles.lbHeader}>
        <Text style={styles.lbTitle}>Leaderboard</Text>
        <View style={styles.lbHeaderRight}>
          {/* NOT converted to <Button>: this is a bare accent glyph beside the
              close control (see refreshBtn's own comment below) — a subordinate
              icon, not a primary/secondary CTA. The primitive's filled/outlined
              recipes would outweigh the panel it sits in, so it stays hand-rolled. */}
          <TouchableOpacity
            onPress={() => refetch()}
            disabled={isFetching}
            style={styles.refreshBtn}
            accessibilityRole="button"
            accessibilityLabel="Refresh leaderboard"
            accessibilityState={{ disabled: isFetching, busy: isFetching }}
          >
            {isFetching ? (
              <ActivityIndicator color={Theme.accent} size="small" />
            ) : (
              <Text style={styles.refreshBtnText}>↺</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close leaderboard">
            <Text style={styles.lbClose}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator color={Theme.accent} style={{ marginVertical: 12 }} />
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
                {formatChallengeValue(entry.value, challenge.type, units)}
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
    const errors: Record<string, string> = {};
    if (!formName.trim()) errors.name = 'What are you competing for?';
    if (!isValidDate(formStart)) errors.start = 'Pick a start date.';
    if (!isValidDate(formEnd)) errors.end = 'Pick an end date.';
    if (!errors.start && !errors.end && formEnd < formStart) {
      errors.end = 'End date must be on or after start date.';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
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
      <ScreenHeader
        title="Challenges"
        right={
          <TouchableOpacity
            onPress={() => setShowForm((v) => !v)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={showForm ? 'Close new challenge form' : 'New challenge'}
          >
            <Text style={styles.add}>{showForm ? '−' : '+'}</Text>
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ── Create form ── */}
          {showForm ? (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>New challenge</Text>

              <TextInput
                style={[styles.input, fieldErrors.name ? styles.inputError : null]}
                placeholder="Challenge name (e.g. July Mileage Madness)"
                placeholderTextColor={Theme.textMut}
                value={formName}
                onChangeText={(v) => {
                  setFormName(v);
                  setFieldErrors((prev) => ({ ...prev, name: '' }));
                }}
                accessibilityLabel="Challenge name"
              />
              <FieldError message={fieldErrors.name} />

              <Text style={styles.fieldLabel}>TYPE</Text>
              <View style={styles.chipRow}>
                {CHALLENGE_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.chip, formType === t && styles.chipActive]}
                    onPress={() => setFormType(t)}
                    accessibilityRole="button"
                    accessibilityLabel={CHALLENGE_TYPE_LABELS[t]}
                    accessibilityState={{ selected: formType === t }}
                  >
                    <Text style={[styles.chipText, formType === t && styles.chipTextActive]}>
                      {CHALLENGE_TYPE_LABELS[t]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>START DATE</Text>
              <DateField
                value={formStart}
                onChange={(d) => {
                  setFormStart(d);
                  setFieldErrors((prev) => ({ ...prev, start: '' }));
                }}
                placeholder="First day"
              />
              <FieldError message={fieldErrors.start} />

              <Text style={styles.fieldLabel}>END DATE</Text>
              <DateField
                value={formEnd}
                onChange={(d) => {
                  setFormEnd(d);
                  setFieldErrors((prev) => ({ ...prev, end: '' }));
                }}
                placeholder="Last day"
              />
              <FieldError message={fieldErrors.end} />

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
                          accessibilityRole="checkbox"
                          accessibilityLabel={`Invite ${f.friendDisplayName}`}
                          accessibilityState={{ checked: invited }}
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

              <Button
                onPress={handleCreate}
                disabled={create.isPending}
                busy={create.isPending}
                accessibilityLabel="Create challenge"
                style={styles.saveBtn}
              >
                {create.isPending ? <ActivityIndicator color={Theme.ink} /> : 'Create Challenge'}
              </Button>
            </View>
          ) : null}

          {/* ── Challenge lists ── */}
          {isLoading ? (
            <ActivityIndicator color={Theme.accent} style={{ marginTop: 32 }} />
          ) : error ? (
            <Text style={styles.errorText}>Couldn&apos;t load challenges.</Text>
          ) : challenges?.length === 0 && !showForm ? (
            <Text style={styles.empty}>
              No challenges yet. Tap + to create one and compete with friends on mileage,
              workout count, minutes, lift volume, or streaks.
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
            {c.memberCount} {c.memberCount === 1 ? 'member' : 'members'} · {daysLeftLabel(c.daysLeft, c.status)}
          </Text>
        </View>
        {c.status === 'active' ? (
          <View style={styles.activePip} />
        ) : null}
      </View>
      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={onToggleLb}
          accessibilityRole="button"
          accessibilityLabel={`${isLbOpen ? 'Hide' : 'Show'} leaderboard for ${c.name}`}
          accessibilityState={{ expanded: isLbOpen }}
        >
          <Text style={[styles.actionLink, isLbOpen && styles.actionLinkActive]}>
            Leaderboard
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onLeave}
          accessibilityRole="button"
          accessibilityLabel={`${isCreator ? 'Delete' : 'Leave'} ${c.name}`}
        >
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
  container: { flex: 1, backgroundColor: Theme.ink },
  add: { color: Theme.accent, fontSize: 24, fontWeight: '700' },
  scroll: { padding: 20, paddingBottom: 48, gap: 10 },
  empty: { color: Theme.textMut, fontSize: 14, lineHeight: 20, marginTop: 8 },
  errorText: { color: StatusPalette.danger, fontSize: 14, marginTop: 16 },
  sectionLabel: {
    color: Theme.accent,
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 2,
  },

  // ── Form ──
  formCard: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 16,
    gap: 8,
    marginBottom: 6,
  },
  formTitle: { color: Theme.text, fontSize: 15, fontWeight: '800', marginBottom: 2 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Theme.textMut,
    letterSpacing: 0.8,
    marginTop: 6,
  },
  inputError: {
    borderColor: StatusPalette.danger,
  },
  input: {
    backgroundColor: Theme.ink,
    borderWidth: 1,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Theme.text,
    fontSize: 15,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Theme.line,
    backgroundColor: Theme.ink,
  },
  chipActive: { borderColor: Theme.accent },
  chipText: { color: Theme.textMut, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: Theme.accent },
  friendInviteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inviteChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Theme.line,
    backgroundColor: Theme.ink,
  },
  inviteChipActive: { borderColor: Theme.accent },
  inviteChipText: { color: Theme.textMut, fontSize: 13, fontWeight: '600' },
  inviteChipTextActive: { color: Theme.accent },
  // Only what <Button> does not already provide; paddingVertical is kept at 14
  // because the primitive defaults to 12, which would shrink this button
  // against the form around it.
  saveBtn: { marginTop: 10, paddingVertical: 14, justifyContent: 'center' },

  // ── Challenge card ──
  challengeCard: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 14,
    gap: 8,
  },
  challengeCardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  challengeName: { color: Theme.text, fontSize: 15, fontWeight: '700' },
  challengeMeta: { color: Theme.textMut, fontSize: 12, marginTop: 3, lineHeight: 17 },
  challengeSubMeta: { color: Theme.textMut, fontSize: 11, marginTop: 2 },
  activePip: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: StatusPalette.success,
    marginTop: 5,
    marginLeft: 8,
  },
  actionRow: { flexDirection: 'row', gap: 18 },
  actionLink: { color: Theme.accent, fontSize: 13, fontWeight: '700' },
  actionLinkActive: { color: Theme.accentBright },
  actionDelete: { color: Theme.textMut, fontSize: 13, fontWeight: '700' },

  // ── Leaderboard panel ──
  lbPanel: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.accent,
    borderTopWidth: 0,
    borderBottomLeftRadius: Radius.card,
    borderBottomRightRadius: Radius.card,
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
  lbTitle: {
    color: Theme.accent,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 0.5,
  },
  lbHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Deliberately NOT the filled-accent CTA recipe: this is a subordinate icon
  // glyph sitting beside the close control in a header row, not a primary
  // action. A filled accent square here would outweigh the panel it sits in.
  refreshBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtnText: { color: Theme.accent, fontSize: 16, fontWeight: '700' },
  lbClose: { color: Theme.textMut, fontSize: 16, fontWeight: '700' },
  lbEmpty: { color: Theme.textMut, fontSize: 13, fontStyle: 'italic', marginVertical: 6 },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: Radius.card,
    gap: 10,
  },
  lbRowMe: {
    backgroundColor: Theme.ink,
    borderWidth: 1,
    borderColor: Theme.accent,
  },
  lbMedal: { fontSize: 16, width: 30, textAlign: 'center' },
  lbName: { flex: 1, color: Theme.textSoft, fontSize: 14, fontWeight: '600' },
  lbNameMe: { color: Theme.text, fontWeight: '800' },
  lbValue: { color: Theme.textMut, fontSize: 14, fontWeight: '700' },
  lbValueMe: { color: Theme.accent },
});
