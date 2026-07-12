# Osprey Web App Phase 1 (Foundation + Workout Desk) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the authenticated Osprey web app (`webapp/`) with login, training calendar, keyboard-first strength logging, workout history, and settings — a pure client on the existing Supabase backend.

**Architecture:** Vite + React SPA in `webapp/` at repo root. TanStack Router (file-based via `@tanstack/router-plugin`) + TanStack Query; `@supabase/supabase-js` v2 talks straight to the live Supabase project (same rows the iOS app uses; RLS is the authorization layer — zero backend changes). All logic that can be pure (sets-grid state machine, unit conversion, zod parsing) is extracted and Vitest-tested; UI wires those pieces to Supabase mutations.

**Tech Stack:** Vite 6, React 18.3, TypeScript strict, @tanstack/react-router v1 + router-plugin, @tanstack/react-query v5, @supabase/supabase-js v2, zod 3, Vitest 2 + jsdom.

## Global Constraints

- **Zero backend changes.** No migrations, no edge-function edits, no new tables. Reads: `training_sessions`, `exercises`, `users.units`; reads/writes: `workout_logs`, `exercise_sets`, `users.units`.
- **Exact DB enums** (zod enums must match verbatim): `session_type` = `run|lift|cross|rest|race|swim|bike|rowing|hyrox`; `workout_status` = `planned|completed|skipped|partial`; `intensity` = `easy|moderate|threshold|interval|race|rest`. Strength workouts are `'lift'`.
- **Units:** weights stored `weight_kg`, displayed per `users.units` (`'imperial'` default → lbs). Conversion mirrors the app exactly: `LB_PER_KG = 2.2046226218`; `kgToLb` rounds to 1 decimal; `lbToKg` rounds to 2 decimals.
- **Soft deletes:** every `workout_logs` query filters `deleted_at IS NULL` (supabase-js: `.is('deleted_at', null)`).
- **Design tokens** (copy from `website/src/styles/tokens.css` conventions): `--ink #09090B`, `--panel #101014`, `--line #3F3F46`, `--amber #c8793a`, `--amber-bright #d98b4a`, `--text #FAFAFA`, `--text-soft #c9cbd1`, `--mut #A1A1AA`; 2px borders, zero radius, Space Grotesk 500/700, `tabular-nums` on all data, `:focus-visible` 3px amber, `prefers-reduced-motion` honored.
- **Env:** `webapp/.env.local` with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (values via the connected Supabase MCP: `get_project_url` + `get_publishable_keys`, or the Supabase dashboard). Never commit `.env.local`.
- **Auth:** supabase-js browser defaults (localStorage persistence, `detectSessionInUrl: true` — note this deliberately differs from the iOS app's `false`). No signup, no password reset UI this phase.
- **Localhost only.** No deploy tasks, no responsive polish beyond not-broken.
- Node v20.20.2 via `/Users/gusjohnson/.nvm/versions/node/v20.20.2/bin/` (prepend to PATH if npm missing). All npm commands run from `/Users/gusjohnson/App Development/Osprey/webapp/`.

---

## File Structure

```
webapp/
  package.json  vite.config.ts  tsconfig.json  index.html  .env.local (untracked)
  src/
    styles/tokens.css  styles/global.css
    lib/supabase.ts          # client singleton
    lib/schemas.ts           # zod: enums + row schemas (tested)
    lib/units.ts             # kg<->lb, distance, parse/format (tested)
    lib/auth.ts              # session hook + signIn/signOut wrappers
    routes/__root.tsx        # router root: QueryClientProvider + outlet
    routes/login.tsx         # /login
    routes/_authed.tsx       # layout: session guard + nav rail
    routes/_authed/calendar.tsx
    routes/_authed/log.tsx  routes/_authed/log.$workoutId.tsx
    routes/_authed/history.tsx  routes/_authed/history.$workoutId.tsx
    routes/_authed/settings.tsx
    features/grid/reducer.ts     # pure sets-grid state machine (tested)
    features/grid/SetsGrid.tsx   # keyboard-first grid component
    features/log/queries.ts      # workout/sets/exercises hooks + mutations
    features/calendar/queries.ts # sessions + completion hooks
    features/history/queries.ts  # paged history hook
    features/settings/queries.ts # units read/write
    components/{NavRail,Panel,ErrorPanel,Field}.tsx  # small shared UI
  tests/units.test.ts  tests/schemas.test.ts  tests/grid-reducer.test.ts
```

---

### Task 1: Scaffold webapp with tokens and env

**Files:**
- Create: `webapp/package.json`, `webapp/vite.config.ts`, `webapp/tsconfig.json`, `webapp/index.html`, `webapp/src/styles/tokens.css`, `webapp/src/styles/global.css`, `webapp/src/main.tsx`, `webapp/.env.local` (untracked), `webapp/.env.example`
- Modify: repo root `.gitignore`

**Interfaces:**
- Produces: a booting Vite dev server; global CSS custom properties (token names above) available everywhere; `import.meta.env.VITE_SUPABASE_URL/ANON_KEY` populated.

- [ ] **Step 1: Create package.json**

`webapp/package.json`:
```json
{
  "name": "osprey-webapp",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.47.0",
    "@tanstack/react-query": "^5.62.0",
    "@tanstack/react-router": "^1.87.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@tanstack/router-plugin": "^1.87.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.0",
    "typescript": "~5.6.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create vite.config.ts, tsconfig.json, index.html, main.tsx**

`webapp/vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [TanStackRouterVite({ routesDirectory: './src/routes', generatedRouteTree: './src/routeTree.gen.ts' }), react()],
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'] },
});
```

`webapp/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["ES2022", "DOM", "DOM.Iterable"], "module": "ESNext",
    "moduleResolution": "bundler", "jsx": "react-jsx", "strict": true,
    "noUnusedLocals": true, "noUnusedParameters": true, "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true, "noEmit": true, "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src", "tests"]
}
```

`webapp/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Osprey</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`webapp/src/main.tsx` (placeholder until Task 3 wires the router):
```tsx
import { createRoot } from 'react-dom/client';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(<h1 style={{ padding: 32 }}>OSPREY</h1>);
```

- [ ] **Step 3: Create token and global styles**

`webapp/src/styles/tokens.css`:
```css
:root {
  --ink: #09090B; --panel: #101014; --line: #3F3F46;
  --amber: #c8793a; --amber-bright: #d98b4a;
  --text: #FAFAFA; --text-soft: #c9cbd1; --mut: #A1A1AA;
  --border-w: 2px; --tap: 44px;
}
```

`webapp/src/styles/global.css`:
```css
@import './tokens.css';
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap');

* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: var(--ink); color: var(--text);
  font-family: 'Space Grotesk', system-ui, sans-serif; font-weight: 500;
  -webkit-font-smoothing: antialiased;
}
a { color: inherit; text-decoration: none; }
:focus-visible { outline: 3px solid var(--amber); outline-offset: 3px; }
input, select, button, textarea { font-family: inherit; font-size: 14px; color: var(--text); }
input, select, textarea {
  background: var(--panel); border: var(--border-w) solid var(--line); padding: 8px 10px;
}
table { border-collapse: collapse; font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
```
(Google Fonts import is acceptable localhost-phase convenience; self-hosting moves to the public-hardening phase.)

- [ ] **Step 4: Env plumbing**

Fetch the Supabase project URL and anon (publishable) key using the connected Supabase MCP tools (`get_project_url`, `get_publishable_keys`) — or, if unavailable, ask the user to copy them from the Supabase dashboard (Settings → API). Write `webapp/.env.local`:
```
VITE_SUPABASE_URL=<url>
VITE_SUPABASE_ANON_KEY=<anon key>
```
Create `webapp/.env.example` with the same keys and placeholder values. Append to repo root `.gitignore`:
```
webapp/node_modules/
webapp/dist/
webapp/.env.local
```

- [ ] **Step 5: Install and verify boot**

Run: `npm install && npm run dev` (background, then curl `http://localhost:5173/` → 200 containing `OSPREY`; kill dev server). Then `npm run build` — expect `dist/` emitted, no TS errors. Note: the router plugin generates `src/routeTree.gen.ts` when routes exist (Task 3); its absence must not fail this build because nothing imports it yet.

- [ ] **Step 6: Commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add .gitignore webapp/package.json webapp/package-lock.json webapp/vite.config.ts webapp/tsconfig.json webapp/index.html webapp/src webapp/.env.example
git commit -m "feat(webapp): scaffold Vite+React app with brutalist tokens"
```

---

### Task 2: Schemas + units (pure, TDD)

**Files:**
- Create: `webapp/src/lib/schemas.ts`, `webapp/src/lib/units.ts`
- Test: `webapp/tests/schemas.test.ts`, `webapp/tests/units.test.ts`

**Interfaces:**
- Produces (schemas.ts): `SessionTypeEnum`, `WorkoutStatusEnum`, `IntensityEnum` (zod enums); `WorkoutLogSchema`/`WorkoutLog`, `ExerciseSetSchema`/`ExerciseSet`, `TrainingSessionSchema`/`TrainingSession`, `ExerciseSchema`/`Exercise` — zod schemas + inferred types matching DB columns (snake_case field names, nullable per DDL).
- Produces (units.ts): `type UnitSystem = 'imperial' | 'metric'`; `kgToLb(kg): number`; `lbToKg(lb): number`; `formatWeightKg(kg, units): string`; `parseWeightInput(text, units): number | null` (returns kg, null on non-numeric/≤0).

- [ ] **Step 1: Write failing tests**

`webapp/tests/units.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { kgToLb, lbToKg, formatWeightKg, parseWeightInput } from '../src/lib/units';

