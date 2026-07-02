import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/colors';
import { useNutritionCoaching } from '@/hooks/useNutritionCoaching';

// Previously showed hardcoded macros (240g protein / 2740 kcal, "carb reload"
// on Sundays) for every user regardless of their actual profile — while the
// Log tab showed real per-user targets from the same nutrition-coach data,
// so the two screens visibly disagreed. Pull the real target here instead.
export default function MacroTargetCard() {
  const { data, isLoading, isError } = useNutritionCoaching();
  const accentColor = Colors.teal;
  const borderColor = Colors.borderTeal;

  if (isError) {
    return (
      <View style={[styles.card, { borderColor }]}>
        <Text style={styles.cardLabel}>TODAY'S FUEL TARGETS</Text>
        <Text style={styles.errorText}>Couldn&apos;t load your targets.</Text>
      </View>
    );
  }

  if (isLoading || !data) {
    return (
      <View style={[styles.card, { borderColor }]}>
        <Text style={styles.cardLabel}>TODAY'S FUEL TARGETS</Text>
        <ActivityIndicator color={accentColor} style={{ marginTop: 10 }} />
      </View>
    );
  }

  const targets = data.target;

  return (
    <View style={[styles.card, { borderColor }]}>
      <View style={styles.headerRow}>
        <Text style={styles.cardLabel}>TODAY'S FUEL TARGETS</Text>
      </View>
      <View style={styles.macroGrid}>
        <MacroBlock value={targets.proteinG} unit="g" label="Protein" accentColor={accentColor} />
        <MacroBlock value={targets.carbsG} unit="g" label="Carbs" accentColor={accentColor} />
        <MacroBlock value={targets.fatG} unit="g" label="Fat" accentColor={accentColor} />
        <MacroBlock value={targets.calories} unit="kcal" label="Calories" accentColor={accentColor} />
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
  errorText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
