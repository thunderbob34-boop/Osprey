import type { SelfReportAnchor } from './baseline';
import { runningPaceZones } from '@/services/calculators/running';
import { swimPaceZones } from '@/services/calculators/swimming';
import { rowingTrainingZones } from '@/services/calculators/rowing';
import { cyclingPowerZones } from '@/services/calculators/cycling';
import { ultraTaperWeeklyVolumes } from '@/services/calculators/ultra';
import { Phase, targetWeeklyLoad } from './periodization';
import { estimateSwimCssByTier, resolveRunningAnchor, estimateRowingSplitByTier } from './anchor';
import { computeFuel, FuelPlan } from './fuel';
import { ZoneSet, blueprintSport } from './zones';
import { resolveMaxHR, ultraHRZones, HRZones } from './hr';
import { ULTRA_DISTANCE_FACTOR } from './ultra-params';

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
  fuel: FuelPlan;
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
  ultraParams?: import('./ultra-params').UltraGoalParams | null;
  weeksRemaining?: number | null;
}

export function computeEnvelope(input: EnvelopeInput): CoachingEnvelope {
  const isUltra = input.sport === 'ultra';
  const distanceFactor = isUltra ? (ULTRA_DISTANCE_FACTOR[input.ultraParams?.raceDistance ?? '50k'] ?? 1) : 1;
  const scaledBaseline = Math.round(input.baselineLoad * distanceFactor);

  let load: number;
  if (isUltra && input.phase === 'Taper') {
    // Progressive 25/25/30 taper (docs/coaching/ultra.md §8): 3-out ×0.75, 2-out ×0.75, race week ×0.70.
    const taperIdx = Math.min(2, Math.max(0, 3 - (input.weeksRemaining ?? 3)));
    load = Math.round(ultraTaperWeeklyVolumes(scaledBaseline)[taperIdx]);
  } else {
    // Math.round wraps this call (the brief's else-branch was unrounded): targetWeeklyLoad's
    // Taper branch returns a raw applyVolumeCut() float (periodization.ts is unchanged, so
    // that's still un-rounded there); every other phase already returns Math.round(target),
    // so this is a no-op for Base/Build/Peak and only cleans up Taper float dust (e.g.
    // 400*(1-0.45) = 220.00000000000003) for non-ultra plans too.
    load = Math.round(targetWeeklyLoad({
      baselineLoad: scaledBaseline,
      phase: input.phase,
      weekNumber: input.weekNumber,
      prevWeekLoad: input.prevWeekLoad,
    }));
  }

  let zones: ZoneSet | null = null;
  if (input.sport === 'triathlon') {
    const t =
      input.selfReportAnchor?.thresholdSecPerMile ??
      resolveRunningAnchor({
        bestRunMiles: input.bestRunMiles,
        bestRunTimeS: input.bestRunTimeS,
        fitnessLevel: input.fitnessLevel,
      }).thresholdSecPerMile;
    const css = input.selfReportAnchor?.cssSecPer100 ?? estimateSwimCssByTier(input.fitnessLevel);
    const ftp = input.selfReportAnchor?.ftpWatts;
    zones = {
      kind: 'triathlon',
      swim: { kind: 'swim', cssSecPer100: css, bands: swimPaceZones(css) },
      run: { kind: 'run', thresholdSecPerMile: t, bands: runningPaceZones(t) },
      bike: ftp != null ? { kind: 'cycling', ftpWatts: ftp, bands: cyclingPowerZones(ftp) } : null,
    };
  } else {
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
  }

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
    fuel: computeFuel(input.sport, input.bodyWeightKg),
  };
}