describe('units', () => {
  it('kgToLb matches app rounding (1 decimal)', () => {
    expect(kgToLb(100)).toBe(220.5);
    expect(kgToLb(83.9)).toBe(185);
  });
  it('lbToKg matches app rounding (2 decimals)', () => {
    expect(lbToKg(185)).toBe(83.91);
    expect(lbToKg(225)).toBe(102.06);
  });
  it('round-trips within rounding tolerance', () => {
    expect(Math.abs(kgToLb(lbToKg(185)) - 185)).toBeLessThanOrEqual(0.1);
  });
  it('formats per unit system', () => {
    expect(formatWeightKg(83.91, 'imperial')).toBe('185 lbs');
    expect(formatWeightKg(83.91, 'metric')).toBe('83.9 kg');
  });
  it('parseWeightInput converts imperial text to kg', () => {
    expect(parseWeightInput('185', 'imperial')).toBe(83.91);
    expect(parseWeightInput('100', 'metric')).toBe(100);
    expect(parseWeightInput('abc', 'imperial')).toBeNull();
    expect(parseWeightInput('-5', 'metric')).toBeNull();
    expect(parseWeightInput('', 'imperial')).toBeNull();
  });
});
```

`webapp/tests/schemas.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { WorkoutLogSchema, ExerciseSetSchema, TrainingSessionSchema, SessionTypeEnum } from '../src/lib/schemas';

describe('schemas', () => {
  it('session type enum matches DB exactly', () => {
    expect(SessionTypeEnum.options).toEqual(['run', 'lift', 'cross', 'rest', 'race', 'swim', 'bike', 'rowing', 'hyrox']);
  });
  it('parses a representative workout_logs row', () => {
    const row = {
      id: '4d2f7a44-0000-4000-8000-000000000001', user_id: '4d2f7a44-0000-4000-8000-000000000002',
      session_id: null, started_at: '2026-07-12T14:00:00+00:00', ended_at: null,
      session_type: 'lift', status: 'completed', perceived_effort: 7,
      total_distance_km: null, total_duration_s: 3600, avg_heart_rate: null, max_heart_rate: null,
      calories_burned: null, tss: null, notes: 'upper', created_at: '2026-07-12T14:00:00+00:00',
      updated_at: '2026-07-12T14:00:00+00:00', deleted_at: null,
    };
    expect(WorkoutLogSchema.parse(row).session_type).toBe('lift');
  });
  it('parses an exercise_sets row and rejects bad rpe', () => {
    const base = { id: '4d2f7a44-0000-4000-8000-000000000003', workout_id: '4d2f7a44-0000-4000-8000-000000000001',
      exercise_id: '4d2f7a44-0000-4000-8000-000000000004', set_number: 1, reps: 8, weight_kg: 83.91,
      duration_s: null, rpe: 8, created_at: '2026-07-12T14:00:00+00:00' };
    expect(ExerciseSetSchema.parse(base).weight_kg).toBe(83.91);
    expect(() => ExerciseSetSchema.parse({ ...base, rpe: 11 })).toThrow();
  });
  it('parses a training_sessions row', () => {
    const row = { id: '4d2f7a44-0000-4000-8000-000000000005', week_id: '4d2f7a44-0000-4000-8000-000000000006',
      user_id: '4d2f7a44-0000-4000-8000-000000000002', session_date: '2026-07-14', session_type: 'run',
      intensity: 'threshold', planned_minutes: 50, planned_distance_km: 10, description: 'Tempo',
      ozzie_notes: null, created_at: '2026-07-12T14:00:00+00:00', updated_at: '2026-07-12T14:00:00+00:00' };
    expect(TrainingSessionSchema.parse(row).intensity).toBe('threshold');
  });
});
```

- [ ] **Step 2: Run tests, verify FAIL** — `npm test` → cannot resolve `../src/lib/units` / `../src/lib/schemas`.

- [ ] **Step 3: Implement**

`webapp/src/lib/units.ts`:
```ts
export type UnitSystem = 'imperial' | 'metric';

const LB_PER_KG = 2.2046226218; // mirrors OSPREY-app/src/services/body-metrics.ts

export function kgToLb(kg: number): number {
  return Math.round(kg * LB_PER_KG * 10) / 10;
}

export function lbToKg(lb: number): number {
  return Math.round((lb / LB_PER_KG) * 100) / 100;
}

export function formatWeightKg(kg: number, units: UnitSystem): string {
  return units === 'metric' ? `${Math.round(kg * 10) / 10} kg` : `${kgToLb(kg)} lbs`;
}

/** Parse user-typed weight in their display units; returns kg for storage, or null if invalid. */
export function parseWeightInput(text: string, units: UnitSystem): number | null {
  const n = Number(text.trim());
  if (!text.trim() || !Number.isFinite(n) || n <= 0) return null;
  return units === 'imperial' ? lbToKg(n) : Math.round(n * 100) / 100;
}
```

`webapp/src/lib/schemas.ts`:
```ts
import { z } from 'zod';

export const SessionTypeEnum = z.enum(['run', 'lift', 'cross', 'rest', 'race', 'swim', 'bike', 'rowing', 'hyrox']);
export const WorkoutStatusEnum = z.enum(['planned', 'completed', 'skipped', 'partial']);
export const IntensityEnum = z.enum(['easy', 'moderate', 'threshold', 'interval', 'race', 'rest']);

export const WorkoutLogSchema = z.object({
  id: z.string().uuid(), user_id: z.string().uuid(), session_id: z.string().uuid().nullable(),
  started_at: z.string(), ended_at: z.string().nullable(),
  session_type: SessionTypeEnum, status: WorkoutStatusEnum,
  perceived_effort: z.number().int().min(1).max(10).nullable(),
  total_distance_km: z.coerce.number().nullable(), total_duration_s: z.number().int().nullable(),
  avg_heart_rate: z.number().int().nullable(), max_heart_rate: z.number().int().nullable(),
  calories_burned: z.number().int().nullable(), tss: z.coerce.number().nullable(),
  notes: z.string().nullable(), created_at: z.string(), updated_at: z.string(),
  deleted_at: z.string().nullable(),
});
export type WorkoutLog = z.infer<typeof WorkoutLogSchema>;

export const ExerciseSetSchema = z.object({
  id: z.string().uuid(), workout_id: z.string().uuid(), exercise_id: z.string().uuid(),
  set_number: z.number().int(), reps: z.number().int().nullable(),
  weight_kg: z.coerce.number().nullable(), duration_s: z.number().int().nullable(),
  rpe: z.number().int().min(1).max(10).nullable(), created_at: z.string(),
});
export type ExerciseSet = z.infer<typeof ExerciseSetSchema>;

export const TrainingSessionSchema = z.object({
  id: z.string().uuid(), week_id: z.string().uuid(), user_id: z.string().uuid(),
  session_date: z.string(), session_type: SessionTypeEnum, intensity: IntensityEnum,
  planned_minutes: z.number().int().nullable(), planned_distance_km: z.coerce.number().nullable(),
  description: z.string().nullable(), ozzie_notes: z.string().nullable(),
  created_at: z.string(), updated_at: z.string(),
});
export type TrainingSession = z.infer<typeof TrainingSessionSchema>;

export const ExerciseSchema = z.object({
  id: z.string().uuid(), name: z.string(), muscle_group: z.string().nullable(),
  equipment: z.string().nullable(), created_at: z.string(),
});
export type Exercise = z.infer<typeof ExerciseSchema>;
```
(NUMERIC columns arrive from PostgREST as JSON numbers by default, but `z.coerce.number()` also tolerates string representations safely.)

- [ ] **Step 4: Run tests, verify PASS** — `npm test` → all green (expect ~9 tests).

- [ ] **Step 5: Commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add webapp/src/lib/schemas.ts webapp/src/lib/units.ts webapp/tests
git commit -m "feat(webapp): add tested DB schemas and unit conversions"
```

---

### Task 3: Supabase client, auth, router shell, /login — ends at GATE ZERO

**Files:**
- Create: `webapp/src/lib/supabase.ts`, `webapp/src/lib/auth.ts`, `webapp/src/routes/__root.tsx`, `webapp/src/routes/login.tsx`, `webapp/src/routes/_authed.tsx`, `webapp/src/routes/_authed/index.tsx`, `webapp/src/components/NavRail.tsx`
- Modify: `webapp/src/main.tsx`

