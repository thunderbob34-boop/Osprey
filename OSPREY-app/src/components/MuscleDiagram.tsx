import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { Theme, Radius } from '@/constants/theme';

interface MuscleDiagramProps {
  workedGroups: Set<string>;
}

// Anatomy-chart rendering: the body is tiled out of muscle-shaped regions
// (pecs, delts, lats, quads...) separated by dark seams — like the muscle
// maps in Fitbod/MuscleWiki — instead of highlight bubbles floating on a
// mannequin. A worked region fills teal with a soft glow halo.
const BODY_FILL = 'rgba(255,255,255,0.07)';
const BODY_STROKE = 'rgba(255,255,255,0.14)';
const MUSCLE_FILL = 'rgba(255,255,255,0.13)';
const MUSCLE_SEAM = 'rgba(9,9,11,0.7)';
const HIGHLIGHT_FILL = Theme.accent;
const HIGHLIGHT_GLOW = 'rgba(200,121,58,0.30)';

// Every group either view can highlight — used to expand 'Full Body' into
// "highlight everything" rather than tracking it as its own drawn region.
const ALL_TRACKABLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Glutes', 'Hamstrings', 'Calves', 'Core',
];

// Right-side geometry; the left side is the same path mirrored, so the
// figure is guaranteed symmetric.
const MIRROR = 'translate(120,0) scale(-1,1)';

// ── Silhouette (always neutral) — athletic V-taper ──
const TORSO = 'M60,32 Q78,33 86,42 Q89,54 84,68 Q79,82 81,94 Q83,104 78,110 Q68,114 60,113 Z';
const ARM =
  'M84,36 Q96,42 97,58 Q97,76 95,92 Q94,106 93,118 Q92,126 88,127 Q84,127 84,120 Q84,105 85,92 Q83,76 82,60 Q81,46 84,36 Z';
const LEG =
  'M79,106 Q85,112 84,128 Q82,148 78,160 Q76,170 77,184 Q78,198 75,206 Q72,212 67,212 Q63,211 64,204 Q66,192 65,180 Q63,164 64,148 Q63,128 65,112 Q69,106 79,106 Z';
const PELVIS = 'M60,102 Q72,103 79,108 Q74,116 66,122 Q61,126 60,126 Z';
const NECK = 'M55,20 Q55,29 51,33 Q60,36 69,33 Q65,29 65,20 Q60,23 55,20 Z';
const HEAD = 'M60,2 Q71,2 71,13 Q71,24 60,24 Q49,24 49,13 Q49,2 60,2 Z';
const FOOT = 'M67,206 Q75,206 77,211 Q77,216 71,216 Q64,216 63,211 Q63,207 67,206 Z';
const HAND = 'M88,120 Q93,122 93,129 Q92,135 89,135 Q85,134 85,128 Q85,122 88,120 Z';
// Neutral anatomy details — no muscle group of their own, but they keep the
// figure reading as a body (forearms below the biceps/triceps seam, kneecaps
// bridging quad → shin).
const FOREARM = 'M85,88 Q92,88 93,96 Q94,108 91,117 Q88,120 86,116 Q84,103 85,88 Z';
const KNEE = 'M66,160 Q71,158 74,161 Q74,166 70,167 Q66,167 66,160 Z';

// ── Front muscles ──
const TRAP_F = 'M62,30 Q70,30 80,36 Q70,39 63,37 Z';
const DELT = 'M80,36 Q89,38 91,47 Q90,54 84,54 Q79,47 80,36 Z';
const PEC = 'M61,39 Q72,39 80,45 Q82,54 78,62 Q69,67 62,64 Q60,51 61,39 Z';
const ABS = 'M60,66 Q66,66 67,71 Q68,85 66,99 Q63,102 60,102 Z';
const OBLIQUE = 'M69,65 Q75,67 77,73 Q78,85 74,96 Q71,98 69,94 Q71,81 69,65 Z';
const UPPER_ARM = 'M83,52 Q91,53 92,62 Q93,74 89,83 Q84,85 82,79 Q81,64 83,52 Z'; // biceps (front) / triceps (back)
const QUAD = 'M65,110 Q76,110 79,122 Q81,140 76,158 Q71,163 67,158 Q63,140 64,122 Z';
const SHIN = 'M65,168 Q73,168 74,180 Q74,193 70,202 Q66,205 65,199 Q63,186 64,176 Z';

