export type PrescriptionSection = 'strength' | 'hyrox' | 'crossfit' | null;

/** Which of the 3 sport-specific prescription sections (if any) your-numbers.tsx
 *  shows. Every other sport is endurance-only — already well-served by ZonesCard's
 *  pace/HR zones, so this screen doesn't duplicate a fuller breakdown for them. */
export function prescriptionSectionForSport(primaryGoal: string | null): PrescriptionSection {
  if (primaryGoal === 'lift') return 'strength';
  if (primaryGoal === 'hyrox') return 'hyrox';
  if (primaryGoal === 'crossfit') return 'crossfit';
  return null;
}