**Interfaces:**
- Produces: `supabase` client singleton; `getSession(): Promise<Session | null>`, `signInWithPassword(email, password)`, `signInWithApple()`, `signOut()` from `lib/auth.ts`; an `_authed` layout route that redirects to `/login` when there is no session and renders `<NavRail/>` + `<Outlet/>` when there is. Route paths: `/login`, `/calendar`, `/log`, `/history`, `/settings` (authed index redirects to `/calendar`).

- [ ] **Step 1: Supabase client + auth wrappers**

`webapp/src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } },
);
```

`webapp/src/lib/auth.ts`:
```ts
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signInWithPassword(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}

export async function signInWithApple(): Promise<string | null> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: `${window.location.origin}/login` },
  });
  return error ? error.message : null;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
```

- [ ] **Step 2: Router root + main.tsx**

`webapp/src/routes/__root.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, Outlet } from '@tanstack/react-router';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

export const Route = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  ),
});
```

`webapp/src/main.tsx` (replace placeholder):
```tsx
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import './styles/global.css';

const router = createRouter({ routeTree });
declare module '@tanstack/react-router' {
  interface Register { router: typeof router; }
}

createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />);
```

- [ ] **Step 3: /login route**

`webapp/src/routes/login.tsx`:
```tsx
import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { signInWithPassword, signInWithApple } from '../lib/auth';

export const Route = createFileRoute('/login')({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const err = await signInWithPassword(email, password);
    setBusy(false);
    if (err) setError(err);
    else navigate({ to: '/calendar' });
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <form onSubmit={submit} style={{ width: 360, border: 'var(--border-w) solid var(--line)', background: 'var(--panel)', padding: 32 }}>
        <h1 style={{ fontSize: 28, textTransform: 'uppercase', marginBottom: 24 }}>Osprey</h1>
        <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--mut)', marginBottom: 6 }}>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', marginBottom: 16 }} />
        <label style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--mut)', marginBottom: 6 }}>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', marginBottom: 20 }} />
        {error && <p role="alert" style={{ color: 'var(--amber)', fontSize: 13, marginBottom: 14 }}>{error}</p>}
        <button type="submit" disabled={busy} style={{ width: '100%', background: 'var(--amber)', color: '#000', fontWeight: 700, textTransform: 'uppercase', padding: '12px 0', border: 'var(--border-w) solid var(--amber)', cursor: 'pointer' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <button type="button" onClick={() => void signInWithApple()} style={{ width: '100%', marginTop: 10, background: 'transparent', color: 'var(--text)', fontWeight: 700, textTransform: 'uppercase', padding: '12px 0', border: 'var(--border-w) solid var(--line)', cursor: 'pointer' }}>
          Sign in with Apple
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Authed layout + nav rail + index redirect**

`webapp/src/routes/_authed.tsx`:
```tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { getSession } from '../lib/auth';
import { NavRail } from '../components/NavRail';

export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    const session = await getSession();
    if (!session) throw redirect({ to: '/login' });
    return { userId: session.user.id };
  },
  component: () => (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <NavRail />
      <main style={{ flex: 1, padding: 28, minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  ),
});
```

`webapp/src/components/NavRail.tsx`:
```tsx
import { Link, useNavigate } from '@tanstack/react-router';
import { signOut } from '../lib/auth';

const links = [
  { to: '/calendar', label: 'Calendar' },
  { to: '/log', label: 'Log' },
  { to: '/history', label: 'History' },
  { to: '/settings', label: 'Settings' },
] as const;

export function NavRail() {
  const navigate = useNavigate();
  return (
    <nav style={{ width: 200, borderRight: 'var(--border-w) solid var(--line)', padding: '24px 0', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontWeight: 700, fontSize: 18, textTransform: 'uppercase', padding: '0 20px 24px' }}>Osprey</div>
      {links.map((l) => (
        <Link key={l.to} to={l.to} style={{ padding: '12px 20px', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--mut)' }}
          activeProps={{ style: { color: '#000', background: 'var(--amber)', fontWeight: 700 } }}>
          {l.label}
        </Link>
      ))}
      <button onClick={() => { void signOut().then(() => navigate({ to: '/login' })); }}
        style={{ margin: 'auto 20px 0', background: 'transparent', border: 'var(--border-w) solid var(--line)', padding: '10px 0', textTransform: 'uppercase', fontSize: 12, cursor: 'pointer' }}>
        Sign out
      </button>
    </nav>
  );
}
```

`webapp/src/routes/_authed/index.tsx`:
```tsx
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/')({
  beforeLoad: () => { throw redirect({ to: '/calendar' }); },
});
```

Also create four stub pages so the router tree compiles (each replaced by its own task):
`webapp/src/routes/_authed/calendar.tsx`, `log.tsx`, `history.tsx`, `settings.tsx`, each:
```tsx
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/_authed/calendar')({ component: () => <h1>Calendar</h1> });
```
(adjusting the path string and heading per file: `/_authed/log`, `/_authed/history`, `/_authed/settings`).

- [ ] **Step 5: Verify build + typecheck** — `npm run build` (plugin generates `src/routeTree.gen.ts`) and `npm run typecheck`: 0 errors.

- [ ] **Step 6: GATE ZERO — owner logs in with the real account (USER CHECKPOINT)**

Start `npm run dev`, open `http://localhost:5173/login` in the Browser pane, and have the user sign in with their real Osprey account. Outcomes:
- **Success** → proceed.
- **Apple-only account** → either configure Supabase Apple web OAuth (Apple Services ID — external, user does it in Apple Developer + Supabase dashboard) or set a password on the existing user (Supabase dashboard → Auth → user → send password recovery / set password). Do NOT create a second account — data lives on the existing user id.
This is a hard stop until login works; nothing downstream is buildable against RLS without a session.

- [ ] **Step 7: Commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add webapp/src
git commit -m "feat(webapp): auth, router shell, login, nav rail"
```

---

### Task 4: Settings page + RLS smoke (units read/write)

**Files:**
- Create: `webapp/src/features/settings/queries.ts`, `webapp/src/components/ErrorPanel.tsx`
- Modify: `webapp/src/routes/_authed/settings.tsx` (replace stub)

**Interfaces:**
- Produces: `useUnits(userId)` → TanStack query returning `UnitSystem`; `useUpdateUnits(userId)` mutation; `<ErrorPanel error={Error} onRetry?>` shared component. Query key: `['units', userId]`.

- [ ] **Step 1: Queries**

`webapp/src/features/settings/queries.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import type { UnitSystem } from '../../lib/units';

export function useUnits(userId: string) {
  return useQuery({
    queryKey: ['units', userId],
    queryFn: async (): Promise<UnitSystem> => {
      const { data, error } = await supabase.from('users').select('units').eq('id', userId).maybeSingle();
      if (error) throw error;
      return (data?.units as UnitSystem | null) ?? 'imperial';
    },
  });
}

export function useUpdateUnits(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (units: UnitSystem) => {
      const { error } = await supabase.from('users').update({ units }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['units', userId] }),
  });
}
```

- [ ] **Step 2: ErrorPanel + settings page**

`webapp/src/components/ErrorPanel.tsx`:
```tsx
export function ErrorPanel({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div role="alert" style={{ border: 'var(--border-w) solid var(--amber)', padding: 20, maxWidth: 480 }}>
      <p style={{ fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Something failed</p>
      <p style={{ color: 'var(--text-soft)', fontSize: 14, marginBottom: onRetry ? 14 : 0 }}>{error.message}</p>
      {onRetry && <button onClick={onRetry} style={{ background: 'var(--amber)', color: '#000', border: 'none', padding: '8px 16px', fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>Retry</button>}
    </div>
  );
}
```

`webapp/src/routes/_authed/settings.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { useUnits, useUpdateUnits } from '../../features/settings/queries';
import { ErrorPanel } from '../../components/ErrorPanel';

export const Route = createFileRoute('/_authed/settings')({ component: SettingsPage });

function SettingsPage() {
  const { userId } = Route.useRouteContext();
  const units = useUnits(userId);
  const update = useUpdateUnits(userId);

  if (units.isPending) return <p style={{ color: 'var(--mut)' }}>Loading…</p>;
  if (units.isError) return <ErrorPanel error={units.error as Error} onRetry={() => void units.refetch()} />;

  return (
    <section style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 32, textTransform: 'uppercase', marginBottom: 24 }}>Settings</h1>
      <div style={{ border: 'var(--border-w) solid var(--line)', padding: 20 }}>
        <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--mut)', marginBottom: 10 }}>Units</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['imperial', 'metric'] as const).map((u) => (
            <button key={u} onClick={() => update.mutate(u)} disabled={update.isPending}
              style={{ flex: 1, padding: '10px 0', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer',
                background: units.data === u ? 'var(--amber)' : 'transparent',
                color: units.data === u ? '#000' : 'var(--text)',
                border: 'var(--border-w) solid ' + (units.data === u ? 'var(--amber)' : 'var(--line)') }}>
              {u}
            </button>
          ))}
        </div>
        {update.isError && <p role="alert" style={{ color: 'var(--amber)', fontSize: 13, marginTop: 10 }}>{(update.error as Error).message}</p>}
      </div>
    </section>
  );
}
```
Note: `Route.useRouteContext()` receives `{ userId }` from the `_authed` layout's `beforeLoad` return.

- [ ] **Step 3: Live RLS smoke (browser)** — `npm run dev`; in the Browser pane: log in, open `/settings`, confirm units render, toggle metric↔imperial, reload — value persists (proves authenticated read AND write through RLS from the web origin).

- [ ] **Step 4: Typecheck + commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey/webapp" && npm run typecheck
cd "/Users/gusjohnson/App Development/Osprey"
git add webapp/src
git commit -m "feat(webapp): settings page with units toggle (RLS smoke)"
```

