import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Theme, Radius } from '@/constants/theme';

interface TimeRowProps {
  label: string;
  m: string;
  s: string;
  setM: (v: string) => void;
  setS: (v: string) => void;
}

/** A "label" + "min : sec" pair of number inputs — used for every time-trial
 *  baseline entry (swim 400m/200m, rowing 2k, run time). */
export function TimeRow({ label, m, s, setM, setS }: TimeRowProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.timeRow}>
        <TextInput style={[styles.input, styles.timeInput]} value={m} onChangeText={setM} keyboardType="number-pad" placeholder="min" placeholderTextColor={Theme.textMut} />
        <Text style={styles.colon}>:</Text>
        <TextInput style={[styles.input, styles.timeInput]} value={s} onChangeText={setS} keyboardType="number-pad" placeholder="sec" placeholderTextColor={Theme.textMut} />
      </View>
    </View>
  );
}

interface NumberFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}

/** A single labeled decimal-pad input — used for distances, watts, and 1RMs. */
export function NumberField({ label, value, onChangeText, placeholder }: NumberFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={Theme.textMut}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6, marginBottom: 12 },
  label: { fontSize: 13, color: Theme.textMut, fontWeight: '600' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { backgroundColor: Theme.ink, borderWidth: 1, borderColor: Theme.line, borderRadius: Radius.card, paddingHorizontal: 14, paddingVertical: 12, color: Theme.text, fontSize: 16 },
  timeInput: { flex: 1, textAlign: 'center' },
  colon: { color: Theme.textMut, fontSize: 18, fontWeight: '700' },
});
