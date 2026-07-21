// Ported from OSPREY-app/src/services/performance.ts's computeAtlCtlTsb.
// Keep in sync; parity: tests/fitness-load-parity.test.ts.

export interface DailyLoad {
  date: string; // YYYY-MM-DD
  tss: number;
}

export interface LoadSeriesPoint {
  date: string;
  atl: number; // Acute Training Load (7-day EWA)
  ctl: number; // Chronic Training Load (42-day EWA)
  tsb: number; // Training Stress Balance = CTL - ATL
}

export function computeAtlCtlTsb(dailyLoads: DailyLoad[]): LoadSeriesPoint[] {
  if (dailyLoads.length === 0) return [];

  const TAU_ATL = 7;
  const TAU_CTL = 42;

  let atl = 0;
  let ctl = 0;

  return dailyLoads.map(({ date, tss }) => {
    atl = atl + (tss - atl) / TAU_ATL;
    ctl = ctl + (tss - ctl) / TAU_CTL;
    const tsb = ctl - atl;
    return { date, atl: Math.round(atl * 10) / 10, ctl: Math.round(ctl * 10) / 10, tsb: Math.round(tsb * 10) / 10 };
  });
}
