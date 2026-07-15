import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { hrGuidance, type HrZoneInfo } from './guidance.ts';

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
