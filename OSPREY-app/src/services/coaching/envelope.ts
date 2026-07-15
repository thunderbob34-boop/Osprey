import type { SelfReportAnchor } from './baseline';
import { runningPaceZones } from '@/services/calculators/running';
import { swimPaceZones } from '@/services/calculators/swimming';
import { rowingTrainingZones } from '@/services/calculators/rowing';
import { cyclingPowerZones } from '@/services/calculators/cycling';
import { Phase, loadingWeek, targetWeeklyLoad } from './periodization';
import { estimateSwimCssByTier, resolveRunningAnchor, estimateRowingSplitByTier } from './anchor';
import { computeRunningFuel, FuelTargets } from './fuel';
import { ZoneSet, blueprintSport } from './zones';
import { resolveMaxHR, ultraHRZones, HRZones } from './hr';

export interface HrZoneInfo {
  maxHR: number;
  source: 'observed' | 'estimated';
  bands: HRZones;
}

export interface CoachingEnvelope {
  sport: string;
  phase: Phase;
  weekNumber: number;
  totalWeeks: number;
  targetWeeklyLoad: number;
  hardSessionShareMax: number; // polarization cap (docs/coaching/_index.md:16)
  zones: ZoneSet | null;
  hrZones: HrZoneInfo; // universal HR fallback (prompt-only); always populated
  fuel: FuelTargets;
}

export interface EnvelopeInput {
  sport: string;
  phase: Phase;
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
}

export function computeEnvelope(input: EnvelopeInput): CoachingEnvelope {
  const load = targetWeeklyLoad({
    baselineLoad: input.baselineLoad,
    phase: input.phase,
    weekNumber: input.weekNumber,
    prevWeekLoad: input.prevWeekLoad,
  });

  let zones: ZoneSet | null = null;
  const bp = blueprintSport(input.sport);
  if (bp === 'run') {
    const t =
      input.selfReportAnchor?.thresholdSecPerMile ??
      resolveRunningAnchor({
        bestRunMiles: input.bestRunMiles,
        bestRunTimeS: input.bestRunTimeS,
        fitnessLevel: input.fitnessLevel,
      }).thresholdSecPerMile;
    zones = { kind: 'run', thresholdSecPerMile: t, bands: runningPaceZones(t) };
  } else if (bp === 'swim') {
    const css = input.selfReportAnchor?.cssSecPer100 ?? estimateSwimCssByTier(input.fitnessLevel);
    zones = { kind: 'swim', cssSecPer100: css, bands: swimPaceZones(css) };
  } else if (bp === 'rowing') {
    const split =
      input.selfReportAnchor?.splitSecPer500 ??
      input.rowingSplitSecPer500 ??
      estimateRowingSplitByTier(input.fitnessLevel);
    zones = { kind: 'rowing', splitSecPer500: split, bands: rowingTrainingZones(split) };
  } else if (bp === 'cycling') {
    const ftp = input.selfReportAnchor?.ftpWatts;
    if (ftp != null) {
      zones = { kind: 'cycling', ftpWatts: ftp, bands: cyclingPowerZones(ftp) };
    }
    // else zones stays null → the universal hrZones (2b-iii) carries the cyclist's guidance
  }

  const hardWeek = loadingWeek(input.weekNumber) !== 4 && input.phase !== 'Taper';

  const hr = resolveMaxHR(input.maxHR ?? null);
  const hrZones: HrZoneInfo = { maxHR: hr.maxHR, source: hr.source, bands: ultraHRZones(hr.maxHR) };

  return {
    sport: input.sport,
    phase: input.phase,
    weekNumber: input.weekNumber,
    totalWeeks: input.totalWeeks,
    targetWeeklyLoad: load,
    hardSessionShareMax: 0.2,
    zones,
    hrZones,
    fuel: computeRunningFuel({ bodyWeightKg: input.bodyWeightKg, hardWeek }),
  };
}
