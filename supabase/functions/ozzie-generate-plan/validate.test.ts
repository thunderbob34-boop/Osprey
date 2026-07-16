// supabase/functions/ozzie-generate-plan/validate.test.ts
import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { validateAndClamp } from './validate.ts';

const envelope = {
  sport: 'run', phase: 'Build', weekNumber: 5, totalWeeks: 16,
  targetWeeklyLoad: 300, hardSessionShareMax: 0.2,
  zones: { kind: 'run', thresholdSecPerMile: 450,
    bands: { easy: { min: 510, max: 570 }, marathonPace: { min: 465, max: 480 }, tenKPace: { min: 435, max: 445 }, fiveKPace: { min: 420, max: 430 } } },
  fuel: {
    dailyCarbGByDayType: { easy: { min: 210, max: 350 }, moderate: { min: 350, max: 490 }, high: { min: 560, max: 700 }, peak: { min: 700, max: 840 } },
    proteinG: { min: 112, max: 154 },
    longSessionCarbGPerHour: 75,
  },
};

Deno.test('clamps an easy run that is implied too fast into the easy band', () => {
  // 10 km in 40 min => 240 s/km => ~386 s/mi, way faster than easy (510-570).
  const day = { dayOffset: 0, session_type: 'run', intensity: 'easy', planned_minutes: 40, planned_distance_km: 10 };
  const { days, changed } = validateAndClamp([day], envelope as never);
  const implied = (days[0].planned_minutes! * 60) / (days[0].planned_distance_km! * 0.621371); // s/mi
  assert(implied >= 510 && implied <= 571, `implied ${implied} not in easy band`);
  assert(changed.length > 0);
});

Deno.test('attaches fuel to non-rest sessions', () => {
  const day = { dayOffset: 0, session_type: 'run', intensity: 'easy', planned_minutes: 40, planned_distance_km: 6 };
  const { days } = validateAndClamp([day], envelope as never);
  assertEquals((days[0] as any).fuel.dailyCarbG, envelope.fuel.dailyCarbGByDayType.easy);
});

Deno.test('attaches day-type carbs per session by (post-polarization) intensity', () => {
  const envelope = {
    hardSessionShareMax: 1,  // don't demote — we want to observe both intensities
    zones: null,
    fuel: {
      dailyCarbGByDayType: { easy: { min: 210, max: 350 }, moderate: { min: 350, max: 490 }, high: { min: 560, max: 700 }, peak: { min: 700, max: 840 } },
      proteinG: { min: 112, max: 154 },
      longSessionCarbGPerHour: 75,
    },
  };
  const days = [
    { dayOffset: 0, session_type: 'run', intensity: 'easy', planned_minutes: 40, planned_distance_km: 8 },
    { dayOffset: 1, session_type: 'run', intensity: 'interval', planned_minutes: 40, planned_distance_km: 10 },
    { dayOffset: 2, session_type: 'rest', intensity: 'rest', planned_minutes: null, planned_distance_km: null },
  ];
  const { days: out } = validateAndClamp(days as any, envelope as any);
  assertEquals((out[0] as any).fuel.dailyCarbG, { min: 210, max: 350 }); // easy → easy carbs
  assertEquals((out[1] as any).fuel.dailyCarbG, { min: 560, max: 700 }); // interval → high carbs
  assertEquals((out[0] as any).fuel.longSessionCarbGPerHour, 75);
  assertEquals((out[2] as any).fuel, undefined);                          // rest → no fuel
});

Deno.test('a session demoted by polarization gets easy-day carbs, not its original hard-day carbs', () => {
  // 5 interval days, cap 0.2 → only 1 stays hard, 4 demote to 'easy'. Fuel-attach (step c)
  // runs AFTER polarization (step a), so a demoted day must carry easy-day carbs (210-350),
  // NOT the high-day carbs (560-700) its original 'interval' intensity would have earned.
  const env = {
    hardSessionShareMax: 0.2,
    zones: null,
    fuel: {
      dailyCarbGByDayType: { easy: { min: 210, max: 350 }, moderate: { min: 350, max: 490 }, high: { min: 560, max: 700 }, peak: { min: 700, max: 840 } },
      proteinG: { min: 112, max: 154 },
      longSessionCarbGPerHour: 75,
    },
  };
  const hard = (o: number) => ({ dayOffset: o, session_type: 'run', intensity: 'interval', planned_minutes: 40, planned_distance_km: 8 });
  const { days: out } = validateAndClamp([hard(0), hard(1), hard(2), hard(3), hard(4)] as any, env as any);
  const demoted = out.filter((d) => d.intensity === 'easy');
  assert(demoted.length > 0, 'expected polarization to demote at least one session to easy');
  for (const d of demoted) {
    assertEquals((d as any).fuel.dailyCarbG, { min: 210, max: 350 }); // demoted → easy-day carbs
  }
  const survivingHard = out.filter((d) => d.intensity === 'interval');
  assertEquals(survivingHard.length, 1);
  assertEquals((survivingHard[0] as any).fuel.dailyCarbG, { min: 560, max: 700 }); // still-hard → high-day carbs
});

