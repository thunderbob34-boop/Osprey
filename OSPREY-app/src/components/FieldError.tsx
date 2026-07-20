import { Text, StyleSheet } from 'react-native';
import { StatusPalette } from '@/constants/theme';

/** Inline validation message rendered under a form field. */
export default function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <Text style={styles.text}>{message}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontSize: 12,
    color: StatusPalette.danger,
    marginTop: -6,
    marginBottom: 4,
  },
});