---

### Task 5: Sets-grid reducer (pure, TDD)

**Files:**
- Create: `webapp/src/features/grid/reducer.ts`
- Test: `webapp/tests/grid-reducer.test.ts`

**Interfaces:**
- Produces:
```ts
interface SetRow { localId: string; dbId: string | null; exerciseId: string | null; exerciseName: string;
  reps: number | null; weightKg: number | null; rpe: number | null; dirty: boolean; }
interface GridState { rows: SetRow[]; nextLocal: number; }
type GridAction =
  | { type: 'load'; rows: Array<Omit<SetRow, 'localId' | 'dirty'>> }
  | { type: 'addRow' }
  | { type: 'duplicateLast' }
  | { type: 'editCell'; localId: string; field: 'exercise' | 'reps' | 'weightKg' | 'rpe'; value: { exerciseId?: string; exerciseName?: string; num?: number | null } }
  | { type: 'markSaved'; localId: string; dbId: string }
  | { type: 'removeRow'; localId: string };
function gridReducer(state: GridState, action: GridAction): GridState;
function emptyGrid(): GridState;
function setNumbers(rows: SetRow[]): Map<string, number>; // localId -> set_number (1-based count within same exerciseId, in row order)
function dirtyCompleteRows(state: GridState): SetRow[]; // dirty rows with exerciseId AND (reps or weightKg) present
```

- [ ] **Step 1: Write failing tests**

`webapp/tests/grid-reducer.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { gridReducer, emptyGrid, setNumbers, dirtyCompleteRows, type GridState } from '../src/features/grid/reducer';

const EX_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const EX_B = 'bbbbbbbb-0000-4000-8000-000000000002';

function seeded(): GridState {
  let s = emptyGrid();
  s = gridReducer(s, { type: 'addRow' });
  const id = s.rows[0].localId;
  s = gridReducer(s, { type: 'editCell', localId: id, field: 'exercise', value: { exerciseId: EX_A, exerciseName: 'Bench Press' } });
  s = gridReducer(s, { type: 'editCell', localId: id, field: 'reps', value: { num: 8 } });
  s = gridReducer(s, { type: 'editCell', localId: id, field: 'weightKg', value: { num: 83.91 } });
  return s;
}

describe('gridReducer', () => {
  it('addRow appends an empty dirty row with unique localId', () => {
    let s = emptyGrid();
    s = gridReducer(s, { type: 'addRow' });
    s = gridReducer(s, { type: 'addRow' });
    expect(s.rows).toHaveLength(2);
    expect(s.rows[0].localId).not.toBe(s.rows[1].localId);
    expect(s.rows[1]).toMatchObject({ dbId: null, exerciseId: null, dirty: true });
  });

  it('editCell sets values and marks dirty', () => {
    const s = seeded();
    expect(s.rows[0]).toMatchObject({ exerciseName: 'Bench Press', reps: 8, weightKg: 83.91, dirty: true });
  });

  it('duplicateLast copies exercise+reps+weight into a new dirty row', () => {
    let s = seeded();
    s = gridReducer(s, { type: 'markSaved', localId: s.rows[0].localId, dbId: 'dddddddd-0000-4000-8000-000000000003' });
    s = gridReducer(s, { type: 'duplicateLast' });
    expect(s.rows).toHaveLength(2);
    expect(s.rows[1]).toMatchObject({ exerciseId: EX_A, reps: 8, weightKg: 83.91, dbId: null, dirty: true });
  });

  it('duplicateLast on empty grid is a no-op addRow', () => {
    const s = gridReducer(emptyGrid(), { type: 'duplicateLast' });
    expect(s.rows).toHaveLength(1);
    expect(s.rows[0].exerciseId).toBeNull();
  });

  it('markSaved clears dirty and stores dbId', () => {
    let s = seeded();
    s = gridReducer(s, { type: 'markSaved', localId: s.rows[0].localId, dbId: 'dddddddd-0000-4000-8000-000000000003' });
    expect(s.rows[0]).toMatchObject({ dirty: false, dbId: 'dddddddd-0000-4000-8000-000000000003' });
  });

  it('load hydrates rows as clean', () => {
    const s = gridReducer(emptyGrid(), { type: 'load', rows: [
      { dbId: 'dddddddd-0000-4000-8000-000000000003', exerciseId: EX_A, exerciseName: 'Bench Press', reps: 8, weightKg: 83.91, rpe: 8 },
    ]});
    expect(s.rows[0]).toMatchObject({ dirty: false, dbId: 'dddddddd-0000-4000-8000-000000000003' });
  });

  it('setNumbers counts per exercise in row order', () => {
    let s = seeded();                                   // A
    s = gridReducer(s, { type: 'duplicateLast' });      // A
    s = gridReducer(s, { type: 'addRow' });             // B (after edit)
    const bId = s.rows[2].localId;
    s = gridReducer(s, { type: 'editCell', localId: bId, field: 'exercise', value: { exerciseId: EX_B, exerciseName: 'Row' } });
    s = gridReducer(s, { type: 'duplicateLast' });      // B
    const nums = setNumbers(s.rows);
    expect(nums.get(s.rows[0].localId)).toBe(1);
    expect(nums.get(s.rows[1].localId)).toBe(2);
    expect(nums.get(s.rows[2].localId)).toBe(1);
    expect(nums.get(s.rows[3].localId)).toBe(2);
  });

  it('dirtyCompleteRows returns only dirty rows with exercise and a value', () => {
    let s = seeded();                                   // dirty+complete
    s = gridReducer(s, { type: 'addRow' });             // dirty but empty
    expect(dirtyCompleteRows(s)).toHaveLength(1);
    s = gridReducer(s, { type: 'markSaved', localId: s.rows[0].localId, dbId: 'dddddddd-0000-4000-8000-000000000003' });
    expect(dirtyCompleteRows(s)).toHaveLength(0);
  });

  it('removeRow deletes by localId', () => {
    let s = seeded();
    s = gridReducer(s, { type: 'removeRow', localId: s.rows[0].localId });
    expect(s.rows).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests, verify FAIL** — module not found.

- [ ] **Step 3: Implement**

`webapp/src/features/grid/reducer.ts`:
```ts
export interface SetRow {
  localId: string; dbId: string | null; exerciseId: string | null; exerciseName: string;
  reps: number | null; weightKg: number | null; rpe: number | null; dirty: boolean;
}
export interface GridState { rows: SetRow[]; nextLocal: number; }
export type GridAction =
  | { type: 'load'; rows: Array<Omit<SetRow, 'localId' | 'dirty'>> }
  | { type: 'addRow' }
  | { type: 'duplicateLast' }
  | { type: 'editCell'; localId: string; field: 'exercise' | 'reps' | 'weightKg' | 'rpe'; value: { exerciseId?: string; exerciseName?: string; num?: number | null } }
  | { type: 'markSaved'; localId: string; dbId: string }
  | { type: 'removeRow'; localId: string };

export function emptyGrid(): GridState {
  return { rows: [], nextLocal: 1 };
}

function blankRow(localId: string): SetRow {
  return { localId, dbId: null, exerciseId: null, exerciseName: '', reps: null, weightKg: null, rpe: null, dirty: true };
}

export function gridReducer(state: GridState, action: GridAction): GridState {
  switch (action.type) {
    case 'load':
      return {
        nextLocal: action.rows.length + 1,
        rows: action.rows.map((r, i) => ({ ...r, localId: `r${i + 1}`, dirty: false })),
      };
    case 'addRow':
      return { nextLocal: state.nextLocal + 1, rows: [...state.rows, blankRow(`r${state.nextLocal}`)] };
    case 'duplicateLast': {
      const last = state.rows[state.rows.length - 1];
      const row = last
        ? { ...blankRow(`r${state.nextLocal}`), exerciseId: last.exerciseId, exerciseName: last.exerciseName, reps: last.reps, weightKg: last.weightKg, rpe: last.rpe }
        : blankRow(`r${state.nextLocal}`);
      return { nextLocal: state.nextLocal + 1, rows: [...state.rows, row] };
    }
    case 'editCell':
      return {
        ...state,
        rows: state.rows.map((r) => {
          if (r.localId !== action.localId) return r;
          if (action.field === 'exercise') {
            return { ...r, exerciseId: action.value.exerciseId ?? null, exerciseName: action.value.exerciseName ?? '', dirty: true };
          }
          return { ...r, [action.field]: action.value.num ?? null, dirty: true };
        }),
      };
    case 'markSaved':
      return { ...state, rows: state.rows.map((r) => (r.localId === action.localId ? { ...r, dbId: action.dbId, dirty: false } : r)) };
    case 'removeRow':
      return { ...state, rows: state.rows.filter((r) => r.localId !== action.localId) };
  }
}

