import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useCalendarMonth } from '@/hooks/useCalendarMonth';
import type { CalendarDay } from '@/services/calendar';

const SESSION_ICON: Record<string, string> = {
  run: '🏃',
  lift: '🏋️',
  cross: '🔁',
  race: '🏁',
  rest: '😴',
};

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function formatSessionType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export default function CalendarScreen() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const { data: days, isLoading } = useCalendarMonth(year, month);

  const dayMap = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const day of days ?? []) map.set(day.date, day);
    return map;
  }, [days]);

  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay();
  const monthLabel = firstOfMonth.toLocaleDateString([], { month: 'long', year: 'numeric' });

  const cells: Array<{ day: number; dateStr: string } | null> = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr });
  }

  function goToPrevMonth() {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  }

  function goToNextMonth() {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  }

  function handleDayPress(dateStr: string) {
    const day = dayMap.get(dateStr);
    if (!day) return;

    const lines: string[] = [];
    if (day.plannedType) {
      lines.push(`Planned: ${formatSessionType(day.plannedType)}${day.plannedDescription ? ` — ${day.plannedDescription}` : ''}`);
    }
    if (day.completedTypes.length > 0) {
      lines.push(`Completed: ${day.completedTypes.map(formatSessionType).join(', ')}`);
    }
    if (lines.length === 0) return;

    Alert.alert(dateStr, lines.join('\n'));
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Calendar</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={styles.monthNav}>
        <TouchableOpacity onPress={goToPrevMonth} style={styles.navBtn}>
          <Text style={styles.navBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity onPress={goToNextMonth} style={styles.navBtn}>
          <Text style={styles.navBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={i} style={styles.weekdayLabel}>{label}</Text>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color={Colors.teal} style={{ marginTop: 24 }} />
      ) : (
        <View style={styles.grid}>
          {cells.map((cell, i) => {
            if (!cell) return <View key={i} style={styles.cell} />;
            const day = dayMap.get(cell.dateStr);
            const isToday = cell.dateStr === today.toISOString().slice(0, 10);
            const hasCompleted = (day?.completedTypes.length ?? 0) > 0;
            const icon = hasCompleted
              ? SESSION_ICON[day!.completedTypes[0]] ?? '✓'
              : day?.plannedType
                ? SESSION_ICON[day.plannedType] ?? '•'
                : null;

            return (
              <TouchableOpacity
                key={i}
                style={[styles.cell, isToday && styles.cellToday]}
                onPress={() => handleDayPress(cell.dateStr)}
              >
                <Text style={[styles.cellDay, isToday && styles.cellDayToday]}>{cell.day}</Text>
                {icon ? (
                  <Text style={[styles.cellIcon, hasCompleted && styles.cellIconDone]}>{icon}</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.legend}>
        <Text style={styles.legendText}>🏃 Run  🏋️ Lift  🔁 Cross  🏁 Race</Text>
        <Text style={styles.legendText}>Faded = planned · Solid = completed</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: { fontSize: 14, color: Colors.teal, fontWeight: '700', width: 50 },
  title: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 8,
  },
  navBtn: { padding: 8 },
  navBtnText: { fontSize: 22, color: Colors.teal, fontWeight: '700' },
  monthLabel: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  weekdayRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 8 },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, marginTop: 4 },
  cell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  cellToday: {
    backgroundColor: Colors.surfaceTeal,
    borderRadius: 10,
  },
  cellDay: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  cellDayToday: { color: Colors.teal, fontWeight: '800' },
  cellIcon: { fontSize: 14, opacity: 0.45 },
  cellIconDone: { opacity: 1 },
  legend: { padding: 20, gap: 4, marginTop: 'auto' },
  legendText: { fontSize: 11, color: Colors.textMuted, textAlign: 'center' },
});
