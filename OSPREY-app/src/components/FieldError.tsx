import { Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

/** Inline validation message rendered under a form field. */
export default function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <Text style={styles.text}>{message}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontSize: 12,
    color: Colors.red,
    marginTop: -6,
    marginBottom: 4,
  },
});
