import type { PrimaryGoal } from '@/types/onboarding';

// Which goals show the conditional event-params screen (sport-specific goal
// inputs: ultra race distance/vert, lift 1RMs, hyrox division, crossfit
// numbers) and the conditional equipment screen (only goals with a real
// lift-prescription component). Centralized here so body-weight.tsx and
// event-params.tsx route off one shared set instead of two copies drifting.
export const EVENT_PARAM_GOALS: PrimaryGoal[] = ['ultra', 'lift', 'crossfit', 'hyrox'];
export const EQUIPMENT_GOALS: PrimaryGoal[] = ['lift', 'hybrid', 'hyrox', 'crossfit'];

// Narrow literal-union return types (not `string`) so expo-router's typed
// `router.push()` accepts these directly — a bare `string` return fails its
// generated route-literal check even though every actual returned value is
// one of the three route files below.
type BodyWeightNext = '/(onboarding)/event-params' | '/(onboarding)/equipment' | '/(onboarding)/summary';
type EventParamsNext = '/(onboarding)/equipment' | '/(onboarding)/summary';

export function nextAfterBodyWeight(goal: PrimaryGoal): BodyWeightNext {
  if (EVENT_PARAM_GOALS.includes(goal)) return '/(onboarding)/event-params';
  if (EQUIPMENT_GOALS.includes(goal)) return '/(onboarding)/equipment';
  return '/(onboarding)/summary';
}

export function nextAfterEventParams(goal: PrimaryGoal): EventParamsNext {
  return EQUIPMENT_GOALS.includes(goal) ? '/(onboarding)/equipment' : '/(onboarding)/summary';
}
