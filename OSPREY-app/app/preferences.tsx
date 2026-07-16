import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { extractFunctionErrorMessage, supabase } from '@/services/supabase';
import { invokeGeneratePlan } from '@/services/coaching/build-envelope';
import { useAuthStore } from '@/store/authStore';
import { ONBOARDING_GOAL_TO_PREFERENCES } from '@/services/onboarding';
import { parseUltraParams, type UltraRaceDistance } from '@/services/coaching/ultra-params';
import { parseHyroxParams, type HyroxDivision } from '@/services/coaching/hyrox-params';
import { parseStrengthParams } from '@/services/coaching/strength-params';
import type {
  ExperienceLevel,
  TrainingDaysPerWeek,
  TrainingGoal,
  TriathlonDistance,
} from '@/types/preferences';
import type { PrimaryGoal } from '@/types/onboarding';

interface GoalOption {
  value: TrainingGoal;
  label: string;
}

interface LevelOption {
  value: ExperienceLevel;
  label: string;
}

const GOAL_OPTIONS: GoalOption[] = [
  { value: 'hybrid', label: '🏋️ Hybrid Athlete' },
  { value: 'run_performance', label: '🏃 Run Performance' },
  { value: 'ultra', label: '⛰️ Ultra' },
  { value: 'strength', label: '💪 Strength Focus' },
  { value: 'triathlon', label: '🏊 Triathlon / Multisport' },
  { value: 'swim', label: '🏊 Swimming' },
  { value: 'rowing', label: '🚣 Rowing' },
  { value: 'hyrox', label: '🏋️‍♂️ Hyrox' },
  { value: 'cycling', label: '🚴 Cycling' },
  { value: 'weight_loss', label: '🔥 Weight Loss' },
  { value: 'general', label: '⚡ General Fitness' },
];

const TRIATHLON_DISTANCE_OPTIONS: { value: TriathlonDistance; label: string }[] = [
  { value: 'sprint', label: 'Sprint (750m/20k/5k)' },
  { value: 'olympic', label: 'Olympic (1.5k/40k/10k)' },
  { value: 'half', label: 'Half (70.3)' },
  { value: 'full', label: 'Full (140.6)' },
];

const ULTRA_DISTANCES: UltraRaceDistance[] = ['50k', '50mi', '100k', '100mi'];

const HYROX_DIVISIONS: { value: HyroxDivision; label: string }[] = [
  { value: 'open_men', label: 'Open M' },
  { value: 'open_women', label: 'Open W' },
  { value: 'pro_men', label: 'Pro M' },
  { value: 'pro_women', label: 'Pro W' },
];

const LEVEL_OPTIONS: LevelOption[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced (3+ yrs)' },
];

const DAYS_OPTIONS: TrainingDaysPerWeek[] = [3, 4, 5, 6];

const EXPERIENCE_TIER_MAP: Record<ExperienceLevel, string> = {
  beginner: 'beginner',
  intermediate: 'intermediate',
  advanced: 'advanced',
};

