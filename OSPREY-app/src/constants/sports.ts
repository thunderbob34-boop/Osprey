import type { PrimaryGoal } from '@/types/onboarding';

// Label for the onboarding schedule picker's PRIMARY-discipline row. The store
// field behind it is still `weeklyRunDays` (see onboardingStore), but for a
// swim/row athlete it means "primary endurance days per week" — the edge fn
// routes that count to the correct discipline via the athlete's primary_goal
// (see supabase/functions/ozzie-generate-plan/goals.ts). Only the label varies.
// Hyrox trains via running + strength, so it keeps the "Run days" label.
// CrossFit is WOD-based with no running component, so it gets a generic
// "Training days" label instead of the run default.
// Athlete-facing name for a discipline, for read-out lines like Settings'
// "Hyrox · 5 days/week · intermediate". Deliberately plain-language, matching
// the coaching-copy convention in CLAUDE.md.
const GOAL_LABEL: Record<PrimaryGoal, string> = {
  run: 'Run',
  lift: 'Strength',
  hybrid: 'Hybrid',
  weight_loss: 'Weight loss',
  general_fitness: 'General fitness',
  swim: 'Swim',
  rowing: 'Rowing',
  hyrox: 'Hyrox',
  cycling: 'Cycling',
  ultra: 'Ultra',
  crossfit: 'CrossFit',
};

export function goalLabel(goal: PrimaryGoal | null): string | null {
  return goal ? GOAL_LABEL[goal] ?? null : null;
}

export function primaryDayLabel(goal: PrimaryGoal | null): string {
  if (goal === 'swim') return 'Swim days per week';
  if (goal === 'rowing') return 'Row days per week';
  if (goal === 'cycling') return 'Ride days per week';
  if (goal === 'lift') return 'Lift days per week';
  if (goal === 'crossfit') return 'Training days per week';
  return 'Run days per week';
}
