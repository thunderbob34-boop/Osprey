// Ported from OSPREY-app/src/services/coaching/envelope.ts. Ultra is entirely
// excluded (the isUltra branch, ULTRA_DISTANCE_FACTOR, ultraParams,
// weeksRemaining) — `sport` can never be 'ultra' from a webapp-originated
// call, so the ported computeEnvelope always takes the non-ultra load-calc
// path and calls computeFuel with no gutTrained argument. Keep in sync;
// parity: tests/envelope-parity.test.ts.
import { runningPaceZones, swimPaceZones, rowingTrainingZones, cyclingPowerZones } from './training-zones';
import { targetWeeklyLoad } from './periodization';
import { estimateSwimCssByTier, resolveRunningAnchor, estimateRowingSplitByTier } from './anchor';
import { computeFuel, type FuelPlan } from './fuel';
import { blueprintSport, type ZoneSet } from './zones';
import { resolveMaxHR, ultraHRZones, type HRZones } from './hr-zones';
import { buildStrengthPrescription, type StrengthPrescription, type StrengthGoalParams } from './strength-loads';
import { buildHyroxPrescription, type HyroxPrescription, type HyroxPrescriptionParams } from './hyrox-loads';
import { buildCrossfitPrescription, type CrossfitPrescription } from './crossfit-zones';
import type { CrossfitGoalParams } from './goal-params';
import type { RacePhaseName } from './race-phase';

export interface HrZoneInfo {
  maxHR: number;
  source: 'observed' | 'estimated';
  bands: HRZones;
}

// Flat shape consumed by computeEnvelope; assembled by build-envelope.ts's
// toSelfReportAnchor from the raw user_goals.threshold_anchor JSONB.
export interface SelfReportAnchor {
  thresholdSecPerMile: number | null;
  cssSecPer100: number | null;
  splitSecPer500: number | null;
  ftpWatts: number | null;
}

export interface CoachingEnvelope {
  sport: string;
  phase: RacePhaseName;
  weekNumber: number;
  totalWeeks: number;
  targetWeeklyLoad: number;
  hardSessionShareMax: number; // polarization cap (docs/coaching/_index.md:16)
  zones: ZoneSet | null;
  hrZones: HrZoneInfo; // universal HR fallback (prompt-only); always populated
  fuel: FuelPlan;
  strength: StrengthPrescription | null;
  hyrox: HyroxPrescription | null;
  crossfit: CrossfitPrescription | null;
}

export interface EnvelopeInput {
  sport: string;
  phase: RacePhaseName;
  weekNumber: number;
  totalWeeks: number;
  baselineLoad: number;
  prevWeekLoad: number | null;
  bestRunMiles: number | null;
  bestRunTimeS: number | null;
  fitnessLevel: string;
  bodyWeightKg: number;
  rowingSplitSecPer500: number | null;
  selfReportAnchor?: SelfReportAnchor | null;
  maxHR?: number | null;
  strengthParams?: StrengthGoalParams | null;
  hyroxParams?: HyroxPrescriptionParams | null;
  crossfitParams?: CrossfitGoalParams | null;
}

export type ZonesConfidence = 'measured' | 'estimated';

