import React from 'react';
import Svg, { Circle, Ellipse, Path, G, Rect } from 'react-native-svg';

interface OzzieAvatarProps {
  size?: number;
}

export default function OzzieAvatar({ size = 40 }: OzzieAvatarProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">

      {/* ── Body / lower silhouette ── */}
      <Ellipse cx="50" cy="88" rx="26" ry="16" fill="#0D1117" />

      {/* ── Head (main dark round shape) ── */}
      <Circle cx="50" cy="48" r="36" fill="#0D1117" />

      {/* ── Chest lighter patch ── */}
      <Ellipse cx="50" cy="68" rx="14" ry="12" fill="#1B2A3A" />

      {/* ── Teal accent stripe on forehead ── */}
      <Path
        d="M34 26 Q50 18 66 26 Q60 22 50 20 Q40 22 34 26 Z"
        fill="#00c8c8"
        opacity="0.75"
      />

      {/* ── Head feather tufts (3 spiky feathers on top) ── */}
      <Path d="M43 14 Q41 6 44 2 Q46 8 45 14 Z" fill="#0D1117" />
      <Path d="M50 12 Q49 4 52 0 Q54 6 52 12 Z" fill="#0D1117" />
      <Path d="M57 14 Q58 6 56 2 Q54 8 55 14 Z" fill="#0D1117" />

      {/* ── Left eye white sclera ── */}
      <Circle cx="36" cy="47" r="12" fill="#ffffff" />
      {/* ── Right eye white sclera ── */}
      <Circle cx="64" cy="47" r="12" fill="#ffffff" />

      {/* ── Left eye teal iris ── */}
      <Circle cx="36" cy="47" r="8.5" fill="#00c8c8" />
      {/* ── Right eye teal iris ── */}
      <Circle cx="64" cy="47" r="8.5" fill="#00c8c8" />

      {/* ── Left pupil ── */}
      <Circle cx="37" cy="47" r="5.5" fill="#0a0a0f" />
      {/* ── Right pupil ── */}
      <Circle cx="65" cy="47" r="5.5" fill="#0a0a0f" />

      {/* ── Left eye highlight ── */}
      <Circle cx="39" cy="44" r="1.8" fill="#ffffff" />
      {/* ── Right eye highlight ── */}
      <Circle cx="67" cy="44" r="1.8" fill="#ffffff" />

      {/* ── Left eyebrow (arched) ── */}
      <Path
        d="M27 36 Q36 31 45 34"
        stroke="#0D1117"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* ── Right eyebrow (arched, slight inner raise for smirk) ── */}
      <Path
        d="M55 34 Q64 31 73 36"
        stroke="#0D1117"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Beak (short stubby amber) ── */}
      <Path
        d="M44 59 Q50 57 56 59 Q53 65 50 66 Q47 65 44 59 Z"
        fill="#F59E0B"
      />
      {/* Beak ridge line */}
      <Path
        d="M46 59 Q50 58 54 59"
        stroke="#D97706"
        strokeWidth="0.8"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Subtle smirk line ── */}
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
