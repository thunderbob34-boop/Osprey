import { TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import OnboardingShell from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { onboardingTotalSteps } from '@/services/coaching/baseline';
import { Theme, Radius } from '@/constants/theme';

export default function NameScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const displayName = useOnboardingStore((s) => s.displayName);
  const setDisplayName = useOnboardingStore((s) => s.setDisplayName);
  const primaryGoal = useOnboardingStore((s) => s.primaryGoal);

  // Seed from the profile once on mount only — re-seeding on every change
  // would refill the field the moment the user clears it to type a new name.
  useEffect(() => {
    if (!useOnboardingStore.getState().displayName && profile?.display_name) {
      setDisplayName(profile.display_name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <OnboardingShell
      step={1}
      totalSteps={onboardingTotalSteps(primaryGoal)}
      title="What should Ozzie call you?"
      hint="This is how I'll greet you every morning."
      continueDisabled={!displayName.trim()}
      onContinue={() => router.push('/(onboarding)/mode')}
    >
      <TextInput
        style={styles.input}
        placeholder="Your name"
        placeholderTextColor={Theme.textMut}
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
        autoFocus
        accessibilityLabel="Your name"
        returnKeyType="done"
        onSubmitEditing={() => {
          if (displayName.trim()) router.push('/(onboarding)/mode');
        }}
      />
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: Theme.ink,
    borderWidth: 1,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Theme.text,
  },
});
