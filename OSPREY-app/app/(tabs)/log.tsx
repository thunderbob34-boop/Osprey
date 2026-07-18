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
import Svg, { Polyline } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/colors';
import { Theme, Radius, BorderWidth } from '@/constants/theme';
import { Card } from '@/components/ui';
import FieldError from '@/components/FieldError';
import HydrationCard from '@/components/HydrationCard';
import { useRecentMeals, useTodayLog } from '@/hooks/useTodayLog';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import type { MealType, QuickWorkoutType, RecentMeal } from '@/types/log';
import { searchFoodByName, type FoodItemResult } from '@/services/food-lookup';
import { useNutritionCoaching } from '@/hooks/useNutritionCoaching';
import { useHydration } from '@/hooks/useHydration';
import { useWeightLog } from '@/hooks/useWeightLog';
import { kgToLb, lbToKg } from '@/services/body-metrics';
import { formatWeightKg, kmToMiles, milesToKm } from '@/services/units';
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

const WORKOUT_ENTRY_ICON: Record<string, string> = {
  run: '🏃',
  lift: '🏋️',
  cross: '🔁',
  race: '🏁',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatShortDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ── Weight trend sparkline ────────────────────────────────────────────────
const WEIGHT_CHART_H = 90;
const WEIGHT_CHART_PAD = { t: 8, b: 8, l: 4, r: 4 };

function WeightChart({ points, width }: { points: number[]; width: number }) {
  if (points.length < 2 || width <= 0) return null;

  const maxVal = Math.max(...points);
  const minVal = Math.min(...points);
  const range = Math.max(0.1, maxVal - minVal);
  const innerW = width - WEIGHT_CHART_PAD.l - WEIGHT_CHART_PAD.r;
  const innerH = WEIGHT_CHART_H - WEIGHT_CHART_PAD.t - WEIGHT_CHART_PAD.b;

  const coords = points
    .map((v, i) => {
      const x = WEIGHT_CHART_PAD.l + (i / (points.length - 1)) * innerW;
      const y = WEIGHT_CHART_PAD.t + innerH - ((v - minVal) / range) * innerH;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <Svg width={width} height={WEIGHT_CHART_H} viewBox={`0 0 ${width} ${WEIGHT_CHART_H}`}>
      <Polyline
        points={coords}
        fill="none"
        stroke={Theme.accent}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return 'Try again.';
}

export default function LogTab() {
  const {
    data,
    isLoading,
    error,
    logWorkout,
    updateWorkout,
    deleteWorkout,
    logFood,
    updateFood,
    deleteFood,
    copyYesterday,
  } = useTodayLog();
  const { data: recentMeals } = useRecentMeals();
  const { data: nutrition } = useNutritionCoaching();
  const { data: hydration, add: addHydration } = useHydration();
  const { data: weightSummary, log: logWeightMutation, history: weightHistory } = useWeightLog();
  const [openSection, setOpenSection] = useState<'workout' | 'food' | 'weight' | null>(null);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [editingFoodId, setEditingFoodId] = useState<string | null>(null);
  const router = useRouter();
  const params = useLocalSearchParams<{
    scannedFoodId?: string;
    scannedName?: string;
    scannedCalories?: string;
    scannedProtein?: string;
    scannedCarbs?: string;
    scannedFat?: string;
    openFood?: string;
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

  const { units: unitPreference } = useUnitPreference();
  const [weightInput, setWeightInput] = useState('');
  const [chartWidth, setChartWidth] = useState(0);
  // Weight/distance units always follow the account-wide preference (Settings
  // → Units) — no per-screen override.
  const weightUnit: 'lb' | 'kg' = unitPreference === 'metric' ? 'kg' : 'lb';

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function clearFieldError(key: string) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  // "Log manually" fallback from the barcode scanner — just open the food form.
  useEffect(() => {
    if (params.openFood !== '1') return;
    setOpenSection('food');
    router.setParams({ openFood: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.openFood]);

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

  useEffect(() => {
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, []);

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
      setFieldErrors({ minutes: 'How many minutes was this workout?' });
      return;
    }
    const enteredDistance = distance ? Number(distance) : undefined;
    const input = {
      sessionType: workoutType,
      minutes: mins,
      distanceMiles:
        enteredDistance != null
          ? unitPreference === 'metric'
            ? kmToMiles(enteredDistance)
            : enteredDistance
          : undefined,
      notes: workoutNotes,
    };
    try {
      if (editingWorkoutId) {
        await updateWorkout.mutateAsync({ id: editingWorkoutId, input });
      } else {
        await logWorkout.mutateAsync(input);
      }
      resetWorkoutForm();
      setEditingWorkoutId(null);
      setOpenSection(null);
    } catch (err) {
      Alert.alert('Save failed', getErrorMessage(err));
    }
  }

  function handleEditWorkout(w: NonNullable<typeof data>['workouts'][number]) {
    setEditingWorkoutId(w.id);
    setWorkoutType((w.sessionType as QuickWorkoutType) ?? 'run');
    setMinutes(String(w.durationMinutes));
    setDistance(
      w.distanceMiles != null
        ? String(unitPreference === 'metric' ? Math.round(milesToKm(w.distanceMiles) * 100) / 100 : w.distanceMiles)
        : '',
    );
    setWorkoutNotes(w.notes ?? '');
    setOpenSection('workout');
  }

  function handleDeleteWorkout(id: string, label: string) {
    Alert.alert(`Delete ${label} workout?`, 'This will remove it from your log.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteWorkout.mutate(id, {
            onError: (err) => Alert.alert('Delete failed', getErrorMessage(err)),
          });
          if (editingWorkoutId === id) {
            resetWorkoutForm();
            setEditingWorkoutId(null);
            setOpenSection(null);
          }
        },
      },
    ]);
  }

  async function handleRelogMeal(meal: RecentMeal) {
    try {
      await logFood.mutateAsync({
        name: meal.name,
        mealType: (meal.mealType ?? 'snack') as MealType,
        calories: meal.calories ?? 0,
        proteinG: meal.proteinG ?? undefined,
        carbsG: meal.carbsG ?? undefined,
        fatG: meal.fatG ?? undefined,
        foodItemId: meal.foodItemId,
        quantityG: meal.quantityG ?? undefined,
      });
    } catch (err) {
      Alert.alert('Save failed', getErrorMessage(err));
    }
  }

  async function handleCopyYesterday() {
    try {
      const copied = await copyYesterday.mutateAsync();
      if (copied === 0) {
        Alert.alert('Nothing to copy', "Yesterday's food log is empty.");
      }
    } catch (err) {
      Alert.alert('Copy failed', getErrorMessage(err));
    }
  }

  async function handleSaveFood() {
    const cals = Number(calories);
    const errors: Record<string, string> = {};
    if (!foodName.trim()) errors.foodName = 'What did you eat?';
    if (!cals || cals <= 0) errors.calories = 'Roughly how many calories?';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    const input = {
      name: foodName.trim(),
      mealType,
      calories: cals,
      proteinG: protein ? Number(protein) : undefined,
      carbsG: carbs ? Number(carbs) : undefined,
      fatG: fat ? Number(fat) : undefined,
      foodItemId: selectedFoodItem?.id || undefined,
      quantityG: selectedFoodItem ? Number(quantityG) || 100 : undefined,
    };
    try {
      if (editingFoodId) {
        await updateFood.mutateAsync({ id: editingFoodId, input });
      } else {
        await logFood.mutateAsync(input);
      }
      resetFoodForm();
      setEditingFoodId(null);
      setOpenSection(null);
    } catch (err) {
      Alert.alert('Save failed', getErrorMessage(err));
    }
  }

  function handleEditFood(f: NonNullable<typeof data>['food'][number]) {
    setEditingFoodId(f.id);
    setFoodName(f.name);
    setMealType((f.mealType as MealType) ?? 'snack');
    setCalories(f.calories != null ? String(f.calories) : '');
    setProtein(f.proteinG != null ? String(f.proteinG) : '');
    setCarbs(f.carbsG != null ? String(f.carbsG) : '');
    setFat(f.fatG != null ? String(f.fatG) : '');
    setQuantityG(f.quantityG != null ? String(f.quantityG) : '100');
    setSelectedFoodItem(null);
    setFoodResults([]);
    setOpenSection('food');
  }

  function handleDeleteFood(id: string, name: string) {
    Alert.alert(`Delete ${name}?`, 'This will remove it from your log.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteFood.mutate(id, {
            onError: (err) => Alert.alert('Delete failed', getErrorMessage(err)),
          });
          if (editingFoodId === id) {
            resetFoodForm();
            setEditingFoodId(null);
            setOpenSection(null);
          }
        },
      },
    ]);
  }

  async function handleSaveWeight() {
    const value = Number(weightInput);
    if (!value || value <= 0) {
      setFieldErrors({ weight: "Enter a number to log today's weigh-in." });
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
          <Text style={styles.subtitle}>Log a workout, a meal, or today's weigh-in.</Text>

          {nutrition ? (
            <Card style={styles.nutritionCard}>
              <View style={styles.nutritionHeaderRow}>
                <Text style={styles.cardLabel}>NUTRITION TODAY</Text>
                {nutrition.dayType ? (
                  <View
                    style={[
                      styles.dayTypeChip,
                      nutrition.dayType === 'rest' && styles.dayTypeChipRest,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayTypeChipText,
                        nutrition.dayType === 'rest' && styles.dayTypeChipTextRest,
                      ]}
                    >
                      {nutrition.dayType === 'training'
                        ? `🏋️ Training day${nutrition.todaySessionType ? ` · ${formatSessionType(nutrition.todaySessionType)}` : ''}`
                        : '😴 Rest day target'}
                    </Text>
                  </View>
                ) : null}
              </View>
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
            </Card>
          ) : null}

          {hydration ? (
            <HydrationCard
              ounces={hydration.ounces}
              targetOz={hydration.targetOz}
              onAdd={(oz) => addHydration.mutate(oz)}
            />
          ) : null}

          {isLoading ? (
            <ActivityIndicator color={Theme.accent} style={{ marginTop: 24 }} />
          ) : error ? (
            <Text style={styles.errorText}>Couldn&apos;t load today&apos;s log.</Text>
          ) : (
            <Card style={styles.todayCard}>
              <Text style={styles.cardLabel}>TODAY</Text>
              {!hasEntries ? (
                <Text style={styles.emptyText}>Nothing logged yet today.</Text>
              ) : (
                <>
                  {data?.workouts.map((w) => (
                    <TouchableOpacity
                      key={w.id}
                      style={styles.entryRow}
                      onPress={() => handleEditWorkout(w)}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${formatSessionType(w.sessionType)} workout`}
                    >
                      <Text style={styles.entryIcon}>{WORKOUT_ENTRY_ICON[w.sessionType] ?? '🏃'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.entryPrimary}>{formatSessionType(w.sessionType)}</Text>
                        <Text style={styles.entrySecondary}>
                          {w.durationMinutes} min
                          {w.distanceMiles
                            ? ` · ${
                                unitPreference === 'metric'
                                  ? `${Math.round(milesToKm(w.distanceMiles) * 10) / 10} km`
                                  : `${w.distanceMiles} mi`
                              }`
                            : ''} · {formatTime(w.startedAt)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteWorkout(w.id, formatSessionType(w.sessionType))}
                        hitSlop={12}
                        style={styles.entryDeleteBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${formatSessionType(w.sessionType)} workout`}
                      >
                        <Text style={styles.entryDeleteText}>✕</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                  {data?.food.map((f) => (
                    <TouchableOpacity
                      key={f.id}
                      style={styles.entryRow}
                      onPress={() => handleEditFood(f)}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${f.name}`}
                    >
                      <Text style={styles.entryIcon}>🍽</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.entryPrimary}>{f.name}</Text>
                        <Text style={styles.entrySecondary}>
                          {f.calories ?? 0} cal · {f.mealType ?? 'meal'} · {formatTime(f.loggedAt)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDeleteFood(f.id, f.name)}
                        hitSlop={12}
                        style={styles.entryDeleteBtn}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${f.name}`}
                      >
                        <Text style={styles.entryDeleteText}>✕</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                  {data && data.totalCalories > 0 ? (
                    <Text style={styles.totalText}>{data.totalCalories} cal logged today</Text>
                  ) : null}
                </>
              )}
            </Card>
          )}

          {/* Log a Workout */}
          <Card style={styles.actionCardWrap}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => {
                if (openSection === 'workout') {
                  setOpenSection(null);
                } else {
                  resetWorkoutForm();
                  setEditingWorkoutId(null);
                  setOpenSection('workout');
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Log a workout"
              accessibilityState={{ expanded: openSection === 'workout' }}
            >
              <Text style={styles.actionTitle}>🏃 Log a Workout</Text>
              <Text style={styles.actionChevron}>{openSection === 'workout' ? '−' : '+'}</Text>
            </TouchableOpacity>
          </Card>

          {openSection === 'workout' ? (
            <Card style={styles.form}>
              <View style={styles.chipRow}>
                {WORKOUT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.chip, workoutType === t.value && styles.chipActive]}
                    onPress={() => setWorkoutType(t.value)}
                    accessibilityRole="button"
                    accessibilityLabel={t.label}
                    accessibilityState={{ selected: workoutType === t.value }}
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
                    style={[styles.input, fieldErrors.minutes ? styles.inputError : null]}
                    keyboardType="number-pad"
                    placeholder="30"
                    placeholderTextColor={Theme.textMut}
                    value={minutes}
                    onChangeText={(v) => {
                      setMinutes(v);
                      clearFieldError('minutes');
                    }}
                    accessibilityLabel="Workout duration in minutes"
                  />
                  <FieldError message={fieldErrors.minutes} />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>
                    DISTANCE ({unitPreference === 'metric' ? 'KM' : 'MI'})
                  </Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    placeholder="optional"
                    placeholderTextColor={Theme.textMut}
                    value={distance}
                    onChangeText={setDistance}
                    accessibilityLabel={`Distance in ${unitPreference === 'metric' ? 'kilometers' : 'miles'}, optional`}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>NOTES</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                placeholder="How did it feel?"
                placeholderTextColor={Theme.textMut}
                value={workoutNotes}
                onChangeText={setWorkoutNotes}
                multiline
                accessibilityLabel="Workout notes"
              />

              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  (logWorkout.isPending || updateWorkout.isPending) && styles.saveBtnDisabled,
                ]}
                onPress={handleSaveWorkout}
                disabled={logWorkout.isPending || updateWorkout.isPending}
                accessibilityRole="button"
                accessibilityLabel={editingWorkoutId ? 'Update workout' : 'Save workout'}
                accessibilityState={{
                  disabled: logWorkout.isPending || updateWorkout.isPending,
                  busy: logWorkout.isPending || updateWorkout.isPending,
                }}
              >
                {logWorkout.isPending || updateWorkout.isPending ? (
                  <ActivityIndicator color={Theme.ink} />
                ) : (
                  <Text style={styles.saveBtnText}>
                    {editingWorkoutId ? 'Update Workout' : 'Save Workout'}
                  </Text>
                )}
              </TouchableOpacity>
            </Card>
          ) : null}

          {/* Log Food */}
          <Card style={styles.actionCardWrap}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => {
                if (openSection === 'food') {
                  setOpenSection(null);
                } else {
                  resetFoodForm();
                  setEditingFoodId(null);
                  setOpenSection('food');
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Log food"
              accessibilityState={{ expanded: openSection === 'food' }}
            >
              <Text style={styles.actionTitle}>🍽 Log Food</Text>
              <Text style={styles.actionChevron}>{openSection === 'food' ? '−' : '+'}</Text>
            </TouchableOpacity>
          </Card>

          {openSection === 'food' ? (
            <Card style={styles.form}>
              <>
                  <Text style={styles.fieldLabel}>QUICK ADD</Text>
                  <View style={styles.chipRow}>
                    {(recentMeals ?? []).map((meal) => (
                      <TouchableOpacity
                        key={meal.foodItemId}
                        style={styles.recentChip}
                        onPress={() => handleRelogMeal(meal)}
                        disabled={logFood.isPending}
                        accessibilityRole="button"
                        accessibilityLabel={`Log ${meal.name} again, ${meal.calories ?? 0} calories`}
                        accessibilityState={{ disabled: logFood.isPending }}
                      >
                        <Text style={styles.recentChipName} numberOfLines={1}>
                          {meal.name}
                        </Text>
                        <Text style={styles.recentChipMeta}>{meal.calories ?? 0} cal</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={[styles.recentChip, styles.copyYesterdayChip]}
                      onPress={handleCopyYesterday}
                      disabled={copyYesterday.isPending}
                      accessibilityRole="button"
                      accessibilityLabel="Copy all meals from yesterday"
                      accessibilityState={{ disabled: copyYesterday.isPending, busy: copyYesterday.isPending }}
                    >
                      {copyYesterday.isPending ? (
                        <ActivityIndicator color={Colors.gold} size="small" />
                      ) : (
                        <>
                          <Text style={[styles.recentChipName, { color: Colors.gold }]}>
                            ⧉ Copy yesterday
                          </Text>
                          <Text style={styles.recentChipMeta}>all meals</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </>

              <View style={styles.foodNameHeader}>
                <Text style={styles.fieldLabel}>WHAT DID YOU EAT?</Text>
                <View style={styles.scanBtnRow}>
                  <TouchableOpacity
                    style={styles.scanBtn}
                    onPress={handleTakeMealPhoto}
                    disabled={analyzingPhoto}
                    accessibilityRole="button"
                    accessibilityLabel="Photograph meal to estimate macros"
                    accessibilityState={{ disabled: analyzingPhoto, busy: analyzingPhoto }}
                  >
                    <Text style={styles.scanBtnText}>📸 Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.scanBtn}
                    onPress={() => router.push('/food-scanner')}
                    accessibilityRole="button"
                    accessibilityLabel="Scan food barcode"
                  >
                    <Text style={styles.scanBtnText}>📷 Scan</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <TextInput
                style={[styles.input, fieldErrors.foodName ? styles.inputError : null]}
                placeholder="Grilled chicken bowl"
                placeholderTextColor={Theme.textMut}
                value={foodName}
                onChangeText={(v) => {
                  handleFoodNameChange(v);
                  clearFieldError('foodName');
                }}
                accessibilityLabel="Food name"
              />
              <FieldError message={fieldErrors.foodName} />

              {analyzingPhoto ? (
                <View style={styles.analyzingRow}>
                  <ActivityIndicator color={Theme.accent} />
                  <Text style={styles.analyzingText}>Ozzie's looking at your photo...</Text>
                </View>
              ) : null}

              {photoConfidenceNote ? (
                <Text style={styles.tipText}>{photoConfidenceNote}</Text>
              ) : null}

              {searching ? (
                <ActivityIndicator color={Theme.accent} style={{ alignSelf: 'flex-start' }} />
              ) : null}

              {foodResults.length > 0 ? (
                <View style={styles.resultsBox}>
                  {foodResults.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.resultRow}
                      onPress={() => handlePickFoodResult(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.name}${item.brand ? `, ${item.brand}` : ''}, ${item.caloriesPer100g} calories per 100 grams`}
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
                    accessibilityLabel="Quantity in grams"
                  />
                </>
              ) : null}

              <View style={styles.chipRow}>
                {MEAL_TYPES.map((m) => (
                  <TouchableOpacity
                    key={m.value}
                    style={[styles.chip, mealType === m.value && styles.chipActive]}
                    onPress={() => setMealType(m.value)}
                    accessibilityRole="button"
                    accessibilityLabel={m.label}
                    accessibilityState={{ selected: mealType === m.value }}
                  >
                    <Text style={[styles.chipText, mealType === m.value && styles.chipTextActive]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>CALORIES</Text>
              <TextInput
                style={[styles.input, fieldErrors.calories ? styles.inputError : null]}
                keyboardType="number-pad"
                placeholder="450"
                placeholderTextColor={Theme.textMut}
                value={calories}
                onChangeText={(v) => {
                  setCalories(v);
                  clearFieldError('calories');
                }}
                accessibilityLabel="Calories"
              />
              <FieldError message={fieldErrors.calories} />

              <View style={styles.fieldRow}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>PROTEIN (G)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    placeholder="optional"
                    placeholderTextColor={Theme.textMut}
                    value={protein}
                    onChangeText={setProtein}
                    accessibilityLabel="Protein in grams, optional"
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>CARBS (G)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    placeholder="optional"
                    placeholderTextColor={Theme.textMut}
                    value={carbs}
                    onChangeText={setCarbs}
                    accessibilityLabel="Carbs in grams, optional"
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>FAT (G)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    placeholder="optional"
                    placeholderTextColor={Theme.textMut}
                    value={fat}
                    onChangeText={setFat}
                    accessibilityLabel="Fat in grams, optional"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  (logFood.isPending || updateFood.isPending) && styles.saveBtnDisabled,
                ]}
                onPress={handleSaveFood}
                disabled={logFood.isPending || updateFood.isPending}
                accessibilityRole="button"
                accessibilityLabel={editingFoodId ? 'Update food' : 'Save food'}
                accessibilityState={{
                  disabled: logFood.isPending || updateFood.isPending,
                  busy: logFood.isPending || updateFood.isPending,
                }}
              >
                {logFood.isPending || updateFood.isPending ? (
                  <ActivityIndicator color={Theme.ink} />
                ) : (
                  <Text style={styles.saveBtnText}>{editingFoodId ? 'Update Food' : 'Save Food'}</Text>
                )}
              </TouchableOpacity>
            </Card>
          ) : null}

          {/* Log Weight */}
          <Card style={styles.actionCardWrap}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => setOpenSection(openSection === 'weight' ? null : 'weight')}
              accessibilityRole="button"
              accessibilityLabel="Log weight"
              accessibilityState={{ expanded: openSection === 'weight' }}
            >
              <Text style={styles.actionTitle}>⚖️ Log Weight</Text>
              <Text style={styles.actionChevron}>{openSection === 'weight' ? '−' : '+'}</Text>
            </TouchableOpacity>
          </Card>

          {openSection === 'weight' ? (
            <Card style={styles.form}>
              {weightSummary?.latestKg != null ? (
                <Text style={styles.weightSummaryText}>
                  Last logged: {formatWeightKg(weightSummary.latestKg, unitPreference)}
                  {weightSummary.kgPerWeek != null && weightSummary.direction
                    ? ` · ${weightSummary.direction} ${formatWeightKg(Math.abs(weightSummary.kgPerWeek), unitPreference)}/wk`
                    : ''}
                </Text>
              ) : (
                <Text style={styles.weightSummaryText}>
                  Log your weight a few times a week and Ozzie auto-tunes your calorie targets to the trend.
                </Text>
              )}

              {weightHistory && weightHistory.length >= 2 ? (
                <>
                  <Text style={styles.fieldLabel}>WEIGHT TREND</Text>
                  <View
                    style={styles.svgWrap}
                    onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
                  >
                    <WeightChart
                      points={weightHistory.map((p) => (weightUnit === 'lb' ? kgToLb(p.kg) : p.kg))}
                      width={chartWidth}
                    />
                  </View>
                  <Text style={styles.chartDateRange}>
                    {formatShortDate(weightHistory[0].recordedOn)} —{' '}
                    {formatShortDate(weightHistory[weightHistory.length - 1].recordedOn)}
                  </Text>
                </>
              ) : null}

              <Text style={styles.fieldLabel}>TODAY&apos;S WEIGHT ({weightUnit})</Text>
              <TextInput
                style={[styles.input, fieldErrors.weight ? styles.inputError : null]}
                keyboardType="decimal-pad"
                placeholder={weightUnit === 'lb' ? 'e.g. 168.4' : 'e.g. 76.4'}
                placeholderTextColor={Theme.textMut}
                value={weightInput}
                onChangeText={(v) => {
                  setWeightInput(v);
                  clearFieldError('weight');
                }}
                accessibilityLabel={`Today's weight in ${weightUnit}`}
              />
              <FieldError message={fieldErrors.weight} />

              <TouchableOpacity
                style={[styles.saveBtn, logWeightMutation.isPending && styles.saveBtnDisabled]}
                onPress={handleSaveWeight}
                disabled={logWeightMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel="Save weight"
                accessibilityState={{ disabled: logWeightMutation.isPending, busy: logWeightMutation.isPending }}
              >
                {logWeightMutation.isPending ? (
                  <ActivityIndicator color={Theme.ink} />
                ) : (
                  <Text style={styles.saveBtnText}>Save Weight</Text>
                )}
              </TouchableOpacity>
            </Card>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.ink },
  scrollContent: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '900', color: Theme.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Theme.textMut, lineHeight: 20, marginBottom: 20 },
  errorText: { fontSize: 13, color: Colors.red, marginBottom: 16 },
  nutritionCard: {
    marginBottom: 16,
    gap: 8,
  },
  nutritionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dayTypeChip: {
    backgroundColor: Theme.panel,
    borderWidth: 1,
    borderColor: Theme.line,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dayTypeChipRest: { backgroundColor: Colors.goldDim, borderColor: 'rgba(200,154,0,0.3)' },
  dayTypeChipText: { fontSize: 10, fontWeight: '700', color: Theme.accent, fontFamily: 'SpaceGrotesk_700Bold' },
  dayTypeChipTextRest: { color: Colors.gold },
  macroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  macroValue: { fontSize: 20, fontWeight: '800', color: Theme.text },
  macroUnit: { fontSize: 13, color: Theme.textMut, fontWeight: '600' },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Theme.line,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Theme.accent, borderRadius: 3 },
  macroChipRow: { flexDirection: 'row', gap: 12 },
  macroChip: { fontSize: 12, color: Theme.textSoft, fontWeight: '600' },
  tipText: { fontSize: 13, color: Theme.textSoft, lineHeight: 18, marginTop: 4 },
  todayCard: {
    marginBottom: 20,
    gap: 10,
  },
  cardLabel: { fontSize: 10, fontWeight: '700', color: Theme.textMut, letterSpacing: 1, fontFamily: 'SpaceGrotesk_700Bold' },
  emptyText: { fontSize: 13, color: Theme.textMut },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  entryIcon: { fontSize: 18, width: 22, textAlign: 'center' },
  entryPrimary: { fontSize: 14, fontWeight: '700', color: Theme.text },
  entrySecondary: { fontSize: 12, color: Theme.textSoft },
  entryDeleteBtn: { padding: 10, marginLeft: 2 },
  entryDeleteText: { fontSize: 13, color: Theme.textMut, fontWeight: '700' },
  totalText: {
    fontSize: 12,
    fontWeight: '700',
    color: Theme.accent,
    marginTop: 4,
  },
  actionCardWrap: {
    padding: 0,
    marginBottom: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  actionTitle: { fontSize: 15, fontWeight: '700', color: Theme.text },
  actionChevron: { fontSize: 18, fontWeight: '800', color: Theme.accent },
  form: {
    marginTop: -4,
    marginBottom: 16,
    gap: 10,
  },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    backgroundColor: Theme.panel,
  },
  chipActive: { backgroundColor: Theme.panel, borderColor: Theme.accent },
  recentChip: {
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    backgroundColor: Theme.panel,
    borderRadius: Radius.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: 160,
    gap: 1,
  },
  recentChipName: { fontSize: 12, fontWeight: '700', color: Theme.accent },
  recentChipMeta: { fontSize: 10, color: Theme.textMut, fontWeight: '600' },
  copyYesterdayChip: {
    borderColor: 'rgba(200,154,0,0.3)',
    backgroundColor: Colors.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '600', color: Theme.textSoft },
  chipTextActive: { color: Theme.accent },
  fieldRow: { flexDirection: 'row', gap: 10 },
  field: { flex: 1 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Theme.textMut,
    letterSpacing: 0.8,
    marginTop: 4,
    marginBottom: 6,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  weightSummaryText: {
    fontSize: 13,
    color: Theme.textSoft,
    lineHeight: 18,
    marginBottom: 4,
  },
  svgWrap: { width: '100%', alignItems: 'center' },
  chartDateRange: { fontSize: 9, color: Theme.textMut, textAlign: 'right', marginTop: -4, marginBottom: 4 },
  inputError: {
    borderColor: Colors.red,
  },
  input: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Theme.text,
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
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  scanBtnText: { fontSize: 12, fontWeight: '700', color: Theme.accent },
  analyzingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  analyzingText: { fontSize: 12, color: Theme.textMut, fontWeight: '600' },
  resultsBox: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  resultRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Theme.line,
  },
  resultName: { fontSize: 13, fontWeight: '700', color: Theme.text },
  resultMeta: { fontSize: 11, color: Theme.textMut, marginTop: 2 },
  saveBtn: {
    marginTop: 6,
    backgroundColor: Theme.accent,
    borderWidth: BorderWidth.card,
    borderColor: Theme.accent,
    borderRadius: Radius.card,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: Theme.ink },
});
