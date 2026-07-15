import { RunningPaceZones } from '@/services/calculators/running';
import { SwimPaceZones } from '@/services/calculators/swimming';
import { RowingTrainingZones } from '@/services/calculators/rowing';
import { CyclingPowerZones } from '@/services/calculators/cycling';

export type ZoneSet =
  | { kind: 'run'; thresholdSecPerMile: number; bands: RunningPaceZones }
  | { kind: 'swim'; cssSecPer100: number; bands: SwimPaceZones }
  | { kind: 'rowing'; splitSecPer500: number; bands: RowingTrainingZones }
  | { kind: 'cycling'; ftpWatts: number; bands: CyclingPowerZones };

export type BlueprintSport = 'run' | 'swim' | 'rowing' | 'cycling';

/** Canonical primaryGoal → the blueprint whose zones drive the plan (Phase 2a set). */
export function blueprintSport(primaryGoal: string): BlueprintSport | null {
  if (primaryGoal === 'run' || primaryGoal === 'hybrid' || primaryGoal === 'hyrox') return 'run';
  if (primaryGoal === 'swim') return 'swim';
  if (primaryGoal === 'rowing') return 'rowing';
  if (primaryGoal === 'cycling') return 'cycling';
  return null; // triathlon / lift / cross — later phases
}
