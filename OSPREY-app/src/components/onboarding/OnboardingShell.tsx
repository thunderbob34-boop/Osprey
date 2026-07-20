import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Theme, Radius, BorderWidth } from '@/constants/theme';
import OzzieAvatar from '@/components/OzzieAvatar';
import { Button } from '@/components/ui';

interface OnboardingShellProps {
  step: number;
  totalSteps: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  loading?: boolean;
  showOzzie?: boolean;
}

export default function OnboardingShell({
  step,
  totalSteps,
  title,
  hint,
  children,
  onContinue,
  continueLabel = 'Continue →',
  continueDisabled = false,
  loading = false,
  showOzzie = true,
}: OnboardingShellProps) {
  const progress = totalSteps > 0 ? (step / totalSteps) * 100 : 0;
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      {step > 0 ? (
        <View style={styles.progressWrap}>
          <View style={styles.progressHeaderRow}>
            {router.canGoBack() ? (
              <TouchableOpacity
                onPress={() => router.back()}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Ionicons name="chevron-back" size={22} color={Theme.textMut} />
              </TouchableOpacity>
            ) : (
              <View style={styles.backSpacer} />
            )}
            <Text style={styles.progressLabel}>
              Step {step} of {totalSteps}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {showOzzie && step > 0 ? (
          <View style={styles.ozzieHeader}>
            <OzzieAvatar size={28} />
            <Text style={styles.ozzieName}>Ozzie</Text>
          </View>
        ) : null}

        <Text style={[styles.title, step === 0 && styles.titleLarge]}>{title}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        {children}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          style={styles.primaryBtn}
          onPress={onContinue}
          disabled={continueDisabled || loading}
          busy={loading}
          accessibilityLabel={continueLabel}
        >
          {loading ? <ActivityIndicator color={Theme.ink} /> : continueLabel}
        </Button>
      </View>
    </SafeAreaView>
  );
}

export function OptionCard({
  title: optionTitle,
  description,
  icon,
  selected,
  onPress,
  accent,
}: {
  title: string;
  description: string;
  icon: string;
  selected: boolean;
  onPress: () => void;
  accent?: string;
}) {
  const accentColor = accent ?? Theme.accent;

  return (
    <TouchableOpacity
      style={[
        styles.optionCard,
        // Border-only. This card already carries THREE selection cues — accent
        // border, accent title, and the ✓ below — so a fill is redundant, and
        // goals.tsx renders these directly above border-only day buttons where
        // the mismatch would read as a seam. Convention: races.tsx:1267.
        selected && { borderColor: accentColor },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${optionTitle}. ${description}`}
    >
      <View style={[styles.optionIcon, { backgroundColor: `${accentColor}26` }]}>
        <Text style={styles.optionIconText}>{icon}</Text>
      </View>
      <View style={styles.optionText}>
        <Text style={[styles.optionTitle, selected && { color: accentColor }]}>
          {optionTitle}
        </Text>
        <Text style={styles.optionDesc}>{description}</Text>
      </View>
      <Text style={[styles.optionCheck, selected && { color: accentColor }]}>
        {selected ? '✓' : ''}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.ink,
  },
  progressWrap: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 6,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backSpacer: { width: 22 },
  progressTrack: {
    height: 4,
    // The unfilled track behind the accent progress fill. Same rgba value that
    // stats.tsx's sportLegend border took to Theme.line in an earlier slice.
    backgroundColor: Theme.line,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: Theme.accent,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 11,
    color: Theme.textMut,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 16,
  },
  ozzieHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  ozzieName: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Theme.accent,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Theme.text,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  titleLarge: {
    fontSize: 28,
    textAlign: 'center',
    marginTop: 24,
  },
  hint: {
    fontSize: 14,
    color: Theme.textMut,
    lineHeight: 20,
    marginBottom: 20,
  },
  footer: {
    padding: 24,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Theme.line,
  },
  primaryBtn: { paddingVertical: 17 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Theme.panel,
    borderWidth: BorderWidth.card,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 14,
    marginBottom: 10,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconText: {
    fontSize: 20,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Theme.text,
    marginBottom: 3,
  },
  optionDesc: {
    fontSize: 12,
    color: Theme.textMut,
    lineHeight: 17,
  },
  optionCheck: {
    fontSize: 16,
    fontWeight: '800',
    width: 20,
    textAlign: 'center',
  },
});
