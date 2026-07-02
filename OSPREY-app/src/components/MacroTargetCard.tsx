import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/colors';
import { useNutritionCoaching } from '@/hooks/useNutritionCoaching';

export default function MacroTargetCard() {
  const { data, isLoading, error } = useNutritionCoaching();
  const accentColor = Colors.teal;

  if (isLoading) {
    return (
      <View style={[styles.card, { borderColor: Colors.borderTeal }]}>
        <ActivityIndicator color={Colors.teal} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.card, { borderColor: Colors.border }]}>
        <Text style={styles.cardLabel}>TODAY'S FUEL TARGETS</Text>
        <Text style={styles.unavailable}>Couldn&apos;t load your targets. Pull to refresh.</Text>
      </View>
    );
  }

  const { target } = data;

  return (
    <View style={[styles.card, { borderColor: Colors.borderTeal }]}>
      <View style={styles.headerRow}>
        <Text style={styles.cardLabel}>TODAY'S FUEL TARGETS</Text>
        <View style={[styles.badge, { backgroundColor: Colors.surfaceTeal }]}>
          <Text style={[styles.badgeText, { color: accentColor }]}>Personalized</Text>
        </View>
      </View>
      <View style={styles.macroGrid}>
        <MacroBlock value={target.proteinG} unit="g" label="Protein" accentColor={accentColor} />
        <MacroBlock value={target.carbsG} unit="g" label="Carbs" accentColor={accentColor} />
        <MacroBlock value={target.fatG} unit="g" label="Fat" accentColor={accentColor} />
        <MacroBlock value={target.calories} unit="kcal" label="Calories" accentColor={accentColor} />
      </View>
    </View>
  );
}

function MacroBlock({
  value,
  unit,
  label,
  accentColor,
}: {
  value: number;
  unit: string;
  label: string;
  accentColor: string;
}) {
  return (
    <View style={styles.macroBlock}>
      <View style={styles.macroValueRow}>
        <Text style={[styles.macroNumber, { color: accentColor }]}>{value}</Text>
        <Text style={styles.macroUnit}>{unit}</Text>
      </View>
      <Text style={styles.macroLabel}>{label}</Text>
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
    alignItems: 'center',
    marginBottom: 14,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  unavailable: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 8,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  macroGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  macroBlock: {
    alignItems: 'center',
    minWidth: '22%',
  },
  macroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  macroNumber: {
    fontSize: 22,
    fontWeight: '800',
  },
  macroUnit: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  macroLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
