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
import { Colors } from '@/constants/colors';
import { fetchRaceDistances, parseRaceDate, searchRaces, type RaceSearchResult } from '@/services/race-search';

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
  // fetchRaceDistances returns the canonical label 'Half Marathon', not 'Half'.
  if (filter === 'Half') return result.distances.some((d) => d === 'Half Marathon');
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
  // The RunSignUp list endpoint never returns event/distance data (searchRaces'
  // `distances` is always []), so any non-"All" chip matched nothing. Distances
  // are only fetched lazily, per race, once a specific distance is selected —
  // not on every search — to avoid firing 20 extra requests per keystroke.
  const [distanceCache, setDistanceCache] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (activeFilter === 'All' || results.length === 0) return;
    const missing = results.filter((r) => !(r.raceId in distanceCache));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map(async (r) => [r.raceId, await fetchRaceDistances(r.raceId)] as const)).then(
      (pairs) => {
        if (cancelled) return;
        setDistanceCache((prev) => {
          const next = { ...prev };
          for (const [id, distances] of pairs) next[id] = distances;
          return next;
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [activeFilter, results, distanceCache]);

  const runSearch = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
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

  const enrichedResults = results.map((r) => ({
    ...r,
    distances: distanceCache[r.raceId] ?? r.distances,
  }));
  const filtered = enrichedResults.filter((r) => matchesFilter(r, activeFilter));

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
        <Text style={styles.title}>Find a Race</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.searchRow}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search races by name or city"
          placeholderTextColor={Colors.textMuted}
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
          <ActivityIndicator color={Colors.teal} size="large" />
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
  backBtn: { width: 36, alignItems: 'flex-start' },
  backText: { color: Colors.teal, fontSize: 22, fontWeight: '700' },
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    gap: 10,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 15 },
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
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  filterChipActive: {
    backgroundColor: Colors.surfaceTeal,
    borderColor: Colors.borderTeal,
  },
  filterChipText: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
  filterChipTextActive: { color: Colors.teal },
  list: { padding: 16, gap: 10, paddingBottom: 48 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  cardMain: { flex: 1, gap: 4 },
  cardName: { color: Colors.teal, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  cardMeta: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  metaIcon: { fontSize: 12 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
  },
  badgeText: { color: Colors.teal, fontSize: 11, fontWeight: '700' },
  chevron: { color: Colors.textMuted, fontSize: 22, fontWeight: '300' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  errorText: { color: Colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
  },
  retryBtnText: { color: Colors.teal, fontSize: 14, fontWeight: '700' },
  emptyText: { color: Colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
