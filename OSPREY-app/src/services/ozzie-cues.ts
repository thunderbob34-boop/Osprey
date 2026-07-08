import type { EnduranceType } from '@/services/workouts';

// Outdoor/GPS run — distinct from ENCOURAGEMENTS.run below, which is written
// for the treadmill (belt-specific copy doesn't fit outside).
export const OUTSIDE_RUN_CUES: string[] = [
  'Smooth turnover — quick, light steps, not long reaches.',
  'Relax the shoulders and jaw. Tension burns energy you need for the pace.',
  'Hold this rhythm. Let the downhills give you free speed, save the legs on the climbs.',
];

export const ENCOURAGEMENTS: Record<EnduranceType, string[]> = {
  swim: [
    'Smooth strokes. Stay long in the water.',
    "Every length counts. Keep your technique tight.",
    'Focus on hip rotation — power comes from the core, not the arms.',
  ],
  bike: [
    'Steady cadence. Let the gears do the work.',
    "Keep your upper body relaxed — only your legs should burn.",
    'Mid-ride check: stay hydrated, keep the power consistent.',
  ],
  run: [
    'Steady rhythm on the belt. Let the pace come to you.',
    'Relax the shoulders, quick turnover — the belt does some of the work for you.',
    "Stay locked in on form — there's no terrain to break it up out here.",
  ],
  rowing: [
    'Legs, then back, then arms — smooth and connected.',
    'Long, patient strokes. Let the recovery breathe.',
    'Watch the split — steady effort beats spiky effort.',
  ],
  cross: [
    'Active recovery is still training. This is how champions stay fresh.',
    "Your body's rebuilding right now. Stay with it.",
    'Consistent effort. Every session moves the needle.',
  ],
};
