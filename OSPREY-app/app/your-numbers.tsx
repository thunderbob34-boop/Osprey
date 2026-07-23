import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Theme } from '@/constants/theme';
import { Card } from '@/components/ui';
import ScreenHeader from '@/components/ScreenHeader';
import { useDisplayEnvelope, type DisplayEnvelope } from '@/hooks/useDisplayEnvelope';
import { intRange } from '@/services/pace-format';
import type { FuelPlan } from '@/services/coaching/fuel';
import type { EnduranceDayType } from '@/services/calculators/shared';

const DAY_TYPE_LABEL: Record<EnduranceDayType, string> = {
  easy: 'Easy days',
  moderate: 'Moderate days',
  high: 'High-volume days',
  peak: 'Peak / race week',
};

const DAY_TYPES: EnduranceDayType[] = ['easy', 'moderate', 'high', 'peak'];

const IN_SESSION_LABEL: Record<string, string> = {
  run: 'on long runs',
  hybrid: 'on long runs',
  ultra: 'on long runs',
  cycling: 'on long rides',
  swim: 'on meet day',
  triathlon: 'on race day',
  hyrox: 'on race day',
  crossfit: 'on long metcons',
};

export default function YourNumbersScreen() {
  const display = useDisplayEnvelope();

  if (!display) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Your Numbers" />
        <ActivityIndicator color={Theme.accent} style={{ marginTop: 32 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Your Numbers" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <TrainingContextSection envelope={display} />
        <FuelSection fuel={display.fuel} sport={display.sport} />
      </ScrollView>
    </SafeAreaView>
  );
}

function TrainingContextSection({ envelope }: { envelope: DisplayEnvelope }) {
  return (
    <Card style={styles.cardGap}>
      <Text style={styles.sectionLabel}>TRAINING CONTEXT</Text>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Phase</Text>
        <Text style={styles.contextValue}>{envelope.phase}</Text>
      </View>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Week</Text>
        <Text style={styles.contextValue}>{envelope.weekNumber} of {envelope.totalWeeks}</Text>
      </View>
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Target weekly load</Text>
        <Text style={styles.contextValue}>{envelope.targetWeeklyLoad}</Text>
      </View>
    </Card>
  );
}

function FuelSection({ fuel, sport }: { fuel: FuelPlan; sport: string }) {
  const inSessionLabel = IN_SESSION_LABEL[sport] ?? 'in long sessions';
  return (
    <Card style={styles.cardGap}>
      <Text style={styles.sectionLabel}>FUEL</Text>
      {DAY_TYPES.map((dt) => (
        <View key={dt} style={styles.contextRow}>
          <Text style={styles.contextLabel}>{DAY_TYPE_LABEL[dt]}</Text>
          <Text style={styles.contextValue}>{intRange(fuel.dailyCarbGByDayType[dt], 'g carbs')}</Text>
        </View>
      ))}
      <View style={styles.contextRow}>
        <Text style={styles.contextLabel}>Protein</Text>
        <Text style={styles.contextValue}>{intRange(fuel.proteinG, 'g')}</Text>
      </View>
      {fuel.longSessionCarbGPerHour > 0 ? (
        <View style={styles.contextRow}>
          <Text style={styles.contextLabel}>In-session, {inSessionLabel}</Text>
          <Text style={styles.contextValue}>{fuel.longSessionCarbGPerHour} g/hr</Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.ink },
  scroll: { padding: 16, gap: 16 },
  cardGap: { gap: 10 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Theme.accent,
    letterSpacing: 1,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  contextRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  contextLabel: { fontSize: 13, fontWeight: '600', color: Theme.textSoft, flex: 1 },
  contextValue: { fontSize: 14, fontWeight: '800', color: Theme.text },
});
