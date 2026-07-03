import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';
import { fetchTodayCheckin, submitCheckinAudio, type CheckinResult } from '@/services/checkin';
import {
  cancelVoiceRecording,
  startVoiceRecording,
  stopVoiceRecordingBase64,
} from '@/services/voice-log';
import { ozzieSpeak } from '@/services/ozzie-audio';

type Phase = 'idle' | 'recording' | 'processing' | 'done';

/**
 * Morning check-in: the athlete answers Ozzie out loud (~30s), the reply is
 * transcribed and distilled into subjective recovery signal server-side.
 * Self-contained — owns its recording state and hides itself once today's
 * check-in exists.
 */
export default function OzzieCheckInCard() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<CheckinResult | null>(null);

  const existing = useQuery({
    queryKey: ['checkin-today', userId],
    queryFn: () => fetchTodayCheckin(userId!),
    enabled: Boolean(userId),
    staleTime: 10 * 60 * 1000,
  });

  // Nothing to show while we don't know yet, or once today's check-in is done
  // (unless it was completed in this session — then show Ozzie's reply once).
  if (existing.isLoading) return null;
  if (existing.data && phase !== 'done') return null;

  async function handleStart() {
    try {
      const started = await startVoiceRecording();
      if (!started) {
        Alert.alert('Microphone access needed', 'OSPREY needs mic access for the morning check-in.');
        return;
      }
      setPhase('recording');
    } catch (err) {
      Alert.alert('Could not start recording', err instanceof Error ? err.message : 'Try again.');
    }
  }

  async function handleStop() {
    setPhase('processing');
    try {
      const audioBase64 = await stopVoiceRecordingBase64();
      const res = await submitCheckinAudio(audioBase64);
      setResult(res);
      setPhase('done');
      if (res.ozzieReply) ozzieSpeak(res.ozzieReply, 'ambient');
      // Recovery score may have shifted — refresh the summary + this card's query.
      queryClient.invalidateQueries({ queryKey: ['daily-summary'] });
      queryClient.invalidateQueries({ queryKey: ['checkin-today', userId] });
    } catch (err) {
      setPhase('idle');
      Alert.alert('Check-in failed', err instanceof Error ? err.message : 'Try again.');
    }
  }

  function handleCancel() {
    cancelVoiceRecording();
    setPhase('idle');
  }

  if (phase === 'done' && result) {
    return (
      <View style={[styles.card, styles.cardDone]}>
        <Text style={styles.label}>OZZIE HEARD YOU</Text>
        <Text style={styles.reply}>&ldquo;{result.ozzieReply}&rdquo;</Text>
        {result.sorenessAreas.length > 0 ? (
          <Text style={styles.soreness}>Watching: {result.sorenessAreas.join(', ')}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>MORNING CHECK-IN</Text>
      <Text style={styles.prompt}>
        {phase === 'recording'
          ? 'Listening… how did you sleep, anything sore, how are you feeling?'
          : phase === 'processing'
            ? 'Ozzie is listening back…'
            : 'Tell Ozzie how you actually feel — it tunes today\'s recommendation.'}
      </Text>
      <View style={styles.actions}>
        {phase === 'idle' ? (
          <TouchableOpacity
            style={styles.micBtn}
            onPress={handleStart}
            accessibilityRole="button"
            accessibilityLabel="Start morning check-in recording"
          >
            <Text style={styles.micBtnText}>🎤 Check in</Text>
          </TouchableOpacity>
        ) : phase === 'recording' ? (
          <>
            <TouchableOpacity
              style={[styles.micBtn, styles.micBtnStop]}
              onPress={handleStop}
              accessibilityRole="button"
              accessibilityLabel="Finish check-in"
            >
              <Text style={styles.micBtnText}>⏹ Done</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCancel}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Cancel check-in"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ActivityIndicator color={Colors.teal} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  cardDone: { backgroundColor: Colors.surfaceGold, borderColor: Colors.borderGold },
  label: { fontSize: 10, fontWeight: '700', color: Colors.teal, letterSpacing: 1, marginBottom: 6 },
  prompt: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 12 },
  reply: { fontSize: 13.5, color: Colors.textSecondary, fontStyle: 'italic', lineHeight: 20 },
  soreness: { fontSize: 12, color: Colors.gold, marginTop: 8, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  micBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  micBtnStop: { backgroundColor: Colors.amber },
  micBtnText: { fontSize: 13.5, fontWeight: '800', color: '#000' },
  cancelText: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
});
