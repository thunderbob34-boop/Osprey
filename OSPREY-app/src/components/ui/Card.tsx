// OSPREY-app/src/components/ui/Card.tsx
import React from 'react';
import { View, ViewStyle } from 'react-native';
import { Theme, Radius, BorderWidth, Shadow } from '@/constants/theme';

type CardProps = {
  emphasis?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
};

export function Card({ emphasis = false, children, style }: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: Theme.panel,
          borderWidth: BorderWidth.card,
          borderColor: emphasis ? Theme.accent : Theme.line,
          borderRadius: Radius.card,
          padding: 14,
        },
        emphasis ? Shadow.emphasis : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
