// supabase/functions/ozzie-generate-plan/validate.ts
export type PlanDay = {
  dayOffset: number;
  session_type: string;
  intensity: string;
  planned_minutes: number | null;
  planned_distance_km: number | null;
  [k: string]: unknown;
};

type Band = { min: number; max: number };
type RunZone = { kind: 'run'; thresholdSecPerMile: number; bands: { easy: Band; marathonPace: Band; tenKPace: Band; fiveKPace: Band } };
type SwimZone = { kind: 'swim'; cssSecPer100: number; bands: { z1EasyRecovery: Band; z2Aerobic: Band; z3Threshold: Band; z4Vo2Max: Band } };
type RowingZone = { kind: 'rowing'; splitSecPer500: number; bands: { ut2: { splitSecPer500: Band }; ut1: { splitSecPer500: Band }; at: { splitSecPer500: Band }; tr: { splitSecPer500: Band } } };
type CyclingZone = { kind: 'cycling'; ftpWatts: number; bands: { z2Endurance: Band; z4Threshold: Band } };
type TriZone = { kind: 'triathlon'; swim: SwimZone | null; bike: CyclingZone | null; run: RunZone | null };
type PaceZone = RunZone | SwimZone | RowingZone; // clampable (implied pace/split); cycling/tri are not directly clampable
type Zones = RunZone | SwimZone | RowingZone | CyclingZone | TriZone;
interface EnvelopeLike { hardSessionShareMax: number; zones: Zones | null; fuel: unknown; }

const KM_TO_MI = 0.621371;
const HARD = new Set(['interval', 'threshold']);

// Pace unit divisor from km, by pace-zone kind.
const KIND_UNIT_PER_KM = { run: KM_TO_MI, swim: 10, rowing: 2 } as const; // sec/mi, sec/100m, sec/500m

function bandFor(intensity: string, z: PaceZone): Band | null {
  if (z.kind === 'run') {
    if (intensity === 'easy') return z.bands.easy;
    if (intensity === 'moderate') return z.bands.marathonPace;
    if (intensity === 'threshold') return z.bands.tenKPace;
    if (intensity === 'interval') return z.bands.fiveKPace;
  } else if (z.kind === 'swim') {
    if (intensity === 'easy') return z.bands.z2Aerobic;   // easy swims sit in aerobic
    if (intensity === 'moderate') return z.bands.z2Aerobic;
    if (intensity === 'threshold') return z.bands.z3Threshold;
    if (intensity === 'interval') return z.bands.z4Vo2Max;
  } else {
    if (intensity === 'easy') return z.bands.ut2.splitSecPer500;
    if (intensity === 'moderate') return z.bands.ut1.splitSecPer500;
    if (intensity === 'threshold') return z.bands.at.splitSecPer500;
    if (intensity === 'interval') return z.bands.tr.splitSecPer500;
  }
  return null;
}

// The pace zone (if any) that applies to a given session type. Single-sport zones
// apply only to their own session type; a triathlon composite routes swim→swim,
// run→run; bike (and lift/cross) have no pace clamp.
function paceZoneForSession(z: Zones | null, sessionType: string): PaceZone | null {
  if (!z) return null;
  if (z.kind === 'run') return sessionType === 'run' ? z : null;
  if (z.kind === 'swim') return sessionType === 'swim' ? z : null;
  if (z.kind === 'rowing') return sessionType === 'rowing' ? z : null;
  if (z.kind === 'triathlon') {
    if (sessionType === 'swim') return z.swim;
    if (sessionType === 'run') return z.run;
    return null; // bike / lift / cross → no pace clamp
  }
  return null; // cycling → prompt-only
}

export function validateAndClamp(days: PlanDay[], envelope: EnvelopeLike): { days: PlanDay[]; changed: string[] } {
  const changed: string[] = [];

  // (a) polarization: demote excess hard sessions (keep the earliest ones).
  // This MUST run before pace-clamp: a session demoted here changes its
  // intensity (and therefore its target band), so clamping has to see the
  // final intensity — otherwise a demoted `easy` session would keep the
  // distance clamped to fit its old, faster `interval`/`threshold` band.
  // Cap hard sessions at the polarization share of TRAINING days — rest days are
  // not sessions and must not loosen the cap (else a 5-run week with 2 rest days
  // would allow ceil(7*0.2)=2 hard = 40% of real sessions instead of ~20%).
  const trainingCount = days.filter((d) => d.session_type !== 'rest').length;
  const maxHard = Math.max(1, Math.round(trainingCount * envelope.hardSessionShareMax));
  let seen = 0;
  let out = days.map((d) => {
    if (HARD.has(d.intensity)) {
      seen += 1;
      if (seen > maxHard) {
        changed.push(`day${d.dayOffset}: ${d.intensity}→easy (polarization)`);
        // Reconcile the prose too — the LLM's "6×800m" description/notes and
        // interval prescription no longer describe this now-easy session.
        return {
          ...d,
          intensity: 'easy',
          interval_prescription: null,
          description: 'Easy Run',
          ozzie_notes: 'Eased off to keep the week polarized (~80% easy).',
        };
      }
    }
    return d;
  });

  // (b) clamp pace into the band by scaling distance for the fixed duration.
  // paceZoneForSession picks the applicable pace zone per day's session_type
  // (single-sport zones clamp only their own type; a triathlon composite routes
  // swim/run to their sub-zone and leaves bike/lift/cross unclamped). Runs after
  // polarization so a demoted session is clamped into the band matching its
  // FINAL (post-demotion) intensity.
  const z = envelope.zones;
  out = out.map((d) => {
    const pz = paceZoneForSession(z, d.session_type);
    if (pz && d.planned_minutes && d.planned_distance_km) {
      const perKm = KIND_UNIT_PER_KM[pz.kind];
      const band = bandFor(d.intensity, pz);
      if (band) {
        const implied = (d.planned_minutes * 60) / (d.planned_distance_km * perKm);
        const target = Math.min(band.max, Math.max(band.min, implied));
        if (target !== implied) {
          const newKm = (d.planned_minutes * 60) / (target * perKm);
          // Round toward the safe side of whichever edge we clamped to.
          // Plain round-to-nearest can overshoot back across the edge (e.g.
          // rounding distance up also speeds up the recomputed pace, which
          // can undershoot a band.min floor by a couple of seconds/mile) —
          // floor when we clamped up to band.min (less distance -> slower,
          // stays >= min), ceil when we clamped down to band.max (more
          // distance -> faster, stays <= max).
          const roundedKm = target === band.min
            ? Math.floor(newKm * 10) / 10
            : Math.ceil(newKm * 10) / 10;
          changed.push(`day${d.dayOffset}: pace ${Math.round(implied)}→${Math.round(target)} (${pz.kind})`);
          return { ...d, planned_distance_km: roundedKm };
        }
      }
    }
    return d;
  });

  // (c) attach envelope fuel to every non-rest session.
  out = out.map((d) => (d.session_type === 'rest' ? d : { ...d, fuel: envelope.fuel }));

  return { days: out, changed };
}
