import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '@/constants/colors';
import FieldError from '@/components/FieldError';
import ScreenHeader from '@/components/ScreenHeader';
import { useSavedRoutes } from '@/hooks/useSavedRoutes';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { formatDistanceKm, kmToMiles, milesToKm } from '@/services/units';
import { SUGGESTED_ROUTE_TAGS, type SavedRoute } from '@/types/routes';

export default function RoutesScreen() {
  const { data: routes, isLoading, error, addRoute, removeRoute } = useSavedRoutes();
  const { units } = useUnitPreference();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [distanceMiles, setDistanceMiles] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [customTag, setCustomTag] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();

  function resetForm() {
    setName('');
    setDistanceMiles('');
    setSelectedTags(new Set());
    setCustomTag('');
    setNameError(undefined);
    setShowForm(false);
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }

  function addCustomTag() {
    const tag = customTag.trim().toLowerCase();
    if (!tag) return;
    setSelectedTags((prev) => new Set(prev).add(tag));
    setCustomTag('');
  }

  async function handleSave() {
    if (!name.trim()) {
      setNameError('What do you call this route?');
      return;
    }
    const parsedDistance = distanceMiles ? Number(distanceMiles) : undefined;
    if (parsedDistance != null && !Number.isFinite(parsedDistance)) {
      Alert.alert('Invalid distance', 'Enter a number like 3.1, or leave it blank.');
      return;
    }
    try {
      await addRoute.mutateAsync({
        name: name.trim(),
        tags: [...selectedTags],
        distanceMiles: parsedDistance != null ? (units === 'metric' ? kmToMiles(parsedDistance) : parsedDistance) : undefined,
      });
      resetForm();
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Try again.');
    }
  }

  function handleDelete(route: SavedRoute) {
    Alert.alert('Delete route?', `Remove "${route.name}" from your saved routes?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeRoute.mutate(route.id) },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Saved Routes"
        right={
          <TouchableOpacity
            onPress={() => setShowForm((v) => !v)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={showForm ? 'Close new route form' : 'Add a route'}
          >
            <Text style={styles.add}>{showForm ? '−' : '+'}</Text>
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.subtitle}>
            Save your go-to routes so Ozzie can recommend one on hot or rainy days — the shaded loop,
            the indoor track, whatever actually works for you.
          </Text>

          {showForm ? (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>New route</Text>

              <TextInput
                style={[styles.input, nameError ? styles.inputError : null]}
                placeholder="Route name (e.g. Riverside Loop)"
                placeholderTextColor={Colors.textMuted}
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  setNameError(undefined);
                }}
                accessibilityLabel="Route name"
              />
              <FieldError message={nameError} />

              <Text style={styles.fieldLabel}>
                DISTANCE ({units === 'metric' ? 'KM' : 'MI'}, OPTIONAL)
              </Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder="e.g. 3.1"
                placeholderTextColor={Colors.textMuted}
                value={distanceMiles}
                onChangeText={setDistanceMiles}
                accessibilityLabel={`Distance in ${units === 'metric' ? 'kilometers' : 'miles'}, optional`}
              />

              <Text style={styles.fieldLabel}>TAGS</Text>
              <View style={styles.chipRow}>
                {SUGGESTED_ROUTE_TAGS.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.chip, selectedTags.has(tag) && styles.chipActive]}
                    onPress={() => toggleTag(tag)}
                    accessibilityRole="checkbox"
                    accessibilityLabel={tag}
                    accessibilityState={{ checked: selectedTags.has(tag) }}
                  >
                    <Text style={[styles.chipText, selectedTags.has(tag) && styles.chipTextActive]}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
                {[...selectedTags]
                  .filter((t) => !(SUGGESTED_ROUTE_TAGS as readonly string[]).includes(t))
                  .map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.chip, styles.chipActive]}
                      onPress={() => toggleTag(tag)}
                      accessibilityRole="checkbox"
                      accessibilityLabel={tag}
                      accessibilityState={{ checked: true }}
                    >
                      <Text style={[styles.chipText, styles.chipTextActive]}>{tag}</Text>
                    </TouchableOpacity>
                  ))}
              </View>
              <View style={styles.customTagRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Custom tag…"
                  placeholderTextColor={Colors.textMuted}
                  value={customTag}
                  onChangeText={setCustomTag}
                  onSubmitEditing={addCustomTag}
                  returnKeyType="done"
                  accessibilityLabel="Custom tag"
                />
                <TouchableOpacity
                  style={styles.customTagAddBtn}
                  onPress={addCustomTag}
                  accessibilityRole="button"
                  accessibilityLabel="Add custom tag"
                >
                  <Text style={styles.customTagAddText}>Add</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={addRoute.isPending}
                accessibilityRole="button"
                accessibilityLabel="Save route"
                accessibilityState={{ disabled: addRoute.isPending, busy: addRoute.isPending }}
              >
                {addRoute.isPending ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Route</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          {isLoading ? (
            <ActivityIndicator color={Colors.teal} style={{ marginTop: 32 }} />
          ) : error ? (
            <Text style={styles.errorText}>Couldn&apos;t load your routes.</Text>
          ) : !routes || routes.length === 0 ? (
            !showForm ? (
              <Text style={styles.empty}>
                No saved routes yet. Tap + to add your favorite shaded loop, indoor track, or trail —
                Ozzie will recommend it on hot or rainy days.
              </Text>
            ) : null
          ) : (
            routes.map((route) => (
              <View key={route.id} style={styles.routeCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeName}>{route.name}</Text>
                  <Text style={styles.routeMeta}>
                    {route.distanceMiles != null
                      ? formatDistanceKm(milesToKm(route.distanceMiles), units)
                      : 'Distance not set'}
                  </Text>
                  {route.tags.length > 0 ? (
                    <View style={styles.routeTagRow}>
                      {route.tags.map((tag) => (
                        <View key={tag} style={styles.routeTagChip}>
                          <Text style={styles.routeTagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => handleDelete(route)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${route.name}`}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  add: { color: Colors.teal, fontSize: 24, fontWeight: '700' },
  scroll: { padding: 20, paddingBottom: 48, gap: 10 },
  subtitle: { color: Colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  empty: { color: Colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 8 },
  errorText: { color: Colors.red, fontSize: 14, marginTop: 16 },

  formCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    marginBottom: 6,
  },
  formTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: 2 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginTop: 6,
  },
  inputError: { borderColor: Colors.red },
  input: {
    backgroundColor: Colors.bg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  chipActive: { backgroundColor: Colors.surfaceTeal, borderColor: Colors.borderTeal },
  chipText: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: Colors.teal },
  customTagRow: { flexDirection: 'row', gap: 8, marginTop: 4, alignItems: 'center' },
  customTagAddBtn: {
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  customTagAddText: { color: Colors.teal, fontSize: 13, fontWeight: '700' },
  saveBtn: {
    marginTop: 10,
    backgroundColor: Colors.teal,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtnText: { color: '#000', fontSize: 14, fontWeight: '800' },

  routeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  routeName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  routeMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  routeTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  routeTagChip: {
    backgroundColor: Colors.surfaceTeal,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  routeTagText: { fontSize: 11, fontWeight: '700', color: Colors.teal },
  deleteText: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
});
