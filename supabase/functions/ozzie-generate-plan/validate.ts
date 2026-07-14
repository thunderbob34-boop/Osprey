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
interface EnvelopeLike {
  hardSessionShareMax: number;
  runZones: { easy: Band; tenKPace: Band; fiveKPace: Band; intervalPace: Band; marathonPace: Band } | null;
  fuel: unknown;
}

const KM_TO_MI = 0.621371;
const HARD = new Set(['interval', 'threshold']);

function bandFor(intensity: string, z: NonNullable<EnvelopeLike['runZones']>): Band | null {
  if (intensity === 'easy') return z.easy;
  if (intensity === 'moderate') return z.marathonPace;
  if (intensity === 'threshold') return z.tenKPace;
  if (intensity === 'interval') return z.fiveKPace;
  return null;
}

export function validateAndClamp(days: PlanDay[], envelope: EnvelopeLike): { days: PlanDay[]; changed: string[] } {
  const changed: string[] = [];
  const z = envelope.runZones;

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

  // (b) clamp run pace into the band by scaling distance for the fixed duration.
  // Runs after polarization so a demoted session is clamped into the band
  // matching its FINAL (post-demotion) intensity.
  out = out.map((d) => {
    if (z && d.session_type === 'run' && d.planned_minutes && d.planned_distance_km) {
      const band = bandFor(d.intensity, z);
      if (band) {
        const impliedSecPerMi = (d.planned_minutes * 60) / (d.planned_distance_km * KM_TO_MI);
        const target = Math.min(band.max, Math.max(band.min, impliedSecPerMi));
        if (target !== impliedSecPerMi) {
          const newKm = (d.planned_minutes * 60) / (target * KM_TO_MI);
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
          changed.push(`day${d.dayOffset}: pace ${Math.round(impliedSecPerMi)}→${Math.round(target)} s/mi`);
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