export function setNumbers(rows: SetRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  const out = new Map<string, number>();
  for (const r of rows) {
    const key = r.exerciseId ?? '∅';
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    out.set(r.localId, n);
  }
  return out;
}

export function dirtyCompleteRows(state: GridState): SetRow[] {
  return state.rows.filter((r) => r.dirty && r.exerciseId !== null && (r.reps !== null || r.weightKg !== null));
}
```

- [ ] **Step 4: Run tests, verify PASS** — `npm test` → all green (9 grid tests + prior 9).

- [ ] **Step 5: Commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add webapp/src/features/grid/reducer.ts webapp/tests/grid-reducer.test.ts
git commit -m "feat(webapp): pure tested sets-grid reducer"
```

---

### Task 6: /log — workout creation and the sets grid UI

**Files:**
- Create: `webapp/src/features/log/queries.ts`, `webapp/src/features/grid/SetsGrid.tsx`, `webapp/src/routes/_authed/log.$workoutId.tsx`
- Modify: `webapp/src/routes/_authed/log.tsx` (replace stub)

**Interfaces:**
- Consumes: `gridReducer`/`emptyGrid`/`setNumbers`/`dirtyCompleteRows` (Task 5), units helpers (Task 2), `useUnits` (Task 4), zod schemas (Task 2).
- Produces (queries.ts): `useCreateWorkout(userId)` → mutation returning new `WorkoutLog` (`session_type:'lift'`, `status:'completed'`, `started_at` param, optional `session_id`); `useWorkout(workoutId)`; `useSets(workoutId)`; `useCommitSet(workoutId)` mutation (insert or update one `exercise_sets` row; input `{ dbId, exerciseId, setNumber, reps, weightKg, rpe }`, returns `{ dbId }`); `useDeleteSet(workoutId)`; `useUpdateWorkout(workoutId)` (effort/notes/duration); `useExerciseSearch(term)` (ilike, limit 10); `useWeekSessions(userId)` (this week's `training_sessions` for the link picker). Query keys: `['workout', id]`, `['sets', workoutId]`, `['exercises', term]`, `['weekSessions', userId]`.

- [ ] **Step 1: Data hooks**

`webapp/src/features/log/queries.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { ExerciseSchema, ExerciseSetSchema, TrainingSessionSchema, WorkoutLogSchema, type WorkoutLog } from '../../lib/schemas';

export function useCreateWorkout(userId: string) {
  return useMutation({
    mutationFn: async (input: { startedAt: string; sessionId: string | null }): Promise<WorkoutLog> => {
      const { data, error } = await supabase.from('workout_logs')
        .insert({ user_id: userId, session_type: 'lift', status: 'completed', started_at: input.startedAt, session_id: input.sessionId })
        .select().single();
      if (error) throw error;
      return WorkoutLogSchema.parse(data);
    },
  });
}

export function useWorkout(workoutId: string) {
  return useQuery({
    queryKey: ['workout', workoutId],
    queryFn: async (): Promise<WorkoutLog> => {
      const { data, error } = await supabase.from('workout_logs').select('*').eq('id', workoutId).is('deleted_at', null).single();
      if (error) throw error;
      return WorkoutLogSchema.parse(data);
    },
  });
}

export function useSets(workoutId: string) {
  return useQuery({
    queryKey: ['sets', workoutId],
    queryFn: async () => {
      const { data, error } = await supabase.from('exercise_sets')
        .select('*, exercises(name)').eq('workout_id', workoutId).order('created_at', { ascending: true });
      if (error) throw error;
      return z.array(ExerciseSetSchema.extend({ exercises: z.object({ name: z.string() }).nullable() })).parse(data);
    },
  });
}

export function useCommitSet(workoutId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { dbId: string | null; exerciseId: string; setNumber: number; reps: number | null; weightKg: number | null; rpe: number | null }): Promise<{ dbId: string }> => {
      if (input.dbId) {
        const { error } = await supabase.from('exercise_sets')
          .update({ exercise_id: input.exerciseId, set_number: input.setNumber, reps: input.reps, weight_kg: input.weightKg, rpe: input.rpe })
          .eq('id', input.dbId);
        if (error) throw error;
        return { dbId: input.dbId };
      }
      const { data, error } = await supabase.from('exercise_sets')
        .insert({ workout_id: workoutId, exercise_id: input.exerciseId, set_number: input.setNumber, reps: input.reps, weight_kg: input.weightKg, rpe: input.rpe })
        .select('id').single();
      if (error) throw error;
      return { dbId: (data as { id: string }).id };
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['sets', workoutId] }),
  });
}

export function useDeleteSet(workoutId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dbId: string) => {
      const { error } = await supabase.from('exercise_sets').delete().eq('id', dbId);
      if (error) throw error;
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['sets', workoutId] }),
  });
}

export function useUpdateWorkout(workoutId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { perceived_effort?: number | null; notes?: string | null; total_duration_s?: number | null }) => {
      const { error } = await supabase.from('workout_logs').update(patch).eq('id', workoutId);
      if (error) throw error;
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['workout', workoutId] }),
  });
}

export function useExerciseSearch(term: string) {
  return useQuery({
    queryKey: ['exercises', term],
    enabled: term.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.from('exercises').select('*').ilike('name', `%${term.trim()}%`).order('name').limit(10);
      if (error) throw error;
      return z.array(ExerciseSchema).parse(data);
    },
  });
}

export function useWeekSessions(userId: string) {
  const now = new Date();
  const day = (now.getDay() + 6) % 7; // Monday=0
  const monday = new Date(now); monday.setDate(now.getDate() - day);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return useQuery({
    queryKey: ['weekSessions', userId, iso(monday)],
    queryFn: async () => {
      const { data, error } = await supabase.from('training_sessions').select('*')
        .eq('user_id', userId).gte('session_date', iso(monday)).lte('session_date', iso(sunday)).order('session_date');
      if (error) throw error;
      return z.array(TrainingSessionSchema).parse(data);
    },
  });
}
```

- [ ] **Step 2: SetsGrid component**

`webapp/src/features/grid/SetsGrid.tsx`:
```tsx
import { useReducer, useEffect, useRef, useState } from 'react';
import { gridReducer, emptyGrid, setNumbers, type SetRow } from './reducer';
import { formatWeightKg, parseWeightInput, kgToLb, type UnitSystem } from '../../lib/units';
import { useExerciseSearch } from '../log/queries';

interface Props {
  units: UnitSystem;
  initialRows: Array<Omit<SetRow, 'localId' | 'dirty'>>;
  onCommitRow: (row: SetRow, setNumber: number) => Promise<string>; // returns dbId
  onDeleteRow: (dbId: string) => void;
}

export function SetsGrid({ units, initialRows, onCommitRow, onDeleteRow }: Props) {
  const [state, dispatch] = useReducer(gridReducer, undefined, emptyGrid);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const loaded = useRef(false);
  useEffect(() => {
    if (!loaded.current && initialRows.length) { dispatch({ type: 'load', rows: initialRows }); loaded.current = true; }
  }, [initialRows]);

  const nums = setNumbers(state.rows);

  async function commit(row: SetRow) {
    if (!row.dirty || !row.exerciseId || (row.reps === null && row.weightKg === null)) return;
    try {
      const dbId = await onCommitRow(row, nums.get(row.localId) ?? 1);
      dispatch({ type: 'markSaved', localId: row.localId, dbId });
      setErrors((e) => ({ ...e, [row.localId]: '' }));
    } catch (err) {
      setErrors((e) => ({ ...e, [row.localId]: (err as Error).message }));
    }
  }

  function numCell(row: SetRow, field: 'reps' | 'rpe', width: number) {
    return (
      <input inputMode="numeric" style={{ width }} defaultValue={row[field] ?? ''}
        onChange={(e) => dispatch({ type: 'editCell', localId: row.localId, field, value: { num: e.target.value ? Number(e.target.value) : null } })}
        onBlur={() => void commit(state.rows.find((r) => r.localId === row.localId)!)} />
    );
  }

  return (
    <div>
      <table style={{ width: '100%' }}>
        <thead>
          <tr style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--mut)', textAlign: 'left' }}>
            <th style={{ padding: 8 }}>Exercise</th><th>Set</th><th>Reps</th>
            <th>Weight ({units === 'imperial' ? 'lbs' : 'kg'})</th><th>RPE</th><th></th>
          </tr>
        </thead>
        <tbody>
          {state.rows.map((row) => (
            <tr key={row.localId} style={{ borderTop: 'var(--border-w) solid var(--line)' }}>
              <td style={{ padding: 8, minWidth: 240 }}><ExerciseCell row={row} dispatch={dispatch} onDone={() => void commit(row)} /></td>
              <td style={{ color: 'var(--mut)' }}>{nums.get(row.localId)}</td>
              <td>{numCell(row, 'reps', 64)}</td>
              <td>
                <input inputMode="decimal" style={{ width: 88 }}
                  defaultValue={row.weightKg === null ? '' : units === 'imperial' ? kgToLb(row.weightKg) : row.weightKg}
                  onChange={(e) => dispatch({ type: 'editCell', localId: row.localId, field: 'weightKg', value: { num: parseWeightInput(e.target.value, units) } })}
                  onBlur={() => void commit(state.rows.find((r) => r.localId === row.localId)!)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); dispatch({ type: 'duplicateLast' }); } }} />
              </td>
              <td>{numCell(row, 'rpe', 52)}</td>
              <td>
                <button aria-label="Delete set" style={{ background: 'transparent', border: 'none', color: 'var(--mut)', cursor: 'pointer', padding: 8 }}
                  onClick={() => { if (row.dbId) onDeleteRow(row.dbId); dispatch({ type: 'removeRow', localId: row.localId }); }}>✕</button>
                {row.dirty && <span title="Unsaved" style={{ color: 'var(--amber)' }}>●</span>}
                {errors[row.localId] && <span role="alert" style={{ color: 'var(--amber)', fontSize: 11, marginLeft: 6 }}>{errors[row.localId]}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={() => dispatch({ type: 'addRow' })} style={{ background: 'transparent', border: 'var(--border-w) solid var(--line)', padding: '8px 16px', textTransform: 'uppercase', fontSize: 12, cursor: 'pointer' }}>+ Set</button>
        <button onClick={() => dispatch({ type: 'duplicateLast' })} style={{ background: 'var(--amber)', color: '#000', border: 'none', padding: '8px 16px', textTransform: 'uppercase', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Duplicate last (⏎)</button>
      </div>
      <p style={{ color: 'var(--mut)', fontSize: 11, marginTop: 8 }}>Rows save on blur · {formatWeightKg(100, units)} = 100kg reference</p>
    </div>
  );
}

function ExerciseCell({ row, dispatch, onDone }: { row: SetRow; dispatch: React.Dispatch<Parameters<typeof gridReducer>[1]>; onDone: () => void }) {
  const [term, setTerm] = useState(row.exerciseName);
  const [open, setOpen] = useState(false);
  const search = useExerciseSearch(open ? term : '');
  return (
    <div style={{ position: 'relative' }}>
      <input value={term} placeholder="Search exercise…" style={{ width: '100%' }}
        onChange={(e) => { setTerm(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && (search.data?.length ?? 0) > 0 && (
        <ul style={{ position: 'absolute', zIndex: 10, listStyle: 'none', background: 'var(--panel)', border: 'var(--border-w) solid var(--line)', width: '100%' }}>
          {search.data!.map((ex) => (
            <li key={ex.id}>
              <button style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                onMouseDown={() => { setTerm(ex.name); setOpen(false);
                  dispatch({ type: 'editCell', localId: row.localId, field: 'exercise', value: { exerciseId: ex.id, exerciseName: ex.name } });
                  onDone(); }}>
                {ex.name}{ex.muscle_group ? <span style={{ color: 'var(--mut)' }}> · {ex.muscle_group}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: /log and /log/$workoutId routes**

`webapp/src/routes/_authed/log.tsx` (replace stub — new-workout launcher):
```tsx
import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCreateWorkout, useWeekSessions } from '../../features/log/queries';

