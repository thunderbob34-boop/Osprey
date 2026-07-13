# Tune-Up Race Scheduling & Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Identify which weeks in a user's existing training plan are good tune-up-race candidates (5K/10K/Half, shorter than the goal distance), and help the user find and log a real local race for that weekend via a verified RunSignup deep link.

**Architecture:** Pure client-side derivation in `webapp/` — no changes to `ozzie-generate-plan` or any edge function. Two new pure-logic modules (ladder matching + goal-distance resolution, RunSignup URL builder), wired into the existing `/calendar` page's data layer and side pane, plus a small settings field and a new add-race form that were both missing prerequisites discovered during design.

**Tech Stack:** React 18 + TypeScript (strict) + TanStack Router/Query + Zod + Vitest, matching `webapp/`'s existing Phase 1 conventions exactly (see `docs/superpowers/specs/2026-07-12-osprey-webapp-phase1-design.md`).

## Global Constraints

- Zero changes to `OSPREY-app/`, `ozzie-generate-plan`, or `docs/coaching/` in this pass.
- No structured race-data API — RunSignup search only, via the verified public-page URL scheme (§4 of the design spec), not its keyed JSON API.
- `users.location_zip` is a US zip code (plain text column, no validation beyond basic format), not a geocoded location.
- Every pure function ships with unit tests before being wired into UI (TDD, matching `predictions.ts`/`grid-reducer.ts` precedent).
- Live-verify against the real Supabase project (`jslbutpmgoushkzcghtg`) and the real authenticated browser session per repo convention — do not claim a task done without running it.
- Full spec: `docs/superpowers/specs/2026-07-12-tuneup-races-design.md`.

---

### Task 1: Migration — `users.location_zip`

**Files:**
- Create: `supabase/migrations/20260712000034_users_location_zip.sql`

**Interfaces:**
- Produces: `users.location_zip` (`text`, nullable) — consumed by Task 6 (settings) and Task 5 (calendar deep-link URL).

- [ ] **Step 1: Write the migration file**

`supabase/migrations/20260712000034_users_location_zip.sql`:
```sql
-- 034_users_location_zip.sql
-- Feeds the tune-up race search deep link (see
-- docs/superpowers/specs/2026-07-12-tuneup-races-design.md). A US zip code,
-- not free-text city/state — RunSignup's search radius filter
-- (zipcodeRadius query param, verified live during planning) needs a zip
-- specifically. No table-level grant needed: users already has UPDATE for
-- authenticated (confirmed via role_table_grants during planning), and a
-- new column is automatically covered by the existing table-level grant.
ALTER TABLE users ADD COLUMN location_zip text;
```

- [ ] **Step 2: Apply the migration to the live project**

Use the Supabase MCP `apply_migration` tool with `project_id: "jslbutpmgoushkzcghtg"`, `name: "users_location_zip"`, and the `ALTER TABLE` statement above as `query`. (If MCP tools aren't available in your environment, run `supabase db push --linked` from the repo root instead — but prefer MCP to match how prior migrations in this session were applied.)

- [ ] **Step 3: Verify the column exists**

Run (via the Supabase MCP `execute_sql` tool, or `psql`):
```sql
select column_name, data_type from information_schema.columns where table_schema='public' and table_name='users' and column_name='location_zip';
```
Expected: one row, `data_type = 'text'`.

- [ ] **Step 4: Commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add supabase/migrations/20260712000034_users_location_zip.sql
git commit -m "feat(db): add users.location_zip for tune-up race search"
```

---

### Task 2: `tuneups.ts` — goal-distance resolution + ladder matching (TDD)

**Files:**
- Create: `webapp/src/lib/tuneups.ts`
- Test: `webapp/tests/tuneups.test.ts`

**Interfaces:**
- Produces:
```ts
export interface LadderRung { label: '5K' | '10K' | 'Half' | 'Marathon'; km: number; }
export const LADDER: LadderRung[];
export function parseGoalDistanceFromText(text: string): number | null;
export interface SessionInput { id: string; weekId: string; sessionDate: string; sessionType: string; plannedDistanceKm: number | null; }
export interface TuneUpWeek { sessionId: string; sessionDate: string; label: '5K' | '10K' | 'Half' | 'Marathon'; ladderKm: number; plannedDistanceKm: number; }
export function matchTuneUpWeeks(sessions: SessionInput[], goalDistanceKm: number | null): TuneUpWeek[];
```
- Consumed by: Task 5 (`features/calendar/queries.ts`).

- [ ] **Step 1: Write the failing tests**

`webapp/tests/tuneups.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseGoalDistanceFromText, matchTuneUpWeeks, LADDER, type SessionInput } from '../src/lib/tuneups';

describe('parseGoalDistanceFromText', () => {
  it('matches half marathon before unqualified marathon', () => {
    expect(parseGoalDistanceFromText('Novant Health Charlotte Marathon (Half Marathon)')).toBeCloseTo(21.0975, 4);
  });
  it('matches hyphenated half-marathon', () => {
    expect(parseGoalDistanceFromText('City Half-Marathon')).toBeCloseTo(21.0975, 4);
  });
  it('matches 13.1 as half marathon', () => {
    expect(parseGoalDistanceFromText('Riverside 13.1')).toBeCloseTo(21.0975, 4);
  });
  it('matches 10K', () => {
    expect(parseGoalDistanceFromText('Turkey Trot 10K')).toBe(10.0);
  });
  it('matches 5K', () => {
    expect(parseGoalDistanceFromText('Fun Run 5K')).toBe(5.0);
  });
  it('matches unqualified marathon', () => {
    expect(parseGoalDistanceFromText('Boston Marathon')).toBeCloseTo(42.195, 4);
  });
  it('returns null with no recognizable distance', () => {
    expect(parseGoalDistanceFromText('Get Fit Challenge')).toBeNull();
  });
});

