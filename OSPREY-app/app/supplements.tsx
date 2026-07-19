import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { Theme, Radius, BorderWidth } from '@/constants/theme';
import { Card, Button } from '@/components/ui';
import FieldError from '@/components/FieldError';
import ScreenHeader from '@/components/ScreenHeader';
import { useAuthStore } from '@/store/authStore';
import {
  createSupplementReminder,
  deleteSupplementReminder,
  fetchSupplementReminders,
  reconcileSupplementReminders,
  setSupplementReminderEnabled,
  type SupplementReminder,
} from '@/services/supplements';
import { requestNotificationPermission } from '@/services/notifications';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

export default function SupplementsScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);

  const [reminders, setReminders] = useState<SupplementReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [dosage, setDosage] = useState('');
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  const [trainingDaysOnly, setTrainingDaysOnly] = useState(false);

  async function load() {
    if (!userId) return;
    try {
      setReminders(await fetchSupplementReminders(userId));
    } catch (err) {
      Alert.alert('Reminders', err instanceof Error ? err.message : 'Could not load reminders.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleAdd() {
    if (!userId) return;
    if (!name.trim()) {
      setNameError('Give the supplement a name first.');
      return;
    }
    setSaving(true);
    try {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('Notifications', 'Enable notifications to get supplement reminders.');
        return;
      }
      await createSupplementReminder(userId, {
        name: name.trim(),
        dosage: dosage.trim() || null,
        remindHour: hour,
        remindMinute: minute,
        trainingDaysOnly,
      });
      setName('');
      setDosage('');
      setTrainingDaysOnly(false);
      await load();
      await reconcileSupplementReminders(userId);
    } catch (err) {
      Alert.alert('Reminders', err instanceof Error ? err.message : 'Could not save reminder.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(reminder: SupplementReminder) {
    if (!userId) return;
    try {
      await setSupplementReminderEnabled(reminder.id, !reminder.enabled);
      setReminders((prev) =>
        prev.map((r) => (r.id === reminder.id ? { ...r, enabled: !r.enabled } : r)),
      );
      await reconcileSupplementReminders(userId);
    } catch (err) {
      Alert.alert('Reminders', err instanceof Error ? err.message : 'Could not update.');
    }
  }

  function handleDelete(reminder: SupplementReminder) {
    Alert.alert(`Delete ${reminder.name}?`, 'This reminder will stop notifying you.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => confirmDelete(reminder),
      },
    ]);
  }

  async function confirmDelete(reminder: SupplementReminder) {
    if (!userId) return;
    try {
      await deleteSupplementReminder(reminder.id);
      setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
      await reconcileSupplementReminders(userId);
    } catch (err) {
      Alert.alert('Reminders', err instanceof Error ? err.message : 'Could not delete.');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Supplement Reminders" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {loading ? (
            <ActivityIndicator color={Theme.accent} style={{ marginTop: 32 }} />
          ) : (
            <>
              {reminders.length === 0 ? (
                <Text style={styles.empty}>
                  No reminders yet. Add creatine, electrolytes, vitamins, or meds below — Ozzie will
                  ping you at the right time.
                </Text>
              ) : (
                reminders.map((reminder) => (
                  <Card key={reminder.id} style={styles.reminderRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reminderName}>
                        {reminder.name}
                        {reminder.dosage ? <Text style={styles.reminderDose}>  ·  {reminder.dosage}</Text> : null}
                      </Text>
                      <Text style={styles.reminderMeta}>
                        {formatTime(reminder.remindHour, reminder.remindMinute)}
                        {reminder.trainingDaysOnly ? '  ·  Training days only' : '  ·  Daily'}
                      </Text>
                    </View>
                    <Switch
                      value={reminder.enabled}
                      onValueChange={() => handleToggle(reminder)}
                      trackColor={{ true: Theme.accent, false: Theme.line }}
                      thumbColor="#fff"
                      accessibilityRole="switch"
                      accessibilityLabel={`${reminder.name} reminder`}
                    />
                    <TouchableOpacity
                      onPress={() => handleDelete(reminder)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${reminder.name} reminder`}
                    >
                      <Text style={styles.delete}>🗑</Text>
                    </TouchableOpacity>
                  </Card>
                ))
              )}

              <Card style={styles.addCard}>
                <Text style={styles.addTitle}>Add a reminder</Text>
                <TextInput
                  style={[styles.input, nameError ? styles.inputError : null]}
                  placeholder="Name (e.g. Creatine)"
                  placeholderTextColor={Theme.textMut}
                  value={name}
                  onChangeText={(v) => {
                    setName(v);
                    setNameError('');
                  }}
                  accessibilityLabel="Supplement name"
                />
                <FieldError message={nameError} />
                <TextInput
                  style={styles.input}
                  placeholder="Dosage (optional, e.g. 5g)"
                  placeholderTextColor={Theme.textMut}
                  value={dosage}
                  onChangeText={setDosage}
                  accessibilityLabel="Dosage, optional"
                />

                <Text style={styles.fieldLabel}>TIME</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                  {HOURS.map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[styles.chip, hour === h && styles.chipActive]}
                      onPress={() => setHour(h)}
                      accessibilityRole="button"
                      accessibilityLabel={`${h % 12 === 0 ? 12 : h % 12} ${h >= 12 ? 'PM' : 'AM'}`}
                      accessibilityState={{ selected: hour === h }}
                    >
                      <Text style={[styles.chipText, hour === h && styles.chipTextActive]}>
                        {h % 12 === 0 ? 12 : h % 12}
                        {h >= 12 ? 'p' : 'a'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.minuteRow}>
                  {MINUTES.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.chip, minute === m && styles.chipActive]}
                      onPress={() => setMinute(m)}
                      accessibilityRole="button"
                      accessibilityLabel={`${String(m).padStart(2, '0')} minutes`}
                      accessibilityState={{ selected: minute === m }}
                    >
                      <Text style={[styles.chipText, minute === m && styles.chipTextActive]}>
                        :{String(m).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchLabel}>Training days only</Text>
                    <Text style={styles.switchHint}>Only remind on days with a planned session</Text>
                  </View>
                  <Switch
                    value={trainingDaysOnly}
                    onValueChange={setTrainingDaysOnly}
                    trackColor={{ true: Theme.accent, false: Theme.line }}
                    thumbColor="#fff"
                    accessibilityRole="switch"
                    accessibilityLabel="Training days only"
                  />
                </View>

                <Button
                  onPress={handleAdd}
                  disabled={saving}
                  busy={saving}
                  accessibilityLabel={`Add reminder, ${formatTime(hour, minute)}`}
                  style={styles.addBtn}
                >
                  {saving ? <ActivityIndicator color={Theme.ink} /> : `Add reminder · ${formatTime(hour, minute)}`}
                </Button>
              </Card>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.ink },
  scroll: { padding: 20, paddingBottom: 48, gap: 10 },
  empty: { color: Theme.textMut, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reminderName: { color: Theme.text, fontSize: 15, fontWeight: '700' },
  reminderDose: { color: Theme.textMut, fontSize: 13, fontWeight: '500' },
  reminderMeta: { color: Theme.textMut, fontSize: 12, marginTop: 2 },
  delete: { fontSize: 16 },
  addCard: {
    marginTop: 8,
    gap: 10,
  },
  addTitle: { color: Theme.text, fontSize: 15, fontWeight: '800' },
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
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Theme.textMut,
    letterSpacing: 1,
    marginTop: 4,
  },
  chipRow: { flexGrow: 0 },
  minuteRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Theme.line,
    backgroundColor: Theme.ink,
    marginRight: 8,
  },
  chipActive: { backgroundColor: Theme.panel, borderColor: Theme.accent },
  chipText: { color: Theme.textMut, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: Theme.accent },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  switchLabel: { color: Theme.text, fontSize: 14, fontWeight: '700' },
  switchHint: { color: Theme.textMut, fontSize: 12, marginTop: 2 },
  // Only what <Button> does not already provide; paddingVertical is kept at 13
  // (the primitive defaults to 12).
  addBtn: { marginTop: 6, paddingVertical: 13 },
});
