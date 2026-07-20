import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme, Radius, BorderWidth, StatusPalette } from '@/constants/theme';
import { Card } from '@/components/ui';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { formatFluidOz, mlToOz } from '@/services/units';

interface HydrationCardProps {
  ounces: number;
  targetOz: number;
  onAdd: (ounces: number) => void;
  /** Highlight styling for heat-alert days — same visual language as WeatherCoachCard's alert state. */
  emphasized?: boolean;
}

// Metric quick-adds are round ml amounts, not conversions of the imperial
// ones — matches how a metric user would actually think about a glass/bottle.
const QUICK_ADDS_OZ = [8, 16, 24];
const QUICK_ADDS_ML = [250, 500, 750];

export default function HydrationCard({ ounces, targetOz, onAdd, emphasized }: HydrationCardProps) {
  const { units } = useUnitPreference();
  const progress = targetOz > 0 ? Math.min(1, ounces / targetOz) : 0;
  const met = progress >= 1;
  const unitLabel = units === 'metric' ? 'ml' : 'oz';

  return (
    <Card emphasis={emphasized} style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Ionicons name="water" size={15} color={met ? StatusPalette.success : Theme.accent} />
          <Text style={styles.label}>HYDRATION</Text>
        </View>
        <Text style={styles.amount}>
          {formatFluidOz(ounces, units)}{' '}
          <Text style={styles.amountTarget}>/ {formatFluidOz(targetOz, units)} {unitLabel}</Text>
        </Text>
      </View>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${progress * 100}%`, backgroundColor: met ? StatusPalette.success : Theme.accent },
          ]}
        />
      </View>

      <View style={styles.quickAddRow}>
        {(units === 'metric' ? QUICK_ADDS_ML : QUICK_ADDS_OZ).map((amount) => (
          <TouchableOpacity
            key={amount}
            style={styles.quickAddBtn}
            onPress={() => onAdd(units === 'metric' ? mlToOz(amount) : amount)}
            accessibilityRole="button"
            accessibilityLabel={`Add ${amount} ${unitLabel} of water`}
          >
            <Text style={styles.quickAddText}>+{amount} {unitLabel}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 14,
    gap: 10,
  } as ViewStyle,
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 10, fontWeight: '700', color: Theme.accent, letterSpacing: 1.2, fontFamily: 'SpaceGrotesk_700Bold' },
  amount: { fontSize: 14, fontWeight: '800', color: Theme.text },
  amountTarget: { fontSize: 12, fontWeight: '600', color: Theme.textMut },
  track: {
    height: 6,
    backgroundColor: Theme.line,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: 3 },
  quickAddRow: { flexDirection: 'row', gap: 8 },
  quickAddBtn: {
    flex: 1,
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    paddingVertical: 8,
    alignItems: 'center',
  },
  quickAddText: { fontSize: 12, fontWeight: '700', color: Theme.text },
});
