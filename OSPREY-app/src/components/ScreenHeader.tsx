import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Theme, BorderWidth } from '@/constants/theme';

interface ScreenHeaderProps {
  title: string;
  /** Rendered on the right edge; pass null to keep the title centered. */
  right?: React.ReactNode;
  onBack?: () => void;
}

/** Standard modal/stack screen header: back chevron, centered title, optional right action. */
export default function ScreenHeader({ title, right, onBack }: ScreenHeaderProps) {
  const router = useRouter();

  // Screens can be landed on with an empty history (e.g. after a
  // dismissAll()+replace() flow like "Add to My Races" → Races), in which
  // case router.back() has nothing to do and logs a GO_BACK warning. Fall
  // back to the home tab rather than leaving the chevron dead.
  function defaultBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }

  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack ?? defaultBack}
        hitSlop={12}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={24} color={Theme.accent} />
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>{right ?? null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: BorderWidth.card,
    borderBottomColor: Theme.line,
  },
  backBtn: {
    width: 44,
    alignItems: 'flex-start',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: Theme.text,
  },
  right: {
    width: 44,
    alignItems: 'flex-end',
  },
});
