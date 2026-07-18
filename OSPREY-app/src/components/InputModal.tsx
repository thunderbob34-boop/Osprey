import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { Theme, Radius, BorderWidth } from '@/constants/theme';
import FieldError from '@/components/FieldError';

interface InputModalProps {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  keyboardType?: 'default' | 'numbers-and-punctuation' | 'number-pad' | 'decimal-pad';
  submitLabel?: string;
  /** Return an error message to keep the modal open, or null to accept. */
  validate?: (text: string) => string | null;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

/**
 * Cross-platform replacement for Alert.prompt (which is iOS-only).
 */
export default function InputModal({
  visible,
  title,
  message,
  placeholder,
  keyboardType = 'default',
  submitLabel = 'Save',
  validate,
  onSubmit,
  onCancel,
}: InputModalProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setText('');
      setError('');
    }
  }, [visible]);

  function handleSubmit() {
    const validationError = validate?.(text) ?? null;
    if (validationError) {
      setError(validationError);
      return;
    }
    onSubmit(text);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            placeholder={placeholder}
            placeholderTextColor={Theme.textMut}
            value={text}
            onChangeText={(v) => {
              setText(v);
              setError('');
            }}
            keyboardType={keyboardType}
            autoFocus
            autoCapitalize="none"
            accessibilityLabel={placeholder ?? title}
          />
          <FieldError message={error} />
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              accessibilityRole="button"
              accessibilityLabel={submitLabel}
            >
              <Text style={styles.submitText}>{submitLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    // Scrim, not a surface — derived from Theme.ink at the original 0.6 alpha,
    // not Theme.panel. It darkens whatever sits behind the modal, it doesn't
    // hold content.
    backgroundColor: 'rgba(9,9,11,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Theme.panel,
    borderWidth: 1,
    borderColor: Theme.line,
    // Kept as a literal sheet-affordance radius (not Radius.card) — this is
    // the modal's own outer container, matching the pattern of the Home
    // adjust sheet and DateField's picker sheet keeping a large radius.
    borderRadius: 18,
    padding: 20,
    gap: 12,
  },
  title: { fontSize: 17, fontWeight: '800', color: Theme.text },
  message: { fontSize: 13, color: Theme.textSoft, lineHeight: 19, marginTop: -6 },
  input: {
    // Nested surface inside a Theme.panel card recedes to Theme.ink so it
    // doesn't read flat against its parent.
    backgroundColor: Theme.ink,
    borderWidth: 1,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 16,
    color: Theme.text,
  },
  // Functional validation red — no Theme token exists for it, and this
  // program keeps validation red as-is everywhere it appears (see
  // FieldError.tsx, log.tsx, food-scanner.tsx).
  inputError: { borderColor: Colors.red },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  // Hand-rolled outline/secondary variant — mirrors Button's non-primary
  // styling. Cannot use <Button> here: this row needs two buttons side by
  // side and Button's style prop lands on a wrapper that ignores flex.
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: Radius.card,
    borderWidth: BorderWidth.card,
    borderColor: Theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 14, fontWeight: '700', color: Theme.accent },
  // Hand-rolled filled/primary variant — same reasoning as cancelBtn.
  submitBtn: {
    flex: 1,
    height: 46,
    borderRadius: Radius.card,
    backgroundColor: Theme.accent,
    borderWidth: BorderWidth.card,
    borderColor: Theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { fontSize: 14, fontWeight: '800', color: Theme.ink },
});
