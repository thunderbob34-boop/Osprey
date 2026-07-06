// Plate math for the lift logger: what to load on each side of the bar.

const DEFAULT_BAR_LBS = 45;
/** Standard gym plate denominations, heaviest first. */
const PLATES_LBS = [45, 35, 25, 10, 5, 2.5];

export interface PlateBreakdown {
  barLbs: number;
  /** Plates for ONE side, heaviest first (e.g. [45, 25, 5]). */
  perSide: number[];
  /** Weight that can't be made with standard plates (per side). */
  remainderPerSideLbs: number;
  /** False when the target is lighter than the bar itself. */
  loadable: boolean;
}

export function computePlates(weightLbs: number, barLbs: number = DEFAULT_BAR_LBS): PlateBreakdown {
  if (weightLbs < barLbs) {
    return { barLbs, perSide: [], remainderPerSideLbs: 0, loadable: false };
  }

  let perSideTarget = (weightLbs - barLbs) / 2;
  const perSide: number[] = [];
  for (const plate of PLATES_LBS) {
    while (perSideTarget >= plate) {
      perSide.push(plate);
      perSideTarget -= plate;
    }
  }

  return {
    barLbs,
    perSide,
    remainderPerSideLbs: Math.round(perSideTarget * 100) / 100,
    loadable: true,
  };
}

/** "45 bar + 45, 25, 5 per side" — compact human string for the modal. */
export function formatPlateBreakdown(breakdown: PlateBreakdown): string {
  if (!breakdown.loadable) return `Lighter than the ${breakdown.barLbs} lb bar — use dumbbells or a fixed bar.`;
  if (breakdown.perSide.length === 0) return `Empty ${breakdown.barLbs} lb bar.`;
  const plates = breakdown.perSide.join(' + ');
  const remainder =
    breakdown.remainderPerSideLbs > 0 ? ` (+${breakdown.remainderPerSideLbs} lb short per side)` : '';
  return `${breakdown.barLbs} lb bar + ${plates} per side${remainder}`;
}
