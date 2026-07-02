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
      Alert.alert('Reminders', 'Give the supplement a name first.');
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
    if (!userId) return;
    Alert.alert('Remove reminder?', `Remove the reminder for ${reminder.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSupplementReminder(reminder.id);
            setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
            await reconcileSupplementReminders(userId);
          } catch (err) {
            Alert.alert('Reminders', err instanceof Error ? err.message : 'Could not delete.');
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Supplement Reminders</Text>
        <View style={{ width: 20 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {loading ? (
            <ActivityIndicator color={Colors.teal} style={{ marginTop: 32 }} />
          ) : (
            <>
              {reminders.length === 0 ? (
                <Text style={styles.empty}>
                  No reminders yet. Add creatine, electrolytes, vitamins, or meds below — Ozzie will
                  ping you at the right time.
                </Text>
              ) : (
                reminders.map((reminder) => (
                  <View key={reminder.id} style={styles.reminderRow}>
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
                      trackColor={{ true: Colors.teal, false: Colors.border }}
                      thumbColor="#fff"
                    />
                    <TouchableOpacity onPress={() => handleDelete(reminder)} hitSlop={10}>
                      <Text style={styles.delete}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}

              <View style={styles.addCard}>
                <Text style={styles.addTitle}>Add a reminder</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Name (e.g. Creatine)"
                  placeholderTextColor={Colors.textMuted}
                  value={name}
                  onChangeText={setName}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Dosage (optional, e.g. 5g)"
                  placeholderTextColor={Colors.textMuted}
                  value={dosage}
                  onChangeText={setDosage}
                />

                <Text style={styles.fieldLabel}>TIME</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                  {HOURS.map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[styles.chip, hour === h && styles.chipActive]}
                      onPress={() => setHour(h)}
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
                    trackColor={{ true: Colors.teal, false: Colors.border }}
                    thumbColor="#fff"
                  />
                </View>

                <TouchableOpacity style={styles.addBtn} onPress={handleAdd} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.addBtnText}>Add reminder · {formatTime(hour, minute)}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  close: { color: Colors.textMuted, fontSize: 18, fontWeight: '700' },
  title: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  scroll: { padding: 20, paddingBottom: 48, gap: 10 },
  empty: { color: Colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
  },
  reminderName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  reminderDose: { color: Colors.textMuted, fontSize: 13, fontWeight: '500' },
  reminderMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  delete: { fontSize: 16 },
  addCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    gap: 10,
  },
  addTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
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
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 1,
    marginTop: 4,
  },
  chipRow: { flexGrow: 0 },
  minuteRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bg,
    marginRight: 8,
  },
  chipActive: { backgroundColor: Colors.surfaceTeal, borderColor: Colors.borderTeal },
  chipText: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: Colors.teal },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  switchLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  switchHint: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  addBtn: {
    marginTop: 6,
    backgroundColor: Colors.teal,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  addBtnText: { color: '#000', fontSize: 14, fontWeight: '800' },
});
