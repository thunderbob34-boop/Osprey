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
            placeholderTextColor={Colors.textMuted}
            value={text}
            onChangeText={(v) => {
              setText(v);
              setError('');
            }}
            keyboardType={keyboardType}
            autoFocus
            autoCapitalize="none"
          />
          <FieldError message={error} />
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0D1424',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 20,
    gap: 12,
  },
  title: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  message: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginTop: -6 },
  input: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  inputError: { borderColor: Colors.red },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  submitBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { fontSize: 14, fontWeight: '800', color: '#000' },
});
