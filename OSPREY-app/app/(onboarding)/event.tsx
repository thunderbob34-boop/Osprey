import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingShell, { OptionCard } from '@/components/onboarding/OnboardingShell';
import DateField from '@/components/DateField';
import { useOnboardingStore } from '@/store/onboardingStore';
import { Colors } from '@/constants/colors';

export default function EventScreen() {
  const router = useRouter();
  const targetRaceName = useOnboardingStore((s) => s.targetRaceName);
  const targetDate = useOnboardingStore((s) => s.targetDate);
  const setTargetRaceName = useOnboardingStore((s) => s.setTargetRaceName);
  const setTargetDate = useOnboardingStore((s) => s.setTargetDate);

  const hasNoTarget = !targetRaceName && !targetDate;

  function handleSkip() {
    setTargetRaceName(null);
    setTargetDate(null);
  }

  return (
    <OnboardingShell
      step={4}
      totalSteps={7}
      title="What are you training for?"
      hint="Give me a race or event and a date, and I'll periodize your plan around it. No target yet? That's fine too."
      onContinue={() => router.push('/(onboarding)/constraints')}
    >
      <View style={styles.field}>
        <Text style={styles.label}>Race or event name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Chicago Marathon"
          placeholderTextColor={Colors.textMuted}
          value={targetRaceName ?? ''}
          onChangeText={(text) => setTargetRaceName(text || null)}
          autoCapitalize="words"
          accessibilityLabel="Race or event name"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Target date</Text>
        <DateField
          value={targetDate ?? ''}
          onChange={setTargetDate}
          placeholder="Select a date"
          minimumDate={new Date()}
        />
      </View>

      <OptionCard
        icon="⏭"
        title="No specific race — general fitness"
        description="Skip the target date and build a general fitness plan instead."
        selected={hasNoTarget}
        onPress={handleSkip}
      />
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: Colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
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