export const Route = createFileRoute('/_authed/log')({ component: LogLauncher });

function LogLauncher() {
  const { userId } = Route.useRouteContext();
  const navigate = useNavigate();
  const create = useCreateWorkout(userId);
  const sessions = useWeekSessions(userId);
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [sessionId, setSessionId] = useState<string>('');

  async function start() {
    const w = await create.mutateAsync({ startedAt: new Date(startedAt).toISOString(), sessionId: sessionId || null });
    void navigate({ to: '/log/$workoutId', params: { workoutId: w.id } });
  }

  return (
    <section style={{ maxWidth: 520 }}>
      <h1 style={{ fontSize: 32, textTransform: 'uppercase', marginBottom: 24 }}>Log a lift</h1>
      <div style={{ border: 'var(--border-w) solid var(--line)', padding: 20, display: 'grid', gap: 14 }}>
        <label style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--mut)' }}>Started at
          <input type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} style={{ display: 'block', marginTop: 6 }} />
        </label>
        <label style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--mut)' }}>Link to plan session (optional)
          <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} style={{ display: 'block', marginTop: 6, minWidth: 280 }}>
            <option value="">— none —</option>
            {(sessions.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.session_date} · {s.session_type} · {s.description ?? ''}</option>
            ))}
          </select>
        </label>
        <button onClick={() => void start()} disabled={create.isPending}
          style={{ background: 'var(--amber)', color: '#000', fontWeight: 700, textTransform: 'uppercase', padding: '12px 0', border: 'none', cursor: 'pointer' }}>
          {create.isPending ? 'Creating…' : 'Start logging'}
        </button>
        {create.isError && <p role="alert" style={{ color: 'var(--amber)', fontSize: 13 }}>{(create.error as Error).message}</p>}
      </div>
    </section>
  );
}
```

`webapp/src/routes/_authed/log.$workoutId.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { useSets, useWorkout, useCommitSet, useDeleteSet, useUpdateWorkout } from '../../features/log/queries';
import { useUnits } from '../../features/settings/queries';
import { SetsGrid } from '../../features/grid/SetsGrid';
import { ErrorPanel } from '../../components/ErrorPanel';

export const Route = createFileRoute('/_authed/log/$workoutId')({ component: WorkoutEditor });

function WorkoutEditor() {
  const { workoutId } = Route.useParams();
  const { userId } = Route.useRouteContext();
  const workout = useWorkout(workoutId);
  const sets = useSets(workoutId);
  const units = useUnits(userId);
  const commit = useCommitSet(workoutId);
  const del = useDeleteSet(workoutId);
  const patch = useUpdateWorkout(workoutId);

  if (workout.isPending || sets.isPending || units.isPending) return <p style={{ color: 'var(--mut)' }}>Loading…</p>;
  if (workout.isError) return <ErrorPanel error={workout.error as Error} onRetry={() => void workout.refetch()} />;
  if (sets.isError) return <ErrorPanel error={sets.error as Error} onRetry={() => void sets.refetch()} />;

  return (
    <section style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 32, textTransform: 'uppercase', marginBottom: 4 }}>Lift · {new Date(workout.data.started_at).toLocaleDateString()}</h1>
      <p style={{ color: 'var(--mut)', marginBottom: 24 }}>Rows save when you leave a cell. Enter duplicates the last set.</p>
      <SetsGrid
        units={units.data ?? 'imperial'}
        initialRows={(sets.data ?? []).map((s) => ({ dbId: s.id, exerciseId: s.exercise_id, exerciseName: s.exercises?.name ?? '', reps: s.reps, weightKg: s.weight_kg, rpe: s.rpe }))}
        onCommitRow={async (row, setNumber) => (await commit.mutateAsync({ dbId: row.dbId, exerciseId: row.exerciseId!, setNumber, reps: row.reps, weightKg: row.weightKg, rpe: row.rpe })).dbId}
        onDeleteRow={(dbId) => del.mutate(dbId)}
      />
      <div style={{ marginTop: 28, borderTop: 'var(--border-w) solid var(--line)', paddingTop: 20, display: 'flex', gap: 20, alignItems: 'flex-end' }}>
        <label style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--mut)' }}>Effort 1–10
          <input inputMode="numeric" defaultValue={workout.data.perceived_effort ?? ''} style={{ display: 'block', width: 72, marginTop: 6 }}
            onBlur={(e) => { const n = Number(e.target.value); patch.mutate({ perceived_effort: e.target.value && n >= 1 && n <= 10 ? n : null }); }} />
        </label>
        <label style={{ flex: 1, fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--mut)' }}>Notes
          <input defaultValue={workout.data.notes ?? ''} style={{ display: 'block', width: '100%', marginTop: 6 }}
            onBlur={(e) => patch.mutate({ notes: e.target.value || null })} />
        </label>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Typecheck + live verify** — `npm run typecheck` → 0 errors. `npm run dev`; in the Browser pane: log in → `/log` → create a workout → add sets (search a real exercise, type reps/weight, blur) → reload the page → sets persist (incremental saves proven). Delete a set; confirm gone after reload.

- [ ] **Step 5: Commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add webapp/src
git commit -m "feat(webapp): strength logging with keyboard-first sets grid"
```

---

### Task 7: /history — table + detail

**Files:**
- Create: `webapp/src/features/history/queries.ts`, `webapp/src/routes/_authed/history.$workoutId.tsx`
- Modify: `webapp/src/routes/_authed/history.tsx` (replace stub)

**Interfaces:**
- Consumes: schemas, units, `useUnits`; for lift detail reuses `/log/$workoutId` (link, not duplicate UI).
- Produces: `useHistory(userId, { type, from, to, page })` → `{ rows: WorkoutLog[]; count: number }`, page size 50, ordered `started_at desc`, filtered `deleted_at IS NULL`. Query key: `['history', userId, type ?? 'all', from ?? '', to ?? '', page]`.

- [ ] **Step 1: Query**

`webapp/src/features/history/queries.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { WorkoutLogSchema, type WorkoutLog } from '../../lib/schemas';

export const PAGE_SIZE = 50;
export interface HistoryFilter { type: string | null; from: string | null; to: string | null; page: number; }

export function useHistory(userId: string, f: HistoryFilter) {
  return useQuery({
    queryKey: ['history', userId, f.type ?? 'all', f.from ?? '', f.to ?? '', f.page],
    queryFn: async (): Promise<{ rows: WorkoutLog[]; count: number }> => {
      let q = supabase.from('workout_logs').select('*', { count: 'exact' })
        .eq('user_id', userId).is('deleted_at', null)
        .order('started_at', { ascending: false })
        .range(f.page * PAGE_SIZE, f.page * PAGE_SIZE + PAGE_SIZE - 1);
      if (f.type) q = q.eq('session_type', f.type);
      if (f.from) q = q.gte('started_at', `${f.from}T00:00:00Z`);
      if (f.to) q = q.lte('started_at', `${f.to}T23:59:59Z`);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: z.array(WorkoutLogSchema).parse(data), count: count ?? 0 };
    },
  });
}
```

- [ ] **Step 2: History page**

`webapp/src/routes/_authed/history.tsx` (replace stub):
```tsx
import { useState } from 'react';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useHistory, PAGE_SIZE } from '../../features/history/queries';
import { SessionTypeEnum } from '../../lib/schemas';
import { ErrorPanel } from '../../components/ErrorPanel';

