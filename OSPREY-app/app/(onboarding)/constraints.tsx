import { TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingShell, { OptionCard } from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import { Colors } from '@/constants/colors';

const CONSTRAINT_TAGS: Array<{ id: string; icon: string; title: string; desc: string }> = [
  { id: 'knee', icon: '🦵', title: 'Knee', desc: 'Past or current knee issue' },
  { id: 'ankle', icon: '🦶', title: 'Ankle', desc: 'Past or current ankle issue' },
  { id: 'shoulder', icon: '💪', title: 'Shoulder', desc: 'Past or current shoulder issue' },
  { id: 'back', icon: '🔻', title: 'Back', desc: 'Past or current back issue' },
  { id: 'hip', icon: '🦴', title: 'Hip', desc: 'Past or current hip issue' },
  { id: 'none', icon: '✅', title: 'None', desc: "Nothing I'm working around right now" },
];

export default function ConstraintsScreen() {
  const router = useRouter();
  const constraintTags = useOnboardingStore((s) => s.constraintTags);
  const setConstraintTags = useOnboardingStore((s) => s.setConstraintTags);
  const injuryNotes = useOnboardingStore((s) => s.injuryNotes);
  const setInjuryNotes = useOnboardingStore((s) => s.setInjuryNotes);

  function toggleTag(tag: string) {
    if (tag === 'none') {
      setConstraintTags(constraintTags.includes('none') ? [] : ['none']);
      return;
    }
    const withoutNone = constraintTags.filter((t) => t !== 'none');
    if (withoutNone.includes(tag)) {
      setConstraintTags(withoutNone.filter((t) => t !== tag));
    } else {
      setConstraintTags([...withoutNone, tag]);
    }
  }

  return (
    <OnboardingShell
      step={5}
      totalSteps={7}
      title="Anything I should know?"
      hint="Flag any areas you're managing so I can design around them. Pick as many as apply."
      onContinue={() => router.push('/(onboarding)/health')}
    >
      {CONSTRAINT_TAGS.map((tag) => (
        <OptionCard
          key={tag.id}
          icon={tag.icon}
          title={tag.title}
          description={tag.desc}
          selected={constraintTags.includes(tag.id)}
          onPress={() => toggleTag(tag.id)}
        />
      ))}

      <TextInput
        style={styles.input}
        placeholder="Anything else? (optional)"
        placeholderTextColor={Colors.textMuted}
        value={injuryNotes}
        onChangeText={setInjuryNotes}
        multiline
        numberOfLines={3}
        accessibilityLabel="Additional injury or constraint notes"
      />
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  input: {
    marginTop: 8,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    minHeight: 88,
    paddingHorizontal: 16,
    paddingTop: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    textAlignVertical: 'top',
  },
});
