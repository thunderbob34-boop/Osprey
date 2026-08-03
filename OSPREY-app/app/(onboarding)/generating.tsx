import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { completeOnboarding, generateInitialPlan } from '@/services/onboarding';
import OzzieMascot from '@/components/OzzieMascot';
import { Theme } from '@/constants/theme';

// Generation theater (docs/design-references/RUNNA-app-teardown.md's pattern):
// staged status copy over the real completeOnboarding + generateInitialPlan
// calls, instead of a bare spinner. No new art or backend work — same calls
// health.tsx used to make, just narrated while they run.
const STAGES = [
  'Reading your training history…',
  'Setting your zones and fuel targets…',
  'Building your first week…',
];

export default function GeneratingScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const draft = useOnboardingStore();
  const reset = useOnboardingStore((s) => s.reset);
  const [stage, setStage] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || !userId) return;
    startedRef.current = true;

    const stageTimer = setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES.length - 1));
    }, 1400);

    (async () => {
      try {
        const onboardingDraft = {
          displayName: draft.displayName,
          primaryGoal: draft.primaryGoal,
          experienceTier: draft.experienceTier,
          weeklyRunDays: draft.weeklyRunDays,
          weeklyLiftDays: draft.weeklyLiftDays,
          healthConnected: draft.healthConnected,
          thresholdAnchor: draft.thresholdAnchor,
          goalParams: draft.goalParams,
          raceGoal: draft.raceGoal,
          bodyWeightKg: draft.bodyWeightKg,
          availableDays: draft.availableDays,
          longSessionDay: draft.longSessionDay,
          equipment: draft.equipment,
          injuryHistory: draft.injuryHistory,
          anchorProposal: draft.anchorProposal,
        };
        await completeOnboarding(userId, onboardingDraft);
        // Best-effort — land on Home with a real plan already generated instead
        // of the "no plan yet" banner. A failure here shouldn't block finishing
        // onboarding; the banner is a perfectly fine fallback.
        await generateInitialPlan(onboardingDraft).catch(() => undefined);
        await fetchProfile();
        reset();
        router.replace('/(tabs)');
      } catch (err) {
        Alert.alert(
          'Setup failed',
          err instanceof Error ? err.message : 'Could not save your profile. Try again.',
        );
        router.back();
      } finally {
        clearInterval(stageTimer);
      }
    })();

    return () => clearInterval(stageTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <View style={styles.container}>
      <OzzieMascot size={120} animated />
      <ActivityIndicator color={Theme.accent} style={styles.spinner} />
      <Text style={styles.stageText}>{STAGES[stage]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.ink, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 },
  spinner: { marginTop: 8 },
  stageText: { fontSize: 15, fontWeight: '600', color: Theme.text, textAlign: 'center' },
});