describe('matchTuneUpWeeks', () => {
  const base: Omit<SessionInput, 'id' | 'sessionDate' | 'plannedDistanceKm'> = { weekId: 'w', sessionType: 'run' };

  it('returns empty when goalDistanceKm is null', () => {
    const sessions: SessionInput[] = [{ id: '1', weekId: 'w1', sessionDate: '2026-08-01', sessionType: 'run', plannedDistanceKm: 10 }];
    expect(matchTuneUpWeeks(sessions, null)).toEqual([]);
  });

  it('returns empty for a 5K goal (nothing shorter on the ladder)', () => {
    const sessions: SessionInput[] = [{ id: '1', weekId: 'w1', sessionDate: '2026-08-01', sessionType: 'run', plannedDistanceKm: 5 }];
    expect(matchTuneUpWeeks(sessions, 5.0)).toEqual([]);
  });

  it('flags a week within +/-20% of a ladder distance', () => {
    // 10K goal offers only 5K (10.0 excluded, not shorter than goal). 5K * 1.19 = 5.95 -> within 20%.
    const sessions: SessionInput[] = [{ id: '1', weekId: 'w1', sessionDate: '2026-08-01', sessionType: 'run', plannedDistanceKm: 5.95 }];
    const result = matchTuneUpWeeks(sessions, 10.0);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ sessionId: '1', label: '5K', ladderKm: 5.0 });
  });

  it('does not flag a week outside the +/-20% tolerance', () => {
    const sessions: SessionInput[] = [{ id: '1', weekId: 'w1', sessionDate: '2026-08-01', sessionType: 'run', plannedDistanceKm: 6.5 }]; // 30% over 5K
    expect(matchTuneUpWeeks(sessions, 10.0)).toEqual([]);
  });

  it('picks the longest run per week, ignoring shorter same-week runs', () => {
    const sessions: SessionInput[] = [
      { id: '1', weekId: 'w1', sessionDate: '2026-08-03', sessionType: 'run', plannedDistanceKm: 4 },
      { id: '2', weekId: 'w1', sessionDate: '2026-08-01', sessionType: 'run', plannedDistanceKm: 10.5 }, // this is the long run
    ];
    // Half goal (21.0975) offers 5K and 10K; 10.5 is closest to 10K.
    const result = matchTuneUpWeeks(sessions, 21.0975);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ sessionId: '2', label: '10K' });
  });

  it('ignores non-run session types', () => {
    const sessions: SessionInput[] = [{ id: '1', weekId: 'w1', sessionDate: '2026-08-01', sessionType: 'lift', plannedDistanceKm: 5 }];
    expect(matchTuneUpWeeks(sessions, 10.0)).toEqual([]);
  });

  it('flags multiple opportunities across different weeks', () => {
    const sessions: SessionInput[] = [
      { id: '1', weekId: 'w1', sessionDate: '2026-08-01', sessionType: 'run', plannedDistanceKm: 5.0 },  // -> 5K
      { id: '2', weekId: 'w5', sessionDate: '2026-09-01', sessionType: 'run', plannedDistanceKm: 10.2 }, // -> 10K
    ];
    // Half goal offers both 5K and 10K.
    const result = matchTuneUpWeeks(sessions, 21.0975);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.label).sort()).toEqual(['10K', '5K']);
  });

  it('sorts results by session date', () => {
    const sessions: SessionInput[] = [
      { id: '2', weekId: 'w5', sessionDate: '2026-09-01', sessionType: 'run', plannedDistanceKm: 10.2 },
      { id: '1', weekId: 'w1', sessionDate: '2026-08-01', sessionType: 'run', plannedDistanceKm: 5.0 },
    ];
    const result = matchTuneUpWeeks(sessions, 21.0975);
    expect(result.map((r) => r.sessionId)).toEqual(['1', '2']);
  });

  it('LADDER is ordered 5K, 10K, Half, Marathon', () => {
    expect(LADDER.map((r) => r.label)).toEqual(['5K', '10K', 'Half', 'Marathon']);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
cd "/Users/gusjohnson/App Development/Osprey/webapp" && npm test -- tuneups
```
Expected: FAIL — `../src/lib/tuneups` module not found.

- [ ] **Step 3: Implement**

`webapp/src/lib/tuneups.ts`:
```ts
export interface LadderRung { label: '5K' | '10K' | 'Half' | 'Marathon'; km: number; }

export const LADDER: LadderRung[] = [
  { label: '5K', km: 5.0 },
  { label: '10K', km: 10.0 },
  { label: 'Half', km: 21.0975 },
  { label: 'Marathon', km: 42.195 },
];

/**
 * Extracts a goal distance from free text like the onboarding
 * user_goals.target_race field. Order matters: "half marathon" must be
 * checked before the unqualified "marathon" pattern, since the longer
 * word contains the shorter one as a substring.
 */
export function parseGoalDistanceFromText(text: string): number | null {
  const t = text.toLowerCase();
  if (/half[\s-]?marathon|\b13\.1\b/.test(t)) return 21.0975;
  if (/\b10\s?k\b/.test(t)) return 10.0;
  if (/\b5\s?k\b/.test(t)) return 5.0;
  if (/marathon/.test(t)) return 42.195;
  return null;
}

export interface SessionInput {
  id: string;
  weekId: string;
  sessionDate: string;
  sessionType: string;
  plannedDistanceKm: number | null;
}

export interface TuneUpWeek {
  sessionId: string;
  sessionDate: string;
  label: LadderRung['label'];
  ladderKm: number;
  plannedDistanceKm: number;
}

const TOLERANCE = 0.20;

/**
 * For every week's long run (the largest planned_distance_km run session
 * in that week), flags it as a tune-up opportunity if its distance is
 * within +/-20% of a ladder rung shorter than the goal distance.
 */
export function matchTuneUpWeeks(sessions: SessionInput[], goalDistanceKm: number | null): TuneUpWeek[] {
  if (goalDistanceKm == null) return [];
  const offered = LADDER.filter((r) => r.km < goalDistanceKm);
  if (offered.length === 0) return [];

  const longestByWeek = new Map<string, SessionInput>();
  for (const s of sessions) {
    if (s.sessionType !== 'run' || !s.plannedDistanceKm) continue;
    const cur = longestByWeek.get(s.weekId);
    if (!cur || s.plannedDistanceKm > (cur.plannedDistanceKm ?? 0)) longestByWeek.set(s.weekId, s);
  }

  const results: TuneUpWeek[] = [];
  for (const run of longestByWeek.values()) {
    const dist = run.plannedDistanceKm!;
    let best: LadderRung | null = null;
    let bestDiff = Infinity;
    for (const rung of offered) {
      const diff = Math.abs(dist - rung.km) / rung.km;
      if (diff < bestDiff) { bestDiff = diff; best = rung; }
    }
    if (best && bestDiff <= TOLERANCE) {
      results.push({ sessionId: run.id, sessionDate: run.sessionDate, label: best.label, ladderKm: best.km, plannedDistanceKm: dist });
    }
  }
  return results.sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
}
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
cd "/Users/gusjohnson/App Development/Osprey/webapp" && npm test -- tuneups
```
Expected: PASS — all 15 tests green.

- [ ] **Step 5: Typecheck**

```bash
cd "/Users/gusjohnson/App Development/Osprey/webapp" && npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add webapp/src/lib/tuneups.ts webapp/tests/tuneups.test.ts
git commit -m "feat(webapp): tune-up ladder matching + goal-distance parser"
```

---

### Task 3: `racesearch.ts` — RunSignup URL builder (TDD)

**Files:**
- Create: `webapp/src/lib/racesearch.ts`
- Test: `webapp/tests/racesearch.test.ts`

**Interfaces:**
- Produces:
```ts
export interface RunSignupSearchParams { zip: string; ladderKm: number; centerDateISO: string; radiusMiles?: number; }
export function buildRunSignupSearchUrl(params: RunSignupSearchParams): string;
```
- Consumed by: Task 5 (`calendar.tsx`).
- **Verified query scheme** (live-tested during planning against `runsignup.com/Races`, not assumed): `eventType`, `radius`, `zipcodeRadius`, `country`, `distance`, `max_distance`, `units`, `start_date`, `end_date`.

- [ ] **Step 1: Write the failing tests**

`webapp/tests/racesearch.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildRunSignupSearchUrl } from '../src/lib/racesearch';

describe('buildRunSignupSearchUrl', () => {
  it('builds a URL with the confirmed RunSignup query params', () => {
    const url = buildRunSignupSearchUrl({ zip: '28202', ladderKm: 10.0, centerDateISO: '2026-08-08' });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://runsignup.com/Races');
    expect(parsed.searchParams.get('zipcodeRadius')).toBe('28202');
    expect(parsed.searchParams.get('eventType')).toBe('running_race');
    expect(parsed.searchParams.get('country')).toBe('US');
    expect(parsed.searchParams.get('units')).toBe('K');
  });

  it('defaults the search radius to 25 miles', () => {
    const url = buildRunSignupSearchUrl({ zip: '28202', ladderKm: 5.0, centerDateISO: '2026-08-08' });
    expect(new URL(url).searchParams.get('radius')).toBe('25');
  });

  it('allows overriding the search radius', () => {
    const url = buildRunSignupSearchUrl({ zip: '28202', ladderKm: 5.0, centerDateISO: '2026-08-08', radiusMiles: 50 });
    expect(new URL(url).searchParams.get('radius')).toBe('50');
  });

  it('builds a +/-1km distance band around the ladder distance', () => {
    const url = buildRunSignupSearchUrl({ zip: '28202', ladderKm: 5.0, centerDateISO: '2026-08-08' });
    const p = new URL(url).searchParams;
    expect(p.get('distance')).toBe('4.0');
    expect(p.get('max_distance')).toBe('6.0');
  });

  it('rounds a fractional ladder distance (Half) to one decimal for the band', () => {
    const url = buildRunSignupSearchUrl({ zip: '28202', ladderKm: 21.0975, centerDateISO: '2026-08-08' });
    const p = new URL(url).searchParams;
    expect(p.get('distance')).toBe('20.1');
    expect(p.get('max_distance')).toBe('22.1');
  });

  it('centers the date window one day before and after, Saturday example', () => {
    // 2026-08-08 is a Saturday.
    const url = buildRunSignupSearchUrl({ zip: '28202', ladderKm: 10.0, centerDateISO: '2026-08-08' });
    const p = new URL(url).searchParams;
    expect(p.get('start_date')).toBe('2026-08-07');
    expect(p.get('end_date')).toBe('2026-08-09');
  });

  it('handles a month boundary correctly', () => {
    const url = buildRunSignupSearchUrl({ zip: '28202', ladderKm: 10.0, centerDateISO: '2026-08-01' });
    const p = new URL(url).searchParams;
    expect(p.get('start_date')).toBe('2026-07-31');
    expect(p.get('end_date')).toBe('2026-08-02');
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
cd "/Users/gusjohnson/App Development/Osprey/webapp" && npm test -- racesearch
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`webapp/src/lib/racesearch.ts`:
```ts
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
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
cd "/Users/gusjohnson/App Development/Osprey/webapp" && npm test -- racesearch
```
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Live sanity check (optional but recommended)**

In a browser, open the URL produced by `buildRunSignupSearchUrl({ zip: '28202', ladderKm: 10.0, centerDateISO: '2026-08-08' })` and confirm it lands on filtered results (not a blank/error page). This mirrors the exact verification done during planning.

- [ ] **Step 6: Typecheck + commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey/webapp" && npm run typecheck
cd "/Users/gusjohnson/App Development/Osprey"
git add webapp/src/lib/racesearch.ts webapp/tests/racesearch.test.ts
git commit -m "feat(webapp): RunSignup deep-link URL builder"
```

---

### Task 4: `features/races/queries.ts` + `AddRaceForm` component

**Files:**
- Create: `webapp/src/features/races/queries.ts`
- Create: `webapp/src/components/AddRaceForm.tsx`

**Interfaces:**
- Produces: `useCreateRaceEvent(userId)` mutation; `<AddRaceForm userId defaultDate? onDone />` component.
- Consumed by: Task 5 (`calendar.tsx`).

- [ ] **Step 1: Data hook**

`webapp/src/features/races/queries.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

export interface NewRaceEventInput {
  name: string;
  eventDate: string; // YYYY-MM-DD
  distanceKm: number | null;
  raceUrl: string | null;
  notes: string | null;
}

export function useCreateRaceEvent(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewRaceEventInput) => {
      const { error } = await supabase.from('race_events').insert({
        user_id: userId,
        name: input.name,
        event_date: input.eventDate,
        distance_km: input.distanceKm,
        race_url: input.raceUrl,
        notes: input.notes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['race-events'] });
      void qc.invalidateQueries({ queryKey: ['next-race-event'] });
    },
  });
}
```

- [ ] **Step 2: Form component**

`webapp/src/components/AddRaceForm.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { useCreateRaceEvent } from '../features/races/queries';

interface Props {
  userId: string;
  defaultDate?: string;
  onDone: () => void;
}

export function AddRaceForm({ userId, defaultDate, onDone }: Props) {
  const create = useCreateRaceEvent(userId);
  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState(defaultDate ?? '');
  const [distanceKm, setDistanceKm] = useState('');
  const [raceUrl, setRaceUrl] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      name,
      eventDate,
      distanceKm: distanceKm.trim() ? Number(distanceKm) : null,
      raceUrl: raceUrl.trim() || null,
      notes: null,
    });
    onDone();
  }

  return (
    <form onSubmit={(e) => void submit(e)}>
      <div className="log-form" style={{ marginBottom: 14 }}>
        <div className="field span-full">
          <label htmlFor="race-name">Race name</label>
          <input id="race-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="race-date">Date</label>
          <input id="race-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="race-distance">Distance (km)</label>
          <input id="race-distance" type="number" step="0.1" min="0" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} />
        </div>
        <div className="field span-full">
          <label htmlFor="race-url">Race URL (optional)</label>
          <input id="race-url" type="url" value={raceUrl} onChange={(e) => setRaceUrl(e.target.value)} placeholder="https://…" />
        </div>
      </div>
      {create.isError && <p className="err-line" role="alert" style={{ marginBottom: 12 }}>{(create.error as Error).message}</p>}
      <div className="log-form-actions">
        <button className="btn" type="submit" disabled={create.isPending}>{create.isPending ? 'Saving…' : 'Add race'}</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
