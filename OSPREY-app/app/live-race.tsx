import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { subscribeToLiveRace, type LivePositionPayload } from '@/services/liveRace';

const STALE_MS = 45_000; // no ping in 45s → grey the racer out

export default function LiveRaceScreen() {
  const router = useRouter();
  const { raceId, raceName } = useLocalSearchParams<{ raceId: string; raceName?: string }>();
  const [positions, setPositions] = useState<Record<string, LivePositionPayload>>({});
  const [now, setNow] = useState(Date.now());
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!raceId) return;
    unsubRef.current = subscribeToLiveRace(raceId, (payload) => {
      setPositions((prev) => ({ ...prev, [payload.userId]: payload }));
    });
    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [raceId]);

  // Tick so "last seen" and stale-out update without a new broadcast.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const racers = useMemo(
    () => Object.values(positions).sort((a, b) => b.distanceMiles - a.distanceMiles),
    [positions],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close live tracking"
        >
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {raceName ? `${raceName} — Live` : 'Live Crew'}
        </Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {racers.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📡</Text>
            <Text style={styles.emptyText}>
              Waiting for your crew to go live. When a racing partner starts their run and taps
              &ldquo;Go live&rdquo;, they&apos;ll show up here in real time.
            </Text>
          </View>
        ) : (
          racers.map((racer, idx) => {
            const ageMs = now - new Date(racer.sentAt).getTime();
            const stale = ageMs > STALE_MS;
            const lastSeen = Math.round(ageMs / 1000);
            return (
              <View key={racer.userId} style={[styles.racerCard, stale && styles.racerCardStale]}>
                <View style={styles.rankBubble}>
                  <Text style={styles.rankText}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.racerName}>{racer.displayName}</Text>
                  <Text style={styles.racerMeta}>
                    {racer.distanceMiles.toFixed(2)} mi · {racer.paceLabel}
                    {stale ? ` · last seen ${lastSeen}s ago` : ' · live'}
                  </Text>
                </View>
                <View style={[styles.liveDot, stale && styles.liveDotStale]} />
              </View>
            );
          })
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
  close: { fontSize: 18, color: Colors.textMuted, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, flex: 1, textAlign: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 40, marginBottom: 16 },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 21 },
  racerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  racerCardStale: { borderColor: Colors.border, opacity: 0.6 },
  rankBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontSize: 15, fontWeight: '800', color: Colors.teal },
  racerName: { fontSize: 15.5, fontWeight: '700', color: Colors.textPrimary },
  racerMeta: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 2 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.teal },
  liveDotStale: { backgroundColor: Colors.textMuted },
});
