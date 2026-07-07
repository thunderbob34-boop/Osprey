import { useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Colors } from '@/constants/colors';
import ScreenHeader from '@/components/ScreenHeader';
import { fetchRaceDistances, getCachedRace, parseRaceDate, stripHtml, type RaceSearchResult } from '@/services/race-search';
import { extractFunctionErrorMessage, supabase } from '@/services/supabase';
import { createRaceEvent } from '@/services/races';
import { useAuthStore } from '@/store/authStore';

/** Best-effort conversion of a race distance label ("5K", "Half Marathon") to km. */
function distanceLabelToKm(label: string): number | null {
  const lower = label.toLowerCase();
  if (lower.includes('half') && lower.includes('marathon')) return 21.1;
  if (lower.includes('marathon')) return 42.2;
  const kMatch = lower.match(/(\d+(?:\.\d+)?)\s*k/);
  if (kMatch) return Number(kMatch[1]);
  const mileMatch = lower.match(/(\d+(?:\.\d+)?)\s*mile/);
  if (mileMatch) return Number(mileMatch[1]) * 1.609;
  if (lower.includes('mile')) return 1.6;
  return null;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = parseRaceDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function weeksUntilRace(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const raceDate = parseRaceDate(dateStr);
  if (!raceDate) return 4;
  const ms = raceDate.getTime() - today.getTime();
  const weeks = Math.floor(ms / (7 * 24 * 3600 * 1000));
  return Math.max(4, Math.min(20, weeks));
}

function pickDistanceAndroid(
  distances: string[],
  onPick: (d: string) => void,
): void {
  Alert.alert('Select Distance', 'Which distance are you training for?', [
    ...distances.map((d) => ({ text: d, onPress: () => onPick(d) })),
    { text: 'Cancel', style: 'cancel' },
  ]);
}

export default function RaceEventScreen() {
  const { raceId } = useLocalSearchParams<{ raceId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const cachedResult: RaceSearchResult | null = raceId ? getCachedRace(raceId) : null;

  const [generating, setGenerating] = useState(false);
  const [savingRace, setSavingRace] = useState(false);
  const [distances, setDistances] = useState<string[]>(cachedResult?.distances ?? []);
  const [loadingDistances, setLoadingDistances] = useState(true);

  const result = cachedResult ? { ...cachedResult, distances } : null;

  useEffect(() => {
    if (!raceId) return;
    let cancelled = false;
    setLoadingDistances(true);
    fetchRaceDistances(raceId).then((fetched) => {
      if (!cancelled && fetched.length > 0) setDistances(fetched);
      if (!cancelled) setLoadingDistances(false);
    });
    return () => {
      cancelled = true;
    };
  }, [raceId]);

  if (!result) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Race Details</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>Race not found. Go back and try again.</Text>
        </View>
      </SafeAreaView>
    );
  }

  function startTrainFlow(selectedDistance: string) {
    const weeks = weeksUntilRace(result!.date);
    const formattedDate = formatDate(result!.date);
    Alert.alert(
      'Build Training Plan',
      `Ozzie will build a ${weeks}-week training plan targeting ${result!.name} on ${formattedDate}. This will replace your current plan. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Build Plan',
          onPress: () => generatePlan(selectedDistance, weeks),
        },
      ],
    );
  }

  async function generatePlan(selectedDistance: string, weeks: number) {
    setGenerating(true);
    try {
      const parsedRaceDate = parseRaceDate(result!.date);
      // parseRaceDate returns local midnight — format locally, since
      // toISOString() would shift the date a day for UTC+ timezones.
      const isoRaceDate = parsedRaceDate ? format(parsedRaceDate, 'yyyy-MM-dd') : null;

      const { data, error } = await supabase.functions.invoke('ozzie-generate-plan', {
        body: {
          raceTarget: {
            raceName: result!.name,
            raceDate: isoRaceDate,
            distance: selectedDistance,
            weeksOut: weeks,
          },
          force: true,
        },
      });
      if (error) {
        const message = await extractFunctionErrorMessage(error);
        Alert.alert('Plan generation failed', message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['daily-summary'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-month'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      const sessions = data?.sessions ?? [];
      router.dismissAll();
      router.replace({
        pathname: '/plan-preview',
        params: { sessions: JSON.stringify(sessions) },
      });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to generate plan. Try again.');
    } finally {
      setGenerating(false);
    }
  }

  function pickDistance(onPick: (distance: string) => void, fallback = 'Running') {
    const available = result!.distances;
    if (available.length === 0) {
      onPick(fallback);
      return;
    }
    if (available.length === 1) {
      onPick(available[0]);
      return;
    }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Select Distance',
          message: 'Which distance are you training for?',
          options: [...available, 'Cancel'],
          cancelButtonIndex: available.length,
        },
        (idx) => {
          if (idx < available.length) {
            onPick(available[idx]);
          }
        },
      );
    } else {
      pickDistanceAndroid(available, onPick);
    }
  }

  function handleTrainPress() {
    pickDistance(startTrainFlow);
  }

  function handleAddToMyRaces() {
    if (!userId) {
      Alert.alert('Sign in required', 'Sign in to save races to your race hub.');
      return;
    }
    const parsedDate = parseRaceDate(result!.date);
    if (!parsedDate) {
      Alert.alert('Missing date', "This event doesn't have a confirmed date yet, so it can't be saved.");
      return;
    }
    pickDistance((selectedDistance) => void saveRace(selectedDistance, parsedDate));
  }

  async function saveRace(selectedDistance: string, parsedDate: Date) {
    setSavingRace(true);
    try {
      await createRaceEvent(userId!, {
        name: result!.name,
        eventDate: format(parsedDate, 'yyyy-MM-dd'),
        distanceKm: distanceLabelToKm(selectedDistance),
        location: result!.city ? `${result!.city}, ${result!.state}` : result!.state || null,
        raceUrl: result!.url || null,
        notes: null,
      });
      queryClient.invalidateQueries({ queryKey: ['races-upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['races-past'] });
      Alert.alert('Race saved 🎉', `${result!.name} is in your race hub.`, [
        { text: 'Stay here', style: 'cancel' },
        {
          text: 'View My Races',
          onPress: () => {
            router.dismissAll();
            router.replace('/races');
          },
        },
      ]);
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setSavingRace(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Race Details" />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.heroSection}>
          <Text style={styles.heroName}>{result.name}</Text>
          {(result.city || result.state) ? (
            <Text style={styles.heroLocation}>
              📍 {result.city ? `${result.city}, ${result.state}` : result.state}
            </Text>
          ) : null}
          {result.date ? (
            <View style={styles.datePill}>
              <Text style={styles.datePillText}>📅 {formatDate(result.date)}</Text>
            </View>
          ) : null}
        </View>

        {result.distances.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DISTANCES</Text>
            <View style={styles.badgeRow}>
              {result.distances.map((d) => (
                <View key={d} style={styles.badge}>
                  <Text style={styles.badgeText}>{d}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : loadingDistances ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DISTANCES</Text>
            <ActivityIndicator color={Colors.teal} style={{ alignSelf: 'flex-start' }} />
          </View>
        ) : null}

        {result.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ABOUT</Text>
            <Text style={styles.descriptionText}>{stripHtml(result.description)}</Text>
          </View>
        ) : null}

        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={styles.trainBtn}
            onPress={handleTrainPress}
            disabled={generating}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Train for this event"
            accessibilityState={{ disabled: generating, busy: generating }}
          >
            {generating ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.trainBtnText}>Train for This Event →</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addBtn}
            onPress={handleAddToMyRaces}
            disabled={savingRace}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Add to my races"
            accessibilityState={{ disabled: savingRace, busy: savingRace }}
          >
            {savingRace ? (
              <ActivityIndicator color={Colors.teal} />
            ) : (
              <Text style={styles.addBtnText}>Add to My Races</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {generating ? (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator color={Colors.teal} size="large" />
            <Text style={styles.loadingText}>Building your {result.name} training plan...</Text>
          </View>
        </View>
      ) : null}
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backText: { color: Colors.teal, fontSize: 22, fontWeight: '700' },
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  scroll: { padding: 20, paddingBottom: 48, gap: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorText: { color: Colors.textMuted, fontSize: 15, textAlign: 'center' },

  heroSection: { gap: 8 },
  heroName: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 32,
  },
  heroLocation: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 20,
  },
  datePill: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 4,
  },
  datePillText: { color: Colors.teal, fontSize: 13, fontWeight: '700' },

  section: { gap: 8 },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
  },
  badgeText: { color: Colors.teal, fontSize: 13, fontWeight: '700' },
  descriptionText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },

  ctaSection: { gap: 12, marginTop: 8 },
  trainBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  trainBtnText: { color: '#000', fontSize: 16, fontWeight: '900' },
  addBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    backgroundColor: Colors.surfaceTeal,
  },
  addBtnText: { color: Colors.teal, fontSize: 15, fontWeight: '700' },

  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(6,9,18,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 16,
    maxWidth: 280,
  },
  loadingText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
  },
});