export default function PreferencesScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const profile = useAuthStore((s) => s.profile);
  const [primaryGoal, setPrimaryGoal] = useState<TrainingGoal>('hybrid');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('intermediate');
  const [daysPerWeek, setDaysPerWeek] = useState<TrainingDaysPerWeek>(5);
  const [longRunDay, setLongRunDay] = useState<'saturday' | 'sunday'>('saturday');
  const [includeSwim, setIncludeSwim] = useState(false);
  const [includeBike, setIncludeBike] = useState(false);
  const [triathlonDistance, setTriathlonDistance] = useState<TriathlonDistance>('sprint');
  const [ultraDistance, setUltraDistance] = useState<UltraRaceDistance>('50k');
  const [ultraVert, setUltraVert] = useState('');
  const [gutTrained, setGutTrained] = useState(false);
  const [division, setDivision] = useState<HyroxDivision>('open_men');
  const [squat, setSquat] = useState('');
  const [bench, setBench] = useState('');
  const [deadlift, setDeadlift] = useState('');
  const [goalSquat, setGoalSquat] = useState('');
  const [goalBench, setGoalBench] = useState('');
  const [goalDeadlift, setGoalDeadlift] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  // Whether a plan-builder session has run before via this screen — a good
  // proxy for "you already have an active plan," since onboarding itself
  // never writes to osprey_preferences (it goes straight to user_goals).
  const [hasGeneratedBefore, setHasGeneratedBefore] = useState(false);

  const isTriathlon = primaryGoal === 'triathlon';
  const isUltra = primaryGoal === 'ultra';
  const isLift = primaryGoal === 'strength';
  const isHyrox = primaryGoal === 'hyrox';

  useEffect(() => {
    async function loadSaved() {
      try {
        const { data } = await supabase.auth.getUser();
        const saved = data.user?.user_metadata?.osprey_preferences;
        if (saved) {
          setHasGeneratedBefore(true);
          if (saved.primaryGoal) setPrimaryGoal(saved.primaryGoal);
          if (saved.experienceLevel) setExperienceLevel(saved.experienceLevel);
          if (saved.daysPerWeek) setDaysPerWeek(saved.daysPerWeek);
          if (saved.longRunDay) setLongRunDay(saved.longRunDay);
          if (typeof saved.includeSwim === 'boolean') setIncludeSwim(saved.includeSwim);
          if (typeof saved.includeBike === 'boolean') setIncludeBike(saved.includeBike);
          if (saved.triathlonDistance) setTriathlonDistance(saved.triathlonDistance);
          if (saved.goalParams) {
            if (saved.goalParams.raceDistance) setUltraDistance(saved.goalParams.raceDistance);
            setUltraVert(saved.goalParams.vertGainM != null ? String(saved.goalParams.vertGainM) : '');
            setGutTrained(!!saved.goalParams.gutTrained);
            if (saved.goalParams.division) setDivision(saved.goalParams.division);
            if (saved.goalParams.oneRepMaxKg) {
              const maxes = saved.goalParams.oneRepMaxKg;
              setSquat(maxes.squat != null ? String(maxes.squat) : '');
              setBench(maxes.bench != null ? String(maxes.bench) : '');
              setDeadlift(maxes.deadlift != null ? String(maxes.deadlift) : '');
            }
            if (saved.goalParams.goalThirdKg) {
              const goalThirds = saved.goalParams.goalThirdKg;
              setGoalSquat(goalThirds.squat != null ? String(goalThirds.squat) : '');
              setGoalBench(goalThirds.bench != null ? String(goalThirds.bench) : '');
              setGoalDeadlift(goalThirds.deadlift != null ? String(goalThirds.deadlift) : '');
            }
          }
        } else if (userId) {
          // First visit — no prior plan-builder session. Seed from the
          // answers already given during onboarding instead of asking the
          // same goal/experience/days questions cold a second time.
          if (profile?.experience_tier) {
            setExperienceLevel(profile.experience_tier as ExperienceLevel);
          }
          const { data: goalsRow } = await supabase
            .from('user_goals')
            .select('primary_goal, weekly_run_days, weekly_lift_days')
            .eq('user_id', userId)
            .maybeSingle();
          if (goalsRow?.primary_goal) {
            const mapped = ONBOARDING_GOAL_TO_PREFERENCES[goalsRow.primary_goal as PrimaryGoal];
            if (mapped) setPrimaryGoal(mapped);
          }
          if (goalsRow?.weekly_run_days != null || goalsRow?.weekly_lift_days != null) {
            const totalDays = (goalsRow.weekly_run_days ?? 0) + (goalsRow.weekly_lift_days ?? 0);
            const clamped = Math.min(6, Math.max(3, totalDays)) as TrainingDaysPerWeek;
            setDaysPerWeek(clamped);
          }
        }
      } catch {
        // silently fall back to defaults
      } finally {
        setLoadingPrefs(false);
      }
    }
    loadSaved();
  }, [userId]);

  async function handleGenerate() {
    setLoading(true);
    try {
      const ultraParams = isUltra
        ? parseUltraParams({ raceDistance: ultraDistance, vertGainM: ultraVert, gutTrained })
        : null;
      if (ultraParams && !ultraParams.ok) {
        Alert.alert('Check your ultra details', ultraParams.error);
        return;
      }
      const ultraParamsValue = ultraParams && ultraParams.ok ? ultraParams.value : null;

      const strengthParams = isLift
        ? parseStrengthParams({ squat, bench, deadlift, goalSquat, goalBench, goalDeadlift })
        : null;
      if (strengthParams && !strengthParams.ok) {
        Alert.alert('Check your lift numbers', strengthParams.error);
        return;
      }
      const strengthParamsValue = strengthParams && strengthParams.ok ? strengthParams.value : null;

      const hyroxParams = isHyrox ? parseHyroxParams({ division, targetTimeMinutes: '' }) : null;
      if (hyroxParams && !hyroxParams.ok) {
        Alert.alert('Check your hyrox details', hyroxParams.error);
        return;
      }
      const hyroxParamsValue = hyroxParams && hyroxParams.ok ? hyroxParams.value : null;

      const preferences = {
        primaryGoal,
        experienceLevel,
        daysPerWeek,
        includeSwim: isTriathlon ? true : includeSwim,
        includeBike: isTriathlon ? true : includeBike,
        longRunDay,
        ...(isTriathlon ? { triathlonDistance } : {}),
        ...(ultraParamsValue ? { goalParams: ultraParamsValue } : {}),
        ...(strengthParamsValue ? { goalParams: strengthParamsValue } : {}),
        ...(hyroxParamsValue ? { goalParams: hyroxParamsValue } : {}),
      };

      // Persist to Supabase Auth user_metadata (no schema change needed)
      await supabase.auth.updateUser({
        data: { osprey_preferences: preferences },
      });

      // Also update experience_tier in the users table
      if (userId) {
        await supabase
          .from('users')
          .update({ experience_tier: EXPERIENCE_TIER_MAP[experienceLevel] })
          .eq('id', userId);
      }

      // Persist goal_params BEFORE generating: invokeGeneratePlan builds the
      // envelope by reading user_goals.goal_params straight from the DB, so
      // this has to land first or the plan we're about to generate won't see
      // today's ultra inputs.
      if (ultraParamsValue && userId) {
        const { error: goalParamsError } = await supabase
          .from('user_goals')
          .update({ goal_params: ultraParamsValue })
          .eq('user_id', userId);
        if (goalParamsError) {
          Alert.alert('Could not save your ultra details', goalParamsError.message);
          return;
        }
      }
      // Same ordering requirement for a lift athlete's 1RMs — the build-envelope
      // reads goal_params from the DB, not from this in-memory preferences object.
      if (strengthParamsValue && userId) {
        const { error: goalParamsError } = await supabase
          .from('user_goals')
          .update({ goal_params: strengthParamsValue })
          .eq('user_id', userId);
        if (goalParamsError) {
          Alert.alert('Could not save your lift numbers', goalParamsError.message);
          return;
        }
      }
      // Same ordering requirement for a hyrox athlete's division — the build-envelope
      // reads goal_params from the DB, not from this in-memory preferences object.
      if (hyroxParamsValue && userId) {
        const { error: goalParamsError } = await supabase
          .from('user_goals')
          .update({ goal_params: hyroxParamsValue })
          .eq('user_id', userId);
        if (goalParamsError) {
          Alert.alert('Could not save your hyrox details', goalParamsError.message);
          return;
        }
      }

      const { data, error } = await invokeGeneratePlan({ preferences, force: true });
      if (error) {
        const message = await extractFunctionErrorMessage(error);
        Alert.alert('Plan generation failed', message);
        return;
      }
      // Navigate to plan preview, passing the generated sessions
      const sessions = data?.sessions ?? [];
      router.replace({
        pathname: '/plan-preview',
        params: { sessions: JSON.stringify(sessions) },
      });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  if (loadingPrefs) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.teal} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
        <Text style={styles.title}>Build Your Plan</Text>
        <Text style={styles.subtitle}>
          Ozzie needs to know your training goals to build a smart schedule.
        </Text>

        <Text style={styles.sectionLabel}>PRIMARY GOAL</Text>
        <View style={styles.chipRow}>
          {GOAL_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, primaryGoal === opt.value && styles.chipSelected]}
              onPress={() => setPrimaryGoal(opt.value)}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              accessibilityState={{ selected: primaryGoal === opt.value }}
            >
              <Text
                style={[styles.chipText, primaryGoal === opt.value && styles.chipTextSelected]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isTriathlon ? (
          <>
            <Text style={styles.sectionLabel}>RACE DISTANCE</Text>
            <View style={styles.chipRow}>
              {TRIATHLON_DISTANCE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, triathlonDistance === opt.value && styles.chipSelected]}
                  onPress={() => setTriathlonDistance(opt.value)}
                  accessibilityRole="button"
                  accessibilityLabel={opt.label}
                  accessibilityState={{ selected: triathlonDistance === opt.value }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      triathlonDistance === opt.value && styles.chipTextSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}

        {isUltra ? (
          <>
            <Text style={styles.sectionLabel}>RACE DISTANCE</Text>
            <View style={styles.chipRow}>
              {ULTRA_DISTANCES.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.chip, ultraDistance === d && styles.chipSelected]}
                  onPress={() => setUltraDistance(d)}
                  accessibilityRole="button"
                  accessibilityLabel={d}
                  accessibilityState={{ selected: ultraDistance === d }}
                >
                  <Text style={[styles.chipText, ultraDistance === d && styles.chipTextSelected]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>RACE VERT (METRES, OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              value={ultraVert}
              onChangeText={setUltraVert}
              keyboardType="number-pad"
              placeholder="e.g. 2000"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.sectionLabel}>GUT-TRAINED</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, gutTrained && styles.chipSelected]}
                onPress={() => setGutTrained((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityLabel="Gut-trained for race-day fueling"
                accessibilityState={{ checked: gutTrained }}
              >
                <Text style={[styles.chipText, gutTrained && styles.chipTextSelected]}>
                  🥤 Practiced high-carb race fueling
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        {isLift ? (
          <>
            <LiftField label="SQUAT — 1RM (KG)" value={squat} onChangeText={setSquat} placeholder="140" />
            <LiftField label="BENCH — 1RM (KG)" value={bench} onChangeText={setBench} placeholder="100" />
            <LiftField label="DEADLIFT — 1RM (KG)" value={deadlift} onChangeText={setDeadlift} placeholder="180" />
            <LiftField
              label="GOAL SQUAT — 3RD ATTEMPT (KG, OPTIONAL)"
              value={goalSquat}
              onChangeText={setGoalSquat}
              placeholder="150"
            />
            <LiftField
              label="GOAL BENCH — 3RD ATTEMPT (KG, OPTIONAL)"
              value={goalBench}
              onChangeText={setGoalBench}
              placeholder="105"
            />
            <LiftField
              label="GOAL DEADLIFT — 3RD ATTEMPT (KG, OPTIONAL)"
              value={goalDeadlift}
              onChangeText={setGoalDeadlift}
              placeholder="190"
            />
          </>
        ) : null}

        {isHyrox ? (
          <>
            <Text style={styles.sectionLabel}>DIVISION</Text>
            <View style={styles.chipRow}>
              {HYROX_DIVISIONS.map((d) => (
                <TouchableOpacity
                  key={d.value}
                  style={[styles.chip, division === d.value && styles.chipSelected]}
                  onPress={() => setDivision(d.value)}
                  accessibilityRole="button"
                  accessibilityLabel={d.label}
                  accessibilityState={{ selected: division === d.value }}
                >
                  <Text style={[styles.chipText, division === d.value && styles.chipTextSelected]}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>EXPERIENCE LEVEL</Text>
        <View style={styles.chipRow}>
          {LEVEL_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, experienceLevel === opt.value && styles.chipSelected]}
              onPress={() => setExperienceLevel(opt.value)}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              accessibilityState={{ selected: experienceLevel === opt.value }}
            >
              <Text
                style={[styles.chipText, experienceLevel === opt.value && styles.chipTextSelected]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>TRAINING DAYS PER WEEK</Text>
        <View style={styles.chipRow}>
          {DAYS_OPTIONS.map((day) => (
            <TouchableOpacity
              key={day}
              style={[styles.chipLarge, daysPerWeek === day && styles.chipSelected]}
              onPress={() => setDaysPerWeek(day)}
              accessibilityRole="button"
              accessibilityLabel={`${day} days per week`}
              accessibilityState={{ selected: daysPerWeek === day }}
            >
              <Text
                style={[styles.chipTextLarge, daysPerWeek === day && styles.chipTextSelected]}
              >
                {day}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>LONG RUN / KEY DAY</Text>
        <View style={styles.chipRow}>
          {(['saturday', 'sunday'] as const).map((day) => (
            <TouchableOpacity
              key={day}
              style={[styles.chip, longRunDay === day && styles.chipSelected]}
              onPress={() => setLongRunDay(day)}
              accessibilityRole="button"
              accessibilityLabel={day.charAt(0).toUpperCase() + day.slice(1)}
              accessibilityState={{ selected: longRunDay === day }}
            >
              <Text
                style={[styles.chipText, longRunDay === day && styles.chipTextSelected]}
              >
                {day.charAt(0).toUpperCase() + day.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isTriathlon ? (
          <Text style={styles.helperText}>
            Triathlon plans always include swim, bike, run, and strength days.
          </Text>
        ) : (
          <>
            <Text style={styles.sectionLabel}>INCLUDE IN PLAN</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, includeSwim && styles.chipSelected]}
                onPress={() => setIncludeSwim((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityLabel="Swim sessions"
                accessibilityState={{ checked: includeSwim }}
              >
                <Text style={[styles.chipText, includeSwim && styles.chipTextSelected]}>
                  🏊 Swim Sessions
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, includeBike && styles.chipSelected]}
                onPress={() => setIncludeBike((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityLabel="Bike sessions"
                accessibilityState={{ checked: includeBike }}
              >
                <Text style={[styles.chipText, includeBike && styles.chipTextSelected]}>
                  🚴 Bike Sessions
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {hasGeneratedBefore ? (
          <Text style={styles.replaceWarning}>
            This replaces your current plan going forward — past sessions already logged are untouched.
          </Text>
        ) : null}

        <TouchableOpacity
          style={[styles.generateBtn, loading && styles.generateBtnDisabled]}
          onPress={handleGenerate}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Generate my plan"
          accessibilityState={{ disabled: loading, busy: loading }}
        >
          {loading ? (
            <>
              <ActivityIndicator color="#000" style={{ marginRight: 8 }} />
              <Text style={styles.generateBtnText}>Ozzie is building your schedule...</Text>
            </>
          ) : (
            <Text style={styles.generateBtnText}>
              {hasGeneratedBefore ? 'Regenerate My Plan →' : 'Generate My Plan →'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={hasGeneratedBefore ? 'Cancel' : 'Skip for now'}
        >
          <Text style={styles.skipText}>{hasGeneratedBefore ? 'Cancel' : 'Skip for now'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function LiftField({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <>
      <Text style={styles.sectionLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24, paddingBottom: 48 },
  closeBtn: { alignSelf: 'flex-start', padding: 8, marginBottom: 4 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 20,
  },
  helperText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginTop: 20,
  },
  input: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipSelected: {
    backgroundColor: Colors.surfaceTeal,
    borderColor: Colors.borderTeal,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: Colors.teal,
  },
  chipLarge: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 14,
    minWidth: 60,
    alignItems: 'center',
  },
  chipTextLarge: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  replaceWarning: {
    fontSize: 12,
    color: Colors.amber,
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 20,
  },
  generateBtn: {
    marginTop: 32,
    backgroundColor: Colors.teal,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  generateBtnDisabled: {
    opacity: 0.7,
  },
  generateBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
  },
  skipBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '600',
  },
});
