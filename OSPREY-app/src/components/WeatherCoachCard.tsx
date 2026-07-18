import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Theme, Radius } from '@/constants/theme';
import type { WeatherCoachResult } from '@/services/weather-coach';

interface WeatherCoachCardProps {
  weather: WeatherCoachResult;
  /** Shown when the forecast recommends moving today's outdoor session inside. */
  onMoveIndoors?: () => void;
  movingIndoors?: boolean;
  alreadyIndoors?: boolean;
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
    bg: Theme.panel,
    border: Theme.line,
    accent: Theme.accent,
    icon: 'partly-sunny-outline' as const,
  },
};

export default function WeatherCoachCard({
  weather,
  onMoveIndoors,
  movingIndoors,
  alreadyIndoors,
}: WeatherCoachCardProps) {
  const s = SEVERITY_STYLE[weather.severity];
  const showAction = weather.suggestIndoor && onMoveIndoors && !alreadyIndoors;

  return (
    <View style={[styles.card, { backgroundColor: s.bg, borderColor: s.border }]}>
      <View style={styles.titleRow}>
        <Ionicons name={s.icon} size={15} color={s.accent} />
        <Text style={[styles.label, { color: s.accent }]}>WEATHER COACH</Text>
      </View>
      <Text style={styles.headline}>{weather.headline}</Text>
      <Text style={styles.detail}>{weather.detail}</Text>

      {weather.recommendedRoute ? (
        <View style={[styles.routeChip, { borderColor: s.border }]}>
          <Ionicons name="map-outline" size={13} color={s.accent} />
          <Text style={styles.routeChipText}>
            Try <Text style={styles.routeChipName}>{weather.recommendedRoute.name}</Text>
            {weather.recommendedRoute.tags.length > 0 ? ` (${weather.recommendedRoute.tags.join(', ')})` : ''}
          </Text>
        </View>
      ) : null}

      {showAction ? (
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: s.accent }]}
          onPress={onMoveIndoors}
          disabled={movingIndoors}
          accessibilityRole="button"
          accessibilityLabel="Move today's session indoors"
          accessibilityState={{ disabled: movingIndoors, busy: movingIndoors }}
        >
          {movingIndoors ? (
            <ActivityIndicator color={s.accent} size="small" />
          ) : (
            <Text style={[styles.actionText, { color: s.accent }]}>Move today's session indoors</Text>
          )}
        </TouchableOpacity>
      ) : alreadyIndoors ? (
        <View style={styles.movedRow}>
          <Ionicons name="checkmark-circle" size={14} color={Colors.green} />
          <Text style={styles.movedText}>Moved indoors</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
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
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 1.2,
  },
  headline: {
    fontSize: 15,
    fontWeight: '800',
    color: Theme.text,
  },
  detail: {
    fontSize: 12,
    color: Theme.textSoft,
    lineHeight: 18,
  },
  routeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    borderWidth: 1,
    borderRadius: Radius.card,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  routeChipText: { fontSize: 12, color: Theme.textSoft },
  routeChipName: { fontWeight: '700', color: Theme.text },
  actionBtn: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: Radius.card,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  movedRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  movedText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.green,
  },
});
