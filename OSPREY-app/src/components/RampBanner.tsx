import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';

interface RampBannerProps {
  gapDays: number;
  lastWorkoutAt: string;
  onDismiss: () => void;
}

export default function RampBanner({ gapDays, lastWorkoutAt, onDismiss }: RampBannerProps) {
  const router = useRouter();
  const weeks = Math.floor(gapDays / 7);
  const gapLabel = weeks >= 2 ? `${weeks} weeks` : `${gapDays} days`;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>👋 Welcome back</Text>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Dismiss welcome back banner"
        >
          <Text style={styles.dismiss}>✕</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>
        It's been about {gapLabel} since your last workout. Jumping straight back to full volume
        is how comebacks get cut short — let Ozzie build a ramp instead.
      </Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={() =>
          router.push({
            pathname: '/return-to-training',
            params: { gapDays: String(gapDays), lastWorkoutAt },
          })
        }
        accessibilityRole="button"
        accessibilityLabel="Build my return-to-training ramp plan"
      >
        <Text style={styles.btnText}>Ease Me Back In →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderGold,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  dismiss: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  btn: {
    marginTop: 4,
    backgroundColor: Colors.gold,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000',
  },
});
