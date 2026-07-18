// OSPREY-app/src/components/ui/Button.tsx
import React, { useRef } from 'react';
import { Animated, Pressable, StyleProp, Text, ViewStyle } from 'react-native';
import { Theme, Radius, BorderWidth } from '@/constants/theme';

type ButtonProps = {
  variant?: 'primary' | 'secondary';
  onPress: () => void;
  /**
   * A string is wrapped in the themed `<Text>` below. Anything else renders
   * as-is, so a button can host an `<ActivityIndicator>` or an icon without
   * being hand-rolled — pass `Theme.ink` (primary) or `Theme.accent`
   * (secondary) as the spinner colour to match the label it replaces.
   */
  children: React.ReactNode;
  disabled?: boolean;
  /** Applied to the inner Pressable — padding, colours, borders. */
  style?: StyleProp<ViewStyle>;
  /**
   * Applied to the OUTER wrapper, which is the flex child when this button sits
   * in a row. `style={{ flex: 1 }}` silently does nothing: it lands on the
   * Pressable inside a wrapper that has no flex of its own, so the button
   * collapses to text width. Use `wrapperStyle={{ flex: 1 }}` instead.
   */
  wrapperStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Button({
  variant = 'primary',
  onPress,
  children,
  disabled,
  style,
  wrapperStyle,
  accessibilityLabel,
}: ButtonProps) {
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
    <Animated.View
      style={[
        { transform: [{ translateX: translate }, { translateY: translate }] },
        wrapperStyle,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !!disabled }}
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
        {typeof children === 'string' ? (
          <Text style={{ color: isPrimary ? Theme.ink : Theme.accent, fontWeight: '800', fontSize: 14 }}>
            {children}
          </Text>
        ) : (
          children
        )}
      </Pressable>
    </Animated.View>
  );
}
