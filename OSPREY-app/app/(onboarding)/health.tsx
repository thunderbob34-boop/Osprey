import { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingShell, { OptionCard } from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { completeOnboarding } from '@/services/onboarding';
import { isHealthKitSupported, requestHealthKitAuthorization } from '@/services/healthkit';
import { Colors } from '@/constants/colors';

export default function HealthScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const healthConnected = useOnboardingStore((s) => s.healthConnected);
  const setHealthConnected = useOnboardingStore((s) => s.setHealthConnected);
  const draft = useOnboardingStore();
  const reset = useOnboardingStore((s) => s.reset);
  const [loading, setLoading] = useState(false);

  async function handleFinish() {
    if (!userId) return;

    setLoading(true);
    try {
      await completeOnboarding(userId, {
        displayName: draft.displayName,
        primaryGoal: draft.primaryGoal,
        experienceTier: draft.experienceTier,
        weeklyRunDays: draft.weeklyRunDays,
        weeklyLiftDays: draft.weeklyLiftDays,
        healthConnected: draft.healthConnected,
      });
      await fetchProfile();
      reset();
      router.replace('/(tabs)');
    } catch (err) {
      Alert.alert(
        'Setup failed',
        err instanceof Error ? err.message : 'Could not save your profile. Try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleConnectHealth() {
    if (!isHealthKitSupported()) {
      // Simulator or non-Apple device — mark intent, skip real auth
      setHealthConnected(true);
      return;
    }
    try {
      const authorized = await requestHealthKitAuthorization();
      setHealthConnected(authorized);
      if (!authorized) {
        Alert.alert('Apple Health', 'Permission not granted. You can connect later in Settings.');
      }
    } catch {
      // Entitlement missing in Expo Go — silently mark intent so setup can complete
      setHealthConnected(true);
    }
  }

  return (
    <OnboardingShell
      step={4}
      totalSteps={4}
      title="Connect Apple Health"
      hint="Ozzie uses HRV, sleep, and heart rate to score recovery and tune your plan."
      onContinue={handleFinish}
      continueLabel="Finish Setup →"
      loading={loading}
    >
      <OptionCard
        icon="❤️"
        title="Connect Apple Health"
        description="Read heart rate, HRV, sleep, and workouts. Ozzie writes completed sessions back to Health."
        selected={healthConnected}
        onPress={handleConnectHealth}
      />
      <OptionCard
        icon="⏭"
        title="Skip for now"
        description="You can connect later in Settings. Ozzie still builds a useful plan without wearable data."
        selected={!healthConnected}
        onPress={() => setHealthConnected(false)}
      />

      <View style={styles.noteCard}>
        <Text style={styles.noteText}>
          Missing data is never a blocker. Ozzie adapts whether you connect a wearable on day one or
          day thirty.
        </Text>
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  noteCard: {
    marginTop: 8,
    backgroundColor: Colors.surfaceTeal,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderTeal,
  },
  noteText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
