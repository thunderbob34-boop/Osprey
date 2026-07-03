import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import type { WeatherCoachResult } from '@/services/weather-coach';

interface WeatherCoachCardProps {
  weather: WeatherCoachResult;
}

const SEVERITY_STYLE = {
  alert: {
    bg: 'rgba(255,68,68,0.07)',
    border: 'rgba(255,68,68,0.3)',
    accent: Colors.red,
    icon: 'thermometer' as const,
  },
  caution: {
    bg: 'rgba(245,166,35,0.08)',
    border: 'rgba(245,166,35,0.3)',
    accent: Colors.amber,
    icon: 'water' as const,
  },
  info: {
    bg: Colors.surfaceTeal,
    border: Colors.borderTeal,
    accent: Colors.teal,
    icon: 'partly-sunny-outline' as const,
  },
};

export default function WeatherCoachCard({ weather }: WeatherCoachCardProps) {
  const s = SEVERITY_STYLE[weather.severity];

  return (
    <View style={[styles.card, { backgroundColor: s.bg, borderColor: s.border }]}>
      <View style={styles.titleRow}>
        <Ionicons name={s.icon} size={15} color={s.accent} />
        <Text style={[styles.label, { color: s.accent }]}>WEATHER COACH</Text>
      </View>
      <Text style={styles.headline}>{weather.headline}</Text>
      <Text style={styles.detail}>{weather.detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  headline: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  detail: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
