// OSPREY-app/src/components/ui/Button.tsx
import React, { useRef } from 'react';
import { Animated, Pressable, Text, ViewStyle } from 'react-native';
import { Theme, Radius, BorderWidth } from '@/constants/theme';

type ButtonProps = {
  variant?: 'primary' | 'secondary';
  onPress: () => void;
  children: string;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ variant = 'primary', onPress, children, disabled, style }: ButtonProps) {
  // Mirrors the webapp's .btn translate(2px,2px) press effect
  // (webapp/src/styles/app.css:8-17) via a native Animated translation.
  const translate = useRef(new Animated.Value(0)).current;

  function pressIn() {
    Animated.timing(translate, { toValue: 2, duration: 80, useNativeDriver: true }).start();
  }
  function pressOut() {
    Animated.timing(translate, { toValue: 0, duration: 80, useNativeDriver: true }).start();
  }

  const isPrimary = variant === 'primary';

  return (
    <Animated.View style={{ transform: [{ translateX: translate }, { translateY: translate }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
        style={[
          {
            backgroundColor: isPrimary ? Theme.accent : 'transparent',
            borderWidth: BorderWidth.card,
            borderColor: Theme.accent,
            borderRadius: Radius.card,
            paddingVertical: 12,
            paddingHorizontal: 18,
            alignItems: 'center',
            opacity: disabled ? 0.5 : 1,
          },
          style,
        ]}
      >
        <Text style={{ color: isPrimary ? Theme.ink : Theme.accent, fontWeight: '800', fontSize: 14 }}>
          {children}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
