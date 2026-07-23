// Ported from OSPREY-app/src/services/coaching/zones.ts. The per-sport zone-band
// interfaces (RunningPaceZones etc.) already exist in ./training-zones — reused
// here rather than re-declared. Keep in sync; parity: tests/zones-parity.test.ts.
import type { RunningPaceZones, SwimPaceZones, RowingTrainingZones, CyclingPowerZones } from './training-zones';

export interface RunZone { kind: 'run'; thresholdSecPerMile: number; bands: RunningPaceZones }
export interface SwimZone { kind: 'swim'; cssSecPer100: number; bands: SwimPaceZones }
export interface RowingZone { kind: 'rowing'; splitSecPer500: number; bands: RowingTrainingZones }
export interface CyclingZone { kind: 'cycling'; ftpWatts: number; bands: CyclingPowerZones }
export interface TriathlonZone {
  kind: 'triathlon';
  swim: SwimZone | null;
  bike: CyclingZone | null;
  run: RunZone | null;
}
export type ZoneSet = RunZone | SwimZone | RowingZone | CyclingZone | TriathlonZone;

export type BlueprintSport = 'run' | 'swim' | 'rowing' | 'cycling';

/** Canonical primaryGoal → the blueprint whose zones drive the plan. Triathlon is a
 *  COMPOSITE handled directly in computeEnvelope, not a single blueprint sport. */
export function blueprintSport(primaryGoal: string): BlueprintSport | null {
  if (primaryGoal === 'run' || primaryGoal === 'hybrid' || primaryGoal === 'hyrox' || primaryGoal === 'ultra') return 'run';
  if (primaryGoal === 'swim') return 'swim';
  if (primaryGoal === 'rowing') return 'rowing';
  if (primaryGoal === 'cycling') return 'cycling';
  return null; // triathlon (composite) / lift / cross
}
