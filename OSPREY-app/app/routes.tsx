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
import { Theme, Radius, BorderWidth, StatusPalette } from '@/constants/theme';
import { Button } from '@/components/ui';
import FieldError from '@/components/FieldError';
import ScreenHeader from '@/components/ScreenHeader';
import { useSavedRoutes } from '@/hooks/useSavedRoutes';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { formatDistanceKm, kmToMiles, milesToKm } from '@/services/units';
import { SUGGESTED_ROUTE_TAGS, type SavedRoute } from '@/types/routes';
import { friendlyError } from '@/utils/errorMessage';

export default function RoutesScreen() {
  const { data: routes, isLoading, error, addRoute, removeRoute } = useSavedRoutes();
  const { units } = useUnitPreference();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [distanceMiles, setDistanceMiles] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [customTag, setCustomTag] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();

  function resetForm() {
    setName('');
    setDistanceMiles('');
    setNotes('');
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
    if (parsedDistance != null && (!Number.isFinite(parsedDistance) || parsedDistance <= 0)) {
      Alert.alert('Invalid distance', 'Enter a number like 3.1, or leave it blank.');
      return;
    }
    try {
      await addRoute.mutateAsync({
        name: name.trim(),
        tags: [...selectedTags],
        distanceMiles: parsedDistance != null ? (units === 'metric' ? kmToMiles(parsedDistance) : parsedDistance) : undefined,
        notes: notes.trim() || undefined,
      });
      resetForm();
    } catch (err) {
      Alert.alert('Save failed', friendlyError(err, 'Try again.'));
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
                placeholderTextColor={Theme.textMut}
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
                placeholderTextColor={Theme.textMut}
                value={distanceMiles}
                onChangeText={setDistanceMiles}
                accessibilityLabel={`Distance in ${units === 'metric' ? 'kilometers' : 'miles'}, optional`}
              />

              <Text style={styles.fieldLabel}>NOTES (OPTIONAL)</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                placeholder="Water fountain at mile 2, sketchy after dark…"
                placeholderTextColor={Theme.textMut}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={2}
                accessibilityLabel="Route notes, optional"
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
                  placeholderTextColor={Theme.textMut}
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

              <Button
                onPress={handleSave}
                disabled={addRoute.isPending}
                busy={addRoute.isPending}
                accessibilityLabel="Save route"
                style={styles.saveBtn}
              >
                {addRoute.isPending ? <ActivityIndicator color={Theme.ink} /> : 'Save Route'}
              </Button>
            </View>
          ) : null}

          {isLoading ? (
            <ActivityIndicator color={Theme.accent} style={{ marginTop: 32 }} />
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
                  {route.notes ? (
                    <Text style={styles.routeNotes}>{route.notes}</Text>
                  ) : null}
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
  container: { flex: 1, backgroundColor: Theme.ink },
  add: { color: Theme.accent, fontSize: 24, fontWeight: '700' },
  scroll: { padding: 20, paddingBottom: 48, gap: 10 },
  subtitle: { color: Theme.textMut, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  empty: { color: Theme.textMut, fontSize: 14, lineHeight: 20, marginTop: 8 },
  errorText: { color: StatusPalette.danger, fontSize: 14, marginTop: 16 },

  formCard: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 16,
    gap: 8,
    marginBottom: 6,
  },
  formTitle: { color: Theme.text, fontSize: 15, fontWeight: '800', marginBottom: 2 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Theme.textMut,
    letterSpacing: 0.8,
    marginTop: 6,
  },
  inputError: { borderColor: StatusPalette.danger },
  input: {
    backgroundColor: Theme.ink,
    borderWidth: 1,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Theme.text,
    fontSize: 15,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Theme.line,
    backgroundColor: Theme.ink,
  },
  // Border-only, matching challenges.tsx. A Theme.panel fill here would make
  // the ACTIVE chip blend into the Theme.panel formCard behind it while the
  // inactive (ink) chips stand off it — inverting the emphasis.
  chipActive: { borderColor: Theme.accent },
  chipText: { color: Theme.textMut, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: Theme.accent },
  customTagRow: { flexDirection: 'row', gap: 8, marginTop: 4, alignItems: 'center' },
  customTagAddBtn: {
    backgroundColor: Theme.panel,
    borderWidth: 1,
    borderColor: Theme.accent,
    borderRadius: Radius.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  customTagAddText: { color: Theme.accent, fontSize: 13, fontWeight: '700' },
  // Only what <Button> does not already provide. Its fill, border, radius,
  // ink label and 0.5-disabled all come from the primitive now; paddingVertical
  // is kept at 14 because the primitive defaults to 12 and that would shrink
  // this button by 4px against the form around it.
  saveBtn: { marginTop: 10, paddingVertical: 14 },

  routeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 14,
    gap: 10,
  },
  routeName: { color: Theme.text, fontSize: 15, fontWeight: '700' },
  routeMeta: { color: Theme.textMut, fontSize: 12, marginTop: 2 },
  routeNotes: { color: Theme.textSoft, fontSize: 13, lineHeight: 18, marginTop: 6 },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  routeTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  routeTagChip: {
    backgroundColor: Theme.ink,
    borderRadius: Radius.card,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  routeTagText: { fontSize: 11, fontWeight: '700', color: Theme.accent },
  deleteText: { color: Theme.textMut, fontSize: 13, fontWeight: '700' },
});
