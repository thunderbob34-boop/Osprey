import { ActivityIndicator, Alert, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { format } from 'date-fns';
import { Theme, Radius, BorderWidth } from '@/constants/theme';
import { Card, Button } from '@/components/ui';
import type { WeekSession } from '@/services/plan';

interface Props {
  session: WeekSession;
  daysToHighRisk: number;
  isAccepting?: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

function formatSessionDay(dateStr: string): string {
  // Local date, not toISOString() — that flips to tomorrow before local
  // midnight for anyone west of UTC (e.g. ~5pm Pacific).
  const todayStr = format(new Date(), 'yyyy-MM-dd');
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
    <Card emphasis style={styles.card}>
      <Text style={styles.title}>⚠️ Ozzie noticed your load climbing</Text>
      <Text style={styles.subtitle}>
        Projected to hit the danger zone {urgency}. Consider de-loading {dayLabel} {session.description || session.session_type}.
      </Text>
      <View style={styles.actions}>
        <Button
          variant="secondary"
          onPress={onDismiss}
          disabled={isAccepting}
          accessibilityLabel="Not now"
          style={styles.flexBtn}
        >
          Not now
        </Button>
        {isAccepting ? (
          <View
            style={styles.acceptBtnLoading}
            accessibilityRole="button"
            accessibilityLabel="De-load it"
            accessibilityState={{ disabled: true, busy: true }}
          >
            <ActivityIndicator color="#000" size="small" />
          </View>
        ) : (
          <Button
            variant="primary"
            onPress={handleAccept}
            accessibilityLabel="De-load it"
            style={styles.flexBtn}
          >
            De-load it →
          </Button>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    gap: 8,
  } as ViewStyle,
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.text,
  },
  subtitle: {
    fontSize: 13,
    color: Theme.textSoft,
    lineHeight: 18,
  },
  actions: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 10,
  },
  flexBtn: {
    flex: 1,
  } as ViewStyle,
  // Mirrors <Button variant="primary"> styling — used only while isAccepting,
  // since Button's children type is `string` and can't host an ActivityIndicator.
  acceptBtnLoading: {
    flex: 1,
    backgroundColor: Theme.accent,
    borderWidth: BorderWidth.card,
    borderColor: Theme.accent,
    borderRadius: Radius.card,
    paddingVertical: 12,
    alignItems: 'center',
    opacity: 0.5,
  },
});
