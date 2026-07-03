import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface HydrationCardProps {
  ounces: number;
  targetOz: number;
  onAdd: (ounces: number) => void;
  /** Highlight styling for heat-alert days — same visual language as WeatherCoachCard's alert state. */
  emphasized?: boolean;
}

const QUICK_ADDS = [8, 16, 24];

export default function HydrationCard({ ounces, targetOz, onAdd, emphasized }: HydrationCardProps) {
  const progress = targetOz > 0 ? Math.min(1, ounces / targetOz) : 0;
  const met = progress >= 1;

  return (
    <View style={[styles.card, emphasized && styles.cardEmphasized]}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <Ionicons name="water" size={15} color={met ? Colors.green : Colors.teal} />
          <Text style={styles.label}>HYDRATION</Text>
        </View>
        <Text style={styles.amount}>
          {Math.round(ounces)} <Text style={styles.amountTarget}>/ {Math.round(targetOz)} oz</Text>
        </Text>
      </View>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${progress * 100}%`, backgroundColor: met ? Colors.green : Colors.teal },
          ]}
        />
      </View>

      <View style={styles.quickAddRow}>
        {QUICK_ADDS.map((oz) => (
          <TouchableOpacity key={oz} style={styles.quickAddBtn} onPress={() => onAdd(oz)}>
            <Text style={styles.quickAddText}>+{oz} oz</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    gap: 10,
  },
  cardEmphasized: {
    backgroundColor: 'rgba(0,200,200,0.08)',
    borderColor: Colors.borderTeal,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 10, fontWeight: '700', color: Colors.teal, letterSpacing: 1.2 },
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
});
