/**
 * A plain-language read of how much time is left before a race, independent
 * of whether a formal training block is linked (computeRacePhase in
 * race-phase.ts needs totalWeeksPlanned, which only mobile onboarding
 * sets). Buckets roughly mirror how a plan periodizes: base needs the most
 * lead time, taper the least.
 */
export function raceRunwayLabel(weeksOut: number): string {
  if (weeksOut <= 1) return "Race week — trust the work you've put in.";
  if (weeksOut <= 4) return 'Peak block window — sharpen up with race-specific work.';
  if (weeksOut <= 11) return 'Time for a focused build — base phase should be behind you.';
  if (weeksOut <= 20) return 'Full build fits, with room for a base block first.';
  return 'Plenty of runway — no need to rush into hard training yet.';
}
