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
import { Theme, Radius, BorderWidth } from '@/constants/theme';
import OzzieAvatar from '@/components/OzzieAvatar';

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

  return (
    <SafeAreaView style={styles.container}>
      {step > 0 ? (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressLabel}>
            Step {step} of {totalSteps}
          </Text>
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
        <TouchableOpacity
          style={[styles.primaryBtn, continueDisabled && styles.primaryBtnDisabled]}
          onPress={onContinue}
          disabled={continueDisabled || loading}
          accessibilityRole="button"
          accessibilityLabel={continueLabel}
          accessibilityState={{ disabled: continueDisabled || loading, busy: loading }}
        >
          {loading ? (
            <ActivityIndicator color={Theme.ink} />
          ) : (
            <Text style={styles.primaryBtnText}>{continueLabel}</Text>
          )}
        </TouchableOpacity>
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

// A row of tappable day-count buttons (0-7), extracted from the old goals.tsx
// so days.tsx and split.tsx (its one-question-per-screen split) share one
// widget instead of two copies.
export function DayCountPicker({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <View style={styles.dayPicker}>
      <Text style={styles.dayLabel}>{label}</Text>
      <View style={styles.dayRow}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((day) => (
          <TouchableOpacity
            key={day}
            style={[styles.dayBtn, value === day && styles.dayBtnActive]}
            onPress={() => onChange(day)}
            accessibilityRole="button"
            accessibilityLabel={`${day} ${label}`}
            accessibilityState={{ selected: value === day }}
          >
            <Text style={[styles.dayBtnText, value === day && styles.dayBtnTextActive]}>{day}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {hint ? <Text style={styles.dayHint}>{hint}</Text> : null}
    </View>
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
  primaryBtn: {
    backgroundColor: Theme.accent,
    borderWidth: BorderWidth.card,
    borderColor: Theme.accent,
    borderRadius: Radius.card,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: Theme.ink,
  },
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
  dayPicker: {
    gap: 8,
  },
  dayLabel: {
    fontSize: 13,
    color: Theme.textMut,
    fontWeight: '600',
  },
  // All 8 buttons (0-7) fit one row via flex-to-fit rather than wrap — mirrors
  // origin/main PR #7's fix to this exact widget's predecessor in goals.tsx:
  // fixed widths + gaps didn't fit a 306pt card on a 390pt iPhone (worse on a
  // 375pt SE), so "7" wrapped onto its own line. flex+aspectRatio keeps all 8
  // on one row and square at any width.
  dayRow: {
    flexDirection: 'row',
    gap: 5,
  },
  dayBtn: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 40,
    borderRadius: Radius.card,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: Theme.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBtnActive: {
    borderColor: Theme.accent,
  },
  dayBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.textMut,
  },
  dayBtnTextActive: {
    color: Theme.accent,
  },
  dayHint: {
    fontSize: 11,
    color: Theme.textMut,
    marginTop: 2,
  },
});
