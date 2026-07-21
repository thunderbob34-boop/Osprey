import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { Theme } from '@/constants/theme';

interface OzzieMascotProps {
  size?: number;
  animated?: boolean;
}

function OzzieSvg({ size, hideWings }: { size: number; hideWings?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">

      {/* ── Shaggy crest, swept back (behind head) ── */}
      <Path d="M40 16 Q40 7 44 3 Q46 10 48 13 Q49 4 53 1 Q54 9 56 12 Q60 5 65 6 Q62 12 61 17 Z" fill="#0D1117" stroke="#2D4A5A" strokeWidth="1.5" />

      {/* ── Folded wings (skipped when animated wing overlays draw them) ── */}
      {!hideWings && (
        <>
          <Path d="M25 66 Q15 80 21 96 Q30 90 33 75 Z" fill="#0D1117" stroke="#2D4A5A" strokeWidth="2" />
          <Path d="M75 66 Q85 80 79 96 Q70 90 67 75 Z" fill="#0D1117" stroke="#2D4A5A" strokeWidth="2" />
        </>
      )}

      {/* ── Body ── */}
      <Ellipse cx="50" cy="83" rx="23" ry="16" fill="#0D1117" stroke="#2D4A5A" strokeWidth="2" />

      {/* ── White chest ── */}
      <Ellipse cx="50" cy="86" rx="14" ry="12" fill="#F5F1E8" />

      {/* ── Speckled chest "necklace" (osprey marking) ── */}
      <Circle cx="43" cy="79" r="1.4" fill="#0D1117" />
      <Circle cx="48" cy="81" r="1.4" fill="#0D1117" />
      <Circle cx="53" cy="81" r="1.4" fill="#0D1117" />
      <Circle cx="57" cy="79" r="1.4" fill="#0D1117" />

      {/* ── Head — white, the osprey signature ── */}
      <Circle cx="50" cy="40" r="30" fill="#F5F1E8" stroke="#2D4A5A" strokeWidth="2.5" />

      {/* ── Slim eye-stripes (osprey marking, no longer a heavy mask) ── */}
      <Path d="M45 41 Q33 36 20 38 Q17 42 20 46 Q33 50 45 46 Z" fill="#0D1117" />
      <Path d="M55 41 Q67 36 80 38 Q83 42 80 46 Q67 50 55 46 Z" fill="#0D1117" />

      {/* ── Brand accent along the stripe brow ── */}
      <Path d="M45 41 Q33 36 20 38" stroke={Theme.accent} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />
      <Path d="M55 41 Q67 36 80 38" stroke={Theme.accent} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />

      {/* ── Big blue eyes (larger than the stripe = cute) ── */}
      <Circle cx="33" cy="43" r="8.5" fill="#3BA9E0" stroke="#0D1117" strokeWidth="1.5" />
      <Circle cx="67" cy="43" r="8.5" fill="#3BA9E0" stroke="#0D1117" strokeWidth="1.5" />

      {/* ── Pupils ── */}
      <Circle cx="33" cy="43" r="4" fill="#0a0a0f" />
      <Circle cx="67" cy="43" r="4" fill="#0a0a0f" />

      {/* ── Highlights (big catchlight + sparkle = friendly) ── */}
      <Circle cx="35.5" cy="40.5" r="2.1" fill="#ffffff" />
      <Circle cx="30" cy="44" r="1" fill="#ffffff" opacity="0.8" />
      <Circle cx="69.5" cy="40.5" r="2.1" fill="#ffffff" />
      <Circle cx="64" cy="44" r="1" fill="#ffffff" opacity="0.8" />

      {/* ── Happy lower lids — crescents contained inside the eye disc ── */}
      <Path d="M25.8 47.5 Q33 44.5 40.2 47.5 Q33 55.3 25.8 47.5 Z" fill="#0D1117" />
      <Path d="M59.8 47.5 Q67 44.5 74.2 47.5 Q67 55.3 59.8 47.5 Z" fill="#0D1117" />

      {/* ── Soft blush on the cheeks (below the eyes, inside the face) ── */}
      <Circle cx="30" cy="57" r="3.5" fill="#FB9BA8" opacity="0.45" />
      <Circle cx="70" cy="57" r="3.5" fill="#FB9BA8" opacity="0.45" />

      {/* ── Small friendly beak with just a hint of hook ── */}
      <Path
        d="M45 49 Q50 46.5 55 49 Q55.5 54 51.5 57.5 Q50.5 59.5 49.2 57.8 Q44.8 53.5 45 49 Z"
        fill="#333D4D"
        stroke="#1B2A3A"
        strokeWidth="1"
      />
      {/* Beak ridge highlight */}
      <Path
        d="M47 50 Q50 48.5 53 50"
        stroke="#8B9AAB"
        strokeWidth="0.9"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />

      {/* ── Cheerful smile under the beak ── */}
      <Path
        d="M44.5 63 Q50 67.5 55.5 63"
        stroke="#2D4A5A"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />

    </Svg>
  );
}

