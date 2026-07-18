import { ScrollView, StyleSheet, Text, TouchableOpacity, SafeAreaView, View } from 'react-native';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/colors';
import { Theme, Radius, BorderWidth } from '@/constants/theme';
import { Button } from '@/components/ui';
import { usePlanAdaptation } from '@/hooks/usePlanAdaptation';
import { pickTrackingMode } from '@/utils/trackingModePicker';

// Keyed by the alert's own message text — once the underlying training-load
// condition changes enough to produce different copy, the new message is
// unrelated to whatever was dismissed and reappears automatically.
const DISMISSED_ALERT_KEY = 'osprey.workout.dismissedPlanAlert';

type Card = {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  desc: string;
  route: string;
  params?: Record<string, string>;
  /** Run and Bike offer an Outside (GPS) vs Stationary (no GPS) choice before starting. */
  needsModePicker?: boolean;
};

const CARDS: Card[] = [
  {
    icon: 'run',
    title: 'Run',
    desc: 'Outside with GPS, or stationary on a treadmill',
    route: '/workout/run',
    needsModePicker: true,
  },
  {
    icon: 'dumbbell',
    title: 'Lift',
    desc: 'Log sets, rest timer, Ozzie encouragement',
    route: '/workout/lift',
  },
  {
    icon: 'swim',
    title: 'Swim',
    desc: 'Timer-based session with Ozzie pool cues',
    route: '/workout/endurance',
    params: { sessionType: 'swim' },
  },
  {
    icon: 'bike',
    title: 'Bike',
    desc: 'Outside with GPS, or stationary on a trainer',
    route: '/workout/endurance',
    params: { sessionType: 'bike' },
    needsModePicker: true,
  },
  {
    icon: 'rowing',
    title: 'Rowing',
    desc: 'Timer-based session with a live /500m split',
    route: '/workout/endurance',
    params: { sessionType: 'rowing' },
  },
  {
    icon: 'weight-lifter',
    title: 'Hyrox',
    desc: '8 runs, 8 stations, race-order logging',
    route: '/workout/hyrox',
  },
  {
    icon: 'yoga',
    title: 'Cross Training',
    desc: 'Pick CrossFit, yoga, hiking, and more',
    route: '/workout/endurance',
    params: { sessionType: 'cross' },
  },
];

export default function WorkoutTab() {
  const router = useRouter();
  const alert = usePlanAdaptation();
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_ALERT_KEY).then(setDismissedMessage).catch(() => undefined);
  }, []);

  function dismissAlert() {
    if (!alert) return;
    setDismissedMessage(alert.message);
    AsyncStorage.setItem(DISMISSED_ALERT_KEY, alert.message).catch(() => undefined);
  }

  const showAlert = alert != null && alert.message !== dismissedMessage;

  const bannerBg = alert?.severity === 'warning' ? 'rgba(245,176,65,0.15)' : Theme.panel;

  const bannerBorder = alert?.severity === 'warning' ? Colors.amber : Theme.accent;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Start a Workout</Text>
        <Text style={styles.subtitle}>
          GPS run, set-by-set lift, or timer-based endurance — everything saves to your training load.
        </Text>

        {showAlert && (
          <View style={[styles.banner, { backgroundColor: bannerBg, borderColor: bannerBorder }]}>
            <Text style={styles.bannerMessage}>{alert.message}</Text>
            <View style={styles.bannerActions}>
              <Button
                variant="secondary"
                onPress={() => router.push('/preferences')}
                accessibilityLabel="Recalibrate plan"
                style={styles.bannerButton}
              >
                Recalibrate →
              </Button>
              <TouchableOpacity
                onPress={dismissAlert}
                style={styles.bannerDismiss}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
              >
                <Text style={styles.bannerDismissText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {CARDS.map((card) => (
          <TouchableOpacity
            key={card.title}
            style={styles.card}
            onPress={() => {
              Haptics.selectionAsync().catch(() => undefined);
              if (!card.needsModePicker) {
                router.push(card.params ? { pathname: card.route as any, params: card.params } : card.route as any);
                return;
              }
              pickTrackingMode((mode) => {
                if (mode === 'outside') {
                  // Outside Run keeps its dedicated GPS screen; outside Bike
                  // gets GPS tracking bolted onto the endurance screen it
                  // already uses (no live map, just an accurate live distance).
                  if (card.title === 'Run') {
                    router.push('/workout/run');
                  } else {
                    router.push({ pathname: '/workout/endurance', params: { ...card.params, mode: 'outside' } });
                  }
                } else {
                  // Stationary Run reuses the endurance screen's plain
                  // timer + manual/HealthKit distance entry (sessionType=run).
                  router.push({
                    pathname: '/workout/endurance',
                    params: card.title === 'Run' ? { sessionType: 'run' } : (card.params ?? {}),
                  });
                }
              });
            }}
            accessibilityRole="button"
            accessibilityLabel={`${card.title}, ${card.desc}`}
          >
            <MaterialCommunityIcons name={card.icon} size={28} color={Theme.accent} />
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{card.title}</Text>
              <Text style={styles.cardDesc}>{card.desc}</Text>
            </View>
            <Text style={styles.cardArrow}>→</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.ink },
  content: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '900', color: Theme.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: Theme.textSoft, lineHeight: 20, marginBottom: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 18,
    marginBottom: 12,
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: Theme.text, marginBottom: 4 },
  cardDesc: { fontSize: 12, color: Theme.textMut, lineHeight: 17 },
  cardArrow: { fontSize: 20, color: Theme.accent, fontWeight: '700' },
  banner: {
    borderWidth: BorderWidth.card,
    borderRadius: Radius.card,
    padding: 14,
    marginBottom: 16,
  },
  bannerMessage: { fontSize: 13, color: Theme.text, lineHeight: 19, marginBottom: 10 },
  bannerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bannerButton: { minHeight: 44, justifyContent: 'center', paddingVertical: 10, alignSelf: 'flex-start' },
  bannerDismiss: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  bannerDismissText: { fontSize: 13, color: Theme.textMut },
});
