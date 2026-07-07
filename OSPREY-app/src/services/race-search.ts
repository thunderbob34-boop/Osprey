export interface RaceSearchResult {
  raceId: string;
  name: string;
  city: string;
  state: string;
  date: string;
  distances: string[];
  url: string;
  description: string | null;
  logoUrl: string | null;
}

/**
 * RunSignUp returns dates as "M/D/YYYY". `new Date(string)` parses this
 * reliably in Node/V8 but returns Invalid Date under Hermes (React Native's
 * JS engine), so race dates must be parsed manually rather than passed
 * straight to the Date constructor.
 */
export function parseRaceDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    const fallback = new Date(dateStr);
    return isNaN(fallback.getTime()) ? null : fallback;
  }
  const [, month, day, year] = match;
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return isNaN(d.getTime()) ? null : d;
}

const cache = new Map<string, RaceSearchResult>();

export function getCachedRace(id: string): RaceSearchResult | null {
  return cache.get(id) ?? null;
}

function setCachedRace(result: RaceSearchResult): void {
  cache.set(result.raceId, result);
}

const DISTANCE_KEYWORDS = ['Marathon', 'Half', '15K', '10K', '5K'];

function parseDistances(events: { name?: string }[]): string[] {
  const found: string[] = [];
  for (const kw of DISTANCE_KEYWORDS) {
    if (events.some((e) => typeof e.name === 'string' && e.name.includes(kw))) {
      found.push(kw);
    }
  }
  return found;
}

interface RunSignUpRace {
  race_id: number | string;
  name: string;
  address?: {
    city?: string;
    state?: string;
  };
  next_date?: string;
  description?: string | null;
  url?: string;
  logo_url?: string | null;
  events?: { name?: string }[];
}

interface RunSignUpResponseItem {
  race: RunSignUpRace;
}

/** Strip HTML tags/entities from RunSignUp's rich-text description field. */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|div)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface RunSignUpEvent {
  name?: string;
  distance?: string | null;
}

const EXCLUDE_EVENT_KEYWORDS = ['relay', 'kids', 'vip', 'fun run', 'training program', 'volunteer'];

const CANONICAL_DISTANCE_ORDER = ['5K', '10K', '15K', 'Half Marathon', 'Marathon'];

function canonicalDistance(distanceStr: string | null | undefined, eventName: string): string | null {
  if (!distanceStr) return null;
  const nameLower = (eventName ?? '').toLowerCase();
  if (EXCLUDE_EVENT_KEYWORDS.some((kw) => nameLower.includes(kw))) return null;

  const d = distanceStr.trim();
  if (/^26\.2\s*Miles?$/i.test(d)) return 'Marathon';
  if (/^13\.1\s*Miles?$/i.test(d)) return 'Half Marathon';
  if (/^5K$/i.test(d)) return '5K';
  if (/^10K$/i.test(d)) return '10K';
  if (/^15K$/i.test(d)) return '15K';
  return null;
}

/**
 * The race list endpoint never returns an `events` array, so distances must be
 * fetched separately from the race detail endpoint when a user opens a race.
 */
export async function fetchRaceDistances(raceId: string): Promise<string[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://runsignup.com/Rest/race/${raceId}?format=json`, {
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const json = (await response.json()) as { race?: { events?: RunSignUpEvent[] } };
    const events = json.race?.events ?? [];
    const found = new Set<string>();
    for (const e of events) {
      const canon = canonicalDistance(e.distance, e.name ?? '');
      if (canon) found.add(canon);
    }
    return CANONICAL_DISTANCE_ORDER.filter((d) => found.has(d));
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function searchRaces(params: {
  query?: string;
  state?: string;
  startDateMin?: string;
  distanceType?: '5K' | '10K' | 'half_marathon' | 'marathon' | 'any';
}): Promise<RaceSearchResult[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const url = new URL('https://runsignup.com/Rest/races');
    url.searchParams.set('format', 'json');
    url.searchParams.set('results_per_page', '20');
    url.searchParams.set('page', '1');
    url.searchParams.set('event_type', 'running_race');
    url.searchParams.set('only_races_with_results_enabled', 'F');

    if (params.query) url.searchParams.set('name', params.query);
    if (params.state) url.searchParams.set('state', params.state);
    if (params.startDateMin) url.searchParams.set('start_date_min', params.startDateMin);

    const response = await fetch(url.toString(), { signal: controller.signal });

    if (!response.ok) {
      console.error('[race-search] RunSignUp API returned', response.status);
      return [];
    }

    const json = (await response.json()) as { races?: RunSignUpResponseItem[] };
    const items = json.races ?? [];

    const results: RaceSearchResult[] = items.map((item) => {
      const r = item.race;
      const result: RaceSearchResult = {
        raceId: String(r.race_id),
        name: r.name ?? '',
        city: r.address?.city ?? '',
        state: r.address?.state ?? '',
        date: r.next_date ?? '',
        distances: parseDistances(r.events ?? []),
        url: r.url ?? `https://runsignup.com/Race/${r.race_id}`,
        description: r.description ?? null,
        logoUrl: r.logo_url ?? null,
      };
      setCachedRace(result);
      return result;
    });

    return results;
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.error('[race-search] Request timed out');
    } else {
      console.error('[race-search] Fetch error:', err);
    }
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}