Deno.test('demotes excess hard sessions to easy', () => {
  const hard = (o: number) => ({ dayOffset: o, session_type: 'run', intensity: 'interval', planned_minutes: 40, planned_distance_km: 8 });
  const { days } = validateAndClamp([hard(0), hard(1), hard(2), hard(3), hard(4)], envelope as never);
  const hardCount = days.filter((d) => d.intensity === 'interval' || d.intensity === 'threshold').length;
  assert(hardCount <= Math.ceil(5 * 0.2) + 0); // ≤ 1 of 5
});

Deno.test('clamps an interval run that is implied too slow into the fiveK band (ceil branch)', () => {
  // 3 km in 30 min => ~966 s/mi, way slower than the interval band (420-430 s/mi),
  // so this exercises the target===band.max / ceil-rounding branch (the mirror
  // image of the too-fast/floor branch the first test covers).
  const day = { dayOffset: 0, session_type: 'run', intensity: 'interval', planned_minutes: 30, planned_distance_km: 3 };
  const { days, changed } = validateAndClamp([day], envelope as never);
  const band = envelope.zones.bands.fiveKPace;
  const implied = (days[0].planned_minutes! * 60) / (days[0].planned_distance_km! * 0.621371); // s/mi
  assert(implied >= band.min && implied <= band.max, `implied ${implied} not in interval band [${band.min}, ${band.max}]`);
  assert(changed.length > 0);
});

Deno.test('reorders polarization before pace-clamp so a demoted session lands in the easy band, not its old fast band', () => {
  // 5 interval days at 40min/8km (~483 s/mi implied). hardSessionShareMax=0.2 means
  // only 1 of 5 may stay hard, so 4 get demoted to 'easy'. If pace-clamp ran before
  // polarization (the bug), a demoted day would keep the distance clamped to fit
  // the fast fiveK band (~429 s/mi) instead of the easy band it's now labeled with.
  const hard = (o: number) => ({ dayOffset: o, session_type: 'run', intensity: 'interval', planned_minutes: 40, planned_distance_km: 8 });
  const { days } = validateAndClamp([hard(0), hard(1), hard(2), hard(3), hard(4)], envelope as never);
  const demoted = days.find((d) => d.intensity === 'easy');
  assert(demoted !== undefined, 'expected at least one session to be demoted to easy');
  const easy = envelope.zones.bands.easy;
  const fiveK = envelope.zones.bands.fiveKPace;
  const implied = (demoted!.planned_minutes! * 60) / (demoted!.planned_distance_km! * 0.621371); // s/mi
  assert(implied >= easy.min && implied <= easy.max, `demoted session implied pace ${implied} s/mi not in easy band [${easy.min}, ${easy.max}]`);
  assert(!(implied >= fiveK.min && implied <= fiveK.max), `demoted session implied pace ${implied} s/mi is still inside the old fiveK band — polarization did not run before pace-clamp`);
});

Deno.test('polarization cap counts training days only, not rest days', () => {
  // 5 hard interval days + 2 rest = 7. The cap must be ~20% of the 5 TRAINING days
  // (→ 1 hard), not 20% of all 7 (→ 2). Rest days must not loosen the cap.
  const hard = (o: number) => ({ dayOffset: o, session_type: 'run', intensity: 'interval', planned_minutes: 40, planned_distance_km: 8 });
  const rest = (o: number) => ({ dayOffset: o, session_type: 'rest', intensity: 'rest', planned_minutes: null, planned_distance_km: null });
  const { days } = validateAndClamp([hard(0), hard(1), hard(2), hard(3), hard(4), rest(5), rest(6)], envelope as never);
  const hardCount = days.filter((d) => d.intensity === 'interval' || d.intensity === 'threshold').length;
  assertEquals(hardCount, 1);
});

