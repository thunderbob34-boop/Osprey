import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/colors';

export interface ActionSheetOption {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

interface ActionSheetModalProps {
  visible: boolean;
  title: string;
  message?: string;
  options: ActionSheetOption[];
  onCancel: () => void;
}

/**
 * Cross-platform replacement for a multi-option Alert.alert — Android's native
 * AlertDialog only renders up to 3 buttons, silently dropping the rest, so any
 * Alert with 4+ options (e.g. swap-session, compress-session) loses choices on
 * Android specifically.
 */
export default function ActionSheetModal({
  visible,
  title,
  message,
  options,
  onCancel,
}: ActionSheetModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onCancel}
          accessibilityLabel="Dismiss"
        />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.label}
              style={styles.optionBtn}
              onPress={opt.onPress}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
            >
              <Text style={[styles.optionText, opt.destructive && styles.optionTextDestructive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    gap: 10,
  },
  title: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  message: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginTop: -6, marginBottom: 4 },
  optionBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  optionTextDestructive: { color: Colors.red },
  cancelBtn: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  cancelText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
});
