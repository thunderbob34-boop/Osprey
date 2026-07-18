import { StyleSheet, Text, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Theme } from '@/constants/theme';
import { Card, Button } from '@/components/ui';

export default function BuildPlanBanner() {
  const router = useRouter();
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>🗓 No plan yet</Text>
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