Deno.test('a demoted session gets easy-run prose, not the stale hard description/prescription', () => {
  const hard = (o: number) => ({
    dayOffset: o, session_type: 'run', intensity: 'interval', planned_minutes: 40, planned_distance_km: 8,
    description: '6x800m intervals', ozzie_notes: 'Hit these hard.', interval_prescription: { segments: [] },
  });
  const { days } = validateAndClamp([hard(0), hard(1), hard(2), hard(3), hard(4)], envelope as never);
  const demoted = days.filter((d) => d.intensity === 'easy');
  assert(demoted.length > 0);
  for (const d of demoted) {
    assert(d.description !== '6x800m intervals', 'demoted session kept its stale hard description');
    assertEquals((d as Record<string, unknown>).interval_prescription, null);
  }
});

const swimEnvelope = {
  hardSessionShareMax: 0.2,
  zones: { kind: 'swim', cssSecPer100: 100,
    bands: { z1EasyRecovery: { min: 108, max: null }, z2Aerobic: { min: 103, max: 106 },
      z3Threshold: { min: 98, max: 102 }, z4Vo2Max: { min: 95, max: 98 } } },
  fuel: {
    dailyCarbGByDayType: { easy: { min: 210, max: 350 }, moderate: { min: 350, max: 490 }, high: { min: 560, max: 700 }, peak: { min: 700, max: 840 } },
    proteinG: { min: 112, max: 154 },
    longSessionCarbGPerHour: 60,
  },
};

Deno.test('clamps a swim easy session implied too fast into the z2 band (sec/100m)', () => {
  // 2 km in 30 min => 900 s / 20 hundred-m => 45 s/100m, way faster than easy z2 (103-106).
  const day = { dayOffset: 0, session_type: 'swim', intensity: 'moderate', planned_minutes: 30, planned_distance_km: 2 };
  const { days } = validateAndClamp([day], swimEnvelope as never);
  const implied = (days[0].planned_minutes! * 60) / (days[0].planned_distance_km! * 10); // s/100m
  assert(implied >= 103 && implied <= 106, `implied ${implied} not in z2 band`);
});

const rowEnvelope = {
  hardSessionShareMax: 0.2,
  zones: { kind: 'rowing', splitSecPer500: 120,
    bands: { ut2: { splitSecPer500: { min: 132, max: 136 } }, ut1: { splitSecPer500: { min: 126, max: 130 } },
      at: { splitSecPer500: { min: 123, max: 125 } }, tr: { splitSecPer500: { min: 120, max: 122 } } } },
  fuel: {
    dailyCarbGByDayType: { easy: { min: 210, max: 350 }, moderate: { min: 350, max: 490 }, high: { min: 560, max: 700 }, peak: { min: 700, max: 840 } },
    proteinG: { min: 112, max: 154 },
    longSessionCarbGPerHour: 60,
  },
};

Deno.test('clamps a rowing easy session into the UT2 split band (sec/500m)', () => {
  // 8 km in 30 min => 1800 s / 16 five-hundred-m => 112.5 s/500m, faster than UT2 (132-136).
  const day = { dayOffset: 0, session_type: 'rowing', intensity: 'easy', planned_minutes: 30, planned_distance_km: 8 };
  const { days } = validateAndClamp([day], rowEnvelope as never);
  const implied = (days[0].planned_minutes! * 60) / (days[0].planned_distance_km! * 2); // s/500m
  assert(implied >= 132 && implied <= 137, `implied ${implied} not in UT2 band`);
});

const cyclingEnvelope = {
  hardSessionShareMax: 0.2,
  zones: { kind: 'cycling', ftpWatts: 240,
    bands: { z2Endurance: { min: 134, max: 180 }, z4Threshold: { min: 218, max: 252 } } },
  fuel: {
    dailyCarbGByDayType: { easy: { min: 1, max: 2 }, moderate: { min: 1, max: 2 }, high: { min: 1, max: 2 }, peak: { min: 1, max: 2 } },
    proteinG: { min: 1, max: 2 },
    longSessionCarbGPerHour: 60,
  },
};

