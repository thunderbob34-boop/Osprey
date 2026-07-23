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
type FuelPlan = {
  dailyCarbGByDayType: { easy: Band; moderate: Band; high: Band; peak: Band };
  proteinG: Band;
  longSessionCarbGPerHour: number;
};
type StrengthLike = { oneRepMaxKg: { squat: number; bench: number; deadlift: number }; workingPercent1RM: number; zone: { percent1RM: [number, number] }; prilepin: { repsPerSet: [number, number] } };
interface EnvelopeLike { hardSessionShareMax: number; zones: Zones | null; fuel: FuelPlan; strength?: StrengthLike | null; hyrox?: { compromisedRunSplitSecPerKm: Band } | null; }

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

function carbDayType(intensity: string): 'easy' | 'moderate' | 'high' | 'peak' {
  if (intensity === 'moderate') return 'moderate';
  if (intensity === 'threshold' || intensity === 'interval') return 'high';
  if (intensity === 'race') return 'peak';
  return 'easy'; // easy / rest / anything else
}

// Shared clamp-and-round math for pace-clamping a session's distance to fit a band
// at a fixed duration. `perKm` converts sec/km → the band's own unit (mi/100m/500m
// via KIND_UNIT_PER_KM); pass 1 for a band already expressed directly in sec/km
// (Hyrox's compromised-run split has no such conversion table — it's already sec/km).
// Returns null when the implied pace is already inside the band (nothing to clamp).
function clampToDistanceBand(
  minutes: number,
  distanceKm: number,
  band: Band,
  perKm: number,
): { distanceKm: number; implied: number; target: number } | null {
  const implied = (minutes * 60) / (distanceKm * perKm);
  const target = Math.min(band.max, Math.max(band.min, implied));
  if (target === implied) return null;
  const newKm = (minutes * 60) / (target * perKm);
  // Round toward the safe side of whichever edge we clamped to — see the pace-clamp
  // step's own comment for why plain round-to-nearest can overshoot back across it.
  const roundedKm = target === band.min ? Math.floor(newKm * 10) / 10 : Math.ceil(newKm * 10) / 10;
  return { distanceKm: roundedKm, implied, target };
}

// Appends a short, fixed, always-accurate clarifier when a clamp changes a session's
// distance. The LLM's own ozzie_notes prose is never rewritten (it's still true) —
// this just stays honest about the corrected number without parsing or guessing
// whether the original prose happened to cite one.
function withClampNote(d: PlanDay): string {
  const notes = typeof d.ozzie_notes === 'string' ? d.ozzie_notes : '';
  return `${notes} (Nudged slightly to match your pace zone.)`;
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
  // Hyrox compromised-run sessions clamp against envelope.hyrox's own band (already
  // sec/km, perKm=1) instead of paceZoneForSession/bandFor's per-intensity tables —
  // hyroxGuidance() tags these session_type:"hyrox" specifically, so they never match
  // paceZoneForSession's sessionType==='run' check even though a Hyrox athlete's
  // zones.kind IS 'run' (their compromised-run pace is deliberately slower than open-
  // run pace, so clamping against the run band would be wrong anyway — see the design
  // spec). Everything else routes through the existing per-sport pace-zone path,
  // unchanged. Runs after polarization so a demoted session is clamped into the band
  // matching its FINAL (post-demotion) intensity.
  const z = envelope.zones;
  const hyroxBand = envelope.hyrox?.compromisedRunSplitSecPerKm;
  out = out.map((d) => {
    if (d.session_type === 'hyrox' && hyroxBand && d.planned_minutes && d.planned_distance_km) {
      const result = clampToDistanceBand(d.planned_minutes, d.planned_distance_km, hyroxBand, 1);
      if (result) {
        changed.push(`day${d.dayOffset}: pace ${Math.round(result.implied)}→${Math.round(result.target)} (hyrox)`);
        return { ...d, planned_distance_km: result.distanceKm, ozzie_notes: withClampNote(d) };
      }
      return d;
    }
    const pz = paceZoneForSession(z, d.session_type);
    if (pz && d.planned_minutes && d.planned_distance_km) {
      const band = bandFor(d.intensity, pz);
      if (band) {
        const result = clampToDistanceBand(d.planned_minutes, d.planned_distance_km, band, KIND_UNIT_PER_KM[pz.kind]);
        if (result) {
          changed.push(`day${d.dayOffset}: pace ${Math.round(result.implied)}→${Math.round(result.target)} (${pz.kind})`);
          return { ...d, planned_distance_km: result.distanceKm, ozzie_notes: withClampNote(d) };
        }
      }
    }
    return d;
  });

  // (c) attach the day-type carb range to every non-rest session, keyed off its
  // FINAL (post-polarization) intensity — hard days get high carbs, easy days fewer.
  out = out.map((d) =>
    d.session_type === 'rest'
      ? d
      : {
          ...d,
          fuel: {
            dailyCarbG: envelope.fuel.dailyCarbGByDayType[carbDayType(d.intensity)],
            proteinG: envelope.fuel.proteinG,
            longSessionCarbGPerHour: envelope.fuel.longSessionCarbGPerHour,
          },
        },
  );

  const LIFT_OF: Record<string, 'squat' | 'bench' | 'deadlift'> = { 'Back Squat': 'squat', 'Bench Press': 'bench', 'Deadlift': 'deadlift' };

  // (d) lift load guardrail: clamp a comp lift's loadKg into the zone's %1RM band.
  const st = envelope.strength;
  if (st) {
    out = out.map((d) => {
      if (d.session_type !== 'lift') return d;
      const lp = d.lift_prescription as { exercises?: { name: string; loadKg: number | null }[] } | undefined;
      if (!lp?.exercises) return d;
      let touched = false;
      const exercises = lp.exercises.map((ex) => {
        const lift = LIFT_OF[ex.name];
        // Skip a comp lift with no 1RM (orm ≤ 0): a partial-provide lifter left this lift
        // blank, so there's no %1RM band to clamp against — don't clamp a real day into [0,0].
        if (!lift || ex.loadKg == null || st.oneRepMaxKg[lift] <= 0) return ex;
        const orm = st.oneRepMaxKg[lift];
        const lo = orm * st.zone.percent1RM[0] / 100;
        const hi = orm * st.zone.percent1RM[1] / 100;
        const clamped = Math.round(Math.min(hi, Math.max(lo, ex.loadKg)));
        if (clamped !== ex.loadKg) { touched = true; changed.push(`day${d.dayOffset}: ${lift} ${ex.loadKg}→${clamped}kg (%1RM guardrail)`); }
        return { ...ex, loadKg: clamped };
      });
      return touched ? { ...d, lift_prescription: { ...lp, exercises } } : d;
    });
  }

  return { days: out, changed };
}