// ── Back muscles ──
const TRAP_B = 'M60,29 Q70,31 79,37 Q72,48 64,54 Q61,55 60,55 Z';
const LAT = 'M62,54 Q73,51 81,47 Q87,60 81,80 Q72,92 63,95 Q60,74 62,54 Z';
const LOWBACK = 'M60,79 Q65,81 66,88 Q65,96 60,99 Z';
const GLUTE = 'M60.5,100 Q70,99 76,103 Q80,109 77,116 Q73,123 66,122 Q60.5,120 60.5,110 Z';
const HAM = 'M65,112 Q76,112 79,124 Q81,142 76,158 Q71,163 67,158 Q63,142 64,124 Z';
const CALF = 'M65,166 Q74,166 75,180 Q74,194 69,202 Q65,204 64,197 Q63,184 64,174 Z';

// ── Definition seams (interior lines, no fill) ──
const CLAVICLE = 'M61,37 Q71,36 80,40';
const QUAD_SWEEP = 'M71,114 Q74,136 71,156';
const HAM_SPLIT = 'M71,126 Q73,142 70,156';
const CALF_SPLIT = 'M69,169 Q70,181 68,194';

function BodyPiece({ d, mirrored }: { d: string; mirrored?: boolean }) {
  return (
    <Path
      d={d}
      fill={BODY_FILL}
      stroke={BODY_STROKE}
      strokeWidth={1}
      transform={mirrored ? MIRROR : undefined}
    />
  );
}

function BodyPair({ d }: { d: string }) {
  return (
    <>
      <BodyPiece d={d} />
      <BodyPiece d={d} mirrored />
    </>
  );
}

function Muscle({ d, worked, mirrored }: { d: string; worked: boolean; mirrored?: boolean }) {
  const transform = mirrored ? MIRROR : undefined;
  return (
    <>
      {worked ? (
        <Path
          d={d}
          fill={HIGHLIGHT_GLOW}
          stroke={HIGHLIGHT_GLOW}
          strokeWidth={4}
          strokeLinejoin="round"
          transform={transform}
        />
      ) : null}
      <Path
        d={d}
        fill={worked ? HIGHLIGHT_FILL : MUSCLE_FILL}
        fillOpacity={worked ? 0.92 : 1}
        stroke={MUSCLE_SEAM}
        strokeWidth={1}
        transform={transform}
      />
    </>
  );
}

function MusclePair({ d, worked }: { d: string; worked: boolean }) {
  return (
    <>
      <Muscle d={d} worked={worked} />
      <Muscle d={d} worked={worked} mirrored />
    </>
  );
}

function Silhouette() {
  return (
    <>
      <BodyPair d={TORSO} />
      <BodyPair d={ARM} />
      <BodyPair d={LEG} />
      <BodyPair d={PELVIS} />
      <BodyPair d={FOOT} />
      <BodyPair d={HAND} />
    </>
  );
}

// Faint segment seams across the abs for the anatomy-chart look.
function AbsLines() {
  return (
    <>
      {[75, 83, 91].map((y) => (
        <Line key={y} x1={55} y1={y} x2={65} y2={y} stroke={MUSCLE_SEAM} strokeWidth={0.8} />
      ))}
    </>
  );
}

// Mirrored interior definition seam drawn over a muscle (no fill).
function SeamPair({ d }: { d: string }) {
  return (
    <>
      <Path d={d} fill="none" stroke={MUSCLE_SEAM} strokeWidth={0.8} />
      <Path d={d} fill="none" stroke={MUSCLE_SEAM} strokeWidth={0.8} transform={MIRROR} />
    </>
  );
}

function HeadNeck() {
  return (
    <>
      <BodyPiece d={NECK} />
      <BodyPiece d={HEAD} />
    </>
  );
}

