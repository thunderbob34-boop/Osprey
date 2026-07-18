// OSPREY-app/src/components/ui/Card.tsx
import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { Theme, Radius, BorderWidth, Shadow } from '@/constants/theme';

type CardProps = {
  emphasis?: boolean;
  children: React.ReactNode;
  /**
   * `StyleProp<ViewStyle>`, not bare `ViewStyle` — callers can pass an array or
   * a conditional without spread-merging into one object first. It was already
   * being composed into a style array below; only the type was narrow.
   */
  style?: StyleProp<ViewStyle>;
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
