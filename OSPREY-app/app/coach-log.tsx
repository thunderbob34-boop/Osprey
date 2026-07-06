import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import ScreenHeader from '@/components/ScreenHeader';
import { useCoachLog } from '@/hooks/useCoachLog';
import type { CoachMemoryEntry } from '@/services/performance';

const EVENT_META: Record<
  CoachMemoryEntry['eventType'],
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; surface: string; border: string }
> = {
  pr: { label: 'PR', icon: 'trophy', color: Colors.gold, surface: Colors.surfaceGold, border: Colors.borderGold },
  race_result: { label: 'Race', icon: 'flag', color: Colors.teal, surface: Colors.surfaceTeal, border: Colors.borderTeal },
  injury_flag: { label: 'Injury note', icon: 'medkit', color: Colors.amber, surface: 'rgba(245,166,35,0.08)', border: 'rgba(245,166,35,0.25)' },
};

function formatOccurredOn(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CoachLogScreen() {
  const { data: entries, isLoading, error } = useCoachLog();

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Coach's Log" />

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading ? (
          <ActivityIndicator color={Colors.teal} style={{ marginTop: 32 }} />
        ) : error ? (
          <Text style={styles.errorText}>Couldn&apos;t load your coach&apos;s log.</Text>
        ) : entries && entries.length > 0 ? (
          entries.map((entry) => {
            const meta = EVENT_META[entry.eventType];
            return (
              <View
                key={entry.id}
                style={[styles.row, { backgroundColor: meta.surface, borderColor: meta.border }]}
                accessibilityRole="text"
                accessibilityLabel={`${meta.label} on ${formatOccurredOn(entry.occurredOn)}: ${entry.summary}`}
              >
                <View style={[styles.iconWrap, { borderColor: meta.border }]}>
                  <Ionicons name={meta.icon} size={18} color={meta.color} />
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowHeader}>
                    <Text style={[styles.badge, { color: meta.color }]}>{meta.label}</Text>
                    <Text style={styles.date}>{formatOccurredOn(entry.occurredOn)}</Text>
                  </View>
                  <Text style={styles.summary}>{entry.summary}</Text>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.empty}>
            Nothing logged yet. PRs, race results, and any elevated-injury-risk notes Ozzie
            catches will show up here as your coaching history builds.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 48, gap: 10 },
  errorText: { color: Colors.red, fontSize: 14, marginTop: 16 },
  empty: { color: Colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 8 },

  row: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
  },
  rowBody: { flex: 1, gap: 4 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  date: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  summary: { color: Colors.textPrimary, fontSize: 14, lineHeight: 20 },
});
