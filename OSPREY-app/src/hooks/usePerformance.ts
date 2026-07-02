import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import {
  buildRacePredictor,
  computeAtlCtlTsb,
  computeInjuryRisk,
  fetchPerformanceData,
  readinessFromTsb,
  type PerformanceMetrics,
} from '@/services/performance';
import type { TrainingReadiness } from '@/types/daily-summary';

export interface PerformanceResult extends PerformanceMetrics {
  trainingReadiness: TrainingReadiness | null;
}

export function usePerformance() {
  const userId = useAuthStore((s) => s.user?.id);
  const key = ['performance', userId];

  return useQuery<PerformanceResult>({
    queryKey: key,
    queryFn: async () => {
      const { dailyLoads, bestRunMiles, bestRunTimeS } = await fetchPerformanceData(userId!);
      const series = computeAtlCtlTsb(dailyLoads);
      const latest = series[series.length - 1] ?? { atl: 0, ctl: 0, tsb: 0 };
      const injuryRisk = computeInjuryRisk(dailyLoads);
      const racePredictor = buildRacePredictor(dailyLoads, bestRunMiles, bestRunTimeS);

      // ACWR: acute (7-day avg) / chronic (28-day avg)
      const last28 = dailyLoads.slice(-28);
      const last7 = dailyLoads.slice(-7);
      const chronicAvg = last28.reduce((s, d) => s + d.tss, 0) / Math.max(1, last28.length);
      const acuteAvg = last7.reduce((s, d) => s + d.tss, 0) / Math.max(1, last7.length);
      const acwr = chronicAvg > 0 ? acuteAvg / chronicAvg : 0;

      // Trim series to last 84 points for charting
      const chartSeries = series.slice(-84);

      const trainingReadiness = latest.ctl > 0
        ? readinessFromTsb(latest.tsb, latest.ctl)
        : null;

      return {
        atl: latest.atl,
        ctl: latest.ctl,
        tsb: latest.tsb,
        acwr,
        injuryRisk,
        series: chartSeries,
        racePredictor,
        trainingReadiness,
      };
    },
    enabled: Boolean(userId),
    staleTime: 300_000, // 5 minutes
  });
}
