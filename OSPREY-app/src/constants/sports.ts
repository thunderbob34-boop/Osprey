import type { PrimaryGoal } from '@/types/onboarding';

// Label for the onboarding schedule picker's PRIMARY-discipline row. The store
// field behind it is still `weeklyRunDays` (see onboardingStore), but for a
// swim/row athlete it means "primary endurance days per week" — the edge fn
// routes that count to the correct discipline via the athlete's primary_goal
// (see supabase/functions/ozzie-generate-plan/goals.ts). Only the label varies.
// Hyrox trains via running + strength, so it keeps the "Run days" label.
export function primaryDayLabel(goal: PrimaryGoal | null): string {
  if (goal === 'swim') return 'Swim days per week';
  if (goal === 'rowing') return 'Row days per week';
  return 'Run days per week';
}