cd "/Users/gusjohnson/App Development/Osprey/webapp" && npm run typecheck
```
Expected: 0 errors. (This task has no live UI entry point yet — Task 5 wires it in. A type-only check is the right bar here.)

- [ ] **Step 4: Commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add webapp/src/features/races/queries.ts webapp/src/components/AddRaceForm.tsx
git commit -m "feat(webapp): add-race mutation and form component"
```

---

### Task 5: Settings — zip code field

**Files:**
- Modify: `webapp/src/features/settings/queries.ts`
- Modify: `webapp/src/routes/_authed/settings.tsx`

**Interfaces:**
- Produces: `useLocationZip(userId)`, `useUpdateLocationZip(userId)` — same shape as the existing `useUnits`/`useUpdateUnits` pair in the same file.
- Consumed by: Task 6 (`calendar.tsx`, to check whether a zip is set before offering the deep link).

- [ ] **Step 1: Add the query/mutation pair**

Append to `webapp/src/features/settings/queries.ts` (current content stays unchanged above this):
```ts
export function useLocationZip(userId: string) {
  return useQuery({
    queryKey: ['location-zip', userId],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.from('users').select('location_zip').eq('id', userId).maybeSingle();
      if (error) throw error;
      return data?.location_zip ?? null;
    },
  });
}

export function useUpdateLocationZip(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (locationZip: string) => {
      const { error } = await supabase.from('users').update({ location_zip: locationZip }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['location-zip', userId] }),
  });
}
```

