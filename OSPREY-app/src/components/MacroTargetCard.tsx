import React from 'react';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { useNutritionCoaching } from '@/hooks/useNutritionCoaching';

export default function MacroTargetCard() {
  const { data, isLoading, error } = useNutritionCoaching();
  const isSunday = new Date().getDay() === 0;
  const borderColor = isSunday ? Colors.borderGold : Colors.borderTeal;
  const surface = isSunday ? Colors.surfaceGold : Colors.surfaceTeal;
  const accentColor = isSunday ? Colors.gold : Colors.teal;
  const badgeLabel = isSunday ? 'Long Day — Carb Reload' : 'Training Day';

  if (isLoading) {
    return (
      <View style={[styles.card, styles.centered, { borderColor }]}>
        <ActivityIndicator color={accentColor} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.card, styles.centered, { borderColor }]}>
        <Text style={styles.errorText}>Couldn't load today's fuel targets.</Text>
      </View>
    );
  }

  const targets = data.target;

  return (
    <View style={[styles.card, { borderColor }]}>
      <View style={styles.headerRow}>
        <Text style={styles.cardLabel}>TODAY'S FUEL TARGETS</Text>
        <View style={[styles.badge, { backgroundColor: surface }]}>
          <Text style={[styles.badgeText, { color: accentColor }]}>{badgeLabel}</Text>
        </View>
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
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
  },
  errorText: {
    fontSize: 12,
    color: Colors.textMuted,
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
});
