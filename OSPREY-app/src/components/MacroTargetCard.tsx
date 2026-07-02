import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

const TRAINING = { protein: 240, carbs: 265, fat: 80, calories: 2740 };
const LONG_DAY = { protein: 240, carbs: 340, fat: 80, calories: 3040 };

export default function MacroTargetCard() {
  const isSunday = new Date().getDay() === 0;
  const targets = isSunday ? LONG_DAY : TRAINING;
  const borderColor = isSunday ? Colors.borderGold : Colors.borderTeal;
  const surface = isSunday ? Colors.surfaceGold : Colors.surfaceTeal;
  const accentColor = isSunday ? Colors.gold : Colors.teal;
  const badgeLabel = isSunday ? 'Long Day — Carb Reload' : 'Training Day';

  return (
    <View style={[styles.card, { borderColor }]}>
      <View style={styles.headerRow}>
        <Text style={styles.cardLabel}>TODAY'S FUEL TARGETS</Text>
        <View style={[styles.badge, { backgroundColor: surface }]}>
          <Text style={[styles.badgeText, { color: accentColor }]}>{badgeLabel}</Text>
        </View>
      </View>
      <View style={styles.macroGrid}>
        <MacroBlock value={targets.protein} unit="g" label="Protein" accentColor={accentColor} />
        <MacroBlock value={targets.carbs} unit="g" label="Carbs" accentColor={accentColor} />
        <MacroBlock value={targets.fat} unit="g" label="Fat" accentColor={accentColor} />
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
});
