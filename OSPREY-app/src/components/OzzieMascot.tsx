import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, G, Rect } from 'react-native-svg';

interface OzzieMascotProps {
  size?: number;
  animated?: boolean;
}

const AnimatedView = Animated.createAnimatedComponent(View);

function OzzieSvg({ size, lidScale }: { size: number; lidScale?: Animated.Value }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">

      {/* ── Body / lower silhouette ── */}
      <Ellipse cx="50" cy="88" rx="26" ry="16" fill="#0D1117" />

      {/* ── Head ── */}
      <Circle cx="50" cy="48" r="36" fill="#0D1117" />

      {/* ── Chest lighter patch ── */}
      <Ellipse cx="50" cy="68" rx="14" ry="12" fill="#1B2A3A" />

      {/* ── Teal accent stripe on forehead ── */}
      <Path
        d="M34 26 Q50 18 66 26 Q60 22 50 20 Q40 22 34 26 Z"
        fill="#00c8c8"
        opacity="0.75"
      />

      {/* ── Head feather tufts ── */}
      <Path d="M43 14 Q41 6 44 2 Q46 8 45 14 Z" fill="#0D1117" />
      <Path d="M50 12 Q49 4 52 0 Q54 6 52 12 Z" fill="#0D1117" />
      <Path d="M57 14 Q58 6 56 2 Q54 8 55 14 Z" fill="#0D1117" />

      {/* ── Eye whites ── */}
      <Circle cx="36" cy="47" r="12" fill="#ffffff" />
      <Circle cx="64" cy="47" r="12" fill="#ffffff" />

      {/* ── Teal iris ── */}
      <Circle cx="36" cy="47" r="8.5" fill="#00c8c8" />
      <Circle cx="64" cy="47" r="8.5" fill="#00c8c8" />

      {/* ── Pupils ── */}
      <Circle cx="37" cy="47" r="5.5" fill="#0a0a0f" />
      <Circle cx="65" cy="47" r="5.5" fill="#0a0a0f" />

      {/* ── Highlights ── */}
      <Circle cx="39" cy="44" r="1.8" fill="#ffffff" />
      <Circle cx="67" cy="44" r="1.8" fill="#ffffff" />

      {/* ── Eyebrows ── */}
      <Path
        d="M27 36 Q36 31 45 34"
        stroke="#0D1117"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M55 34 Q64 31 73 36"
        stroke="#0D1117"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Beak ── */}
      <Path
        d="M44 59 Q50 57 56 59 Q53 65 50 66 Q47 65 44 59 Z"
        fill="#F59E0B"
      />
      <Path
        d="M46 59 Q50 58 54 59"
        stroke="#D97706"
        strokeWidth="0.8"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Smirk ── */}
      <Path
        d="M46 70 Q50 73 55 70"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />

    </Svg>
  );
}

export default function OzzieMascot({ size = 120, animated = false }: OzzieMascotProps) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animated) return;

    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -4,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 4,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const blink = Animated.loop(
      Animated.sequence([
        Animated.delay(3800),
        Animated.timing(blinkAnim, {
          toValue: 0,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
      ])
    );

    float.start();
    blink.start();

    return () => {
      float.stop();
      blink.stop();
    };
  }, [animated, floatAnim, blinkAnim]);

  if (!animated) {
    return <OzzieSvg size={size} />;
  }

  const scale = size / 100;
  const eyeLeftX = 36 * scale - 12 * scale;
  const eyeRightX = 64 * scale - 12 * scale;
  const eyeY = 47 * scale - 12 * scale;
  const eyeD = 24 * scale;

  return (
    <Animated.View style={{ transform: [{ translateY: floatAnim }] }}>
      <View style={{ width: size, height: size }}>
        <OzzieSvg size={size} />

        {/* Blink lids drawn as absolute-positioned Animated.Views covering each eye */}
        <Animated.View
          style={{
            position: 'absolute',
            left: eyeLeftX,
            top: eyeY,
            width: eyeD,
            height: eyeD,
            borderRadius: eyeD / 2,
            backgroundColor: '#0D1117',
            transform: [{ scaleY: blinkAnim }],
          }}
        />
        <Animated.View
          style={{
            position: 'absolute',
            left: eyeRightX,
            top: eyeY,
            width: eyeD,
            height: eyeD,
            borderRadius: eyeD / 2,
            backgroundColor: '#0D1117',
            transform: [{ scaleY: blinkAnim }],
          }}
        />
      </View>
    </Animated.View>
  );
}
