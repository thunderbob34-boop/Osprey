import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { hrGuidance, type HrZoneInfo, strengthGuidance, type StrengthInfo } from './guidance.ts';

const hr180: HrZoneInfo = {
  maxHR: 180,
  source: 'observed',
  bands: {
    maxHR: 180,
    z1Recovery: { min: null, max: 126 },
    z2Endurance: { min: 126, max: 144 },
    z3SteadyMarathon: { min: 144, max: 157 },
    z4Threshold: { min: 157, max: 166 },
    z5Vo2Hills: { min: 166, max: null },
  },
};

Deno.test('hrGuidance returns empty for null/undefined', () => {
  assertEquals(hrGuidance(null), '');
  assertEquals(hrGuidance(undefined), '');
});

Deno.test('hrGuidance emits Z2 + Z4 bpm from an observed max', () => {
  const s = hrGuidance(hr180);
  assertEquals(s.includes('Z2 126-144 bpm'), true);
  assertEquals(s.includes('Z4 157-166 bpm'), true);
  assertEquals(s.includes('~180 bpm'), true);
  assertEquals(s.includes('estimated'), false);
});

Deno.test('hrGuidance flags an estimated max as approximate', () => {
  const s = hrGuidance({ ...hr180, source: 'estimated' });
  assertEquals(s.includes('estimated'), true);
});

const fullStrength: StrengthInfo = {
  oneRepMaxKg: { squat: 200, bench: 140, deadlift: 240 },
  workingPercent1RM: 80,
  zone: { name: 'Strength-Volume', percent1RM: [75, 85], reps: [3, 6], rpe: [7, 8], rir: [2, 3] },
  prilepin: { repsPerSet: [2, 4], totalReps: [10, 20] },
  fatG: { min: 72, max: 135 },
  attempts: null,
};

Deno.test('strengthGuidance returns empty for null/undefined', () => {
  assertEquals(strengthGuidance(null), '');
  assertEquals(strengthGuidance(undefined), '');
});

Deno.test('strengthGuidance is byte-identical to the inline version for a fully-specified lifter', () => {
  assertEquals(
    strengthGuidance(fullStrength),
    ` STRENGTH (powerlifting): work the comp lifts at ~80% 1RM — squat 160kg, bench 112kg, deadlift 192kg (zone "Strength-Volume", RPE 7-8, RIR 2-3). Keep top-set volume within Prilepin: 2-4 reps/set, 10-20 total reps at this intensity; then back-off volume + a variation + 2-3 accessories. Daily fat 72-135 g; creatine 3-5 g/day.`,
  );
});

Deno.test('strengthGuidance omits a comp lift with no 1RM (orm=0) from the load line', () => {
  const g = strengthGuidance({ ...fullStrength, oneRepMaxKg: { squat: 200, bench: 0, deadlift: 240 } });
  assertEquals(g.includes('squat 160kg'), true);
  assertEquals(g.includes('deadlift 192kg'), true);
  assertEquals(g.includes('bench'), false); // a blank bench is never shown as 0kg
});

Deno.test('strengthGuidance omits a 0-orm lift from the meet-week openers too', () => {
  const attempts = {
    squat: { opener: { min: 180, max: 184 }, second: { min: 190, max: 195 }, third: { min: 200, max: 204 } },
    bench: { opener: { min: 0, max: 0 }, second: { min: 0, max: 0 }, third: { min: 0, max: 0 } },
    deadlift: { opener: { min: 214, max: 218 }, second: { min: 228, max: 232 }, third: { min: 240, max: 245 } },
  };
  const g = strengthGuidance({ ...fullStrength, oneRepMaxKg: { squat: 200, bench: 0, deadlift: 240 }, attempts });
  assertEquals(g.includes('MEET WEEK'), true);
  assertEquals(g.includes('squat 180-184kg'), true);
  assertEquals(g.includes('deadlift 214-218kg'), true);
  assertEquals(/bench \d/.test(g), false); // no bench opener line
});