export const Route = createFileRoute('/_authed/history')({ component: HistoryPage });

function HistoryPage() {
  const { userId } = Route.useRouteContext();
  const [type, setType] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const q = useHistory(userId, { type, from, to, page });

  const fmtDur = (s: number | null) => (s === null ? '—' : `${Math.floor(s / 60)}m`);

  return (
    <section>
      <h1 style={{ fontSize: 32, textTransform: 'uppercase', marginBottom: 20 }}>History</h1>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <select value={type ?? ''} onChange={(e) => { setType(e.target.value || null); setPage(0); }}>
          <option value="">All types</option>
          {SessionTypeEnum.options.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="date" value={from ?? ''} onChange={(e) => { setFrom(e.target.value || null); setPage(0); }} />
        <input type="date" value={to ?? ''} onChange={(e) => { setTo(e.target.value || null); setPage(0); }} />
      </div>
      {q.isError && <ErrorPanel error={q.error as Error} onRetry={() => void q.refetch()} />}
      {q.isPending && <p style={{ color: 'var(--mut)' }}>Loading…</p>}
      {q.data && (
        <>
          <table style={{ width: '100%' }}>
            <thead>
              <tr style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--mut)', textAlign: 'left' }}>
                <th style={{ padding: 8 }}>Date</th><th>Type</th><th>Duration</th><th>Distance</th><th>Effort</th><th>TSS</th>
              </tr>
            </thead>
            <tbody>
              {q.data.rows.map((w) => (
                <tr key={w.id} style={{ borderTop: 'var(--border-w) solid var(--line)' }}>
                  <td style={{ padding: 8 }}>
                    <Link to="/history/$workoutId" params={{ workoutId: w.id }} style={{ color: 'var(--amber)' }}>
                      {new Date(w.started_at).toLocaleDateString()}
                    </Link>
                  </td>
                  <td style={{ textTransform: 'uppercase', fontSize: 12 }}>{w.session_type}</td>
                  <td>{fmtDur(w.total_duration_s)}</td>
                  <td>{w.total_distance_km === null ? '—' : `${w.total_distance_km} km`}</td>
                  <td>{w.perceived_effort ?? '—'}</td>
                  <td>{w.tss ?? '—'}</td>
                </tr>
              ))}
              {q.data.rows.length === 0 && <tr><td colSpan={6} style={{ padding: 20, color: 'var(--mut)' }}>No workouts match.</td></tr>}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, alignItems: 'center' }}>
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} style={{ padding: '6px 14px', background: 'transparent', border: 'var(--border-w) solid var(--line)', cursor: 'pointer' }}>‹ Prev</button>
            <span style={{ color: 'var(--mut)', fontSize: 12 }}>Page {page + 1} of {Math.max(1, Math.ceil(q.data.count / PAGE_SIZE))}</span>
            <button disabled={(page + 1) * PAGE_SIZE >= q.data.count} onClick={() => setPage((p) => p + 1)} style={{ padding: '6px 14px', background: 'transparent', border: 'var(--border-w) solid var(--line)', cursor: 'pointer' }}>Next ›</button>
          </div>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Detail route** — `webapp/src/routes/_authed/history.$workoutId.tsx`:
```tsx
import { Link, createFileRoute } from '@tanstack/react-router';
import { useWorkout, useSets } from '../../features/log/queries';
import { useUnits } from '../../features/settings/queries';
import { formatWeightKg } from '../../lib/units';
import { ErrorPanel } from '../../components/ErrorPanel';

export const Route = createFileRoute('/_authed/history/$workoutId')({ component: WorkoutDetail });

function WorkoutDetail() {
  const { workoutId } = Route.useParams();
  const { userId } = Route.useRouteContext();
  const workout = useWorkout(workoutId);
  const sets = useSets(workoutId);
  const units = useUnits(userId);

  if (workout.isPending) return <p style={{ color: 'var(--mut)' }}>Loading…</p>;
  if (workout.isError) return <ErrorPanel error={workout.error as Error} onRetry={() => void workout.refetch()} />;
  const w = workout.data;

  return (
    <section style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: 32, textTransform: 'uppercase', marginBottom: 4 }}>{w.session_type} · {new Date(w.started_at).toLocaleDateString()}</h1>
      <p style={{ color: 'var(--mut)', marginBottom: 20 }}>
        {w.total_duration_s ? `${Math.floor(w.total_duration_s / 60)} min` : ''} {w.total_distance_km ? ` · ${w.total_distance_km} km` : ''} {w.perceived_effort ? ` · effort ${w.perceived_effort}/10` : ''}
      </p>
      {w.session_type === 'lift' && (
        <>
          <table style={{ width: '100%', marginBottom: 16 }}>
            <thead><tr style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--mut)', textAlign: 'left' }}>
              <th style={{ padding: 8 }}>Exercise</th><th>Set</th><th>Reps</th><th>Weight</th><th>RPE</th></tr></thead>
            <tbody>
              {(sets.data ?? []).map((s) => (
                <tr key={s.id} style={{ borderTop: 'var(--border-w) solid var(--line)' }}>
                  <td style={{ padding: 8 }}>{s.exercises?.name ?? '—'}</td><td>{s.set_number}</td><td>{s.reps ?? '—'}</td>
                  <td>{s.weight_kg === null ? '—' : formatWeightKg(s.weight_kg, units.data ?? 'imperial')}</td><td>{s.rpe ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Link to="/log/$workoutId" params={{ workoutId }} style={{ color: 'var(--amber)', textDecoration: 'underline' }}>Edit this workout</Link>
        </>
      )}
      {w.notes && <p style={{ marginTop: 16, color: 'var(--text-soft)' }}>{w.notes}</p>}
    </section>
  );
}
```

- [ ] **Step 4: Typecheck + live verify** — `npm run typecheck`; browser: `/history` lists the Task 6 workout (and any phone-logged workouts), filters narrow it, detail shows sets in display units, "Edit this workout" opens the grid.

- [ ] **Step 5: Commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add webapp/src
git commit -m "feat(webapp): workout history table and detail"
```

---

### Task 8: /calendar — month/week plan view with side detail pane

**Files:**
- Create: `webapp/src/features/calendar/queries.ts`
- Modify: `webapp/src/routes/_authed/calendar.tsx` (replace stub)

**Interfaces:**
- Consumes: `TrainingSessionSchema`, `WorkoutLogSchema`.
- Produces: `useMonthSessions(userId, monthStartISO, monthEndISO)` → `TrainingSession[]`; `useCompletions(userId, fromISO, toISO)` → `Set<string>` of completed `session_id`s. Query keys: `['sessions', userId, monthStartISO]`, `['completions', userId, monthStartISO]`.

- [ ] **Step 1: Queries**

`webapp/src/features/calendar/queries.ts`:
```ts
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { TrainingSessionSchema } from '../../lib/schemas';

export function useMonthSessions(userId: string, fromISO: string, toISO: string) {
  return useQuery({
    queryKey: ['sessions', userId, fromISO],
    queryFn: async () => {
      const { data, error } = await supabase.from('training_sessions').select('*')
        .eq('user_id', userId).gte('session_date', fromISO).lte('session_date', toISO).order('session_date');
      if (error) throw error;
      return z.array(TrainingSessionSchema).parse(data);
    },
  });
}

export function useCompletions(userId: string, fromISO: string, toISO: string) {
  return useQuery({
    queryKey: ['completions', userId, fromISO],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from('workout_logs').select('session_id')
        .eq('user_id', userId).eq('status', 'completed').is('deleted_at', null)
        .not('session_id', 'is', null)
        .gte('started_at', `${fromISO}T00:00:00Z`).lte('started_at', `${toISO}T23:59:59Z`);
      if (error) throw error;
      return new Set((data as Array<{ session_id: string }>).map((r) => r.session_id));
    },
  });
}
```

- [ ] **Step 2: Calendar page**

`webapp/src/routes/_authed/calendar.tsx` (replace stub):
```tsx
import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useMonthSessions, useCompletions } from '../../features/calendar/queries';
import type { TrainingSession } from '../../lib/schemas';
import { ErrorPanel } from '../../components/ErrorPanel';

