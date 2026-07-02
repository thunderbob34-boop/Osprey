import { TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import OnboardingShell from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useAuthStore } from '@/store/authStore';
import { Colors } from '@/constants/colors';

export default function NameScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const displayName = useOnboardingStore((s) => s.displayName);
  const setDisplayName = useOnboardingStore((s) => s.setDisplayName);

  useEffect(() => {
    if (!displayName && profile?.display_name) {
      setDisplayName(profile.display_name);
    }
  }, [displayName, profile?.display_name, setDisplayName]);

  return (
    <OnboardingShell
      step={1}
      totalSteps={5}
      title="What should Ozzie call you?"
      hint="This is how I'll greet you every morning."
      continueDisabled={!displayName.trim()}
      onContinue={() => router.push('/(onboarding)/mode')}
    >
      <TextInput
        style={styles.input}
        placeholder="Your name"
        placeholderTextColor={Colors.textMuted}
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
        autoFocus
      />
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.textPrimary,
  },
});
