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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Theme, Radius, BorderWidth } from '@/constants/theme';
import { SESSION_ICON, SESSION_ICON_FALLBACK } from '@/constants/session-icons';
import ScreenHeader from '@/components/ScreenHeader';
import { useCalendarMonth } from '@/hooks/useCalendarMonth';
import type { CalendarDay } from '@/services/calendar';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** The legend under the grid — the types an athlete can actually see here. */
const LEGEND_TYPES = ['run', 'lift', 'swim', 'bike', 'rowing', 'hyrox', 'cross', 'race'] as const;

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
        <ActivityIndicator color={Theme.accent} style={{ marginTop: 24 }} />
      ) : (
        <View style={styles.grid}>
          {cells.map((cell, i) => {
            if (!cell) return <View key={i} style={styles.cell} />;
            const day = dayMap.get(cell.dateStr);
            const isToday = cell.dateStr === todayStr;
            const hasCompleted = (day?.completedTypes.length ?? 0) > 0;
            // Race day trumps everything — it's the day you circled.
            const icon = day?.raceName
              ? SESSION_ICON.race
              : hasCompleted
                ? SESSION_ICON[day!.completedTypes[0]] ?? SESSION_ICON_FALLBACK
                : day?.plannedType
                  ? SESSION_ICON[day.plannedType] ?? SESSION_ICON_FALLBACK
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
                  // Done vs planned is carried by colour, not transparency. It
                  // used to be opacity 0.45 vs 1 on a multicolour emoji against
                  // near-black — the single most important fact on this screen,
                  // encoded in a way the legend had to explain in words.
                  <MaterialCommunityIcons
                    name={icon}
                    size={14}
                    color={hasCompleted || day?.raceName ? Theme.accent : Theme.textMut}
                    style={styles.cellIcon}
                  />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.legend}>
        <View style={styles.legendKeyRow}>
          {LEGEND_TYPES.map((type) => (
            <View key={type} style={styles.legendKey}>
              <MaterialCommunityIcons name={SESSION_ICON[type]} size={13} color={Theme.textSoft} />
              <Text style={styles.legendText}>{formatSessionType(type)}</Text>
            </View>
          ))}
        </View>
        <View style={styles.legendKeyRow}>
          <View style={styles.legendKey}>
            <MaterialCommunityIcons name="run" size={13} color={Theme.textMut} />
            <Text style={styles.legendText}>Planned</Text>
          </View>
          <View style={styles.legendKey}>
            <MaterialCommunityIcons name="run" size={13} color={Theme.accent} />
            <Text style={styles.legendText}>Completed</Text>
          </View>
        </View>
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
              <MaterialCommunityIcons
                name={SESSION_ICON.race}
                size={24}
                color={Theme.accent}
                style={styles.sheetCardIcon}
              />
              <View style={styles.sheetCardBody}>
                <Text style={[styles.sheetCardLabel, { color: Theme.accent }]}>RACE DAY</Text>
                <Text style={styles.sheetCardTitle}>{selectedDay.raceName}</Text>
                <Text style={styles.sheetCardDesc}>View in Race Hub →</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {selectedDay?.plannedType ? (
            <View style={styles.sheetCard}>
              <MaterialCommunityIcons
                name={SESSION_ICON[selectedDay.plannedType] ?? SESSION_ICON_FALLBACK}
                size={24}
                color={Theme.textMut}
                style={styles.sheetCardIcon}
              />
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
              <MaterialCommunityIcons
                name="check-circle"
                size={24}
                color={Colors.green}
                style={styles.sheetCardIcon}
              />
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
  container: { flex: 1, backgroundColor: Theme.ink },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 8,
  },
  navBtn: { padding: 8 },
  navBtnText: { fontSize: 22, color: Theme.accent, fontWeight: '700' },
  monthLabel: { fontSize: 16, fontWeight: '800', color: Theme.text },
  weekdayRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 8 },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    color: Theme.textMut,
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
    backgroundColor: Theme.accent + '1A',
    borderRadius: Radius.card,
  },
  cellDay: { fontSize: 13, color: Theme.textSoft, fontWeight: '600' },
  cellDayToday: { color: Theme.accent, fontWeight: '800' },
  cellIcon: { marginTop: 1 },
  legend: { padding: 20, gap: 8, marginTop: 'auto' },
  legendKeyRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  legendKey: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 11, color: Theme.textMut, textAlign: 'center' },

  // Day detail sheet
  // Scrim, not a surface — re-derived from Theme.ink at the original alpha
  // rather than mapped to a surface token. Matches InputModal.tsx.
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(9,9,11,0.5)' },
  sheet: {
    backgroundColor: Theme.panel,
    // Sheet corners stay at 20 — a bottom sheet's large top radius is a sheet
    // affordance, not card chrome. Matches the already-migrated Home adjust
    // sheet (src/screens/DailySummary.tsx:889), which kept 20 through its own
    // migration.
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
  sheetTitle: { fontSize: 18, fontWeight: '800', color: Theme.text },
  sheetCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Theme.accent + '0F',
    borderWidth: BorderWidth.card,
    borderColor: Theme.accent + '33',
    borderRadius: Radius.card,
    padding: 14,
  },
  sheetCardDone: {
    backgroundColor: Colors.surfaceGreen,
    borderColor: Colors.borderGreen,
  },
  sheetCardRace: {
    backgroundColor: `${Theme.accent}26`,
    borderColor: Theme.accent,
  },
  sheetCardIcon: { width: 26, textAlign: 'center' },
  sheetCardBody: { flex: 1, gap: 2 },
  sheetCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Theme.accent,
    letterSpacing: 1,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  sheetCardTitle: { fontSize: 16, fontWeight: '800', color: Theme.text },
  sheetCardDesc: { fontSize: 13, color: Theme.textSoft, lineHeight: 18, marginTop: 2 },
  sheetCloseBtn: {
    marginTop: 4,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseBtnText: { fontSize: 14, fontWeight: '700', color: Theme.textSoft },
});
