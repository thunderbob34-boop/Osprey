import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/colors';
import { useNutritionCoaching } from '@/hooks/useNutritionCoaching';

// Shown only while the very first fetch is in flight or if it fails —
// real targets always come from ozzie-nutrition-coach once loaded, which
// adapts to the user's goal, today's session, and their weight trend.
const FALLBACK = { protein: 200, carbs: 220, fat: 70, calories: 2400 };

export default function MacroTargetCard() {
  const { data, isLoading } = useNutritionCoaching();

  const targets = data?.target
    ? {
        protein: data.target.proteinG,
        carbs: data.target.carbsG,
        fat: data.target.fatG,
        calories: data.target.calories,
      }
    : FALLBACK;

  return (
    <View style={[styles.card, { borderColor: Colors.borderTeal }]}>
      <View style={styles.headerRow}>
        <Text style={styles.cardLabel}>TODAY'S FUEL TARGETS</Text>
        {isLoading ? <ActivityIndicator size="small" color={Colors.teal} /> : null}
      </View>
      <View style={styles.macroGrid}>
        <MacroBlock value={targets.protein} unit="g" label="Protein" accentColor={Colors.teal} />
        <MacroBlock value={targets.carbs} unit="g" label="Carbs" accentColor={Colors.teal} />
        <MacroBlock value={targets.fat} unit="g" label="Fat" accentColor={Colors.teal} />
        <MacroBlock value={targets.calories} unit="kcal" label="Calories" accentColor={Colors.teal} />
      </View>
      {data?.tip ? <Text style={styles.tip}>{data.tip}</Text> : null}
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
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
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
  tip: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
    fontStyle: 'italic',
  },
});
