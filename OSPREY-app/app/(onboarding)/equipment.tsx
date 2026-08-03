import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import OnboardingShell from '@/components/onboarding/OnboardingShell';
import { useOnboardingStore } from '@/store/onboardingStore';
import type { EquipmentId } from '@/types/onboarding';
import { Theme, Radius } from '@/constants/theme';

const EQUIPMENT: { id: EquipmentId; icon: string; label: string }[] = [
  { id: 'barbell', icon: '🏋️', label: 'Barbell' },
  { id: 'dumbbell', icon: '🏋️‍♀️', label: 'Dumbbell' },
  { id: 'kettlebell', icon: '🔔', label: 'Kettlebell' },
  { id: 'bench', icon: '🛋️', label: 'Bench' },
  { id: 'pull_up_bar', icon: '🧗', label: 'Pull-up bar' },
  { id: 'box', icon: '📦', label: 'Box' },
  { id: 'stretch_band', icon: '➰', label: 'Stretch band' },
  { id: 'swiss_ball', icon: '⚪', label: 'Swiss ball' },
];

export default function EquipmentScreen() {
  const router = useRouter();
  const equipment = useOnboardingStore((s) => s.equipment);
  const setEquipment = useOnboardingStore((s) => s.setEquipment);

  function toggle(id: EquipmentId) {
    setEquipment(equipment.includes(id) ? equipment.filter((e) => e !== id) : [...equipment, id]);
  }

  return (
    <OnboardingShell
      step={13}
      totalSteps={13}
      title="What do you have access to?"
      hint="Your strength sessions get built from what you actually have — no prescribing a barbell squat if you're training from a hotel gym."
      onContinue={() => router.push('/(onboarding)/summary')}
      continueLabel={equipment.length === 0 ? 'Bodyweight only →' : 'Continue →'}
    >
      <View style={styles.grid}>
        {EQUIPMENT.map((item) => (
          <Pressable
            key={item.id}
            style={[styles.chip, equipment.includes(item.id) && styles.chipSelected]}
            onPress={() => toggle(item.id)}
            accessibilityRole="checkbox"
            accessibilityLabel={item.label}
            accessibilityState={{ checked: equipment.includes(item.id) }}
          >
            <Text style={styles.chipIcon}>{item.icon}</Text>
            <Text style={[styles.chipText, equipment.includes(item.id) && styles.chipTextSelected]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Theme.panel,
    borderWidth: 1,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chipSelected: { borderColor: Theme.accent },
  chipIcon: { fontSize: 16 },
  chipText: { fontSize: 14, fontWeight: '600', color: Theme.textMut },
  chipTextSelected: { color: Theme.accent },
});
