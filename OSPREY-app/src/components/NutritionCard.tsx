import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useNutritionCoaching } from '@/hooks/useNutritionCoaching';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { formatFluidOz, mlToOz } from '@/services/units';
import type { FuelStatusData } from '@/types/daily-summary';

// Shown only while the very first fetch is in flight or if it fails —
// real targets always come from ozzie-nutrition-coach once loaded, which
// adapts to the user's goal, today's session, and their weight trend.
const FALLBACK = { protein: 200, carbs: 220, fat: 70, calories: 2400 };
// Metric quick-adds are round ml amounts, not conversions of the imperial
// ones — matches how a metric user would actually think about a glass/bottle.
const QUICK_ADDS_OZ = [8, 16, 24];
const QUICK_ADDS_ML = [250, 500, 750];

interface NutritionCardProps {
  hydration?: { ounces: number; targetOz: number };
  onAddHydration?: (ounces: number) => void;
  /** Highlight the hydration section, e.g. on heat-alert days. */
  hydrationEmphasized?: boolean;
  fuelStatus?: FuelStatusData;
  /** Hide the meal-timing tip on rest days, matching the old standalone fuel card's behavior. */
  showFuelTip?: boolean;
}

export default function NutritionCard({
  hydration,
  onAddHydration,
  hydrationEmphasized,
  fuelStatus,
  showFuelTip = true,
}: NutritionCardProps) {
  const { data, isLoading } = useNutritionCoaching();
  const { units } = useUnitPreference();
  const unitLabel = units === 'metric' ? 'ml' : 'oz';

  const targets = data?.target
    ? {
        protein: data.target.proteinG,
        carbs: data.target.carbsG,
        fat: data.target.fatG,
        calories: data.target.calories,
      }
    : FALLBACK;

  const fuelTip = showFuelTip ? fuelCardCopy(fuelStatus) : null;
  const hydrationProgress =
    hydration && hydration.targetOz > 0 ? Math.min(1, hydration.ounces / hydration.targetOz) : 0;
  const hydrationMet = hydrationProgress >= 1;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.cardLabel}>NUTRITION</Text>
        {isLoading ? <ActivityIndicator size="small" color={Colors.teal} /> : null}
      </View>

      <View style={styles.macroGrid}>
        <MacroBlock value={targets.protein} unit="g" label="Protein" />
        <MacroBlock value={targets.carbs} unit="g" label="Carbs" />
        <MacroBlock value={targets.fat} unit="g" label="Fat" />
        <MacroBlock value={targets.calories} unit="kcal" label="Calories" />
      </View>
      {data?.tip ? <Text style={styles.tip}>{data.tip}</Text> : null}

      {hydration ? (
        <>
          <View style={styles.divider} />
          <View style={[styles.hydrationSection, hydrationEmphasized && styles.hydrationSectionEmphasized]}>
            <View style={styles.hydrationHeaderRow}>
              <View style={styles.titleRow}>
                <Ionicons name="water" size={14} color={hydrationMet ? Colors.green : Colors.teal} />
                <Text style={styles.sectionLabel}>HYDRATION</Text>
              </View>
              <Text style={styles.amount}>
                {formatFluidOz(hydration.ounces, units)}{' '}
                <Text style={styles.amountTarget}>/ {formatFluidOz(hydration.targetOz, units)} {unitLabel}</Text>
              </Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${hydrationProgress * 100}%`, backgroundColor: hydrationMet ? Colors.green : Colors.teal },
                ]}
              />
            </View>
            <View style={styles.quickAddRow}>
              {(units === 'metric' ? QUICK_ADDS_ML : QUICK_ADDS_OZ).map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={styles.quickAddBtn}
                  onPress={() => onAddHydration?.(units === 'metric' ? mlToOz(amount) : amount)}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${amount} ${unitLabel} of water`}
                >
                  <Text style={styles.quickAddText}>+{amount} {unitLabel}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </>
      ) : null}

      {fuelTip ? (
        <>
          <View style={styles.divider} />
          <View style={styles.fuelTipTitleRow}>
            <Ionicons name="restaurant-outline" size={14} color={Colors.gold} />
            <Text style={styles.fuelTipTitle}>{fuelTip.title}</Text>
          </View>
          <Text style={styles.fuelTipBody}>{fuelTip.body}</Text>
        </>
      ) : null}
    </View>
  );
}

function formatFuelTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function fuelCardCopy(fuelStatus?: FuelStatusData): { title: string; body: string } | null {
  if (!fuelStatus) return null;
  if (fuelStatus.lastLoggedMinutesAgo == null) {
    return {
      title: 'Fuel up before training',
      body: "No meals logged yet today. Eat a carb-rich snack 60-90 min before your session for best performance.",
    };
  }
  const timeAgo = formatFuelTime(fuelStatus.lastLoggedMinutesAgo);
  if (fuelStatus.recommendation === 'recently_fueled') {
    return {
      title: 'Recently fueled',
      body: `Last meal logged ${timeAgo} ago. Give it a little time to digest before going hard.`,
    };
  }
  if (fuelStatus.recommendation === 'good_timing') {
    return {
      title: 'Good timing',
      body: `Last meal logged ${timeAgo} ago — that's a solid fueling window for today's session.`,
    };
  }
  return {
    title: 'Fuel up before training',
    body: `It's been ${timeAgo} since your last logged meal. Grab a carb-rich snack 60-90 min before training.`,
  };
}

function MacroBlock({ value, unit, label }: { value: number; unit: string; label: string }) {
  return (
    <View style={styles.macroBlock}>
      <View style={styles.macroValueRow}>
        <Text style={styles.macroNumber}>{value}</Text>
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
    borderColor: Colors.borderTeal,
    padding: 16,
    marginBottom: 16,
    gap: 12,
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
    color: Colors.teal,
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
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  hydrationSection: { gap: 10 },
  hydrationSectionEmphasized: {
    backgroundColor: 'rgba(0,200,200,0.08)',
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 12,
    padding: 10,
    margin: -10,
  },
  hydrationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: Colors.teal, letterSpacing: 1.2 },
  amount: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  amountTarget: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  track: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: 3 },
  quickAddRow: { flexDirection: 'row', gap: 8 },
  quickAddBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  quickAddText: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  fuelTipTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fuelTipTitle: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  fuelTipBody: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
});
