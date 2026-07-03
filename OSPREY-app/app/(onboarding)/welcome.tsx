import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingShell from '@/components/onboarding/OnboardingShell';
import OzzieMascot from '@/components/OzzieMascot';
import { Colors } from '@/constants/colors';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <OnboardingShell
      step={0}
      totalSteps={5}
      title="Hey — I'm Ozzie."
      showOzzie={false}
      onContinue={() => router.push('/(onboarding)/name')}
      continueLabel="Let's go →"
    >
      <View style={styles.hero}>
        <OzzieMascot size={160} animated />
        <Text style={styles.subtitle}>
          Your OSPREY coach. Three quick questions and I&apos;ll build your first plan —
          about 90 seconds. <Text style={styles.subtitleAccent}>Ready?</Text>
        </Text>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    marginTop: 16,
    gap: 28,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 27,
    paddingHorizontal: 8,
  },
  subtitleAccent: {
    color: Colors.teal,
    fontWeight: '800',
  },
});
