import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Theme, Radius, BorderWidth } from '@/constants/theme';

interface DateFieldProps {
  /** ISO date string 'YYYY-MM-DD', or '' when unset. */
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoDate(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDisplay(value: string): string {
  const d = parseIsoDate(value);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Tap-to-pick date field backed by the native date picker.
 * Keeps a 'YYYY-MM-DD' string interface so forms can stay unchanged.
 */
export default function DateField({
  value,
  onChange,
  placeholder = 'Select date',
  minimumDate,
  maximumDate,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const current = parseIsoDate(value) ?? new Date();

  if (Platform.OS === 'android') {
    return (
      <>
        <TouchableOpacity
          style={styles.field}
          onPress={() => setOpen(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={value ? formatDisplay(value) : placeholder}
        >
          <Text style={value ? styles.fieldText : styles.fieldPlaceholder}>
            {value ? formatDisplay(value) : placeholder}
          </Text>
        </TouchableOpacity>
        {open ? (
          <DateTimePicker
            value={current}
            mode="date"
            display="default"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(event, picked) => {
              setOpen(false);
              if (event.type === 'set' && picked) onChange(toIsoDate(picked));
            }}
          />
        ) : null}
      </>
    );
  }

  // iOS — inline spinner in a bottom sheet with a Done button.
  return (
    <>
      <TouchableOpacity
        style={styles.field}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={value ? formatDisplay(value) : placeholder}
      >
        <Text style={value ? styles.fieldText : styles.fieldPlaceholder}>
          {value ? formatDisplay(value) : placeholder}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close date picker"
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <TouchableOpacity
              onPress={() => setOpen(false)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.sheetCancel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (!value) onChange(toIsoDate(current));
                setOpen(false);
              }}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Text style={styles.sheetDone}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={current}
            mode="date"
            display="spinner"
            themeVariant="dark"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(_event, picked) => {
              if (picked) onChange(toIsoDate(picked));
            }}
            style={styles.picker}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    height: 48,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  fieldText: {
    fontSize: 15,
    color: Theme.text,
    fontWeight: '600',
  },
  fieldPlaceholder: {
    fontSize: 15,
    color: Theme.textMut,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: Theme.panel,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Theme.line,
  },
  sheetCancel: { fontSize: 15, color: Theme.textMut, fontWeight: '600' },
  sheetDone: { fontSize: 15, color: Theme.accent, fontWeight: '800' },
  picker: { alignSelf: 'center' },
});
