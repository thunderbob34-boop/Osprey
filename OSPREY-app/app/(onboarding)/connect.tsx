import { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingShell, { OptionCard } from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import { isHealthKitSupported, requestHealthKitAuthorization } from '@/services/healthkit';
import { Theme, Radius } from '@/constants/theme';

// Moved to step 2 (was step 5, last) — this is the change that makes every
// later screen able to PROPOSE instead of ask: experience tier, days/week,
// availability, threshold anchor, and body weight can all pre-fill from
// HealthKit only if authorization happens before those screens run.
export default function ConnectScreen() {
  const router = useRouter();
  const healthConnected = useOnboardingStore((s) => s.healthConnected);
  const setHealthConnected = useOnboardingStore((s) => s.setHealthConnected);
  const [connecting, setConnecting] = useState(false);

  async function handleConnect() {
    if (!isHealthKitSupported()) {
      // Simulator or non-Apple device — mark intent, skip real auth. Every
      // later "propose from HealthKit" screen already falls back to asking
      // when nothing is connected, so this is a safe no-op there.
      setHealthConnected(true);
      return;
    }
    setConnecting(true);
    try {
      const authorized = await requestHealthKitAuthorization();
      setHealthConnected(authorized);
      if (!authorized) {
        Alert.alert('Apple Health', 'Permission not granted. You can connect later in Settings.');
      }
    } catch {
      // Entitlement missing in Expo Go — silently mark intent so setup can complete.
      setHealthConnected(true);
    } finally {
      setConnecting(false);
    }
  }

  return (
    <OnboardingShell
      step={2}
      totalSteps={13}
      title="Connect Apple Health"
      hint="I'll use your training history to propose your fitness numbers instead of asking you to guess them — confirm or correct anything I get wrong."
      onContinue={() => router.push('/(onboarding)/goals')}
      loading={connecting}
    >
      <OptionCard
        icon="❤️"
        title="Connect Apple Health"
        description="Read heart rate, HRV, sleep, and workouts. Ozzie writes completed sessions back to Health."
        selected={healthConnected}
        onPress={handleConnect}
      />
      <OptionCard
        icon="⏭"
        title="Skip for now"
        description="You can connect later in Settings — I'll ask for your numbers directly instead."
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
    backgroundColor: Theme.panel,
    borderRadius: Radius.card,
    padding: 14,
    borderWidth: 1,
    borderColor: Theme.line,
  },
  noteText: {
    fontSize: 12,
    color: Theme.textSoft,
    lineHeight: 18,
  },
});
