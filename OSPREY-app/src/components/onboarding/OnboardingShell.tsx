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
import { Colors } from '@/constants/colors';

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
            <View style={styles.ozzieAvatar}>
              <Text style={styles.ozzieEmoji}>🦅</Text>
            </View>
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
            <ActivityIndicator color="#000" />
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
  const accentColor = accent ?? Colors.teal;

  return (
    <TouchableOpacity
      style={[
        styles.optionCard,
        selected && { borderColor: accentColor, backgroundColor: `${accentColor}14` },
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
    backgroundColor: Colors.bg,
  },
  progressWrap: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 6,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.teal,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 11,
    color: Colors.textMuted,
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
  ozzieAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ozzieEmoji: {
    fontSize: 14,
  },
  ozzieName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.gold,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
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
    color: Colors.textMuted,
    lineHeight: 20,
    marginBottom: 20,
  },
  footer: {
    padding: 24,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  primaryBtn: {
    backgroundColor: Colors.teal,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
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
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  optionDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
  },
  optionCheck: {
    fontSize: 16,
    fontWeight: '800',
    width: 20,
    textAlign: 'center',
  },
});
