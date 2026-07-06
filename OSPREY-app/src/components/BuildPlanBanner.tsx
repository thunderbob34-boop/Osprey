import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function BuildPlanBanner() {
  const router = useRouter();
  return (
    <View style={styles.card}>
      <Text style={styles.title}>🗓 No plan yet</Text>
      <Text style={styles.subtitle}>
        Ozzie can build a personalized schedule based on your goals.
      </Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.push('/preferences')}
        accessibilityRole="button"
        accessibilityLabel="Build my plan"
      >
        <Text style={styles.btnText}>Build My Plan →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  btn: {
    marginTop: 4,
    backgroundColor: Colors.teal,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000',
  },
});
