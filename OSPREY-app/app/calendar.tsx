import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Colors } from '@/constants/colors';
import ScreenHeader from '@/components/ScreenHeader';
import { useCalendarMonth } from '@/hooks/useCalendarMonth';
import type { CalendarDay } from '@/services/calendar';

const SESSION_ICON: Record<string, string> = {
  run: '🏃',
  lift: '🏋️',
  swim: '🏊',
  bike: '🚴',
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
  // Local date — toISOString() flips to tomorrow at 5pm Pacific.
  const todayStr = useMemo(() => format(today, 'yyyy-MM-dd'), [today]);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const { data: days, isLoading, error } = useCalendarMonth(year, month);

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

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selectedDay = selectedDate ? dayMap.get(selectedDate) : undefined;

  function handleDayPress(dateStr: string) {
    const day = dayMap.get(dateStr);
    if (!day) return;
    if (!day.plannedType && day.completedTypes.length === 0 && !day.raceName) return;
    setSelectedDate(dateStr);
  }

  function formatSheetDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Calendar" />

      <View style={styles.monthNav}>
        <TouchableOpacity
          onPress={goToPrevMonth}
          style={styles.navBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
        >
          <Text style={styles.navBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity
          onPress={goToNextMonth}
          style={styles.navBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
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
      ) : error ? (
        <Text style={styles.errorText}>Couldn&apos;t load your calendar.</Text>
      ) : (
        <View style={styles.grid}>
          {cells.map((cell, i) => {
            if (!cell) return <View key={i} style={styles.cell} />;
            const day = dayMap.get(cell.dateStr);
            const isToday = cell.dateStr === todayStr;
            const hasCompleted = (day?.completedTypes.length ?? 0) > 0;
            // Race day trumps everything — it's the day you circled.
            const icon = day?.raceName
              ? '🏁'
              : hasCompleted
                ? SESSION_ICON[day!.completedTypes[0]] ?? '✓'
                : day?.plannedType
                  ? SESSION_ICON[day.plannedType] ?? '•'
                  : null;

            const dayLabelParts = [`${monthLabel.split(' ')[0]} ${cell.day}`];
            if (isToday) dayLabelParts.push('today');
            if (day?.raceName) dayLabelParts.push(`race day, ${day.raceName}`);
            if (hasCompleted) dayLabelParts.push(`completed ${day!.completedTypes.map(formatSessionType).join(', ')}`);
            else if (day?.plannedType) dayLabelParts.push(`planned ${formatSessionType(day.plannedType)}`);

            return (
              <TouchableOpacity
                key={i}
                style={[styles.cell, isToday && styles.cellToday]}
                onPress={() => handleDayPress(cell.dateStr)}
                accessibilityRole="button"
                accessibilityLabel={dayLabelParts.join(', ')}
              >
                <Text style={[styles.cellDay, isToday && styles.cellDayToday]}>{cell.day}</Text>
                {icon ? (
                  <Text style={[styles.cellIcon, (hasCompleted || day?.raceName) && styles.cellIconDone]}>
                    {icon}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.legend}>
        <Text style={styles.legendText}>🏃 Run  🏋️ Lift  🏊 Swim  🚴 Bike  🔁 Cross  🏁 Race</Text>
        <Text style={styles.legendText}>Faded = planned · Solid = completed</Text>
      </View>

      {/* ── Day detail sheet ── */}
      <Modal
        visible={selectedDate != null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDate(null)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setSelectedDate(null)}
          accessibilityRole="button"
          accessibilityLabel="Close day details"
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>
            {selectedDate ? formatSheetDate(selectedDate) : ''}
          </Text>

          {selectedDay?.raceName ? (
            <TouchableOpacity
              style={[styles.sheetCard, styles.sheetCardRace]}
              onPress={() => {
                setSelectedDate(null);
                router.push('/races');
              }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Race day: ${selectedDay.raceName}. View in race hub`}
            >
              <Text style={styles.sheetCardIcon}>🏁</Text>
              <View style={styles.sheetCardBody}>
                <Text style={[styles.sheetCardLabel, { color: Colors.gold }]}>RACE DAY</Text>
                <Text style={styles.sheetCardTitle}>{selectedDay.raceName}</Text>
                <Text style={styles.sheetCardDesc}>View in Race Hub →</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {selectedDay?.plannedType ? (
            <View style={styles.sheetCard}>
              <Text style={styles.sheetCardIcon}>
                {SESSION_ICON[selectedDay.plannedType] ?? '•'}
              </Text>
              <View style={styles.sheetCardBody}>
                <Text style={styles.sheetCardLabel}>PLANNED</Text>
                <Text style={styles.sheetCardTitle}>
                  {formatSessionType(selectedDay.plannedType)}
                </Text>
                {selectedDay.plannedDescription ? (
                  <Text style={styles.sheetCardDesc}>{selectedDay.plannedDescription}</Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {selectedDay && selectedDay.completedTypes.length > 0 ? (
            <View style={[styles.sheetCard, styles.sheetCardDone]}>
              <Text style={styles.sheetCardIcon}>✅</Text>
              <View style={styles.sheetCardBody}>
                <Text style={[styles.sheetCardLabel, { color: Colors.green }]}>COMPLETED</Text>
                <Text style={styles.sheetCardTitle}>
                  {selectedDay.completedTypes.map(formatSessionType).join(', ')}
                </Text>
              </View>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.sheetCloseBtn}
            onPress={() => setSelectedDate(null)}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.sheetCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
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
  errorText: {
    fontSize: 13,
    color: Colors.red,
    textAlign: 'center',
    marginTop: 24,
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

  // Day detail sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#0D1424',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    gap: 12,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 4,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  sheetCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 14,
    padding: 14,
  },
  sheetCardDone: {
    backgroundColor: Colors.surfaceGreen,
    borderColor: Colors.borderGreen,
  },
  sheetCardRace: {
    backgroundColor: Colors.surfaceGold,
    borderColor: Colors.borderGold,
  },
  sheetCardIcon: { fontSize: 24 },
  sheetCardBody: { flex: 1, gap: 2 },
  sheetCardLabel: { fontSize: 10, fontWeight: '700', color: Colors.teal, letterSpacing: 1 },
  sheetCardTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  sheetCardDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginTop: 2 },
  sheetCloseBtn: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseBtnText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
});