Deno.test('cycling envelope does not pace-clamp bike sessions (prompt-only)', () => {
  const day = { dayOffset: 0, session_type: 'bike', intensity: 'threshold', planned_minutes: 60, planned_distance_km: 30 };
  const { days, changed } = validateAndClamp([day], cyclingEnvelope as never);
  assertEquals(days[0].planned_distance_km, 30); // untouched — no pace clamp
  assertEquals(changed.length, 0);
  assert((days[0] as Record<string, unknown>).fuel !== undefined, 'fuel not attached'); // fuel still attached
});

Deno.test('triathlon clamps swim + run by their sub-zones, leaves bike unclamped', () => {
  const envelope = {
    hardSessionShareMax: 0.5,
    zones: {
      kind: 'triathlon',
      swim: { kind: 'swim', cssSecPer100: 95, bands: { z1EasyRecovery: { min: 103, max: 999 }, z2Aerobic: { min: 98, max: 101 }, z3Threshold: { min: 93, max: 97 }, z4Vo2Max: { min: 90, max: 93 } } },
      run:  { kind: 'run',  thresholdSecPerMile: 440, bands: { easy: { min: 500, max: 560 }, marathonPace: { min: 455, max: 470 }, tenKPace: { min: 425, max: 435 }, fiveKPace: { min: 410, max: 420 } } },
      bike: { kind: 'cycling', ftpWatts: 240, bands: { z2Endurance: { min: 134, max: 180 }, z4Threshold: { min: 218, max: 252 } } },
    },
    fuel: {
      dailyCarbGByDayType: { easy: { min: 1, max: 2 }, moderate: { min: 1, max: 2 }, high: { min: 1, max: 2 }, peak: { min: 1, max: 2 } },
      proteinG: { min: 1, max: 2 },
      longSessionCarbGPerHour: 60,
    },
  };
  const days = [
    // easy swim implied WAY too fast (short distance / long time) → clamped into z2Aerobic
    { dayOffset: 0, session_type: 'swim', intensity: 'easy', planned_minutes: 30, planned_distance_km: 2 },
    // easy run implied too fast → clamped into the easy band
    { dayOffset: 1, session_type: 'run', intensity: 'easy', planned_minutes: 30, planned_distance_km: 8 },
    // bike → never clamped (advice-only), distance untouched
    { dayOffset: 2, session_type: 'bike', intensity: 'threshold', planned_minutes: 60, planned_distance_km: 30 },
  ];
  const { days: out, changed } = validateAndClamp(days as any, envelope as any);
  assertEquals(out[2].planned_distance_km, 30);          // bike untouched
  assert(changed.some((c) => c.includes('swim')));        // swim clamped
  assert(changed.some((c) => c.includes('run')));         // run clamped
  assert(!changed.some((c) => c.includes('day2')));       // bike not in the change log
});

Deno.test('clamps an out-of-band comp-lift load into the %1RM band, leaves a valid load', () => {
  const envelope = {
    hardSessionShareMax: 1, zones: null,
    fuel: { dailyCarbGByDayType: { easy: {min:1,max:2}, moderate:{min:1,max:2}, high:{min:1,max:2}, peak:{min:1,max:2} }, proteinG:{min:1,max:2}, longSessionCarbGPerHour:0 },
    strength: { oneRepMaxKg: { squat: 200, bench: 140, deadlift: 240 }, workingPercent1RM: 80, zone: { name:'Strength-Volume', percent1RM:[75,85], reps:[3,6], rpe:[7,8], rir:[2,3] }, prilepin: { repsPerSet:[2,4], totalReps:[10,20] }, fatG:{min:1,max:2}, attempts: null },
  };
  const days = [
    { dayOffset: 0, session_type: 'lift', intensity: 'moderate', planned_minutes: 60, planned_distance_km: null,
      lift_prescription: { exercises: [ { name: 'Back Squat', sets: 4, reps: '4', loadKg: 400, note: null }, { name: 'Barbell Row', sets: 3, reps: '8', loadKg: null, note: null } ] } },
    { dayOffset: 1, session_type: 'lift', intensity: 'moderate', planned_minutes: 60, planned_distance_km: null,
      lift_prescription: { exercises: [ { name: 'Bench Press', sets: 4, reps: '4', loadKg: 112, note: null } ] } }, // 80% of 140 = 112, in band
  ];
  const { days: out, changed } = validateAndClamp(days as any, envelope as any);
  const squat = (out[0] as any).lift_prescription.exercises[0].loadKg;
  assertEquals(squat >= 200*0.75 && squat <= 200*0.85, true); // clamped into [150,170]
  assertEquals((out[1] as any).lift_prescription.exercises[0].loadKg, 112); // valid → untouched
  assertEquals((out[0] as any).lift_prescription.exercises[1].loadKg, null); // accessory untouched
  assertEquals(changed.some((c) => c.includes('squat')), true);
});

