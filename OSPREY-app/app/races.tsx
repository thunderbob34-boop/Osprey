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
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Colors } from '@/constants/colors';
import { Theme, Radius, BorderWidth } from '@/constants/theme';
import { Button } from '@/components/ui';
import DateField from '@/components/DateField';
import FieldError from '@/components/FieldError';
import InputModal from '@/components/InputModal';
import ScreenHeader from '@/components/ScreenHeader';
import { useRacePartners } from '@/hooks/useRacePartners';
import { useRaces } from '@/hooks/useRaces';
import { useSubscription } from '@/hooks/useSubscription';
import { useUnitPreference } from '@/hooks/useUnitPreference';
import { formatPacePerUnit, milesToKm } from '@/services/units';
import { formatRaceDistance, RACE_DISTANCE_LADDER, raceRunwayLabel } from '@/services/race-display';
import { extractFunctionErrorMessage } from '@/services/supabase';
import { invokeGeneratePlan } from '@/services/coaching/build-envelope';
import {
  DEFAULT_CHECKLIST,
  formatRaceTime,
  parseRaceTime,
  type ChecklistItem,
  type RaceEvent,
} from '@/services/races';

function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function countdownLabel(daysUntil: number): string {
  if (daysUntil === 0) return 'Today! 🏁';
  if (daysUntil === 1) return 'Tomorrow';
  return `${daysUntil} days out`;
}

/** "Sep 12, 2026" from a yyyy-mm-dd string, parsed as a local date. */
function formatEventDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Logistics panel ─────────────────────────────────────────────────────────

interface LogisticsState {
  packetPickupTime: string;
  parkingNotes: string;
  gearNotes: string;
  checklist: ChecklistItem[];
}

function initLogistics(race: RaceEvent): LogisticsState {
  return {
    packetPickupTime: race.packetPickupTime ?? '',
    parkingNotes: race.parkingNotes ?? '',
    gearNotes: race.gearNotes ?? '',
    checklist: race.morningChecklist ?? DEFAULT_CHECKLIST.map((i) => ({ ...i })),
  };
}

interface LogisticsPanelProps {
  race: RaceEvent;
  onClose: () => void;
  onSave: (raceId: string, state: LogisticsState) => Promise<void>;
  onGenerateBriefing: (race: RaceEvent) => Promise<void>;
  isSaving: boolean;
  isGenerating: boolean;
  isPlus: boolean;
  onPaywall: () => void;
}

