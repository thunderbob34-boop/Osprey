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
import { Colors } from '@/constants/colors';
import { useActivity } from '@/hooks/useActivity';
import { useAuthStore } from '@/store/authStore';

const KM_PER_MILE = 1.609344;

function formatWorkoutType(type: string): string {
  switch (type) {
    case 'run':
      return '🏃 Run';
    case 'lift':
      return '🏋️ Lift';
    case 'cross':
      return '🔁 Cross';
    case 'race':
      return '🏁 Race';
    default:
      return type;
  }
}

function formatDistance(km: number | null): string {
  if (km == null) return '';
  const miles = km / KM_PER_MILE;
  return `${Math.round(miles * 10) / 10} mi`;
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
  const [kudoingId, setKudoingId] = useState<string | null>(null);

  async function handleKudo(card: any) {
    setKudoingId(card.shareId);
    try {
      await kudo.mutateAsync(card.shareId);
    } catch (err) {
      Alert.alert('Kudo failed', err instanceof Error ? err.message : 'Try again.');
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Activity</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading ? (
          <ActivityIndicator color={Colors.teal} style={{ marginTop: 32 }} />
        ) : error ? (
          <Text style={styles.errorText}>Couldn&apos;t load activity feed.</Text>
        ) : !feed || feed.length === 0 ? (
          <Text style={styles.empty}>
            No activity yet. Complete a workout and tap the heart on Home to share it with friends.
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
                  <TouchableOpacity onPress={() => handleDelete(card)}>
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
                  <Text style={styles.cardStat}>{formatDistance(card.distanceKm)}</Text>
                ) : null}
              </View>

              {card.caption ? <Text style={styles.cardCaption}>"{card.caption}"</Text> : null}

              <View style={styles.cardFooter}>
                <TouchableOpacity
                  style={[styles.kudoBtn, card.hasKudo && styles.kudoBtnActive]}
                  onPress={() => handleKudo(card)}
                  disabled={kudoingId === card.shareId}
                >
                  {kudoingId === card.shareId ? (
                    <ActivityIndicator size="small" color={Colors.teal} />
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
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  scroll: { padding: 16, paddingBottom: 32, gap: 12 },
  empty: { color: Colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 24 },
  errorText: { color: Colors.red, fontSize: 14, marginTop: 16 },

  card: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  cardTime: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  delete: { color: Colors.textMuted, fontSize: 16, fontWeight: '700' },

  cardBody: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  cardWorkout: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  cardStat: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },

  cardCaption: { color: Colors.textSecondary, fontSize: 13, fontStyle: 'italic', lineHeight: 18 },

  cardFooter: { flexDirection: 'row', gap: 8 },
  kudoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  kudoBtnActive: { backgroundColor: Colors.surfaceTeal, borderColor: Colors.borderTeal },
  kudoEmoji: { fontSize: 14 },
  kudoEmojiActive: { fontSize: 15 },
  kudoText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  kudoTextActive: { color: Colors.teal, fontWeight: '700' },
});
