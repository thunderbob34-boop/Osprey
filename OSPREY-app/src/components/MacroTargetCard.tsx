import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useNutritionCoaching } from '@/hooks/useNutritionCoaching';

export default function MacroTargetCard() {
  const router = useRouter();
  const { data, isLoading } = useNutritionCoaching();
  const isSunday = new Date().getDay() === 0;
  const borderColor = isSunday ? Colors.borderGold : Colors.borderTeal;
  const surface = isSunday ? Colors.surfaceGold : Colors.surfaceTeal;
  const accentColor = isSunday ? Colors.gold : Colors.teal;
  const badgeLabel = isSunday ? 'Long Day — Carb Reload' : 'Training Day';

  if (isLoading || !data?.target) return null;

  const { target } = data;

  return (
    <Pressable style={[styles.card, { borderColor }]} onPress={() => router.push('/(tabs)/log' as any)}>
      <View style={styles.headerRow}>
        <Text style={styles.cardLabel}>TODAY'S FUEL TARGETS</Text>
        <View style={[styles.badge, { backgroundColor: surface }]}>
          <Text style={[styles.badgeText, { color: accentColor }]}>{badgeLabel}</Text>
        </View>
      </View>
      <View style={styles.macroGrid}>
        <MacroBlock value={target.proteinG} unit="g" label="Protein" accentColor={accentColor} />
        <MacroBlock value={target.carbsG} unit="g" label="Carbs" accentColor={accentColor} />
        <MacroBlock value={target.fatG} unit="g" label="Fat" accentColor={accentColor} />
        <MacroBlock value={target.calories} unit="kcal" label="Calories" accentColor={accentColor} />
      </View>
    </Pressable>
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
