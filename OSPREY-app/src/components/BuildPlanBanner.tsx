import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Theme } from '@/constants/theme';
import { Card, Button } from '@/components/ui';

export default function BuildPlanBanner() {
  const router = useRouter();
  return (
    <Card style={styles.card}>
      <View style={styles.titleRow}>
        <MaterialCommunityIcons name="calendar-blank-outline" size={16} color={Theme.text} />
        <Text style={styles.title}>No plan yet</Text>
      </View>
      <Text style={styles.subtitle}>
        Ozzie can build a personalized schedule based on your goals.
      </Text>
      <Button
        variant="primary"
        onPress={() => router.push('/preferences')}
        accessibilityLabel="Build my plan"
        style={styles.btn}
      >
        Build My Plan →
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    gap: 8,
  } as ViewStyle,
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.text,
  },
  subtitle: {
    fontSize: 13,
    color: Theme.textSoft,
    lineHeight: 18,
  },
  btn: {
    marginTop: 4,
  } as ViewStyle,
});
