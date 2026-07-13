import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** How far to shrink while the press is held (1 = no scale). */
  activeScale?: number;
};

/**
 * A Pressable that gently scales down while held, giving cards and buttons a
 * tactile press response. The scale runs on the UI thread via Reanimated, so it
 * stays smooth even when JS is busy, and honours the `disabled` prop by skipping
 * the shrink entirely.
 */
export default function PressableScale({
  style,
  activeScale = 0.97,
  onPressIn,
  onPressOut,
  disabled,
  children,
  ...rest
}: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e: GestureResponderEvent) => {
        if (!disabled) {
          scale.value = withTiming(activeScale, { duration: 90, easing: Easing.out(Easing.quad) });
        }
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        scale.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
        onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
