import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface ScreenHeaderProps {
  title: string;
  /** Rendered on the right edge; pass null to keep the title centered. */
  right?: React.ReactNode;
  onBack?: () => void;
}

/** Standard modal/stack screen header: back chevron, centered title, optional right action. */
export default function ScreenHeader({ title, right, onBack }: ScreenHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack ?? (() => router.back())}
        hitSlop={12}
        style={styles.backBtn}
      >
        <Ionicons name="chevron-back" size={24} color={Colors.teal} />
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
    color: Colors.textPrimary,
  },
  right: {
    width: 44,
    alignItems: 'flex-end',
  },
});
