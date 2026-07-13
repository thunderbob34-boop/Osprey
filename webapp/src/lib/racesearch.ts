export interface RunSignupSearchParams {
  zip: string;
  ladderKm: number;
  centerDateISO: string; // YYYY-MM-DD, typically the tune-up week's long-run session_date
  radiusMiles?: number;
}

const DEFAULT_RADIUS_MILES = 25;
const DISTANCE_BAND_KM = 1.0;

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Builds a deep link to RunSignup's public race search. Query params were
 * verified live during planning by filling the site's own Filters form and
 * reading the resulting URL (its JSON API requires a key; this page does
 * not) — see docs/superpowers/specs/2026-07-12-tuneup-races-design.md §4.
 */
export function buildRunSignupSearchUrl(params: RunSignupSearchParams): string {
  const { zip, ladderKm, centerDateISO, radiusMiles = DEFAULT_RADIUS_MILES } = params;
  const center = new Date(`${centerDateISO}T00:00:00`);
  const start = new Date(center); start.setDate(start.getDate() - 1);
  const end = new Date(center); end.setDate(end.getDate() + 1);

  const qs = new URLSearchParams({
    eventType: 'running_race',
    radius: String(radiusMiles),
    zipcodeRadius: zip,
    country: 'US',
    distance: (ladderKm - DISTANCE_BAND_KM).toFixed(1),
    max_distance: (ladderKm + DISTANCE_BAND_KM).toFixed(1),
    units: 'K',
    start_date: isoDate(start),
    end_date: isoDate(end),
  });
  return `https://runsignup.com/Races?${qs.toString()}`;
}
