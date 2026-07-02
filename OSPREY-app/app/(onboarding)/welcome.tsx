import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingShell from '@/components/onboarding/OnboardingShell';
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
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarEmoji}>🦅</Text>
        </View>
        <Text style={styles.subtitle}>
          Your OSPREY coach. A few quick questions and I&apos;ll build your first plan — about
          90 seconds.
        </Text>
        <View style={styles.speech}>
          <Text style={styles.speaker}>Ozzie says:</Text>
          <Text style={styles.quote}>
            &ldquo;Three questions, one plan, and we adjust as we go. Ready?&rdquo;
          </Text>
        </View>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    marginTop: 8,
  },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  avatarEmoji: {
    fontSize: 44,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  speech: {
    width: '100%',
    backgroundColor: Colors.surfaceGold,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderGold,
  },
  speaker: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.gold,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  quote: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
    fontStyle: 'italic',
  },
});