- [ ] **Step 2: Add the Settings UI card**

Replace the full contents of `webapp/src/routes/_authed/settings.tsx` with:
```tsx
import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useUnits, useUpdateUnits, useLocationZip, useUpdateLocationZip } from '../../features/settings/queries';
import { useUserProfile } from '../../lib/useAuthUser';
import { PageHeader } from '../../components/PageHeader';
import { ErrorPanel } from '../../components/ErrorPanel';

const TIER_LABEL: Record<string, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

function LocationCard({ userId }: { userId: string }) {
  const zip = useLocationZip(userId);
  const update = useUpdateLocationZip(userId);
  const [draft, setDraft] = useState('');

  useEffect(() => { if (zip.data) setDraft(zip.data); }, [zip.data]);

  return (
    <div className="card">
      <div className="settings-row">
        <span className="k">Zip code</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. 28202"
            style={{ width: 120 }}
            inputMode="numeric"
          />
          <button
            className="btn"
            type="button"
            disabled={update.isPending || draft.trim() === '' || draft === (zip.data ?? '')}
            onClick={() => update.mutate(draft.trim())}
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      <p style={{ color: 'var(--mut)', fontSize: 12, marginTop: 10 }}>Used to find real tune-up races near you on the Calendar.</p>
      {update.isError && <p className="err-line" role="alert" style={{ marginTop: 10 }}>{(update.error as Error).message}</p>}
    </div>
  );
}

function SettingsPage() {
  const { userId } = Route.useRouteContext();
  const { data: profile } = useUserProfile();
  const units = useUnits(userId);
  const update = useUpdateUnits(userId);

  return (
    <>
      <PageHeader eyebrow="Your account" title="Settings" />

      {profile && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="settings-row">
            <span className="k">Name</span>
            <span className="v">{profile.display_name}</span>
          </div>
          <div className="settings-row">
            <span className="k">Email</span>
            <span className="v">{profile.email}</span>
          </div>
          <div className="settings-row">
            <span className="k">Experience</span>
            <span className="v">{TIER_LABEL[profile.experience_tier]}</span>
          </div>
        </div>
      )}

      {units.isPending && <p className="loading-line">Loading…</p>}
      {units.isError && <ErrorPanel error={units.error as Error} onRetry={() => void units.refetch()} />}

      {units.isSuccess && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="settings-row">
            <span className="k">Units</span>
            <div className="toggle-group">
              {(['imperial', 'metric'] as const).map((u) => (
                <button
                  key={u}
                  className={units.data === u ? 'active' : ''}
                  onClick={() => update.mutate(u)}
                  disabled={update.isPending}
                >
                  {u === 'imperial' ? 'Imperial' : 'Metric'}
                </button>
              ))}
            </div>
          </div>
          {update.isError && <p className="err-line" role="alert" style={{ marginTop: 12 }}>{(update.error as Error).message}</p>}
        </div>
      )}

      <LocationCard userId={userId} />
    </>
  );
}

export const Route = createFileRoute('/_authed/settings')({ component: SettingsPage });
```

