import { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/colors';
import { useTodayLog } from '@/hooks/useTodayLog';
import type { MealType, QuickWorkoutType } from '@/types/log';
import { searchFoodByName, type FoodItemResult } from '@/services/food-lookup';
import { useNutritionCoaching } from '@/hooks/useNutritionCoaching';
import { useWeightLog } from '@/hooks/useWeightLog';
import { kgToLb, lbToKg } from '@/services/body-metrics';
import { estimateMealFromPhoto } from '@/services/meal-photo';

const WORKOUT_TYPES: { value: QuickWorkoutType; label: string }[] = [
  { value: 'run', label: 'Run' },
  { value: 'lift', label: 'Lift' },
  { value: 'cross', label: 'Cross' },
  { value: 'race', label: 'Race' },
];

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

function formatSessionType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return 'Try again.';
}

export default function LogTab() {
  const { data, isLoading, error, logWorkout, logFood } = useTodayLog();
  const { data: nutrition } = useNutritionCoaching();
  const { data: weightSummary, log: logWeightMutation } = useWeightLog();
  const [openSection, setOpenSection] = useState<'workout' | 'food' | 'weight' | null>(null);
  const router = useRouter();
  const params = useLocalSearchParams<{
    scannedFoodId?: string;
    scannedName?: string;
    scannedCalories?: string;
    scannedProtein?: string;
    scannedCarbs?: string;
    scannedFat?: string;
  }>();

  const [workoutType, setWorkoutType] = useState<QuickWorkoutType>('run');
  const [minutes, setMinutes] = useState('');
  const [distance, setDistance] = useState('');
  const [workoutNotes, setWorkoutNotes] = useState('');

  const [foodName, setFoodName] = useState('');
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [quantityG, setQuantityG] = useState('100');
  const [selectedFoodItem, setSelectedFoodItem] = useState<FoodItemResult | null>(null);
  const [foodResults, setFoodResults] = useState<FoodItemResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [photoConfidenceNote, setPhotoConfidenceNote] = useState<string | null>(null);

  const [weightInput, setWeightInput] = useState('');
  const [weightUnit, setWeightUnit] = useState<'lb' | 'kg'>('lb');

  useEffect(() => {
    if (!params.scannedFoodId) return;
    setOpenSection('food');
    setFoodName(params.scannedName ?? '');
    setCalories(params.scannedCalories ?? '');
    setProtein(params.scannedProtein ?? '');
    setCarbs(params.scannedCarbs ?? '');
    setFat(params.scannedFat ?? '');
    setQuantityG('100');
    setSelectedFoodItem({
      id: params.scannedFoodId,
      name: params.scannedName ?? '',
      brand: null,
      caloriesPer100g: Number(params.scannedCalories ?? 0),
      proteinG: params.scannedProtein ? Number(params.scannedProtein) : null,
      carbsG: params.scannedCarbs ? Number(params.scannedCarbs) : null,
      fatG: params.scannedFat ? Number(params.scannedFat) : null,
      barcode: null,
    });
    router.setParams({
      scannedFoodId: undefined,
      scannedName: undefined,
      scannedCalories: undefined,
      scannedProtein: undefined,
      scannedCarbs: undefined,
      scannedFat: undefined,
    });
  }, [params.scannedFoodId]);

  function handleFoodNameChange(text: string) {
    setFoodName(text);
    setSelectedFoodItem(null);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);

    if (text.trim().length < 2) {
      setFoodResults([]);
      return;
    }

    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchFoodByName(text);
        setFoodResults(results);
      } catch {
        setFoodResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  function handlePickFoodResult(item: FoodItemResult) {
    setSelectedFoodItem(item);
    setFoodName(item.name);
    setQuantityG('100');
    setCalories(String(item.caloriesPer100g));
    setProtein(item.proteinG != null ? String(item.proteinG) : '');
    setCarbs(item.carbsG != null ? String(item.carbsG) : '');
    setFat(item.fatG != null ? String(item.fatG) : '');
    setFoodResults([]);
  }

  async function handleTakeMealPhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'OSPREY needs camera access to photograph meals.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]?.base64) return;

    setAnalyzingPhoto(true);
    setPhotoConfidenceNote(null);
    setSelectedFoodItem(null);
    setFoodResults([]);

    try {
      const estimate = await estimateMealFromPhoto(result.assets[0].base64);
      if (!estimate.isFood) {
        Alert.alert("Hmm, didn't catch food there", 'Try another photo, or log it manually.');
        return;
      }
      setFoodName(estimate.name);
      setCalories(String(estimate.calories));
      setProtein(String(estimate.proteinG));
      setCarbs(String(estimate.carbsG));
      setFat(String(estimate.fatG));
      setPhotoConfidenceNote(estimate.confidenceNote);
    } catch (err) {
      Alert.alert('Photo analysis failed', getErrorMessage(err));
    } finally {
      setAnalyzingPhoto(false);
    }
  }

  function handleQuantityChange(text: string) {
    setQuantityG(text);
    if (!selectedFoodItem) return;
    const grams = Number(text) || 0;
    const ratio = grams / 100;
    setCalories(String(Math.round(selectedFoodItem.caloriesPer100g * ratio)));
    if (selectedFoodItem.proteinG != null) setProtein(String(Math.round(selectedFoodItem.proteinG * ratio * 10) / 10));
    if (selectedFoodItem.carbsG != null) setCarbs(String(Math.round(selectedFoodItem.carbsG * ratio * 10) / 10));
    if (selectedFoodItem.fatG != null) setFat(String(Math.round(selectedFoodItem.fatG * ratio * 10) / 10));
  }

  function resetWorkoutForm() {
    setWorkoutType('run');
    setMinutes('');
    setDistance('');
    setWorkoutNotes('');
  }

  function resetFoodForm() {
    setFoodName('');
    setMealType('lunch');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setQuantityG('100');
    setSelectedFoodItem(null);
    setFoodResults([]);
    setPhotoConfidenceNote(null);
  }

  async function handleSaveWorkout() {
    const mins = Number(minutes);
    if (!mins || mins <= 0) {
      Alert.alert('Add a duration', 'How many minutes was this workout?');
      return;
    }
    try {
      await logWorkout.mutateAsync({
        sessionType: workoutType,
        minutes: mins,
        distanceMiles: distance ? Number(distance) : undefined,
        notes: workoutNotes,
      });
      resetWorkoutForm();
      setOpenSection(null);
    } catch (err) {
      Alert.alert('Save failed', getErrorMessage(err));
    }
  }

  async function handleSaveFood() {
    const cals = Number(calories);
    if (!foodName.trim()) {
      Alert.alert('Add a name', 'What did you eat?');
      return;
    }
    if (!cals || cals <= 0) {
      Alert.alert('Add calories', 'Roughly how many calories?');
      return;
    }
    try {
      await logFood.mutateAsync({
        name: foodName.trim(),
        mealType,
        calories: cals,
        proteinG: protein ? Number(protein) : undefined,
        carbsG: carbs ? Number(carbs) : undefined,
        fatG: fat ? Number(fat) : undefined,
        foodItemId: selectedFoodItem?.id || undefined,
        quantityG: selectedFoodItem ? Number(quantityG) || 100 : undefined,
      });
      resetFoodForm();
      setOpenSection(null);
    } catch (err) {
      Alert.alert('Save failed', getErrorMessage(err));
    }
  }

  async function handleSaveWeight() {
    const value = Number(weightInput);
    if (!value || value <= 0) {
      Alert.alert('Add your weight', 'Enter a number to log today\'s weigh-in.');
      return;
    }
    const weightKg = weightUnit === 'lb' ? lbToKg(value) : value;
    try {
      await logWeightMutation.mutateAsync({ weightKg });
      setWeightInput('');
      setOpenSection(null);
    } catch (err) {
      Alert.alert('Save failed', getErrorMessage(err));
    }
  }

  const hasEntries = (data?.workouts.length ?? 0) > 0 || (data?.food.length ?? 0) > 0;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Log</Text>
          <Text style={styles.subtitle}>Quick workout and nutrition logging.</Text>

          {nutrition ? (
            <View style={styles.nutritionCard}>
              <Text style={styles.cardLabel}>NUTRITION TODAY</Text>
              <View style={styles.macroRow}>
                <Text style={styles.macroValue}>
                  {nutrition.loggedToday.calories} / {nutrition.target.calories}
                </Text>
                <Text style={styles.macroUnit}>cal</Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(
                        100,
                        (nutrition.loggedToday.calories / Math.max(1, nutrition.target.calories)) * 100,
                      )}%`,
                    },
                  ]}
                />
              </View>
              <View style={styles.macroChipRow}>
                <Text style={styles.macroChip}>
                  P {Math.round(nutrition.loggedToday.proteinG)}/{nutrition.target.proteinG}g
                </Text>
                <Text style={styles.macroChip}>
                  C {Math.round(nutrition.loggedToday.carbsG)}/{nutrition.target.carbsG}g
                </Text>
                <Text style={styles.macroChip}>
                  F {Math.round(nutrition.loggedToday.fatG)}/{nutrition.target.fatG}g
                </Text>
              </View>
              {nutrition.tip ? <Text style={styles.tipText}>{nutrition.tip}</Text> : null}
            </View>
          ) : null}

          {isLoading ? (
            <ActivityIndicator color={Colors.teal} style={{ marginTop: 24 }} />
          ) : error ? (
            <Text style={styles.errorText}>Couldn&apos;t load today&apos;s log.</Text>
          ) : (
            <View style={styles.todayCard}>
              <Text style={styles.cardLabel}>TODAY</Text>
              {!hasEntries ? (
                <Text style={styles.emptyText}>Nothing logged yet today.</Text>
              ) : (
                <>
                  {data?.workouts.map((w) => (
                    <View key={w.id} style={styles.entryRow}>
                      <Text style={styles.entryPrimary}>
                        {formatSessionType(w.sessionType)}
                        {w.verified ? <Text style={styles.verifiedBadge}>  ✓ Verified</Text> : null}
                      </Text>
                      <Text style={styles.entrySecondary}>
                        {w.durationMinutes} min
                        {w.distanceMiles ? ` · ${w.distanceMiles} mi` : ''} · {formatTime(w.startedAt)}
                      </Text>
                    </View>
                  ))}
                  {data?.food.map((f) => (
                    <View key={f.id} style={styles.entryRow}>
                      <Text style={styles.entryPrimary}>{f.name}</Text>
                      <Text style={styles.entrySecondary}>
                        {f.calories ?? 0} cal · {f.mealType ?? 'meal'} · {formatTime(f.loggedAt)}
                      </Text>
                    </View>
                  ))}
                  {data && data.totalCalories > 0 ? (
                    <Text style={styles.totalText}>{data.totalCalories} cal logged today</Text>
                  ) : null}
                </>
              )}
            </View>
          )}

          {/* Log a Workout */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => setOpenSection(openSection === 'workout' ? null : 'workout')}
          >
            <Text style={styles.actionTitle}>🏃 Log a Workout</Text>
            <Text style={styles.actionChevron}>{openSection === 'workout' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'workout' ? (
            <View style={styles.form}>
              <View style={styles.chipRow}>
                {WORKOUT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.chip, workoutType === t.value && styles.chipActive]}
                    onPress={() => setWorkoutType(t.value)}
                  >
                    <Text
                      style={[styles.chipText, workoutType === t.value && styles.chipTextActive]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>MINUTES</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    placeholder="30"
                    placeholderTextColor={Colors.textMuted}
                    value={minutes}
                    onChangeText={setMinutes}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>DISTANCE (MI)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    placeholder="optional"
                    placeholderTextColor={Colors.textMuted}
                    value={distance}
                    onChangeText={setDistance}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>NOTES</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="How did it feel?"
                placeholderTextColor={Colors.textMuted}
                value={workoutNotes}
                onChangeText={setWorkoutNotes}
                multiline
              />

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveWorkout}
                disabled={logWorkout.isPending}
              >
                {logWorkout.isPending ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Workout</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Log Food */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => setOpenSection(openSection === 'food' ? null : 'food')}
          >
            <Text style={styles.actionTitle}>🍽 Log Food</Text>
            <Text style={styles.actionChevron}>{openSection === 'food' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'food' ? (
            <View style={styles.form}>
              <View style={styles.foodNameHeader}>
                <Text style={styles.fieldLabel}>WHAT DID YOU EAT?</Text>
                <View style={styles.scanBtnRow}>
                  <TouchableOpacity
                    style={styles.scanBtn}
                    onPress={handleTakeMealPhoto}
                    disabled={analyzingPhoto}
                  >
                    <Text style={styles.scanBtnText}>📸 Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.scanBtn}
                    onPress={() => router.push('/food-scanner')}
                  >
                    <Text style={styles.scanBtnText}>📷 Scan</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Grilled chicken bowl"
                placeholderTextColor={Colors.textMuted}
                value={foodName}
                onChangeText={handleFoodNameChange}
              />

              {analyzingPhoto ? (
                <View style={styles.analyzingRow}>
                  <ActivityIndicator color={Colors.teal} />
                  <Text style={styles.analyzingText}>Ozzie's looking at your photo...</Text>
                </View>
              ) : null}

              {photoConfidenceNote ? (
                <Text style={styles.tipText}>{photoConfidenceNote}</Text>
              ) : null}

              {searching ? (
                <ActivityIndicator color={Colors.teal} style={{ alignSelf: 'flex-start' }} />
              ) : null}

              {foodResults.length > 0 ? (
                <View style={styles.resultsBox}>
                  {foodResults.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.resultRow}
                      onPress={() => handlePickFoodResult(item)}
                    >
                      <Text style={styles.resultName}>
                        {item.name}
                        {item.brand ? ` · ${item.brand}` : ''}
                      </Text>
                      <Text style={styles.resultMeta}>{item.caloriesPer100g} cal / 100g</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              {selectedFoodItem ? (
                <>
                  <Text style={styles.fieldLabel}>QUANTITY (G)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={quantityG}
                    onChangeText={handleQuantityChange}
                  />
                </>
              ) : null}

              <View style={styles.chipRow}>
                {MEAL_TYPES.map((m) => (
                  <TouchableOpacity
                    key={m.value}
                    style={[styles.chip, mealType === m.value && styles.chipActive]}
                    onPress={() => setMealType(m.value)}
                  >
                    <Text style={[styles.chipText, mealType === m.value && styles.chipTextActive]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>CALORIES</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                placeholder="450"
                placeholderTextColor={Colors.textMuted}
                value={calories}
                onChangeText={setCalories}
              />

              <View style={styles.fieldRow}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>PROTEIN (G)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    placeholder="optional"
                    placeholderTextColor={Colors.textMuted}
                    value={protein}
                    onChangeText={setProtein}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>CARBS (G)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    placeholder="optional"
                    placeholderTextColor={Colors.textMuted}
                    value={carbs}
                    onChangeText={setCarbs}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>FAT (G)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    placeholder="optional"
                    placeholderTextColor={Colors.textMuted}
                    value={fat}
                    onChangeText={setFat}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveFood}
                disabled={logFood.isPending}
              >
                {logFood.isPending ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Food</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Log Weight */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => setOpenSection(openSection === 'weight' ? null : 'weight')}
          >
            <Text style={styles.actionTitle}>⚖️ Log Weight</Text>
            <Text style={styles.actionChevron}>{openSection === 'weight' ? '−' : '+'}</Text>
          </TouchableOpacity>

          {openSection === 'weight' ? (
            <View style={styles.form}>
              {weightSummary?.latestKg != null ? (
                <Text style={styles.weightSummaryText}>
                  Last logged: {kgToLb(weightSummary.latestKg)} lb
                  {weightSummary.kgPerWeek != null && weightSummary.direction
                    ? ` · ${weightSummary.direction} ${Math.abs(kgToLb(weightSummary.kgPerWeek))} lb/wk`
                    : ''}
                </Text>
              ) : (
                <Text style={styles.weightSummaryText}>
                  Log your weight a few times a week and Ozzie auto-tunes your calorie targets to the trend.
                </Text>
              )}

              <View style={styles.chipRow}>
                {(['lb', 'kg'] as const).map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.chip, weightUnit === u && styles.chipActive]}
                    onPress={() => setWeightUnit(u)}
                  >
                    <Text style={[styles.chipText, weightUnit === u && styles.chipTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>TODAY&apos;S WEIGHT ({weightUnit})</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder={weightUnit === 'lb' ? 'e.g. 168.4' : 'e.g. 76.4'}
                placeholderTextColor={Colors.textMuted}
                value={weightInput}
                onChangeText={setWeightInput}
              />

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveWeight}
                disabled={logWeightMutation.isPending}
              >
                {logWeightMutation.isPending ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Weight</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scrollContent: { padding: 28, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.textMuted, lineHeight: 20, marginBottom: 20 },
  errorText: { fontSize: 13, color: Colors.red, marginBottom: 16 },
  nutritionCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 8,
  },
  macroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  macroValue: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  macroUnit: { fontSize: 13, color: Colors.textMuted, fontWeight: '600' },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.teal, borderRadius: 3 },
  macroChipRow: { flexDirection: 'row', gap: 12 },
  macroChip: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  tipText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18, marginTop: 4 },
  todayCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    gap: 10,
  },
  cardLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1 },
  emptyText: { fontSize: 13, color: Colors.textMuted },
  entryRow: { gap: 2 },
  entryPrimary: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  verifiedBadge: { fontSize: 11, fontWeight: '700', color: Colors.teal },
  entrySecondary: { fontSize: 12, color: Colors.textSecondary },
  totalText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.teal,
    marginTop: 4,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  actionTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  actionChevron: { fontSize: 18, fontWeight: '800', color: Colors.teal },
  form: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    marginTop: -4,
    marginBottom: 16,
    gap: 10,
  },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  chipActive: { backgroundColor: Colors.surfaceTeal, borderColor: Colors.borderTeal },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: Colors.teal },
  fieldRow: { flexDirection: 'row', gap: 10 },
  field: { flex: 1 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginTop: 4,
    marginBottom: 6,
  },
  weightSummaryText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  notesInput: { minHeight: 60, textAlignVertical: 'top' },
  foodNameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  scanBtnRow: { flexDirection: 'row', gap: 8 },
  scanBtn: {
    backgroundColor: Colors.surfaceTeal,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  scanBtnText: { fontSize: 12, fontWeight: '700', color: Colors.teal },
  analyzingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  analyzingText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  resultsBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  resultRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resultName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  resultMeta: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  saveBtn: {
    marginTop: 6,
    backgroundColor: Colors.teal,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: '#000' },
});
