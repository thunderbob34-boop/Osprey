// Race time prediction — ported verbatim from OSPREY-app/src/services/performance.ts
// (riegelPredict / buildRacePredictor / formatRaceTimeSec), which is the tested,
// shipped formula the mobile app already uses. Keep this file in sync with that one;
// do not fork the math.

const RIEGEL_EXPONENT = 1.06;

export function riegelPredict(
  sourceDistanceMiles: number,
  sourceTimeS: number,
  targetDistanceMiles: number,
): number {
  return sourceTimeS * Math.pow(targetDistanceMiles / sourceDistanceMiles, RIEGEL_EXPONENT);
}

const RACE_DISTANCES: { label: string; miles: number }[] = [
  { label: '5K', miles: 3.107 },
  { label: '10K', miles: 6.214 },
  { label: 'Half', miles: 13.109 },
  { label: 'Marathon', miles: 26.219 },
];

export interface RacePredictor {
  baseMiles: number;
  basePaceSecPerMile: number;
  predictions: { label: string; distanceMiles: number; predictedTimeS: number }[];
}

export function buildRacePredictor(bestRunMiles: number, bestRunTimeS: number): RacePredictor | null {
  if (bestRunMiles < 1 || bestRunTimeS <= 0) return null;

  const paceSecPerMile = bestRunTimeS / bestRunMiles;

  const predictions = RACE_DISTANCES
    .filter((d) => d.miles >= bestRunMiles * 0.5)
    .map(({ label, miles }) => ({
      label,
      distanceMiles: miles,
      predictedTimeS: Math.round(riegelPredict(bestRunMiles, bestRunTimeS, miles)),
    }));

  return { baseMiles: bestRunMiles, basePaceSecPerMile: paceSecPerMile, predictions };
}

export function formatRaceTimeSec(totalS: number): string {
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = Math.round(totalS % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
