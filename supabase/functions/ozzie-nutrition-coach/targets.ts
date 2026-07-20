// Bodyweight- and load-driven daily nutrition targets.
// docs/coaching/_index.md:20 — protein ~1.6-2.2 g/kg/day; carbs 3-12 g/kg/day by load.

export type PrimaryGoal = 'run' | 'lift' | 'hybrid' | 'weight_loss' | 'general_fitness';

export interface TodaySession {
  sessionType: string;
  plannedMinutes: number | null;
}

export interface NutritionTarget {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

// Per-goal protein point within 1.6-2.2 g/kg (hybrid/lift lean toward the top
// for muscle retention; endurance/general sit mid-range).
const PROTEIN_G_PER_KG: Record<PrimaryGoal, number> = {
  hybrid: 2.2, lift: 2.2, weight_loss: 2.0, run: 1.8, general_fitness: 1.8,
};
const DEFAULT_PROTEIN_G_PER_KG = 1.8;

// running.md / ultra.md daily-fueling tables: easy 3-5, moderate 5-7,
// high-volume 8-10, peak/race-sim 10-12 g/kg/day — point value per tier.
export const CARB_G_PER_KG_BY_LOAD = { easy: 4, moderate: 6, high: 9, peak: 11 } as const;
export type LoadTier = keyof typeof CARB_G_PER_KG_BY_LOAD;

// A brand-new user with no body_metrics reading yet still needs a starting
// target — falls back to a reference adult bodyweight rather than crashing.
export const REFERENCE_BODYWEIGHT_KG = 75;

// Session intensity multipliers for calorie bump (cal/min of planned activity).
// Endurance sessions (swim/bike/run) burn more than strength sessions.
const SESSION_CAL_PER_MIN: Record<string, number> = {
  run: 7,    // ~420 cal/hr moderate run
  swim: 8,   // slightly higher — open water or pool
  bike: 6,   // moderate cycling
  lift: 4,   // strength session
  cross: 5,
  race: 9,   // race effort
  rest: 0,
};

export function loadTierForSession(todaySession: TodaySession | null): LoadTier {
  if (!todaySession || todaySession.sessionType === 'rest') return 'easy';
  if (todaySession.sessionType === 'race') return 'peak';
  if ((todaySession.plannedMinutes ?? 0) >= 90) return 'high';
  return 'moderate';
}

export function computeTarget(
  primaryGoal: PrimaryGoal | null,
  todaySession: TodaySession | null,
  weightTrendCalorieAdjustment: number,
  bodyWeightKg: number | null,
): NutritionTarget {
  const weightKg = bodyWeightKg ?? REFERENCE_BODYWEIGHT_KG;

  const proteinGPerKg = primaryGoal ? PROTEIN_G_PER_KG[primaryGoal] : DEFAULT_PROTEIN_G_PER_KG;
  const proteinG = Math.round(weightKg * proteinGPerKg);

  const carbsG = Math.round(weightKg * CARB_G_PER_KG_BY_LOAD[loadTierForSession(todaySession)]);

  // Fat ~26% of total calories. Solved algebraically — protein and carbs are
  // fixed by bodyweight/load rather than derived from a calorie total.
  const proteinCals = proteinG * 4;
  const carbsCals = carbsG * 4;
  let totalCals = (proteinCals + carbsCals) / (1 - 0.26);

  // Activity bump based on session type and planned duration.
  if (todaySession && todaySession.sessionType !== 'rest') {
    const minutes = todaySession.plannedMinutes ?? 45;
    const ratePerMin = SESSION_CAL_PER_MIN[todaySession.sessionType] ?? 5;
    totalCals += Math.round(minutes * ratePerMin);
  }

  // Weight-trend correction lands on fat/calories, not protein or carbs —
  // those stay anchored to bodyweight and today's training load. Floor
  // protects against unsafe lowballing if multiple negatives stack.
  totalCals = Math.max(1600, totalCals + weightTrendCalorieAdjustment);

  const fatG = Math.max(0, Math.round((totalCals - proteinCals - carbsCals) / 9));
  const calories = Math.round(proteinCals + carbsCals + fatG * 9);

  return { calories, proteinG, carbsG, fatG };
}