function LogisticsPanel({
  race,
  onClose,
  onSave,
  onGenerateBriefing,
  isSaving,
  isGenerating,
  isPlus,
  onPaywall,
}: LogisticsPanelProps) {
  const [form, setForm] = useState<LogisticsState>(() => initLogistics(race));

  function toggleCheckItem(id: string) {
    setForm((prev) => ({
      ...prev,
      checklist: prev.checklist.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item,
      ),
    }));
  }

  const doneCount = form.checklist.filter((i) => i.done).length;

  return (
    <View style={styles.logisticsPanel}>
      <View style={styles.logisticsHeader}>
        <Text style={styles.logisticsTitle}>Race Logistics</Text>
        <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close race logistics">
          <Text style={styles.logisticsClose}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Packet pickup */}
      <Text style={styles.fieldLabel}>PACKET PICKUP</Text>
      <TextInput
        style={styles.input}
        placeholder="Time + location (e.g. Sat 10am, Expo Hall B)"
        placeholderTextColor={Theme.textMut}
        value={form.packetPickupTime}
        onChangeText={(t) => setForm((p) => ({ ...p, packetPickupTime: t }))}
        accessibilityLabel="Packet pickup time and location"
      />

      {/* Parking */}
      <Text style={styles.fieldLabel}>PARKING / TRANSIT</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Parking lot, garage, transit stop…"
        placeholderTextColor={Theme.textMut}
        value={form.parkingNotes}
        onChangeText={(t) => setForm((p) => ({ ...p, parkingNotes: t }))}
        multiline
        numberOfLines={3}
        accessibilityLabel="Parking and transit notes"
      />

      {/* Gear */}
      <Text style={styles.fieldLabel}>GEAR NOTES</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Shoes, kit, drop bag contents…"
        placeholderTextColor={Theme.textMut}
        value={form.gearNotes}
        onChangeText={(t) => setForm((p) => ({ ...p, gearNotes: t }))}
        multiline
        numberOfLines={3}
        accessibilityLabel="Gear notes"
      />

      {/* Morning checklist */}
      <View style={styles.checklistHeader}>
        <Text style={styles.fieldLabel}>MORNING CHECKLIST</Text>
        <Text style={styles.checklistProgress}>
          {doneCount}/{form.checklist.length}
        </Text>
      </View>
      {form.checklist.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.checkRow}
          onPress={() => toggleCheckItem(item.id)}
          activeOpacity={0.7}
          accessibilityRole="checkbox"
          accessibilityLabel={item.label}
          accessibilityState={{ checked: item.done }}
        >
          <View style={[styles.checkbox, item.done && styles.checkboxDone]}>
            {item.done ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
          <Text style={[styles.checkLabel, item.done && styles.checkLabelDone]}>
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}

      {/* Ozzie briefing */}
      <View style={styles.briefingSection}>
        <View style={styles.briefingHeaderRow}>
          <Text style={styles.briefingLabel}>OZZIE RACE BRIEFING</Text>
          {/* Hand-rolled, not <Button>: generateBtn is border/fill-less (just
              padding) — a bare accent-text tap target, not the primitive's
              bordered-pill recipe. Converting would add a visible border box
              that isn't there today. */}
          <TouchableOpacity
            onPress={() => (isPlus ? onGenerateBriefing(race) : onPaywall())}
            disabled={isGenerating}
            style={styles.generateBtn}
            accessibilityRole="button"
            accessibilityLabel={!isPlus ? 'Unlock OSPREY+ to generate race briefing' : race.ozzieBriefingText ? 'Refresh race briefing' : 'Generate race briefing'}
            accessibilityState={{ disabled: isGenerating, busy: isGenerating }}
          >
            {isGenerating ? (
              <ActivityIndicator color={Theme.accent} size="small" />
            ) : (
              <Text style={styles.generateBtnText}>
                {!isPlus ? '🔒 OSPREY+' : race.ozzieBriefingText ? '↺ Refresh' : 'Generate'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
        {race.ozzieBriefingText ? (
          <Text style={styles.briefingText}>{race.ozzieBriefingText}</Text>
        ) : (
          <Text style={styles.briefingPlaceholder}>
            Tap Generate for a personalized race-morning message from Ozzie.
          </Text>
        )}
      </View>

      {/* Save button */}
      <Button
        onPress={() => onSave(race.id, form)}
        disabled={isSaving}
        busy={isSaving}
        accessibilityLabel="Save logistics"
        style={styles.saveBtn}
      >
        {isSaving ? <ActivityIndicator color={Theme.ink} /> : 'Save Logistics'}
      </Button>
    </View>
  );
}

// ─── Retrospective panel ─────────────────────────────────────────────────────

const FEEL_OPTIONS: { score: number; label: string }[] = [
  { score: 1, label: 'Suffered' },
  { score: 2, label: 'Struggled' },
  { score: 3, label: 'Solid' },
  { score: 4, label: 'Strong' },
  { score: 5, label: 'Flew' },
];

interface RetroState {
  feelScore: number | null;
  pacingNotes: string;
  nutritionNotes: string;
  lessons: string;
}

function initRetro(race: RaceEvent): RetroState {
  return {
    feelScore: race.retroFeelScore,
    pacingNotes: race.retroPacingNotes ?? '',
    nutritionNotes: race.retroNutritionNotes ?? '',
    lessons: race.retroLessons ?? '',
  };
}

function pacingDeltaLabel(goalTimeS: number, resultTimeS: number): string {
  const deltaS = resultTimeS - goalTimeS;
  const sign = deltaS > 0 ? '+' : '';
  const absM = Math.floor(Math.abs(deltaS) / 60);
  const absS = Math.round(Math.abs(deltaS) % 60);
  const pct = ((deltaS / goalTimeS) * 100).toFixed(1);
  return `${sign}${absM}:${String(absS).padStart(2, '0')} (${sign}${pct}%)`;
}

interface RetroPanelProps {
  race: RaceEvent;
  onClose: () => void;
  onSave: (raceId: string, state: RetroState) => Promise<void>;
  onGenerateRetro: (race: RaceEvent, feelScore: number | null) => Promise<void>;
  isSaving: boolean;
  isGenerating: boolean;
  isPlus: boolean;
  onPaywall: () => void;
}

function RetroPanel({
  race,
  onClose,
  onSave,
  onGenerateRetro,
  isSaving,
  isGenerating,
  isPlus,
  onPaywall,
}: RetroPanelProps) {
  const [form, setForm] = useState<RetroState>(() => initRetro(race));

  const hasDelta = race.goalTimeS != null && race.resultTimeS != null;
  const deltaLabel = hasDelta
    ? pacingDeltaLabel(race.goalTimeS!, race.resultTimeS!)
    : null;
  const fasterThanGoal = hasDelta && race.resultTimeS! < race.goalTimeS!;

  return (
    <View style={styles.retroPanel}>
      <View style={styles.logisticsHeader}>
        <Text style={styles.retroTitle}>Race Retrospective</Text>
        <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close race retrospective">
          <Text style={styles.logisticsClose}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Pacing accuracy summary */}
      {hasDelta ? (
        <View style={[styles.deltaBadge, fasterThanGoal ? styles.deltaBadgeGood : styles.deltaBadgeMiss]}>
          <Text style={styles.deltaLabel}>VS GOAL</Text>
          <Text style={[styles.deltaValue, fasterThanGoal ? styles.deltaValueGood : styles.deltaValueMiss]}>
            {deltaLabel}
          </Text>
          <Text style={styles.deltaSubtext}>
            {fasterThanGoal ? 'Ahead of target' : 'Behind target'}
          </Text>
        </View>
      ) : null}

      {/* Feel score */}
      <Text style={[styles.fieldLabel, { marginTop: 12 }]}>HOW DID IT FEEL?</Text>
      <View style={styles.feelRow}>
        {FEEL_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.score}
            style={[styles.feelChip, form.feelScore === opt.score && styles.feelChipActive]}
            onPress={() => setForm((p) => ({ ...p, feelScore: opt.score }))}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: form.feelScore === opt.score }}
          >
            <Text style={[styles.feelScore, form.feelScore === opt.score && styles.feelScoreActive]}>
              {opt.score}
            </Text>
            <Text style={[styles.feelLabel, form.feelScore === opt.score && styles.feelLabelActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Pacing notes */}
      <Text style={styles.fieldLabel}>PACING REFLECTION</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="How did the pacing feel? Went out too hard? Negative split?"
        placeholderTextColor={Theme.textMut}
        value={form.pacingNotes}
        onChangeText={(t) => setForm((p) => ({ ...p, pacingNotes: t }))}
        multiline
        numberOfLines={3}
        accessibilityLabel="Pacing reflection notes"
      />

      {/* Nutrition notes */}
      <Text style={styles.fieldLabel}>NUTRITION ADHERENCE</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="Did the fueling plan hold up? Bonk? GI issues?"
        placeholderTextColor={Theme.textMut}
        value={form.nutritionNotes}
        onChangeText={(t) => setForm((p) => ({ ...p, nutritionNotes: t }))}
        multiline
        numberOfLines={3}
        accessibilityLabel="Nutrition adherence notes"
      />

      {/* Key lessons */}
      <Text style={styles.fieldLabel}>KEY LESSONS</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder="What would you do differently next time?"
        placeholderTextColor={Theme.textMut}
        value={form.lessons}
        onChangeText={(t) => setForm((p) => ({ ...p, lessons: t }))}
        multiline
        numberOfLines={3}
        accessibilityLabel="Key lessons"
      />

      {/* Ozzie's take */}
      <View style={styles.briefingSection}>
        <View style={styles.briefingHeaderRow}>
          <Text style={styles.briefingLabel}>OZZIE'S TAKE</Text>
          {/* Hand-rolled, not <Button>: same reasoning as the Logistics panel's
              generate button — generateBtn has no border/fill of its own. */}
          <TouchableOpacity
            onPress={() => (isPlus ? onGenerateRetro(race, form.feelScore) : onPaywall())}
            disabled={isGenerating}
            style={styles.generateBtn}
            accessibilityRole="button"
            accessibilityLabel={!isPlus ? 'Unlock OSPREY+ to generate race retrospective' : race.ozzieRetroText ? "Refresh Ozzie's take" : "Generate Ozzie's take"}
            accessibilityState={{ disabled: isGenerating, busy: isGenerating }}
          >
            {isGenerating ? (
              <ActivityIndicator color={Theme.accent} size="small" />
            ) : (
              <Text style={styles.generateBtnText}>
                {!isPlus ? '🔒 OSPREY+' : race.ozzieRetroText ? '↺ Refresh' : 'Generate'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
        {race.ozzieRetroText ? (
          <Text style={styles.briefingText}>{race.ozzieRetroText}</Text>
        ) : (
          <Text style={styles.briefingPlaceholder}>
            Save your notes, then tap Generate for Ozzie's coaching debrief.
          </Text>
        )}
      </View>

      <Button
        onPress={() => onSave(race.id, form)}
        disabled={isSaving}
        busy={isSaving}
        accessibilityLabel="Save retrospective"
        style={styles.saveBtn}
      >
        {isSaving ? <ActivityIndicator color={Theme.ink} /> : 'Save Retrospective'}
      </Button>
    </View>
  );
}

// ─── Partners panel ──────────────────────────────────────────────────────────
// Self-contained: owns the useRacePartners query so it only runs when open.

interface PartnersPanelProps {
  race: RaceEvent;
  onClose: () => void;
}

function PartnersPanel({ race, onClose }: PartnersPanelProps) {
  const { friendsAtRace, partners, partnerIds, isLoading, addPartner, removePartner } =
    useRacePartners(race);

  const isWorking = addPartner.isPending || removePartner.isPending;

  function togglePartner(friendUserId: string) {
    if (isWorking) return;
    if (partnerIds.has(friendUserId)) {
      removePartner.mutate(friendUserId, {
        onError: () => Alert.alert('Error', 'Could not remove partner. Try again.'),
      });
    } else {
      addPartner.mutate(friendUserId, {
        onError: () => Alert.alert('Error', 'Could not add partner. Try again.'),
      });
    }
  }

  // Partners whose races aren't visible in friendsAtRace (friend deleted their event, etc.)
  const orphanedPartners =
    partners?.filter((p) => !friendsAtRace?.some((f) => f.friendUserId === p.partnerUserId)) ?? [];

  return (
    <View style={styles.partnersPanel}>
      <View style={styles.logisticsHeader}>
        <View>
          <Text style={styles.partnersTitle}>Training Partners</Text>
          <Text style={styles.partnersSubtitle}>{formatEventDate(race.eventDate)}</Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close training partners">
          <Text style={styles.logisticsClose}>✕</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={Theme.accent} style={{ marginVertical: 12 }} />
      ) : friendsAtRace && friendsAtRace.length > 0 ? (
        <>
          <Text style={styles.partnersHint}>
            Tap to flag shared training days with a friend racing this event.
          </Text>
          {friendsAtRace.map((friend) => {
            const linked = partnerIds.has(friend.friendUserId);
            return (
              <TouchableOpacity
                key={friend.friendUserId}
                style={[styles.friendRow, linked && styles.friendRowLinked]}
                onPress={() => togglePartner(friend.friendUserId)}
                activeOpacity={0.75}
                disabled={isWorking}
                accessibilityRole="button"
                accessibilityLabel={`${friend.friendDisplayName}, ${friend.friendRaceName}`}
                accessibilityState={{ selected: linked, disabled: isWorking }}
              >
                <View style={styles.friendAvatar}>
                  <Text style={styles.friendInitial}>
                    {friend.friendDisplayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.friendName}>{friend.friendDisplayName}</Text>
                  <Text style={styles.friendRaceName}>{friend.friendRaceName}</Text>
                </View>
                <View style={[styles.linkBadge, linked && styles.linkBadgeActive]}>
                  <Text style={[styles.linkBadgeText, linked && styles.linkBadgeTextActive]}>
                    {linked ? '✓ Training' : '+ Train together'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </>
      ) : (
        <Text style={styles.partnersEmpty}>
          None of your accepted friends have a race on this date yet.
        </Text>
      )}

      {orphanedPartners.length > 0 ? (
        <>
          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>LINKED PARTNERS</Text>
          {orphanedPartners.map((p) => (
            <View key={p.partnerUserId} style={[styles.friendRow, styles.friendRowLinked]}>
              <View style={styles.friendAvatar}>
                <Text style={styles.friendInitial}>
                  {p.partnerDisplayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.friendName, { flex: 1 }]}>{p.partnerDisplayName}</Text>
              <TouchableOpacity
                onPress={() => removePartner.mutate(p.partnerUserId)}
                disabled={isWorking}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${p.partnerDisplayName} as training partner`}
                accessibilityState={{ disabled: isWorking }}
              >
                <Text style={styles.actionDelete}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function RacesScreen() {
  const queryClient = useQueryClient();
  const [buildingPlanRaceId, setBuildingPlanRaceId] = useState<string | null>(null);
  const router = useRouter();
  const { isPlus } = useSubscription();
  const {
    upcoming,
    past,
    isLoading,
    error,
    create,
    recordResult,
    remove,
    linkToPlan,
    saveLogistics,
    generateBriefing,
    saveRetro,
    generateRetro,
  } = useRaces();
  const { units } = useUnitPreference();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [customMiles, setCustomMiles] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [goalTime, setGoalTime] = useState('');
  const [location, setLocation] = useState('');

  const [logisticsRaceId, setLogisticsRaceId] = useState<string | null>(null);
  const [retroRaceId, setRetroRaceId] = useState<string | null>(null);
  const [partnersRaceId, setPartnersRaceId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [resultRace, setResultRace] = useState<RaceEvent | null>(null);

  function resetForm() {
    setName('');
    setDistanceKm(null);
    setCustomMiles('');
    setEventDate('');
    setGoalTime('');
    setLocation('');
    setShowForm(false);
  }

  async function handleCreate() {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'What event is this?';
    if (!isValidDate(eventDate)) errors.date = 'When is race day?';
    const customValue = customMiles ? Number(customMiles) : null;
    if (customValue != null && (!Number.isFinite(customValue) || customValue <= 0)) {
      errors.distance = 'Enter a number like 3.1.';
    }
    const km =
      distanceKm ??
      (customValue != null && Number.isFinite(customValue) && customValue > 0
        ? units === 'metric'
          ? customValue
          : milesToKm(customValue)
        : null);
    const goalTimeS = goalTime ? parseRaceTime(goalTime) : null;
    if (goalTime && goalTimeS == null) {
      errors.goalTime = 'Use h:mm:ss or mm:ss, e.g. 1:45:00.';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    try {
      await create.mutateAsync({
        name: name.trim(),
        distanceKm: km,
        eventDate,
        goalTimeS,
        location: location.trim() || null,
      });
      resetForm();
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Try again.');
    }
  }

  async function handleLinkToPlan(race: RaceEvent) {
    try {
      const linked = await linkToPlan.mutateAsync(race.id);
      Alert.alert(
        'Training plan',
        linked
          ? `Your active plan is now pointed at ${race.name}.`
          : 'No active training plan to link yet — generate one from the home screen first.',
      );
    } catch (err) {
      Alert.alert('Link failed', err instanceof Error ? err.message : 'Try again.');
    }
  }

  function handleBuildPlan(race: RaceEvent) {
    const weeks = Math.max(1, Math.round(race.daysUntil / 7));
    Alert.alert(
      'Build Training Plan',
      `Ozzie will build a ${weeks}-week training plan targeting ${race.name}. This will replace your current plan. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Build Plan', onPress: () => buildPlanForRace(race, weeks) },
      ],
    );
  }

  async function buildPlanForRace(race: RaceEvent, weeks: number) {
    setBuildingPlanRaceId(race.id);
    try {
      const { data, error } = await invokeGeneratePlan({
        raceTarget: {
          raceName: race.name,
          raceDate: race.eventDate,
          distance: formatRaceDistance(race.distanceKm ?? 0, units) ?? 'Running',
          weeksOut: weeks,
        },
        force: true,
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
      router.push({
        pathname: '/plan-preview',
        params: { sessions: JSON.stringify(sessions) },
      });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to generate plan. Try again.');
    } finally {
      setBuildingPlanRaceId(null);
    }
  }

  function handleRecordResult(race: RaceEvent) {
    setResultRace(race);
  }

  async function handleSubmitResult(text: string) {
    const race = resultRace;
    setResultRace(null);
    if (!race) return;
    const seconds = parseRaceTime(text);
    if (seconds == null) {
      Alert.alert('Invalid time', 'Use h:mm:ss or mm:ss, e.g. 1:45:00.');
      return;
    }
    try {
      await recordResult.mutateAsync({ raceId: race.id, resultTimeS: seconds });
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Try again.');
    }
  }

  function handleDelete(race: RaceEvent) {
    Alert.alert('Remove race', `Remove ${race.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(race.id) },
    ]);
  }

  async function handleSaveLogistics(raceId: string, state: LogisticsState) {
    try {
      await saveLogistics.mutateAsync({
        raceId,
        update: {
          packetPickupTime: state.packetPickupTime || null,
          parkingNotes: state.parkingNotes || null,
          gearNotes: state.gearNotes || null,
          morningChecklist: state.checklist,
        },
      });
      setLogisticsRaceId(null);
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Try again.');
    }
  }

  async function handleGenerateBriefing(race: RaceEvent) {
    try {
      await generateBriefing.mutateAsync(race);
    } catch (err) {
      Alert.alert('Generate failed', err instanceof Error ? err.message : 'Try again.');
    }
  }

  async function handleSaveRetro(raceId: string, state: RetroState) {
    try {
      await saveRetro.mutateAsync({
        raceId,
        update: {
          retroFeelScore: state.feelScore,
          retroPacingNotes: state.pacingNotes || null,
          retroNutritionNotes: state.nutritionNotes || null,
          retroLessons: state.lessons || null,
        },
      });
      setRetroRaceId(null);
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Try again.');
    }
  }

  async function handleGenerateRetro(race: RaceEvent, feelScore: number | null) {
    try {
      await generateRetro.mutateAsync({ race, feelScore });
    } catch (err) {
      Alert.alert('Generate failed', err instanceof Error ? err.message : 'Try again.');
    }
  }

  const nextRace = upcoming?.[0];

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader
        title="Races"
        right={
          <TouchableOpacity
            onPress={() => setShowForm((v) => !v)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={showForm ? 'Close add race form' : 'Add a race'}
          >
            <Text style={styles.add}>{showForm ? '−' : '+'}</Text>
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {showForm ? (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Add a race</Text>
              <TextInput
                style={[styles.input, fieldErrors.name ? styles.inputError : null]}
                placeholder="Race name (e.g. Chicago Marathon)"
                placeholderTextColor={Theme.textMut}
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  setFieldErrors((prev) => ({ ...prev, name: '' }));
                }}
                accessibilityLabel="Race name"
              />
              <FieldError message={fieldErrors.name} />

              <Text style={styles.fieldLabel}>DISTANCE</Text>
              <View style={styles.chipRow}>
                {RACE_DISTANCE_LADDER.map((p) => (
                  <TouchableOpacity
                    key={p.label}
                    style={[styles.chip, distanceKm === p.km && styles.chipActive]}
                    onPress={() => {
                      setDistanceKm(p.km);
                      setCustomMiles('');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={p.label}
                    accessibilityState={{ selected: distanceKm === p.km }}
                  >
                    <Text style={[styles.chipText, distanceKm === p.km && styles.chipTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TextInput
                  style={[styles.input, styles.customMiles, distanceKm == null && customMiles ? styles.chipActive : null]}
                  placeholder={units === 'metric' ? 'km' : 'mi'}
                  placeholderTextColor={Theme.textMut}
                  keyboardType="decimal-pad"
                  value={customMiles}
                  onChangeText={(t) => {
                    setCustomMiles(t);
                    setDistanceKm(null);
                    setFieldErrors((prev) => ({ ...prev, distance: '' }));
                  }}
                  accessibilityLabel={`Custom distance in ${units === 'metric' ? 'kilometers' : 'miles'}`}
                />
              </View>
              <FieldError message={fieldErrors.distance} />

              <Text style={styles.fieldLabel}>DATE</Text>
              <DateField
                value={eventDate}
                onChange={(d) => {
                  setEventDate(d);
                  setFieldErrors((prev) => ({ ...prev, date: '' }));
                }}
                placeholder="Race day"
                minimumDate={new Date()}
              />
              <FieldError message={fieldErrors.date} />

              <Text style={styles.fieldLabel}>GOAL TIME (optional)</Text>
              <TextInput
                style={[styles.input, fieldErrors.goalTime ? styles.inputError : null]}
                placeholder="h:mm:ss (e.g. 1:45:00)"
                placeholderTextColor={Theme.textMut}
                value={goalTime}
                onChangeText={(v) => {
                  setGoalTime(v);
                  setFieldErrors((prev) => ({ ...prev, goalTime: '' }));
                }}
                autoCapitalize="none"
                accessibilityLabel="Goal time"
              />
              <FieldError message={fieldErrors.goalTime} />

              <Text style={styles.fieldLabel}>LOCATION (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="City, venue…"
                placeholderTextColor={Theme.textMut}
                value={location}
                onChangeText={setLocation}
                accessibilityLabel="Location"
              />

              <Button
                onPress={handleCreate}
                disabled={create.isPending}
                busy={create.isPending}
                accessibilityLabel="Save race"
                style={styles.saveBtn}
              >
                {create.isPending ? <ActivityIndicator color={Theme.ink} /> : 'Save Race'}
              </Button>
            </View>
          ) : null}

          <View style={styles.discoverCard}>
            <Text style={styles.discoverEmoji}>🔍</Text>
            <View style={styles.discoverBody}>
              <Text style={styles.discoverTitle}>Find Your Next Race</Text>
              <Text style={styles.discoverSub}>
                Search 50,000+ running events — 5K to marathon.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.discoverBtn}
              onPress={() => router.push('/race-search')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Discover events, search races"
            >
              <Text style={styles.discoverBtnText}>Discover Events →</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ActivityIndicator color={Theme.accent} style={{ marginTop: 32 }} />
          ) : error ? (
            <Text style={styles.errorText}>Couldn&apos;t load races.</Text>
          ) : (
            <>
              {nextRace ? (
                <View style={styles.nextCard}>
                  <Text style={styles.nextLabel}>NEXT UP</Text>
                  <Text style={styles.nextName}>{nextRace.name}</Text>
                  <Text style={styles.nextCountdown}>{countdownLabel(nextRace.daysUntil)}</Text>
                  <View style={styles.nextMetaRow}>
                    {nextRace.distanceKm ? (
                      <Text style={styles.nextMeta}>{formatRaceDistance(nextRace.distanceKm, units)}</Text>
                    ) : null}
                    {formatPacePerUnit(nextRace.goalTimeS, nextRace.distanceKm, units) ? (
                      <Text style={styles.nextMeta}>
                        Goal {formatPacePerUnit(nextRace.goalTimeS, nextRace.distanceKm, units)}
                      </Text>
                    ) : null}
                    {nextRace.goalTimeS ? (
                      <Text style={styles.nextMeta}>Target {formatRaceTime(nextRace.goalTimeS)}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.nextRunway}>{raceRunwayLabel(Math.round(nextRace.daysUntil / 7))}</Text>
                </View>
              ) : null}

              {upcoming && upcoming.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>UPCOMING</Text>
                  {upcoming.map((race) => (
                    <View key={race.id}>
                      <View style={styles.raceRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.raceName}>{race.name}</Text>
                          <Text style={styles.raceMeta}>
                            {formatEventDate(race.eventDate)} · {countdownLabel(race.daysUntil)}
                            {race.distanceKm ? ` · ${formatRaceDistance(race.distanceKm, units)}` : ''}
                            {race.location ? ` · ${race.location}` : ''}
                          </Text>
                          <View style={styles.actionRow}>
                            <View style={styles.actionGroup}>
                              <TouchableOpacity
                                onPress={() => handleBuildPlan(race)}
                                disabled={buildingPlanRaceId === race.id}
                                accessibilityRole="button"
                                accessibilityLabel={`Build a training plan for ${race.name}`}
                              >
                                <Text style={styles.actionLink}>
                                  {buildingPlanRaceId === race.id ? 'Building…' : 'Build plan'}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => handleLinkToPlan(race)}
                                accessibilityRole="button"
                                accessibilityLabel={`Link ${race.name} to training plan`}
                              >
                                <Text style={styles.actionLink}>Link to plan</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() =>
                                  setLogisticsRaceId((id) => (id === race.id ? null : race.id))
                                }
                                accessibilityRole="button"
                                accessibilityLabel={`${logisticsRaceId === race.id ? 'Hide' : 'Show'} logistics for ${race.name}`}
                                accessibilityState={{ expanded: logisticsRaceId === race.id }}
                              >
                                <Text
                                  style={[
                                    styles.actionLink,
                                    logisticsRaceId === race.id && styles.actionLinkActive,
                                  ]}
                                >
                                  Logistics
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() =>
                                  setPartnersRaceId((id) => (id === race.id ? null : race.id))
                                }
                                accessibilityRole="button"
                                accessibilityLabel={`${partnersRaceId === race.id ? 'Hide' : 'Show'} training partners for ${race.name}`}
                                accessibilityState={{ expanded: partnersRaceId === race.id }}
                              >
                                <Text
                                  style={[
                                    styles.actionLink,
                                    partnersRaceId === race.id && styles.actionLinkActive,
                                  ]}
                                >
                                  Partners
                                </Text>
                              </TouchableOpacity>
                            </View>
                            <TouchableOpacity
                              onPress={() => handleDelete(race)}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel={`Remove ${race.name}`}
                            >
                              <Text style={styles.actionDelete}>Remove</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>

                      {logisticsRaceId === race.id ? (
                        <LogisticsPanel
                          race={race}
                          onClose={() => setLogisticsRaceId(null)}
                          onSave={handleSaveLogistics}
                          onGenerateBriefing={handleGenerateBriefing}
                          isSaving={saveLogistics.isPending}
                          isGenerating={generateBriefing.isPending}
                          isPlus={isPlus}
                          onPaywall={() => router.push('/paywall')}
                        />
                      ) : null}

                      {partnersRaceId === race.id ? (
                        <PartnersPanel
                          race={race}
                          onClose={() => setPartnersRaceId(null)}
                        />
                      ) : null}
                    </View>
                  ))}
                </>
              ) : !showForm ? (
                <Text style={styles.empty}>
                  No upcoming races. Tap + to add one — Ozzie will count down the days and pace your
                  goal.
                </Text>
              ) : null}

              {past && past.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>PAST RESULTS</Text>
                  {past.map((race) => (
                    <View key={race.id}>
                      <View style={styles.raceRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.raceName}>{race.name}</Text>
                          <Text style={styles.raceMeta}>
                            {formatEventDate(race.eventDate)}
                            {race.distanceKm ? ` · ${formatRaceDistance(race.distanceKm, units)}` : ''}
                            {race.resultTimeS ? ` · Finished ${formatRaceTime(race.resultTimeS)}` : ''}
                          </Text>
                          <View style={styles.actionRow}>
                            {!race.resultTimeS ? (
                              <TouchableOpacity
                                onPress={() => handleRecordResult(race)}
                                accessibilityRole="button"
                                accessibilityLabel={`Record result for ${race.name}`}
                              >
                                <Text style={styles.actionLink}>Record result</Text>
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                onPress={() =>
                                  setRetroRaceId((id) => (id === race.id ? null : race.id))
                                }
                                accessibilityRole="button"
                                accessibilityLabel={`${retroRaceId === race.id ? 'Hide' : 'Show'} retrospective for ${race.name}`}
                                accessibilityState={{ expanded: retroRaceId === race.id }}
                              >
                                <Text
                                  style={[
                                    styles.actionLink,
                                    retroRaceId === race.id && styles.actionLinkActive,
                                  ]}
                                >
                                  {race.ozzieRetroText ? 'Retrospective ✓' : 'Retrospective'}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      </View>

                      {retroRaceId === race.id ? (
                        <RetroPanel
                          race={race}
                          onClose={() => setRetroRaceId(null)}
                          onSave={handleSaveRetro}
                          onGenerateRetro={handleGenerateRetro}
                          isSaving={saveRetro.isPending}
                          isGenerating={generateRetro.isPending}
                          isPlus={isPlus}
                          onPaywall={() => router.push('/paywall')}
                        />
                      ) : null}
                    </View>
                  ))}
                </>
              ) : null}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <InputModal
        visible={resultRace != null}
        title="Record result"
        message={resultRace ? `Finish time for ${resultRace.name}` : undefined}
        placeholder="h:mm:ss (e.g. 1:45:00)"
        keyboardType="numbers-and-punctuation"
        validate={(text) => (parseRaceTime(text) == null ? 'Use h:mm:ss or mm:ss.' : null)}
        onSubmit={handleSubmitResult}
        onCancel={() => setResultRace(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.ink },
  discoverCard: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 16,
    gap: 10,
    marginBottom: 4,
  },
  discoverEmoji: { fontSize: 22 },
  discoverBody: { gap: 2 },
  discoverTitle: { color: Theme.text, fontSize: 15, fontWeight: '800' },
  discoverSub: { color: Theme.textMut, fontSize: 12, lineHeight: 17 },
  discoverBtn: {
    backgroundColor: Theme.accent,
    borderWidth: BorderWidth.card,
    borderColor: Theme.accent,
    borderRadius: Radius.card,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  discoverBtnText: { color: Theme.ink, fontSize: 13, fontWeight: '800' },
  add: { color: Theme.accent, fontSize: 24, fontWeight: '700' },
  scroll: { padding: 20, paddingBottom: 48, gap: 10 },
  empty: { color: Theme.textMut, fontSize: 14, lineHeight: 20, marginTop: 8 },
  errorText: { color: Colors.red, fontSize: 14, marginTop: 16 },

  nextCard: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 18,
    marginBottom: 6,
  },
  nextLabel: {
    color: Theme.accent,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  nextName: { color: Theme.text, fontSize: 20, fontWeight: '900', marginTop: 4 },
  nextCountdown: { color: Theme.accentBright, fontSize: 15, fontWeight: '700', marginTop: 2 },
  nextMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  nextMeta: { color: Theme.textSoft, fontSize: 13, fontWeight: '600' },
  nextRunway: { color: Theme.textSoft, fontSize: 13, marginTop: 10, lineHeight: 18 },

  sectionLabel: {
    color: Theme.accent,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 2,
  },
  raceRow: {
    flexDirection: 'row',
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 14,
  },
  raceName: { color: Theme.text, fontSize: 15, fontWeight: '700' },
  raceMeta: { color: Theme.textMut, fontSize: 12, marginTop: 3, lineHeight: 17 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  actionGroup: { flexDirection: 'row', gap: 18, flexWrap: 'wrap', flexShrink: 1 },
  actionLink: { color: Theme.accent, fontSize: 13, fontWeight: '700' },
  actionLinkActive: { color: Theme.accentBright },
  actionDelete: { color: Theme.textMut, fontSize: 13, fontWeight: '700' },

  // ── Logistics panel ──
  logisticsPanel: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderTopWidth: 0,
    borderBottomLeftRadius: Radius.card,
    borderBottomRightRadius: Radius.card,
    padding: 16,
    gap: 8,
    marginTop: -2,
  },
  logisticsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  // Panel identity collapsed to a single accent (user decision) — Logistics
  // and Retrospective no longer carry distinct teal/gold cues.
  logisticsTitle: {
    color: Theme.accent,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  logisticsClose: { color: Theme.textMut, fontSize: 16, fontWeight: '700' },

  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  checklistProgress: { color: Theme.accent, fontSize: 11, fontWeight: '700' },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: Theme.line,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Theme.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: Theme.accent, borderColor: Theme.accent },
  checkmark: { color: Theme.ink, fontSize: 13, fontWeight: '900' },
  checkLabel: { color: Theme.textSoft, fontSize: 14 },
  checkLabelDone: { color: Theme.textMut, textDecorationLine: 'line-through' },

  // Nested surface inside logisticsPanel/retroPanel (Theme.panel) — recedes
  // to Theme.ink so it doesn't read flat against its parent.
  briefingSection: {
    backgroundColor: Theme.ink,
    borderWidth: 1,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 14,
    marginTop: 8,
    gap: 8,
  },
  briefingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  briefingLabel: { color: Theme.accent, fontFamily: 'SpaceGrotesk_700Bold', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  generateBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  generateBtnText: { color: Theme.accent, fontSize: 12, fontWeight: '700' },
  briefingText: { color: Theme.text, fontSize: 14, lineHeight: 21 },
  briefingPlaceholder: { color: Theme.textMut, fontSize: 13, fontStyle: 'italic' },

  // ── Add-race form ──
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
  inputError: {
    borderColor: Colors.red,
  },
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
  multiline: { minHeight: 72, textAlignVertical: 'top', paddingTop: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Theme.line,
    backgroundColor: Theme.ink,
  },
  // Border-only, matching challenges.tsx and routes.tsx. This chip pairs with
  // chipTextActive (accent text), so the border + text are already two cues and
  // a tint would be redundant. Contrast feelChipActive in the Retro panel, which
  // has NO text-active variant and therefore does need its fill.
  chipActive: { borderColor: Theme.accent },
  chipText: { color: Theme.textMut, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: Theme.accent },
  customMiles: { width: 70, paddingVertical: 9 },
  // Only what <Button> does not already provide. Its fill, border, radius,
  // ink label and 0.5-disabled all come from the primitive now; paddingVertical
  // is kept at 13 (the primitive defaults to 12) to match the previous height
  // across all three Save buttons that share this style.
  saveBtn: { marginTop: 10, paddingVertical: 13 },

  // ── Retro panel ──
  retroPanel: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderTopWidth: 0,
    borderBottomLeftRadius: Radius.card,
    borderBottomRightRadius: Radius.card,
    padding: 16,
    gap: 8,
    marginTop: -2,
  },
  // Panel identity collapsed to a single accent (user decision) — Logistics
  // and Retrospective no longer carry distinct teal/gold cues.
  retroTitle: {
    color: Theme.accent,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  deltaBadge: {
    borderRadius: Radius.card,
    padding: 12,
    borderWidth: BorderWidth.card,
    marginBottom: 4,
  },
  // FUNCTIONAL — pass/fail against goal time, not brand
  deltaBadgeGood: {
    backgroundColor: 'rgba(76,222,128,0.07)',
    borderColor: 'rgba(76,222,128,0.25)',
  },
  deltaBadgeMiss: {
    backgroundColor: 'rgba(245,166,35,0.07)',
    borderColor: 'rgba(245,166,35,0.25)',
  },
  deltaLabel: {
    color: Theme.textMut,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  deltaValue: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  deltaValueGood: { color: Colors.green },
  deltaValueMiss: { color: Colors.amber },
  deltaSubtext: { color: Theme.textMut, fontSize: 12, marginTop: 2 },
  feelRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  feelChip: {
    flex: 1,
    minWidth: 56,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Theme.line,
    backgroundColor: Theme.ink,
  },
  // Keeps its accent tint, unlike chipActive above: this 1-5 selector has NO
  // text-active variant, so the fill + border are its only selection cues.
  // (chipActive pairs with chipTextActive, so a border alone already reads.)
  feelChipActive: { backgroundColor: Theme.accent + '1F', borderColor: Theme.accent },
  feelScore: { color: Theme.textMut, fontSize: 15, fontWeight: '800' },
  feelScoreActive: { color: Theme.accent },
  feelLabel: { color: Theme.textMut, fontSize: 9, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  feelLabelActive: { color: Theme.accent },

  // ── Partners panel ──
  partnersPanel: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderTopWidth: 0,
    borderBottomLeftRadius: Radius.card,
    borderBottomRightRadius: Radius.card,
    padding: 16,
    gap: 8,
    marginTop: -2,
  },
  // Same panel-heading role as logisticsTitle/retroTitle — collapsed to the
  // single accent identity.
  partnersTitle: {
    color: Theme.accent,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  partnersSubtitle: { color: Theme.textMut, fontSize: 11, marginTop: 1 },
  partnersHint: {
    color: Theme.textMut,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 4,
  },
  partnersEmpty: {
    color: Theme.textMut,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
    marginVertical: 8,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Theme.line,
    backgroundColor: Theme.ink,
  },
  // Active/linked state — accent tint is correct here (same treatment as
  // feelChipActive).
  friendRowLinked: {
    borderColor: Theme.accent,
    backgroundColor: Theme.accent + '1F',
  },
  friendAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Theme.accent + '1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendInitial: { color: Theme.accent, fontSize: 15, fontWeight: '800' },
  friendName: { color: Theme.text, fontSize: 14, fontWeight: '700' },
  friendRaceName: { color: Theme.textMut, fontSize: 11, marginTop: 1 },
  linkBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Theme.line,
    backgroundColor: Theme.ink,
  },
  linkBadgeActive: {
    borderColor: Theme.accent,
    backgroundColor: Theme.accent + '1F',
  },
  linkBadgeText: { color: Theme.textMut, fontSize: 11, fontWeight: '700' },
  linkBadgeTextActive: { color: Theme.accent },
});