function FrontBody({ worked }: { worked: Set<string> }) {
  return (
    <Svg width={170} height={300} viewBox="0 0 120 220">
      <Silhouette />
      <MusclePair d={TRAP_F} worked={worked.has('Shoulders')} />
      <MusclePair d={PEC} worked={worked.has('Chest')} />
      <SeamPair d={CLAVICLE} />
      <MusclePair d={ABS} worked={worked.has('Core')} />
      <AbsLines />
      <MusclePair d={OBLIQUE} worked={worked.has('Core')} />
      <MusclePair d={DELT} worked={worked.has('Shoulders')} />
      <MusclePair d={UPPER_ARM} worked={worked.has('Biceps')} />
      <BodyPair d={FOREARM} />
      <MusclePair d={QUAD} worked={worked.has('Legs')} />
      <SeamPair d={QUAD_SWEEP} />
      <BodyPair d={KNEE} />
      <MusclePair d={SHIN} worked={worked.has('Calves')} />
      <HeadNeck />
    </Svg>
  );
}

function BackBody({ worked }: { worked: Set<string> }) {
  return (
    <Svg width={170} height={300} viewBox="0 0 120 220">
      <Silhouette />
      <MusclePair d={TRAP_B} worked={worked.has('Back')} />
      <MusclePair d={LAT} worked={worked.has('Back')} />
      <MusclePair d={LOWBACK} worked={worked.has('Back')} />
      <MusclePair d={DELT} worked={worked.has('Shoulders')} />
      <MusclePair d={UPPER_ARM} worked={worked.has('Triceps')} />
      <BodyPair d={FOREARM} />
      {/* Hamstrings first, then glutes on top — the overlap forms the
          gluteal fold instead of the ham tops chopping the glutes flat. */}
      <MusclePair d={HAM} worked={worked.has('Hamstrings')} />
      <MusclePair d={GLUTE} worked={worked.has('Glutes')} />
      <SeamPair d={HAM_SPLIT} />
      <BodyPair d={KNEE} />
      <MusclePair d={CALF} worked={worked.has('Calves')} />
      <SeamPair d={CALF_SPLIT} />
      <HeadNeck />
    </Svg>
  );
}

export default function MuscleDiagram({ workedGroups }: MuscleDiagramProps) {
  const [view, setView] = useState<'front' | 'back'>('front');

  const effectiveWorked = workedGroups.has('Full Body')
    ? new Set(ALL_TRACKABLE_GROUPS)
    : workedGroups;

  const legendGroups = Array.from(workedGroups).sort();

  return (
    <View style={styles.card}>
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, view === 'front' && styles.toggleBtnActive]}
          onPress={() => setView('front')}
          accessibilityRole="button"
          accessibilityLabel="Show front view"
          accessibilityState={{ selected: view === 'front' }}
        >
          <Text style={[styles.toggleText, view === 'front' && styles.toggleTextActive]}>Front</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, view === 'back' && styles.toggleBtnActive]}
          onPress={() => setView('back')}
          accessibilityRole="button"
          accessibilityLabel="Show back view"
          accessibilityState={{ selected: view === 'back' }}
        >
          <Text style={[styles.toggleText, view === 'back' && styles.toggleTextActive]}>Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bodyWrap}>
        {view === 'front' ? <FrontBody worked={effectiveWorked} /> : <BackBody worked={effectiveWorked} />}
      </View>

      <Text style={styles.legend}>
        {legendGroups.length > 0
          ? `Working: ${legendGroups.join(', ')}`
          : 'Add exercises to see what this session works.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.panel,
    borderWidth: 1,
    borderColor: Theme.line,
    borderRadius: Radius.card,
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Theme.panel,
    borderRadius: 20,
    padding: 3,
    gap: 3,
  },
  toggleBtn: {
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  toggleBtnActive: {
    backgroundColor: Theme.panel,
    borderColor: Theme.accent,
  },
  toggleText: { fontSize: 12, fontWeight: '700', color: Theme.textMut },
  toggleTextActive: { color: Theme.accent },
  bodyWrap: { paddingVertical: 4 },
  legend: {
    fontSize: 12,
    color: Theme.textSoft,
    textAlign: 'center',
    lineHeight: 17,
  },
});
