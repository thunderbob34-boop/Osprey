import { useEffect, useState } from 'react';
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
import { Theme, Radius, BorderWidth, StatusPalette } from '@/constants/theme';
import ScreenHeader from '@/components/ScreenHeader';
import { useActivity } from '@/hooks/useActivity';
import { useAuthStore } from '@/store/authStore';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { formatDistanceKm } from '@/services/units';
import { friendlyError } from '@/utils/errorMessage';

function formatWorkoutType(type: string): string {
  switch (type) {
    case 'run':
      return '🏃 Run';
    case 'lift':
      return '🏋️ Lift';
    case 'cross':
      return '🔁 Cross';
    case 'rowing':
      return '🚣 Rowing';
    case 'race':
      return '🏁 Race';
    default:
      return type;
  }
}

function timeAgo(isoStr: string): string {
  const posted = new Date(isoStr);
  const now = new Date();
  const sec = Math.round((now.getTime() - posted.getTime()) / 1000);
  if (sec < 60) return 'now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return posted.toLocaleDateString();
}

export default function ActivityScreen() {
  const router = useRouter();
  const { feed, isLoading, error, share, kudo, remove } = useActivity();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { units } = useUnitPreference();
  const [kudoingId, setKudoingId] = useState<string | null>(null);

  async function handleKudo(card: any) {
    setKudoingId(card.shareId);
    try {
      await kudo.mutateAsync(card.shareId);
    } catch (err) {
      Alert.alert('Kudo failed', friendlyError(err, 'Try again.'));
    } finally {
      setKudoingId(null);
    }
  }

  function handleDelete(card: any) {
    Alert.alert('Remove this post?', 'Your activity card will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(card.shareId) },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Activity"
        right={
          <TouchableOpacity
            onPress={() => router.push('/friends')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Friends"
          >
            <Ionicons name="person-add-outline" size={22} color={Theme.accent} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading ? (
          <ActivityIndicator color={Theme.accent} style={{ marginTop: 32 }} />
        ) : error ? (
          <Text style={styles.errorText}>Couldn&apos;t load activity feed.</Text>
        ) : !feed || feed.length === 0 ? (
          <Text style={styles.empty}>
            No activity yet. Share a completed workout from its recap screen to post it here for
            your friends.
          </Text>
        ) : (
          feed.map((card) => (
            <View key={card.shareId} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{card.userName}</Text>
                  <Text style={styles.cardTime}>{timeAgo(card.postedAt)}</Text>
                </View>
                {card.userId === currentUserId ? (
                  <TouchableOpacity
                    onPress={() => handleDelete(card)}
                    accessibilityRole="button"
                    accessibilityLabel="Remove this post"
                  >
                    <Text style={styles.delete}>✕</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.cardWorkout}>{formatWorkoutType(card.sessionType)}</Text>
                {card.durationMinutes ? (
                  <Text style={styles.cardStat}>{card.durationMinutes} min</Text>
                ) : null}
                {card.distanceKm ? (
                  <Text style={styles.cardStat}>{formatDistanceKm(card.distanceKm, units)}</Text>
                ) : null}
              </View>

              {card.caption ? <Text style={styles.cardCaption}>"{card.caption}"</Text> : null}

              <View style={styles.cardFooter}>
                {/* NOT converted to <Button>: neither variant fits. Its resting
                    fill is Theme.ink (not transparent) with a neutral line
                    border, and the "active" cue is border-color-only, not a
                    fill/outline swap — a structurally different recipe from
                    primary/secondary. It also swaps an icon+count pair (not
                    plain text) for the spinner, which the primitive's single
                    ReactNode child handles but its color/shape defaults don't
                    match. Left hand-rolled. */}
                <TouchableOpacity
                  style={[styles.kudoBtn, card.hasKudo && styles.kudoBtnActive]}
                  onPress={() => handleKudo(card)}
                  disabled={kudoingId === card.shareId}
                  accessibilityRole="button"
                  accessibilityLabel={`${card.hasKudo ? 'Remove kudo' : 'Give kudo'}${card.kudoCount > 0 ? `, ${card.kudoCount}` : ''}`}
                  accessibilityState={{ selected: card.hasKudo, disabled: kudoingId === card.shareId }}
                >
                  {kudoingId === card.shareId ? (
                    <ActivityIndicator size="small" color={Theme.accent} />
                  ) : (
                    <>
                      <Text style={[styles.kudoEmoji, card.hasKudo && styles.kudoEmojiActive]}>
                        ❤️
                      </Text>
                      <Text style={[styles.kudoText, card.hasKudo && styles.kudoTextActive]}>
                        {card.kudoCount > 0 ? card.kudoCount : ''}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.ink },
  scroll: { padding: 16, paddingBottom: 32, gap: 12 },
  empty: { color: Theme.textMut, fontSize: 14, lineHeight: 20, marginTop: 24 },
  errorText: { color: StatusPalette.danger, fontSize: 14, marginTop: 16 },

  card: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 14,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardName: { color: Theme.text, fontSize: 15, fontWeight: '700' },
  cardTime: { color: Theme.textMut, fontSize: 12, marginTop: 2 },
  delete: { color: Theme.textMut, fontSize: 16, fontWeight: '700' },

  cardBody: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  cardWorkout: { color: Theme.text, fontSize: 15, fontWeight: '700' },
  cardStat: { color: Theme.textSoft, fontSize: 13, fontWeight: '600' },

  cardCaption: { color: Theme.textSoft, fontSize: 13, fontStyle: 'italic', lineHeight: 18 },

  cardFooter: { flexDirection: 'row', gap: 8 },
  kudoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.card,
    backgroundColor: Theme.ink,
    borderWidth: 1,
    borderColor: Theme.line,
  },
  // Selected state has a second cue (kudoTextActive turns accent + bold),
  // so the container itself is border-only — no tint fill.
  kudoBtnActive: { borderColor: Theme.accent },
  kudoEmoji: { fontSize: 14 },
  kudoEmojiActive: { fontSize: 15 },
  kudoText: { color: Theme.textMut, fontSize: 12, fontWeight: '600' },
  kudoTextActive: { color: Theme.accent, fontWeight: '700' },
});