Deno.test('non-lift plan + load-free lift day pass through the guardrail untouched', () => {
  // an envelope with no strength, or a lift day with no loadKg, is unchanged
  const baseEnvelope = {
    hardSessionShareMax: 1, zones: null,
    fuel: { dailyCarbGByDayType: { easy: {min:1,max:2}, moderate:{min:1,max:2}, high:{min:1,max:2}, peak:{min:1,max:2} }, proteinG:{min:1,max:2}, longSessionCarbGPerHour:0 },
  };
  const strength = { oneRepMaxKg: { squat: 200, bench: 140, deadlift: 240 }, workingPercent1RM: 80, zone: { name:'Strength-Volume', percent1RM:[75,85], reps:[3,6], rpe:[7,8], rir:[2,3] }, prilepin: { repsPerSet:[2,4], totalReps:[10,20] }, fatG:{min:1,max:2}, attempts: null };

  // (1) no `strength` on the envelope at all → even an out-of-band comp-lift load is left
  // alone (there's no 1RM to clamp against, so the guardrail no-ops entirely).
  const outOfBandDay = { dayOffset: 0, session_type: 'lift', intensity: 'moderate', planned_minutes: 60, planned_distance_km: null,
    lift_prescription: { exercises: [ { name: 'Back Squat', sets: 4, reps: '4', loadKg: 999, note: null } ] } };
  const { days: out1, changed: changed1 } = validateAndClamp([outOfBandDay] as any, baseEnvelope as any);
  assertEquals((out1[0] as any).lift_prescription.exercises[0].loadKg, 999); // no strength envelope → untouched
  assertEquals(changed1.length, 0);

  // (2) strength IS present, but this comp lift's loadKg is null (left for prompt-driven
  // prescription) → the guardrail must not synthesize a load from nothing.
  const nullLoadDay = { dayOffset: 0, session_type: 'lift', intensity: 'moderate', planned_minutes: 60, planned_distance_km: null,
    lift_prescription: { exercises: [ { name: 'Back Squat', sets: 4, reps: '4', loadKg: null, note: null } ] } };
  const { days: out2, changed: changed2 } = validateAndClamp([nullLoadDay] as any, { ...baseEnvelope, strength } as any);
  assertEquals((out2[0] as any).lift_prescription.exercises[0].loadKg, null); // loadKg: null → pass through
  assertEquals(changed2.length, 0);
});

Deno.test('guardrail leaves a comp lift with orm=0 untouched (partial-provide lifter)', () => {
  const strength = { oneRepMaxKg: { squat: 200, bench: 0, deadlift: 240 }, workingPercent1RM: 80, zone: { name: 'Strength-Volume', percent1RM: [75, 85], reps: [3, 6], rpe: [7, 8], rir: [2, 3] }, prilepin: { repsPerSet: [2, 4], totalReps: [10, 20] }, fatG: { min: 1, max: 2 }, attempts: null };
  const baseEnvelope = {
    hardSessionShareMax: 1, zones: null,
    fuel: { dailyCarbGByDayType: { easy: {min:1,max:2}, moderate:{min:1,max:2}, high:{min:1,max:2}, peak:{min:1,max:2} }, proteinG:{min:1,max:2}, longSessionCarbGPerHour:0 },
  };
  const benchDay = { dayOffset: 0, session_type: 'lift',
    lift_prescription: { exercises: [ { name: 'Bench Press', sets: 4, reps: '4', loadKg: 60, note: null } ] } };
  const { days: out, changed } = validateAndClamp([benchDay] as any, { ...baseEnvelope, strength } as any);
  assertEquals((out[0] as any).lift_prescription.exercises[0].loadKg, 60); // bench orm=0 → not clamped into [0,0]
  assertEquals(changed.length, 0);
});