- [ ] **Step 3: Typecheck**

```bash
cd "/Users/gusjohnson/App Development/Osprey/webapp" && npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 4: Live verify**

`npm run dev`; in the browser, open `/settings`, confirm the new "Zip code" card renders below Units, type a zip (e.g. `28202`), click Save, reload the page — the value persists. Leave it set to a real value for Task 6's live verification (or clear it after — your choice, but note which you did in the commit).

- [ ] **Step 5: Commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add webapp/src/features/settings/queries.ts webapp/src/routes/_authed/settings.tsx
git commit -m "feat(webapp): settings zip code field for tune-up race search"
```

---

### Task 6: Calendar — goal distance, tune-up weeks, grid markers, side-pane card

**Files:**
- Modify: `webapp/src/features/calendar/queries.ts`
- Modify: `webapp/src/routes/_authed/calendar.tsx`
- Modify: `webapp/src/styles/app.css`

**Interfaces:**
- Consumes: `matchTuneUpWeeks`, `LADDER` (Task 2); `buildRunSignupSearchUrl` (Task 3); `AddRaceForm`, `useCreateRaceEvent` (Task 4); `useLocationZip` (Task 5).
- Produces: `useGoalDistanceKm(userId)`, `useTuneUpWeeks(sessions, goalDistanceKm)` in `features/calendar/queries.ts`.

- [ ] **Step 1: Add the two new query hooks**

Append to `webapp/src/features/calendar/queries.ts` (add these imports to the top of the file alongside the existing ones, and add the two functions at the end):
```ts
// add to the top import block:
import { useMemo } from 'react';
import { matchTuneUpWeeks, parseGoalDistanceFromText, type TuneUpWeek } from '../../lib/tuneups';
import type { TrainingSession } from '../../lib/schemas';

// append at the end of the file:

/**
 * Resolves the active plan's goal distance: the linked race_events row if
 * training_plans.target_event_id is set, otherwise parsed from
 * user_goals.target_race (the onboarding input that generated the plan —
 * reliably populated even when target_event_id isn't). Returns null if
 * neither source yields a distance.
 */
export function useGoalDistanceKm(userId: string) {
  return useQuery({
    queryKey: ['goal-distance', userId],
    queryFn: async (): Promise<number | null> => {
      const { data: plan, error: planErr } = await supabase.from('training_plans')
        .select('target_event_id')
        .eq('user_id', userId).eq('status', 'active')
        .order('start_date', { ascending: false }).limit(1).maybeSingle();
      if (planErr) throw planErr;
      if (!plan) return null;

      if (plan.target_event_id) {
        const { data: race, error: raceErr } = await supabase.from('race_events')
          .select('distance_km').eq('id', plan.target_event_id).maybeSingle();
        if (raceErr) throw raceErr;
        if (race?.distance_km) return Number(race.distance_km);
      }

      const { data: goal, error: goalErr } = await supabase.from('user_goals')
        .select('target_race').eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (goalErr) throw goalErr;
      if (goal?.target_race) return parseGoalDistanceFromText(goal.target_race);
      return null;
    },
  });
}

/** Derived (no network call) — which of the given sessions are tune-up opportunities. */
export function useTuneUpWeeks(sessions: TrainingSession[] | undefined, goalDistanceKm: number | null | undefined): TuneUpWeek[] {
  return useMemo(() => {
    if (!sessions || goalDistanceKm == null) return [];
    return matchTuneUpWeeks(
      sessions.map((s) => ({
        id: s.id, weekId: s.week_id, sessionDate: s.session_date,
        sessionType: s.session_type, plannedDistanceKm: s.planned_distance_km,
      })),
      goalDistanceKm,
    );
  }, [sessions, goalDistanceKm]);
}
```

