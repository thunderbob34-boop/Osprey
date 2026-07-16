import {
  predictCompromisedRunSplit, hyroxStationWeights, hyroxSodiumMgPerHour, hyroxCaffeineMg,
  type HyroxStationWeights, type HyroxDivision,
} from '@/services/calculators/hyrox';
import { Range } from '@/services/calculators/types';
import { resolveRunningAnchor } from './anchor';
import type { EnvelopeInput } from './envelope';

const MILES_PER_KM = 0.621371;

export interface HyroxPrescription {
  division: HyroxDivision;
  compromisedRunSplitSecPerKm: Range; // race-pace target under station fatigue (threshold + 15-30 s/km)
  stationWeights: HyroxStationWeights; // division-fixed race weights (training references)
  sodiumMgPerHour: Range;
  caffeineMg: Range;
}

export function buildHyroxPrescription(input: EnvelopeInput): HyroxPrescription | null {
  if (input.sport !== 'hyrox') return null;
  const division = input.hyroxParams?.division;
  if (!division) return null;
  // Run threshold: self-report first, else derive from data/tier — same resolution the run
  // zones use. Convert sec/mile → sec/km for the compromised-split predictor.
  const thresholdSecPerMile =
    input.selfReportAnchor?.thresholdSecPerMile ??
    resolveRunningAnchor({ bestRunMiles: input.bestRunMiles, bestRunTimeS: input.bestRunTimeS, fitnessLevel: input.fitnessLevel }).thresholdSecPerMile;
  const thresholdSecPerKm = Math.round(thresholdSecPerMile * MILES_PER_KM);
  return {
    division,
    compromisedRunSplitSecPerKm: predictCompromisedRunSplit(thresholdSecPerKm),
    stationWeights: hyroxStationWeights(division),
    sodiumMgPerHour: hyroxSodiumMgPerHour(),
    caffeineMg: hyroxCaffeineMg(input.bodyWeightKg),
  };
}
