// OSPREY-app/src/components/ui/Badge.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { Theme, Radius } from '@/constants/theme';

type BadgeProps = {
  children: React.ReactNode;
  tone?: 'accent' | 'neutral';
};

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  const color = tone === 'accent' ? Theme.accent : Theme.textMut;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: color,
        borderRadius: Radius.card,
        paddingVertical: 3,
        paddingHorizontal: 8,
      }}
    >
      <Text
        style={{
          color,
          fontFamily: 'SpaceGrotesk_700Bold',
          fontSize: 10,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        {children}
      </Text>
    </View>
  );
}
