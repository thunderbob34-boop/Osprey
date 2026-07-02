import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { useLifeLoad } from '@/hooks/useLifeLoad';
import OzzieAvatar from '@/components/OzzieAvatar';

function bandFor(score: number | null): { label: string; color: string } {
  if (score == null) return { label: 'Not enough data yet', color: Colors.textMuted };
  if (score >= 75) return { label: 'Carrying it well', color: Colors.teal };
  if (score >= 50) return { label: 'Manageable load', color: Colors.amber };
  return { label: 'Heavy load', color: Colors.red };
}

export default function LifeLoadCard() {
  const { data, isLoading, error } = useLifeLoad();
  const [whyExpanded, setWhyExpanded] = useState(false);

  if (isLoading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={Colors.teal} />
      </View>
    );
  }

  if (error || !data) {
    return null; // non-critical surface — fail quiet rather than clutter Home with an error card
  }

  const band = bandFor(data.compositeScore);

  return (
    <View style={[styles.card, { borderColor: band.color + '33' }]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.cardLabel}>LIFE LOAD</Text>
          <Text style={[styles.bandLabel, { color: band.color }]}>{band.label}</Text>
        </View>
        <View style={styles.scoreBlock}>
          <Text style={[styles.scoreValue, { color: band.color }]}>
            {data.compositeScore != null ? data.compositeScore : '—'}
          </Text>
          <Text style={styles.scoreUnit}>/ 100</Text>
        </View>
      </View>

      <View style={styles.narrativeRow}>
        <OzzieAvatar size={22} />
        <Text style={styles.narrativeText}>&ldquo;{data.narrative}&rdquo;</Text>
      </View>

      {data.whyReasoning ? (
        <View>
          <TouchableOpacity
            style={styles.whyToggle}
            onPress={() => setWhyExpanded((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={whyExpanded ? 'Hide explanation' : 'Show explanation for this Life Load score'}
          >
            <Text style={styles.whyToggleText}>{whyExpanded ? '▾ Why?' : '▸ Why?'}</Text>
          </TouchableOpacity>
          {whyExpanded ? (
            <View style={styles.whyPanel}>
              <Text style={styles.whyPanelText}>{data.whyReasoning}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1 },
  bandLabel: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  scoreBlock: { alignItems: 'flex-end' },
  scoreValue: { fontSize: 28, fontWeight: '900', lineHeight: 30 },
  scoreUnit: { fontSize: 11, color: Colors.textMuted },
  narrativeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  narrativeText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 19, fontStyle: 'italic' },
  whyToggle: { marginTop: 10 },
  whyToggleText: { fontSize: 12, color: Colors.teal, fontWeight: '700' },
  whyPanel: {
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    padding: 10,
  },
  whyPanelText: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
});