export default function OzzieMascot({ size = 120, animated = false }: OzzieMascotProps) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const blinkAnim = useRef(new Animated.Value(0)).current;
  const flapAnim = useRef(new Animated.Value(0)).current;

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
          toValue: 1,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 0,
          duration: 80,
          useNativeDriver: true,
        }),
      ])
    );

    // Wings flap in sync with the float bob — one gentle stroke per second
    const flap = Animated.loop(
      Animated.sequence([
        Animated.timing(flapAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(flapAnim, {
          toValue: 0,
          duration: 500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    float.start();
    blink.start();
    flap.start();

    return () => {
      float.stop();
      blink.stop();
      flap.stop();
    };
  }, [animated, floatAnim, blinkAnim, flapAnim]);

  if (!animated) {
    return <OzzieSvg size={size} />;
  }

  // Eyes sit at (33,43) and (67,43) with r=8.5 (plus a 1.5 outline);
  // lids are slightly larger ovals in the dark feather color so a blink covers the whole eye.
  const scale = size / 100;
  const lidW = 19 * scale;
  const lidH = 18.5 * scale;
  const eyeLeftX = 33 * scale - lidW / 2;
  const eyeRightX = 67 * scale - lidW / 2;
  const eyeY = 43 * scale - lidH / 2;

  // Wing rotation pivots at the shoulder (33,70)/(67,70) rather than the view
  // center, via the translate → rotate → translate-back transform sequence.
  const leftWingRotate = flapAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '12deg'],
  });
  const rightWingRotate = flapAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-12deg'],
  });

  return (
    <Animated.View style={{ transform: [{ translateY: floatAnim }] }}>
      <View style={{ width: size, height: size }}>
        {/* Flapping wings, drawn behind the body */}
        <Animated.View
          style={{
            position: 'absolute',
            left: 12 * scale,
            top: 62 * scale,
            width: 24 * scale,
            height: 38 * scale,
            transform: [
              { translateX: 9 * scale },
              { translateY: -11 * scale },
              { rotate: leftWingRotate },
              { translateX: -9 * scale },
              { translateY: 11 * scale },
            ],
          }}
        >
          <Svg width={24 * scale} height={38 * scale} viewBox="12 62 24 38">
            <Path d="M25 66 Q15 80 21 96 Q30 90 33 75 Z" fill="#0D1117" stroke="#2D4A5A" strokeWidth="2" />
          </Svg>
        </Animated.View>
        <Animated.View
          style={{
            position: 'absolute',
            left: 64 * scale,
            top: 62 * scale,
            width: 24 * scale,
            height: 38 * scale,
            transform: [
              { translateX: -9 * scale },
              { translateY: -11 * scale },
              { rotate: rightWingRotate },
              { translateX: 9 * scale },
              { translateY: 11 * scale },
            ],
          }}
        >
          <Svg width={24 * scale} height={38 * scale} viewBox="64 62 24 38">
            <Path d="M75 66 Q85 80 79 96 Q70 90 67 75 Z" fill="#0D1117" stroke="#2D4A5A" strokeWidth="2" />
          </Svg>
        </Animated.View>

        <OzzieSvg size={size} hideWings />

        {/* Blink lids drawn as absolute-positioned Animated.Views covering each eye */}
        <Animated.View
          style={{
            position: 'absolute',
            left: eyeLeftX,
            top: eyeY,
            width: lidW,
            height: lidH,
            borderRadius: lidH / 2,
            backgroundColor: '#0D1117',
            transform: [{ scaleY: blinkAnim }],
          }}
        />
        <Animated.View
          style={{
            position: 'absolute',
            left: eyeRightX,
            top: eyeY,
            width: lidW,
            height: lidH,
            borderRadius: lidH / 2,
            backgroundColor: '#0D1117',
            transform: [{ scaleY: blinkAnim }],
          }}
        />
      </View>
    </Animated.View>
  );
}
