// Pure prompt-guidance builders. Hand-narrowed mirror of the app's HR zone shape
// (OSPREY-app/src/services/coaching/hr.ts + calculators/ultra.ts UltraHRZones).
// Keep in sync if those change.
interface Range {
  min: number | null;
  max: number | null;
}

interface HRZones {
  maxHR: number;
  z1Recovery: Range;
  z2Endurance: Range;
  z3SteadyMarathon: Range;
  z4Threshold: Range;
  z5Vo2Hills: Range;
}

export interface HrZoneInfo {
  maxHR: number;
  source: 'observed' | 'estimated';
  bands: HRZones;
}

// Prompt-only HR guidance for cross-training / non-pace cardio. Never clamps.
export function hrGuidance(hr: HrZoneInfo | null | undefined): string {
  if (!hr) return '';
  const approx = hr.source === 'estimated' ? ' (estimated — treat as approximate)' : '';
  const z2 = hr.bands.z2Endurance;
  const z4 = hr.bands.z4Threshold;
  return (
    ` HR zones from max HR ~${hr.maxHR} bpm${approx}: keep easy / cross-training cardio in Z2 ${z2.min}-${z2.max} bpm,` +
    ` one harder Z4 ${z4.min}-${z4.max} bpm. Use HR zones (not pace) for bike/cross/easy-cardio sessions,` +
    ` and for all cardio when no pace bands are given.`
  );
}

// Hand-narrowed mirror of StrengthPrescription (OSPREY-app/src/services/coaching/strength.ts),
// matching index.ts's Envelope.strength. Keep in sync if that shape changes.
export interface StrengthInfo {
  oneRepMaxKg: { squat: number; bench: number; deadlift: number };
  workingPercent1RM: number;
  zone: { name: string; percent1RM: [number, number]; reps: [number, number]; rpe: [number, number]; rir: [number, number] };
  prilepin: { repsPerSet: [number, number]; totalReps: [number, number] };
  fatG: { min: number; max: number };
  attempts: {
    squat: { opener: { min: number; max: number }; second: { min: number; max: number }; third: { min: number; max: number } };
    bench: { opener: { min: number; max: number }; second: { min: number; max: number }; third: { min: number; max: number } };
    deadlift: { opener: { min: number; max: number }; second: { min: number; max: number }; third: { min: number; max: number } };
  } | null;
}

const COMP_LIFTS = ['squat', 'bench', 'deadlift'] as const;

// Powerlifting %1RM/Prilepin guidance, present only when the envelope carries a strength
// block (sport === 'lift'). A comp lift with no 1RM (orm ≤ 0 — a partial-provide lifter left
// it blank) is omitted from the load lines so the LLM is never told to program a 0 kg day.
// With all three maxes present the string is byte-identical to the pre-extraction inline form.
export function strengthGuidance(s: StrengthInfo | null | undefined): string {
  if (!s) return '';
  const loads = COMP_LIFTS.filter((l) => s.oneRepMaxKg[l] > 0)
    .map((l) => `${l} ${Math.round(s.oneRepMaxKg[l] * s.workingPercent1RM / 100)}kg`)
    .join(', ');
  let meet = '';
  if (s.attempts) {
    const at = s.attempts;
    meet =
      ` MEET WEEK — plan openers (~90% of goal): ` +
      COMP_LIFTS.filter((l) => s.oneRepMaxKg[l] > 0)
        .map((l) => `${l} ${Math.round(at[l].opener.min)}-${Math.round(at[l].opener.max)}kg`)
        .join(', ') +
      `; each lift's 2nd/3rd build to the goal third.`;
  }
  return (
    ` STRENGTH (powerlifting): work the comp lifts at ~${s.workingPercent1RM}% 1RM — ${loads} (zone "${s.zone.name}", RPE ${s.zone.rpe[0]}-${s.zone.rpe[1]}, RIR ${s.zone.rir[0]}-${s.zone.rir[1]}). Keep top-set volume within Prilepin: ${s.prilepin.repsPerSet[0]}-${s.prilepin.repsPerSet[1]} reps/set, ${s.prilepin.totalReps[0]}-${s.prilepin.totalReps[1]} total reps at this intensity; then back-off volume + a variation + 2-3 accessories. Daily fat ${s.fatG.min}-${s.fatG.max} g; creatine 3-5 g/day.` +
    meet
  );
}

// Hand-narrowed mirror of HyroxPrescription (OSPREY-app/src/services/coaching/hyrox.ts),
// matching index.ts's Envelope.hyrox. Keep in sync if that shape changes.
export interface HyroxInfo {
  division: string;
  compromisedRunSplitSecPerKm: { min: number; max: number };
  stationWeights: { sledPushKg: number; sledPullKg: number; farmersCarryPerHandKg: number; sandbagLungesKg: number; wallBallKg: number };
  sodiumMgPerHour: { min: number; max: number };
  caffeineMg: { min: number; max: number };
}

// Hyrox coaching, present only when the envelope carries a hyrox block (sport === 'hyrox').
export function hyroxGuidance(h: HyroxInfo | null | undefined): string {
  if (!h) return '';
  const w = h.stationWeights;
  return (
    ` HYROX (${h.division.replace('_', ' ')}): race 8×1km runs + 8 stations as ONE effort — control the opening` +
    ` SkiErg→Sled block. Target compromised run splits ${h.compromisedRunSplitSecPerKm.min}-${h.compromisedRunSplitSecPerKm.max} s/km` +
    ` (stations pre-fatigue you — do NOT run fresh-5k pace). Signature session: compromised-running intervals` +
    ` (1km race-pace → a station → 1km race-pace). Station strength-endurance at race weights — sled push ${w.sledPushKg}kg,` +
    ` sled pull ${w.sledPullKg}kg, farmers ${w.farmersCarryPerHandKg}kg/hand, sandbag lunge ${w.sandbagLungesKg}kg,` +
    ` wall ball ${w.wallBallKg}kg (100 reps, pre-plan the break); ski/row 1000m at target split. Race day:` +
    ` ${h.sodiumMgPerHour.min}-${h.sodiumMgPerHour.max} mg/hr sodium, caffeine ${h.caffeineMg.min}-${h.caffeineMg.max} mg pre-race` +
    ` (familiar dose). Program station work in the session descriptions/ozzie_notes (not lift_prescription).`
  );
}
