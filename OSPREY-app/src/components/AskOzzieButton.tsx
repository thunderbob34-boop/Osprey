import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/colors';
import {
  startVoiceRecording,
  stopVoiceRecordingAndAsk,
  cancelVoiceRecording,
  type LiveCoachContext,
} from '@/services/voice-log';
import { ozzieSpeak } from '@/services/ozzie-audio';

type State = 'idle' | 'recording' | 'thinking' | 'speaking';

/**
 * Push-to-talk button: tap to ask Ozzie a question mid-workout, tap again
 * to stop and get a short spoken answer grounded in live session numbers.
 * `getContext` is called at the moment recording stops (not on mount) so
 * the numbers sent are current, not stale from when the button first rendered.
 */
export default function AskOzzieButton({ getContext }: { getContext: () => LiveCoachContext }) {
  const [state, setState] = useState<State>('idle');
  const stateRef = useRef<State>('idle');

  function setBoth(next: State) {
    stateRef.current = next;
    setState(next);
  }

  async function handlePress() {
    if (stateRef.current === 'idle') {
      try {
        const started = await startVoiceRecording();
        if (!started) {
          Alert.alert('Microphone access needed', 'OSPREY needs mic access to talk to Ozzie.');
          return;
        }
        setBoth('recording');
      } catch (err) {
        Alert.alert('Could not start recording', err instanceof Error ? err.message : 'Try again.');
      }
      return;
    }

    if (stateRef.current === 'recording') {
      setBoth('thinking');
      try {
        const { reply } = await stopVoiceRecordingAndAsk(getContext());
        setBoth('speaking');
        await ozzieSpeak(reply, 'workout');
      } catch (err) {
        Alert.alert('Ozzie didn’t catch that', err instanceof Error ? err.message : 'Try again.');
      } finally {
        setBoth('idle');
      }
    }
  }

  function handleLongPressCancel() {
    if (stateRef.current === 'recording') {
      cancelVoiceRecording();
      setBoth('idle');
    }
  }

  const label =
    state === 'recording' ? '⏹ Stop' : state === 'thinking' ? 'Thinking…' : state === 'speaking' ? '🦅 Ozzie' : '🎤 Ask Ozzie';

  return (
    <TouchableOpacity
      style={[styles.btn, state === 'recording' && styles.btnActive]}
      onPress={handlePress}
      onLongPress={handleLongPressCancel}
      disabled={state === 'thinking' || state === 'speaking'}
      accessibilityRole="button"
      accessibilityLabel={state === 'recording' ? 'Stop recording your question for Ozzie' : 'Ask Ozzie a question out loud'}
    >
      {state === 'thinking' ? (
        <ActivityIndicator color={Colors.teal} size="small" />
      ) : (
        <Text style={styles.btnText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: { backgroundColor: Colors.red, borderColor: Colors.red },
  btnText: { fontSize: 14, fontWeight: '800', color: Colors.teal },
});