- [ ] **Step 2: Wire it into the Calendar page**

Replace the full contents of `webapp/src/routes/_authed/calendar.tsx` with:
```tsx
import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useMonthSessions, useCompletions, useMonthRaceEvents, useNextRaceEvent, useBestRun,
  useGoalDistanceKm, useTuneUpWeeks,
} from '../../features/calendar/queries';
import { useLocationZip } from '../../features/settings/queries';
import type { TrainingSession, RaceEvent } from '../../lib/schemas';
import { buildRacePredictor, formatRaceTimeSec } from '../../lib/predictions';
import { buildRunSignupSearchUrl } from '../../lib/racesearch';
import { ErrorPanel } from '../../components/ErrorPanel';
import { PageHeader } from '../../components/PageHeader';
import { AddRaceForm } from '../../components/AddRaceForm';
import { SESSION_TYPE_LABEL, INTENSITY_LABEL } from '../../lib/format';

const INTENSITY_COLOR: Record<string, string> = {
  easy: 'var(--mut)', moderate: 'var(--text-soft)', threshold: 'var(--amber)',
  interval: 'var(--amber-bright)', race: '#ff5f57', rest: 'var(--line)',
};

function monthRange(anchor: Date): { fromISO: string; toISO: string; cells: Date[] } {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const lead = (first.getDay() + 6) % 7; // Monday-first grid
  const start = new Date(first); start.setDate(first.getDate() - lead);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); cells.push(d); }
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { fromISO: iso(first), toISO: iso(last), cells };
}

function daysUntil(dateISO: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateISO}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

type Selection = { kind: 'session'; data: TrainingSession } | { kind: 'race'; data: RaceEvent } | null;

function CalendarPage() {
  const { userId } = Route.useRouteContext();
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState<Selection>(null);
  const [addingRace, setAddingRace] = useState<string | null>(null); // holds a default date, or null when closed
  const { fromISO, toISO, cells } = useMemo(() => monthRange(anchor), [anchor]);

  const sessions = useMonthSessions(userId, fromISO, toISO);
  const completions = useCompletions(userId, fromISO, toISO);
  const raceEvents = useMonthRaceEvents(userId, fromISO, toISO);
  const nextRace = useNextRaceEvent(userId);
  const bestRun = useBestRun(userId);
  const goalDistanceKm = useGoalDistanceKm(userId);
  const tuneUpWeeks = useTuneUpWeeks(sessions.data, goalDistanceKm.data);
  const locationZip = useLocationZip(userId);

  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const sessionsByDate = useMemo(() => {
    const m = new Map<string, TrainingSession[]>();
    for (const s of sessions.data ?? []) { const arr = m.get(s.session_date) ?? []; arr.push(s); m.set(s.session_date, arr); }
    return m;
  }, [sessions.data]);
  const racesByDate = useMemo(() => {
    const m = new Map<string, RaceEvent[]>();
    for (const r of raceEvents.data ?? []) { const arr = m.get(r.event_date) ?? []; arr.push(r); m.set(r.event_date, arr); }
    return m;
  }, [raceEvents.data]);
  const tuneUpBySessionId = useMemo(() => new Map(tuneUpWeeks.map((t) => [t.sessionId, t])), [tuneUpWeeks]);

  const predictor = bestRun.data ? buildRacePredictor(bestRun.data.miles, bestRun.data.timeS) : null;
  const selectedTuneUp = selected?.kind === 'session' ? tuneUpBySessionId.get(selected.data.id) : undefined;

  if (sessions.isError) return <ErrorPanel error={sessions.error as Error} onRetry={() => void sessions.refetch()} />;

  return (
    <>
      <PageHeader eyebrow="Season" title="Calendar" />

      <div className="cal-layout">
        <section className="cal-main">
          <div className="cal-nav">
            <span className="month-title">{anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            <button className="btn ghost" type="button" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}>‹</button>
            <button className="btn ghost" type="button" onClick={() => setAnchor(new Date())}>Today</button>
            <button className="btn ghost" type="button" onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}>›</button>
          </div>

          <div className="cal-grid">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="cal-dow">{d}</div>)}
            {cells.map((d) => {
              const dISO = iso(d);
              const inMonth = d.getMonth() === anchor.getMonth();
              const daySessions = sessionsByDate.get(dISO) ?? [];
              const dayRaces = racesByDate.get(dISO) ?? [];
              return (
                <div key={dISO} className={inMonth ? 'cal-cell' : 'cal-cell out'}>
                  <span className="daynum">{d.getDate()}</span>
                  {dayRaces.map((r) => (
                    <button
                      key={r.id}
                      className={selected?.kind === 'race' && selected.data.id === r.id ? 'cal-chip race selected' : 'cal-chip race'}
                      type="button"
                      onClick={() => setSelected({ kind: 'race', data: r })}
                    >
                      ★ {r.name}
                    </button>
                  ))}
                  {daySessions.map((s) => {
                    const tuneUp = tuneUpBySessionId.get(s.id);
                    const isSelected = selected?.kind === 'session' && selected.data.id === s.id;
                    const cls = ['cal-chip', tuneUp && 'tuneup', isSelected && 'selected'].filter(Boolean).join(' ');
                    return (
                      <button
                        key={s.id}
                        className={cls}
                        type="button"
                        style={isSelected ? undefined : { color: INTENSITY_COLOR[s.intensity] ?? 'var(--text)' }}
                        onClick={() => setSelected({ kind: 'session', data: s })}
                      >
                        {tuneUp ? '◆ ' : ''}{completions.data?.has(s.id) ? '✓ ' : ''}{SESSION_TYPE_LABEL[s.session_type]}
                        {s.planned_minutes ? ` · ${s.planned_minutes}m` : ''}
                        {s.planned_distance_km ? ` · ${s.planned_distance_km}k` : ''}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </section>

        <aside className="cal-aside">
          {nextRace.data && (
            <div className="race-countdown">
              <div className="days">T–{Math.max(0, daysUntil(nextRace.data.event_date))}</div>
              <div className="lab">Days to race</div>
              <div className="name">{nextRace.data.name}</div>
              <div className="meta">
                {new Date(`${nextRace.data.event_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {nextRace.data.distance_km ? ` · ${nextRace.data.distance_km}km` : ''}
                {nextRace.data.goal_time_s ? ` · Goal ${formatRaceTimeSec(nextRace.data.goal_time_s)}` : ''}
              </div>
            </div>
          )}

          {predictor ? (
            <div className="detail-card">
              <div className="tag">Race predictor</div>
              <p>From your best run in the last 12 weeks ({predictor.baseMiles.toFixed(1)} mi at {formatRaceTimeSec(predictor.basePaceSecPerMile)}/mi pace).</p>
              <table className="predictor-table">
                <thead><tr><th>Distance</th><th className="num">Predicted</th></tr></thead>
                <tbody>
                  {predictor.predictions.map((p) => (
                    <tr key={p.label}><td>{p.label}</td><td className="num">{formatRaceTimeSec(p.predictedTimeS)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : bestRun.isSuccess && (
            <div className="detail-card">
              <div className="tag">Race predictor</div>
              <p>Log a completed run with distance and time — including a tune-up race — and your predicted times for every distance show up here.</p>
            </div>
          )}

          {selected?.kind === 'session' && (
            <div className="detail-card">
              <div className="tag">{selected.data.session_date} · {INTENSITY_LABEL[selected.data.intensity]}</div>
              <h3>{SESSION_TYPE_LABEL[selected.data.session_type]}{completions.data?.has(selected.data.id) ? ' · Done ✓' : ''}</h3>
              {selected.data.description && <p>{selected.data.description}</p>}
              {selected.data.ozzie_notes && (
                <div className="note-block">
                  <div className="tag">Ozzie</div>
                  <p>{selected.data.ozzie_notes}</p>
                </div>
              )}

              {selectedTuneUp && (
                <div className="note-block tuneup-block">
                  <div className="tag">Tune-up opportunity</div>
                  <p>This week's long run (≈{selectedTuneUp.plannedDistanceKm.toFixed(1)}km) is close to a {selectedTuneUp.label}.</p>
                  {locationZip.data ? (
                    <a
                      className="btn small"
                      href={buildRunSignupSearchUrl({ zip: locationZip.data, ladderKm: selectedTuneUp.ladderKm, centerDateISO: selectedTuneUp.sessionDate })}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Find a race near you
                    </a>
                  ) : (
                    <p className="err-line">Set a zip code in Settings to search for races near you.</p>
                  )}
                  {' '}
                  <button className="btn ghost small" type="button" onClick={() => setAddingRace(selectedTuneUp.sessionDate)}>
                    Add the race you found
                  </button>
                </div>
              )}
            </div>
          )}

          {selected?.kind === 'race' && (
            <div className="detail-card">
              <div className="tag">{selected.data.event_date}</div>
              <h3>{selected.data.name}</h3>
              <p>
                {selected.data.distance_km ? `${selected.data.distance_km}km` : 'Distance TBD'}
                {selected.data.goal_time_s ? ` · Goal ${formatRaceTimeSec(selected.data.goal_time_s)}` : ''}
                {selected.data.result_time_s ? ` · Result ${formatRaceTimeSec(selected.data.result_time_s)}` : ''}
              </p>
              {selected.data.notes && <p style={{ marginTop: 10 }}>{selected.data.notes}</p>}
            </div>
          )}

          {!selected && (
            <p style={{ color: 'var(--mut)', fontSize: 13.5 }}>Select a session or race on the calendar to see details.</p>
          )}

          <div className="detail-card">
            {addingRace !== null ? (
              <>
                <div className="tag">Add a race</div>
                <AddRaceForm userId={userId} defaultDate={addingRace || undefined} onDone={() => setAddingRace(null)} />
              </>
            ) : (
              <button className="btn ghost small" type="button" onClick={() => setAddingRace('')}>+ Add a race</button>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

export const Route = createFileRoute('/_authed/calendar')({ component: CalendarPage });
```

- [ ] **Step 3: CSS for the tune-up marker and block**

Append to `webapp/src/styles/app.css` (after the existing `.cal-*` rules):
```css
.cal-chip.tuneup { border-color: var(--amber); border-style: dashed; }
.tuneup-block { border-top: 1px solid #232329; margin-top: 12px; padding-top: 12px; }
.tuneup-block p { margin-bottom: 10px; }
.btn.small { font-size: 12px; padding: 8px 16px; }
```

- [ ] **Step 4: Typecheck**

```bash
cd "/Users/gusjohnson/App Development/Osprey/webapp" && npm run typecheck
```
Expected: 0 errors.

- [ ] **Step 5: Live verify**

`npm run dev`; in the browser:
1. Open `/calendar`. Confirm no console errors and the page renders as before (no visible regression for weeks with no tune-up match).
2. Navigate to a month containing one of the plan's long-run weeks. If `goalDistanceKm` resolved (check by confirming the user has either a linked `race_events` row via `target_event_id`, or a parseable `user_goals.target_race` — the real account currently relies on the fallback parser since `target_event_id` is null, per the design spec §10), a long-run session whose distance is within ±20% of 5K or 10K should show a dashed amber border and a ◆ marker.
3. Click that session. Confirm the side pane shows the new "Tune-up opportunity" block with the correct distance label.
4. If a zip code is set (Task 5), click "Find a race near you" — confirm it opens a new tab to a filtered RunSignup results page (real races, not an empty/broken page).
5. Click "Add the race you found" (or the standalone "+ Add a race" at the bottom of the aside), fill in a real or test race, submit, and confirm it appears as a ★ pin on the correct date after the form closes.
6. If no plan week naturales matches (real data may not hit the ±20% band), temporarily insert a test `training_sessions` row via the Supabase MCP `execute_sql` tool with a `planned_distance_km` close to a ladder rung, verify the marker/card appear, then delete the test row — do not leave synthetic data in the real account.

- [ ] **Step 6: Run the full test suite**

```bash
cd "/Users/gusjohnson/App Development/Osprey/webapp" && npm test
```
Expected: all suites green (units, predictions, grid-reducer, schemas, tuneups, racesearch).

- [ ] **Step 7: Commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add webapp/src/features/calendar/queries.ts webapp/src/routes/_authed/calendar.tsx webapp/src/styles/app.css
git commit -m "feat(webapp): tune-up race markers, side-pane card, and add-race entry point on Calendar"
```

---

### Task 7: Final verification pass + docs

**Files:**
- Modify: `webapp/README.md` (append a note)
- Modify: anything a check below flags

**Interfaces:** none (verification task).

- [ ] **Step 1: Full local gates**

```bash
cd "/Users/gusjohnson/App Development/Osprey/webapp"
npm run typecheck   # 0 errors
npm test             # all suites green, including tuneups.test.ts and racesearch.test.ts
npm run build        # succeeds
```

- [ ] **Step 2: Browser walkthrough (dev server + real account)**

1. `/settings` — zip code card present, saves and persists across reload.
2. `/calendar` — tune-up markers appear on eligible weeks; side-pane card shows the correct ladder label; "Find a race near you" opens real, filtered RunSignup results; "Add the race you found" / "+ Add a race" both open the form and a successful submit shows up as a new race pin.
3. Console: no errors on `/calendar` or `/settings`.
4. Confirm `useGoalDistanceKm` actually exercises the fallback path on the real account (target_event_id is null per §10 of the design spec) — check the network/query result resolves a non-null distance via `user_goals.target_race`, not silently returning null.

- [ ] **Step 3: Docs**

Append to `webapp/README.md`, under "## Routes" → `/calendar` bullet, a short addition (or a new bullet directly after it):
```markdown
  - Tune-up-eligible weeks (5K/10K/Half, shorter than the plan's goal distance, matched by planned long-run distance ±20%) show a dashed marker and a side-pane card with a verified RunSignup search deep link, plus a form to log the race you pick.
```

- [ ] **Step 4: Fix anything found, then commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add -A webapp/README.md
git commit -m "chore(webapp): tune-up races verification pass and docs"
```

---

## Self-Review

**Spec coverage:** §1 product intent → Task 6 (identification + discovery UI). §2 architecture (derived, no plan-gen changes, no structured API) → respected throughout, no task touches `OSPREY-app/` or edge functions. §3 ladder & scheduling logic, including the two-source goal-distance resolution found during design self-review → Task 2 (pure logic) + Task 6 Step 1 (query wiring). §4 discovery deep link, including the verified query scheme → Task 3. §5 data model (`location_zip`, add-race gap) → Task 1 (migration) + Task 4 (add-race). §6 UI placement (grid markers, side-pane card, add-race entry point) → Task 6 Step 2. §7 data layer (`useGoalDistanceKm`, `useTuneUpWeeks`, races feature) → Tasks 4 and 6. §8 testing → Tasks 2 and 3 are TDD; Task 6 covers live verification since it has no new pure logic of its own. §9 out-of-scope items are respected — no task adds a second race site, structured API, mobile changes, or plan-generation edits. §10 risks: the ±20% tolerance is a named constant (`TOLERANCE` in `tuneups.ts`) easy to retune; the goal-distance fallback is directly tested (`parseGoalDistanceFromText` half-marathon-vs-marathon ordering test).

**Placeholder scan:** every step carries complete, real code — no TBD/TODO. The only open value is the `radiusMiles` default (25 miles), explicitly flagged as tunable in both the spec and the code comment, not a placeholder.

**Type consistency:** `TuneUpWeek`/`SessionInput`/`LadderRung` (Task 2) are the exact shapes consumed by `useTuneUpWeeks` (Task 6); `RunSignupSearchParams` (Task 3) matches the call site in `calendar.tsx`; `NewRaceEventInput` (Task 4) matches `AddRaceForm`'s local state mapping; `useLocationZip`/`useUpdateLocationZip` (Task 5) mirror the existing `useUnits`/`useUpdateUnits` pair's signature shape exactly, as intended.
