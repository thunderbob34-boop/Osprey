import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';
import { saveEnduranceWorkout, type EnduranceType } from '@/services/workouts';
import { ozzieSpeak, ozzieStop } from '@/services/ozzie-audio';
import { formatDuration } from '@/store/workoutStore';
import { useSubscription } from '@/hooks/useSubscription';
import { isHealthKitSupported, requestHealthKitAuthorization } from '@/services/healthkit';

const SESSION_META: Record<EnduranceType, { icon: string; label: string; color: string; borderColor: string }> = {
  swim: { icon: '🏊', label: 'SWIM',  color: Colors.teal,  borderColor: Colors.borderTeal },
  bike: { icon: '🚴', label: 'BIKE',  color: Colors.teal,  borderColor: Colors.borderTeal },
  cross:{ icon: '🔁', label: 'CROSS', color: Colors.amber, borderColor: Colors.borderGold },
};

const ENCOURAGEMENTS: Record<EnduranceType, string[]> = {
  swim: [
    'Smooth strokes. Stay long in the water.',
    "Every length counts. Keep your technique tight.",
    'Focus on hip rotation — power comes from the core, not the arms.',
  ],
  bike: [
    'Steady cadence. Let the gears do the work.',
    "Keep your upper body relaxed — only your legs should burn.",
    'Mid-ride check: stay hydrated, keep the power consistent.',
  ],
  cross: [
    'Active recovery is still training. This is how champions stay fresh.',
    "Your body's rebuilding right now. Stay with it.",
    'Consistent effort. Every session moves the needle.',
  ],
};

const AUTO_CUE_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes

