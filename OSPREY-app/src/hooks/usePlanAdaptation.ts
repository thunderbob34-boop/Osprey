import { usePerformance } from '@/hooks/usePerformance';

export interface PlanAdaptationAlert {
  message: string;
  severity: 'warning' | 'info' | 'positive';
  tsb: number;
}

export function usePlanAdaptation(): PlanAdaptationAlert | null {
  const { data, isLoading } = usePerformance();

  if (isLoading || !data) return null;
  if (data.ctl < 5) return null;

  const { tsb } = data;

  if (tsb < -20) {
    return {
      message: "You're carrying heavy load. Ozzie can rebuild your plan around recovery.",
      severity: 'warning',
      tsb,
    };
  }

  if (tsb < -10) {
    return {
      message: 'Moderate fatigue detected. Your next plan will auto-reduce intensity.',
      severity: 'info',
      tsb,
    };
  }

  if (tsb > 15) {
    return {
      message: "You're fresh and fit. Ozzie can push harder in your next plan.",
      severity: 'positive',
      tsb,
    };
  }

  return null;
}
