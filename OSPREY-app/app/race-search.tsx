import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { Theme, Radius, BorderWidth } from '@/constants/theme';
import { parseRaceDate, searchRaces, type RaceSearchResult } from '@/services/race-search';

const DISTANCE_FILTERS = ['All', '5K', '10K', 'Half', 'Full'] as const;
type DistanceFilter = (typeof DISTANCE_FILTERS)[number];

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = parseRaceDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function matchesFilter(result: RaceSearchResult, filter: DistanceFilter): boolean {
  if (filter === 'All') return true;
  if (filter === 'Full') return result.distances.some((d) => d === 'Marathon');
  if (filter === 'Half') return result.distances.some((d) => d === 'Half');
  return result.distances.includes(filter);
}

interface RaceCardProps {
  item: RaceSearchResult;
  onPress: () => void;
}

function RaceCard({ item, onPress }: RaceCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.city ? `${item.city}, ${item.state}` : item.state || 'Location TBD'}, ${formatDate(item.date)}`}
    >
      <View style={styles.cardMain}>
        <Text style={styles.cardName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.cardMeta}>
          <Text style={styles.metaIcon}>📍 </Text>
          {item.city ? `${item.city}, ${item.state}` : item.state || 'Location TBD'}
        </Text>
        <Text style={styles.cardMeta}>
          <Text style={styles.metaIcon}>📅 </Text>
          {formatDate(item.date)}
        </Text>
        {item.distances.length > 0 ? (
          <View style={styles.badgeRow}>
            {item.distances.map((d) => (
              <View key={d} style={styles.badge}>
                <Text style={styles.badgeText}>{d}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

export default function RaceSearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<DistanceFilter>('All');
  const [results, setResults] = useState<RaceSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      // Local date, not toISOString() — avoids excluding today's own races
      // for anyone west of UTC in the evening.
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const data = await searchRaces({
        query: q || undefined,
        startDateMin: todayStr,
      });
      if (data.length === 0 && !q) {
        setError(null);
      }
      setResults(data);
    } catch {
      setError("Couldn't load races. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runSearch('');
  }, [runSearch]);

  function handleQueryChange(text: string) {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(text);
    }, 600);
  }

  function handleRetry() {
    runSearch(query);
  }

  const filtered = results.filter((r) => matchesFilter(r, activeFilter));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>Find a Race</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.searchRow}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search races by name or city"
          placeholderTextColor={Theme.textMut}
          value={query}
          onChangeText={handleQueryChange}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search races by name or city"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
        style={styles.filterBar}
      >
        {DISTANCE_FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
            onPress={() => setActiveFilter(f)}
            accessibilityRole="button"
            accessibilityLabel={f}
            accessibilityState={{ selected: activeFilter === f }}
          >
            <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Theme.accent} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={handleRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No races found. Try a different search.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.raceId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <RaceCard
              item={item}
              onPress={() => {
                router.push({
                  pathname: '/race-event',
                  params: { raceId: item.raceId },
                });
              }}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.ink },
  // Bespoke header (kept per controller decision), styled to match
  // src/components/ScreenHeader.tsx's ink ground / accent chevron / text
  // title / line border look without swapping in that component.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: BorderWidth.card,
    borderBottomColor: Theme.line,
  },
  backBtn: { width: 44, alignItems: 'flex-start' },
  backText: { color: Theme.accent, fontSize: 24, fontWeight: '700' },
  title: { flex: 1, textAlign: 'center', color: Theme.text, fontSize: 16, fontWeight: '800' },
  headerRight: { width: 44, alignItems: 'flex-end' },
  // Text input container: Theme.ink + 1px + Theme.line (not panel/2px —
  // that treatment is reserved for card surfaces).
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: Theme.ink,
    borderWidth: 1,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    gap: 10,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, color: Theme.text, fontSize: 15 },
  filterBar: { flexShrink: 0, maxHeight: 48 },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
    paddingBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Theme.line,
    backgroundColor: Theme.ink,
  },
  // Active/selected chip treatment — accent tint reserved for this state.
  filterChipActive: {
    backgroundColor: Theme.accent + '1F',
    borderColor: Theme.accent,
  },
  filterChipText: { color: Theme.textMut, fontSize: 13, fontWeight: '700' },
  filterChipTextActive: { color: Theme.accent },
  list: { padding: 16, gap: 10, paddingBottom: 48 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 16,
    gap: 12,
  },
  cardMain: { flex: 1, gap: 4 },
  cardName: { color: Theme.accent, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  cardMeta: { color: Theme.textSoft, fontSize: 13, lineHeight: 18 },
  metaIcon: { fontSize: 12 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  // Nested inside a Theme.panel card — recedes to ink, not another panel fill.
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Theme.ink,
    borderWidth: 1,
    borderColor: Theme.line,
  },
  badgeText: { color: Theme.textSoft, fontSize: 11, fontWeight: '700' },
  chevron: { color: Theme.textMut, fontSize: 22, fontWeight: '300' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  errorText: { color: Theme.textSoft, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: Radius.card,
    backgroundColor: Theme.accent + '1F',
    borderWidth: 1,
    borderColor: Theme.accent,
  },
  retryBtnText: { color: Theme.accent, fontSize: 14, fontWeight: '700' },
  emptyText: { color: Theme.textMut, fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
