import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/colors';
import type { WeekSession } from '@/services/plan';

interface Props {
  session: WeekSession;
  daysToHighRisk: number;
  isAccepting?: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

function formatSessionDay(dateStr: string): string {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (dateStr === todayStr) return "Today's";
  const date = new Date(`${dateStr}T00:00:00`);
  return `${date.toLocaleDateString('en-US', { weekday: 'long' })}'s`;
}

export default function DeloadSuggestionCard({ session, daysToHighRisk, isAccepting, onAccept, onDismiss }: Props) {
  const dayLabel = formatSessionDay(session.session_date);
  const urgency = daysToHighRisk <= 1 ? 'as soon as tomorrow' : `in about ${daysToHighRisk} days`;

  function handleAccept() {
    Alert.alert(
      'De-load this session?',
      `Ozzie noticed your training load climbing toward the danger zone — ${urgency}. Swap ${dayLabel} ${session.description || session.session_type} to cross training?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'De-load it', onPress: onAccept },
      ],
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>⚠️ Ozzie noticed your load climbing</Text>
      <Text style={styles.subtitle}>
        Projected to hit the danger zone {urgency}. Consider de-loading {dayLabel} {session.description || session.session_type}.
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} disabled={isAccepting}>
          <Text style={styles.dismissText}>Not now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} disabled={isAccepting}>
          {isAccepting ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={styles.acceptText}>De-load it →</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.amber,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  actions: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 10,
  },
  dismissBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: Colors.amber,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  acceptText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000',
  },
});