export const Route = createFileRoute('/_authed/calendar')({ component: CalendarPage });

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

function CalendarPage() {
  const { userId } = Route.useRouteContext();
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState<TrainingSession | null>(null);
  const { fromISO, toISO, cells } = useMemo(() => monthRange(anchor), [anchor]);
  const sessions = useMonthSessions(userId, fromISO, toISO);
  const completions = useCompletions(userId, fromISO, toISO);

  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const byDate = useMemo(() => {
    const m = new Map<string, TrainingSession[]>();
    for (const s of sessions.data ?? []) { const arr = m.get(s.session_date) ?? []; arr.push(s); m.set(s.session_date, arr); }
    return m;
  }, [sessions.data]);

  if (sessions.isError) return <ErrorPanel error={sessions.error as Error} onRetry={() => void sessions.refetch()} />;

  return (
    <div style={{ display: 'flex', gap: 24 }}>
      <section style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <h1 style={{ fontSize: 32, textTransform: 'uppercase', flex: 1 }}>
            {anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h1>
          <button onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))} style={{ padding: '6px 14px', background: 'transparent', border: 'var(--border-w) solid var(--line)', cursor: 'pointer' }}>‹</button>
          <button onClick={() => setAnchor(new Date())} style={{ padding: '6px 14px', background: 'transparent', border: 'var(--border-w) solid var(--line)', cursor: 'pointer', textTransform: 'uppercase', fontSize: 12 }}>Today</button>
          <button onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))} style={{ padding: '6px 14px', background: 'transparent', border: 'var(--border-w) solid var(--line)', cursor: 'pointer' }}>›</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', border: 'var(--border-w) solid var(--line)' }}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} style={{ padding: 8, fontSize: 10, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--mut)', borderBottom: 'var(--border-w) solid var(--line)' }}>{d}</div>
          ))}
          {cells.map((d) => {
            const dISO = iso(d);
            const inMonth = d.getMonth() === anchor.getMonth();
            const daySessions = byDate.get(dISO) ?? [];
            return (
              <div key={dISO} style={{ minHeight: 96, padding: 6, borderBottom: '1px solid var(--line)', borderRight: '1px solid var(--line)', opacity: inMonth ? 1 : 0.35 }}>
                <div style={{ fontSize: 11, color: 'var(--mut)', marginBottom: 4 }}>{d.getDate()}</div>
                {daySessions.map((s) => (
                  <button key={s.id} onClick={() => setSelected(s)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 3, padding: '3px 6px', fontSize: 11,
                      background: selected?.id === s.id ? 'var(--amber)' : 'var(--panel)',
                      color: selected?.id === s.id ? '#000' : INTENSITY_COLOR[s.intensity] ?? 'var(--text)',
                      border: '1px solid var(--line)', cursor: 'pointer', textTransform: 'uppercase' }}>
                    {completions.data?.has(s.id) ? '✓ ' : ''}{s.session_type}{s.planned_minutes ? ` · ${s.planned_minutes}m` : ''}{s.planned_distance_km ? ` · ${s.planned_distance_km}k` : ''}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </section>
      <aside style={{ width: 320, borderLeft: 'var(--border-w) solid var(--line)', paddingLeft: 24 }}>
        {selected ? (
          <>
            <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--amber)', marginBottom: 6 }}>{selected.session_date} · {selected.intensity}</p>
            <h2 style={{ fontSize: 22, textTransform: 'uppercase', marginBottom: 12 }}>{selected.session_type}{completions.data?.has(selected.id) ? ' · done ✓' : ''}</h2>
            {selected.description && <p style={{ color: 'var(--text-soft)', fontSize: 14, lineHeight: 1.55, marginBottom: 14 }}>{selected.description}</p>}
            {selected.ozzie_notes && (
              <div style={{ borderTop: 'var(--border-w) solid var(--line)', paddingTop: 14 }}>
                <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: 'var(--amber)', marginBottom: 6 }}>Ozzie</p>
                <p style={{ color: 'var(--text-soft)', fontSize: 14, lineHeight: 1.55 }}>{selected.ozzie_notes}</p>
              </div>
            )}
          </>
        ) : (
          <p style={{ color: 'var(--mut)', fontSize: 13 }}>Select a session to see details.</p>
        )}
      </aside>
    </div>
  );
}
```
(The spec's month/week toggle is satisfied by the month grid + the `/log` week picker; a dedicated week strip is cut as YAGNI for a single user — noted as an accepted scope trim, revisit in Phase 4.)

- [ ] **Step 3: Typecheck + live verify** — `npm run typecheck`; browser: `/calendar` shows the active plan's sessions in the right cells, intensity colors differ, clicking a session fills the side pane (description + Ozzie notes), sessions completed via linked logs show ✓, month nav works.

- [ ] **Step 4: Commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add webapp/src
git commit -m "feat(webapp): training calendar with side detail pane"
```

---

### Task 9: Final verification pass

**Files:**
- Modify: anything a check below flags; Create: `webapp/README.md`; Modify: repo root `CLAUDE.md` (repo-layout line)

**Interfaces:** none (verification task).

- [ ] **Step 1: Full local gates** — from `webapp/`: `npm test` (all suites green), `npm run typecheck` (0 errors), `npm run build` (succeeds).
- [ ] **Step 2: Browser walkthrough** (dev server + Browser pane, real account):
  1. Sign out → guard redirects `/calendar` → `/login`. Sign back in.
  2. `/calendar`: current month renders plan; select session → pane; ✓ marks correct.
  3. `/log`: create lift linked to a plan session → add 3 sets (typeahead, duplicate-last via Enter, blur-save) → reload → all persist → `/calendar` now shows ✓ on that session.
  4. `/history`: new workout on top; filter type=lift; open detail; weights match units setting; edit link round-trips.
  5. `/settings`: toggle metric → `/history` detail shows kg; toggle back.
  6. Keyboard-only pass over the grid (Tab order sane, focus visible).
  7. Console: no errors on any page.
- [ ] **Step 3: Docs** — `webapp/README.md`: one-paragraph purpose, `npm install && npm run dev`, `.env.local` setup (MCP or dashboard), phase roadmap pointer to the spec. Append to root `CLAUDE.md` repo-layout section: `- webapp/ — authenticated web companion app (Vite/React, see docs/superpowers/specs/2026-07-12-osprey-webapp-phase1-design.md)`.
- [ ] **Step 4: Fix anything found, then commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add -A webapp CLAUDE.md
git commit -m "chore(webapp): phase 1 verification pass and docs"
```

---

## Self-Review

**Spec coverage:** §2 architecture → Tasks 1, 3 (SPA, router, query, pure client). §3 auth/gate zero → Task 3 (hard user checkpoint + Apple fallback documented). §4 design language → Task 1 tokens/global + brutalist styling throughout. §5.1 login → Task 3; §5.2 calendar + side pane + completion marks + read-only → Task 8; §5.3 log (lift enum, incremental blur-saves, typeahead, duplicate-last, units conversion, effort/notes) → Tasks 5–6; §5.4 history (filters, pagination, detail, edit reuse) → Task 7; §5.5 settings/units → Task 4. §6 data layer (query keys, zod at boundary, error panels, soft-delete filters) → Tasks 2, 4, 6, 7, 8. §7 testing (units, schemas, reducer as pure state machine) → Tasks 2, 5. §8 out-of-scope respected (no deploy, no nutrition/Ozzie, no maps). §9 risks: enum drift killed by pinned enums (Task 2 test asserts them); RLS smoke early (Task 4); Apple-only fallback (Task 3); grid kept plain (Task 5–6, no virtualization). Deviation noted inline: week-strip toggle trimmed (Task 8 note) — flagged for the user rather than silently dropped.

**Placeholder scan:** all steps carry complete code/commands; the only intentionally open values are the two env secrets (fetched at execution via Supabase MCP/dashboard, never committed).

**Type consistency:** `SetRow`/`GridState`/`gridReducer`/`setNumbers`/`dirtyCompleteRows` names match between Task 5 and Task 6 usage; `useUnits` (Task 4) consumed in Tasks 6–7; `useWorkout`/`useSets` defined in Task 6, reused in Task 7 detail; `UnitSystem` from `lib/units` used consistently; `Route.useRouteContext()` `{ userId }` provided by `_authed.beforeLoad` (Task 3) and consumed in Tasks 4/6/7/8.