// Zone dispatch + a client-only confidence signal. `estimated` = the sport's
// pace/power anchor is a pure tier fallback (no self-report AND no logged
// data); `measured` otherwise. computeEnvelope consumes only `.zones`.
export function resolveZones(input: EnvelopeInput): { zones: ZoneSet | null; zonesConfidence: ZonesConfidence } {
  const runConfidence = (): ZonesConfidence =>
    input.selfReportAnchor?.thresholdSecPerMile != null
      ? 'measured'
      : resolveRunningAnchor({ bestRunMiles: input.bestRunMiles, bestRunTimeS: input.bestRunTimeS, fitnessLevel: input.fitnessLevel }).source === 'derived'
        ? 'measured'
        : 'estimated';

  let zones: ZoneSet | null = null;
  let zonesConfidence: ZonesConfidence = 'estimated';

  if (input.sport === 'triathlon') {
    const t =
      input.selfReportAnchor?.thresholdSecPerMile ??
      resolveRunningAnchor({ bestRunMiles: input.bestRunMiles, bestRunTimeS: input.bestRunTimeS, fitnessLevel: input.fitnessLevel }).thresholdSecPerMile;
    const css = input.selfReportAnchor?.cssSecPer100 ?? estimateSwimCssByTier(input.fitnessLevel);
    const ftp = input.selfReportAnchor?.ftpWatts;
    zones = {
      kind: 'triathlon',
      swim: { kind: 'swim', cssSecPer100: css, bands: swimPaceZones(css) },
      run: { kind: 'run', thresholdSecPerMile: t, bands: runningPaceZones(t) },
      bike: ftp != null ? { kind: 'cycling', ftpWatts: ftp, bands: cyclingPowerZones(ftp) } : null,
    };
    const swimConf: ZonesConfidence = input.selfReportAnchor?.cssSecPer100 != null ? 'measured' : 'estimated';
    zonesConfidence = runConfidence() === 'estimated' || swimConf === 'estimated' ? 'estimated' : 'measured';
  } else {
    const bp = blueprintSport(input.sport);
    if (bp === 'run') {
      const t =
        input.selfReportAnchor?.thresholdSecPerMile ??
        resolveRunningAnchor({ bestRunMiles: input.bestRunMiles, bestRunTimeS: input.bestRunTimeS, fitnessLevel: input.fitnessLevel }).thresholdSecPerMile;
      zones = { kind: 'run', thresholdSecPerMile: t, bands: runningPaceZones(t) };
      zonesConfidence = runConfidence();
    } else if (bp === 'swim') {
      const css = input.selfReportAnchor?.cssSecPer100 ?? estimateSwimCssByTier(input.fitnessLevel);
      zones = { kind: 'swim', cssSecPer100: css, bands: swimPaceZones(css) };
      zonesConfidence = input.selfReportAnchor?.cssSecPer100 != null ? 'measured' : 'estimated';
    } else if (bp === 'rowing') {
      const hasSplit = input.selfReportAnchor?.splitSecPer500 != null || input.rowingSplitSecPer500 != null;
      const split =
        input.selfReportAnchor?.splitSecPer500 ?? input.rowingSplitSecPer500 ?? estimateRowingSplitByTier(input.fitnessLevel);
      zones = { kind: 'rowing', splitSecPer500: split, bands: rowingTrainingZones(split) };
      zonesConfidence = hasSplit ? 'measured' : 'estimated';
    } else if (bp === 'cycling') {
      const ftp = input.selfReportAnchor?.ftpWatts;
      if (ftp != null) {
        zones = { kind: 'cycling', ftpWatts: ftp, bands: cyclingPowerZones(ftp) };
        zonesConfidence = 'measured';
      }
      // else zones stays null → the display falls back to hrZones
    }
  }
  return { zones, zonesConfidence };
}

export function computeEnvelope(input: EnvelopeInput): CoachingEnvelope {
  const load = Math.round(targetWeeklyLoad({
    baselineLoad: Math.round(input.baselineLoad),
    phase: input.phase,
    weekNumber: input.weekNumber,
    prevWeekLoad: input.prevWeekLoad,
  }));

  const { zones } = resolveZones(input);

  const hr = resolveMaxHR(input.maxHR ?? null);
  const hrZones: HrZoneInfo = { maxHR: hr.maxHR, source: hr.source, bands: ultraHRZones(hr.maxHR) };

  const strength = buildStrengthPrescription(input);
  const hyrox = buildHyroxPrescription(input);
  const crossfit = buildCrossfitPrescription(input);

  return {
    sport: input.sport,
    phase: input.phase,
    weekNumber: input.weekNumber,
    totalWeeks: input.totalWeeks,
    targetWeeklyLoad: load,
    hardSessionShareMax: 0.2,
    zones,
    hrZones,
    fuel: computeFuel(input.sport, input.bodyWeightKg),
    strength,
    hyrox,
    crossfit,
  };
}
