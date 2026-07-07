import React from 'react';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

interface OzzieAvatarProps {
  size?: number;
}

export default function OzzieAvatar({ size = 40 }: OzzieAvatarProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">

      {/* ── Shaggy crest, swept back (behind head) ── */}
      <Path d="M40 16 Q40 7 44 3 Q46 10 48 13 Q49 4 53 1 Q54 9 56 12 Q60 5 65 6 Q62 12 61 17 Z" fill="#0D1117" stroke="#2D4A5A" strokeWidth="1.5" />

      {/* ── Folded wings ── */}
      <Path d="M25 66 Q15 80 21 96 Q30 90 33 75 Z" fill="#0D1117" stroke="#2D4A5A" strokeWidth="2" />
      <Path d="M75 66 Q85 80 79 96 Q70 90 67 75 Z" fill="#0D1117" stroke="#2D4A5A" strokeWidth="2" />

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

      {/* ── Teal brand accent along the stripe brow ── */}
      <Path d="M45 41 Q33 36 20 38" stroke="#00c8c8" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />
      <Path d="M55 41 Q67 36 80 38" stroke="#00c8c8" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />

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