export default function EnduranceWorkoutScreen() {
  const router = useRouter();
  const { sessionType, sessionId } = useLocalSearchParams<{ sessionType: EnduranceType; sessionId?: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const { isPlus } = useSubscription();

  const type: EnduranceType = (sessionType ?? 'cross') as EnduranceType;
  const meta = SESSION_META[type] ?? SESSION_META.cross;

  const startedAtRef = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [distance, setDistance] = useState('');
  const [distanceUnit, setDistanceUnit] = useState<'meters' | 'yards' | 'km' | 'miles'>('meters');
  const [syncing, setSyncing] = useState(false);
  const lastAutoCueMs = useRef(Date.now());
  const speakingRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => {
      clearInterval(timer);
      ozzieStop();
    };
  }, []);

  // Auto cues every 10 minutes (OSPREY+ only)
  useEffect(() => {
    if (!isPlus || speakingRef.current) return;
    const nowMs = Date.now();
    if (elapsed > 0 && nowMs - lastAutoCueMs.current >= AUTO_CUE_INTERVAL_MS) {
      lastAutoCueMs.current = nowMs;
      const cues = ENCOURAGEMENTS[type];
      const idx = Math.floor(elapsed / 600) % cues.length;
      speakingRef.current = true;
      ozzieSpeak(cues[idx], 'workout').finally(() => { speakingRef.current = false; });
    }
  }, [elapsed, isPlus, type]);

  async function handleManualCue() {
    const cues = ENCOURAGEMENTS[type];
    const cue = cues[Math.floor(Math.random() * cues.length)];
    await ozzieSpeak(cue, 'workout');
  }

  async function handleSyncHealthKit() {
    if (!isHealthKitSupported()) {
      Alert.alert('Apple Health', 'HealthKit not available on this device.');
      return;
    }
    setSyncing(true);
    try {
      const authorized = await requestHealthKitAuthorization();
      if (authorized) {
        Alert.alert('Apple Health', 'Synced. Distance data from your HealthKit workout will be included.');
        // In a full implementation, you'd fetch the distance from HealthKit here
        // For now, just confirm the sync intent
      } else {
        Alert.alert('Apple Health', 'Permission not granted. Enter distance manually.');
      }
    } catch {
      Alert.alert('Apple Health', 'Could not sync. Enter distance manually.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleEnd() {
    if (!userId) return;
    setSaving(true);
    try {
      const durationS = Math.floor((Date.now() - startedAtRef.current) / 1000);
      const distanceParam = distance && parseFloat(distance) > 0
        ? { value: parseFloat(distance), unit: distanceUnit }
        : null;
      const workoutId = await saveEnduranceWorkout({
        userId,
        sessionId: sessionId ?? null,
        sessionType: type,
        startedAt: startedAtRef.current,
        durationS,
        distance: distanceParam,
      });
      router.replace({ pathname: '/workout/recap', params: { workoutId } });
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Try again.');
      setSaving(false);
    }
  }

  function confirmEnd() {
    Alert.alert('End session?', 'Save this workout and see your recap.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard & Exit', style: 'destructive', onPress: () => router.replace('/(tabs)') },
      { text: 'End & Save', onPress: handleEnd },
    ]);
  }

  const hours = Math.floor(elapsed / 3600);
  const mins  = Math.floor((elapsed % 3600) / 60);
  const secs  = elapsed % 60;
  const timeStr = hours > 0
    ? `${hours}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`
    : `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={[styles.sessionBadge, { borderColor: meta.borderColor }]}>
          <Text style={styles.sessionIcon}>{meta.icon}</Text>
          <Text style={[styles.sessionLabel, { color: meta.color }]}>{meta.label} IN PROGRESS</Text>
        </View>

        <View style={styles.timerBlock}>
          <Text style={styles.timerValue}>{timeStr}</Text>
          <Text style={styles.timerSub}>elapsed</Text>
        </View>

        <TouchableOpacity style={styles.ozzieBtn} onPress={handleManualCue}>
          <Text style={styles.ozzieBtnText}>🦅 Ozzie Cue</Text>
        </TouchableOpacity>

        <View style={styles.distanceCard}>
          <Text style={styles.distanceLabel}>Distance</Text>
          <View style={styles.distanceInputRow}>
            <TextInput
              style={styles.distanceInput}
              placeholder="0"
              placeholderTextColor={Colors.textMuted}
              value={distance}
              onChangeText={setDistance}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.unitRow}>
            {(['meters', 'yards', 'km', 'miles'] as const).map((unit) => (
              <TouchableOpacity
                key={unit}
                style={[styles.unitBtn, distanceUnit === unit && styles.unitBtnActive]}
                onPress={() => setDistanceUnit(unit)}
              >
                <Text style={[styles.unitBtnText, distanceUnit === unit && styles.unitBtnTextActive]}>
                  {unit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.syncBtn, syncing && { opacity: 0.6 }]}
            onPress={handleSyncHealthKit}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator color={Colors.teal} size="small" />
            ) : (
              <Text style={styles.syncBtnText}>Sync from Apple Health</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.endBtn} onPress={confirmEnd} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={Colors.red} />
          ) : (
            <Text style={styles.endBtnText}>End & Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { flex: 1, padding: 28, justifyContent: 'center', gap: 20 },
  sessionBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sessionIcon: { fontSize: 20 },
  sessionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  timerBlock: { alignItems: 'center', gap: 6, marginVertical: 20 },
  timerValue: { fontSize: 72, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -2 },
  timerSub: { fontSize: 12, color: Colors.textMuted, fontWeight: '600', letterSpacing: 0.5 },
  ozzieBtn: {
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ozzieBtnText: { fontSize: 15, fontWeight: '700', color: Colors.teal },
  distanceCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  distanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  distanceInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  distanceInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  unitRow: {
    flexDirection: 'row',
    gap: 6,
  },
  unitBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  unitBtnActive: {
    backgroundColor: Colors.surfaceTeal,
    borderColor: Colors.borderTeal,
  },
  unitBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  unitBtnTextActive: {
    color: Colors.teal,
  },
  syncBtn: {
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  syncBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.teal,
  },
  endBtn: {
    backgroundColor: 'rgba(255,68,68,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,68,68,0.25)',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  endBtnText: { fontSize: 15, fontWeight: '700', color: Colors.red },
});
