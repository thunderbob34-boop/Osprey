# Webapp Ozzie Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A grounded, streaming coaching chat at `/chat` in the webapp, with saved threads.

**Architecture:** Three layers. (1) A migration adds `ozzie_conversations` + `ozzie_messages`. (2) A new edge function `ozzie-chat` authenticates the caller, loads their real training context, calls gpt-4o-mini with `stream: true`, pipes tokens to the browser as SSE, and persists both turns server-side. (3) The webapp gets a `/chat` page: thread list, message list, composer, and a streaming `fetch` client. All pure logic (prompt building, SSE parsing, title derivation) lives outside the impure handler/page so it is unit-tested.

**Tech Stack:** Postgres/Supabase (migration, RLS, grants); Deno + `jsr:@supabase/supabase-js@2` (edge, `Deno.test` + `https://deno.land/std@0.224.0/assert/mod.ts`); Vite/React + TanStack Router/Query + Zod + vitest (webapp).

**Spec:** `docs/superpowers/specs/2026-07-17-webapp-ozzie-chat-design.md`

## Global Constraints

- **CORS is mandatory on the edge function.** Six of the eight Ozzie functions omit CORS because React Native doesn't enforce it — the obvious template (`ozzie-nutrition-coach`) has none. A browser preflights any request with an `Authorization` header. Copy the pattern from `supabase/functions/ozzie-race-briefing/index.ts:75-82`. Every response — including 401/404/500 — carries `Access-Control-Allow-Origin: *`.
- **The edge function uses the SERVICE-ROLE client** (`createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`) and authenticates the caller separately via `supabase.auth.getUser(token)`. This is the house pattern in all 8 functions. **RLS therefore does not constrain the function**: every query MUST be scoped by hand with `.eq('user_id', userId)`.
- **NEVER select `goal_params`.** Verified against the live schema 2026-07-17: `user_goals` in production has `id, user_id, primary_goal, target_race, target_date, weekly_run_days, weekly_lift_days, fitness_level, created_at, updated_at, total_weeks_planned, threshold_anchor` — and **no `goal_params`** (it ships in the pending, undeployed coaching bundle). Selecting it would 400 every chat call. `total_weeks_planned` and `threshold_anchor` ARE deployed and safe.
- **Model + key handling:** `model: 'gpt-4o-mini'`, `Authorization: Bearer ${Deno.env.get('OPENAI_API_KEY')}` — matching every other Ozzie function. The key never leaves the server.
- **Bounds (exact):** thread cap **20** messages; recent logs cap **10**; composer max **2000** characters; title max **48** characters.
- **Copy rule (CLAUDE.md):** user-visible coaching copy stays athlete-facing and plain-language.
- **Test commands:** edge → `deno test supabase/functions/ozzie-chat/`; webapp → `cd webapp && npm test` (vitest, `TZ=America/New_York` from package.json), `npm run typecheck`, `npm run build`.
- **Existing 118 webapp tests stay green.** No existing file's behavior changes except `NavRail.tsx` (one added link).
- **No new CSS rules.** Reuse existing `app.css` classes (`.page`, `.page-head`, `.ozzie-note`, `.btn`, `.detail-card`, `.rail-link`, `.error-panel`, `.muted` — all verified present); inline styles are fine for chat-specific layout.
- **This branch is not deployable by itself.** The migration + function are additive and independent of the held coaching bundle, but chat stays dark until they are applied. Do not apply them.

---

### Task 1: Migration — conversation + message tables

**Files:**
- Create: `supabase/migrations/20260717000001_ozzie_chat_threads.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: tables `ozzie_conversations(id, user_id, title, created_at, updated_at)` and `ozzie_messages(id, conversation_id, user_id, role, content, created_at)`; RLS policies `ozzie_conversations_self` / `ozzie_messages_self`; grants used by Tasks 4-7.

**Context:** Least-privilege grants are deliberate. The edge function writes as service-role and needs no grant at all, so `authenticated` gets only what the browser does directly: list/start threads and read messages. The client never writes a message — the function does.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260717000001_ozzie_chat_threads.sql`:

```sql
-- 20260717000001_ozzie_chat_threads.sql
-- Ozzie chat (webapp): saved conversation threads.
--
-- The ozzie-chat edge function writes BOTH turns with the service-role key (the
-- house pattern — see ozzie-nutrition-coach/index.ts:300), so it needs no grant
-- here. `authenticated` gets only what the browser does directly: list and start
-- threads, and read their messages.
--
-- Additive and independent of the pending coaching deploy bundle: no existing
-- table, enum, view, or function is touched.

CREATE TABLE ozzie_conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- The thread list is always "mine, newest activity first".
CREATE INDEX idx_ozzie_conversations_user ON ozzie_conversations(user_id, updated_at DESC);

CREATE TABLE ozzie_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ozzie_conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Reading a thread is always "this conversation, oldest first".
CREATE INDEX idx_ozzie_messages_conversation ON ozzie_messages(conversation_id, created_at);

ALTER TABLE ozzie_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ozzie_messages ENABLE ROW LEVEL SECURITY;

-- user_id is denormalised onto ozzie_messages so its policy is the same simple
-- self-check every other table uses, rather than a join through the parent.
-- FOR ALL by default; an omitted WITH CHECK reuses the USING expression, so one
-- policy covers the client's reads and its INSERT (precedent: user_recipes_self
-- in 20260713000002_recipes_and_web_nutrition_grants.sql).
CREATE POLICY ozzie_conversations_self ON ozzie_conversations
  USING (user_id = auth.uid());

CREATE POLICY ozzie_messages_self ON ozzie_messages
  USING (user_id = auth.uid());

-- RLS restricts rows; it does not substitute for base grants (see
-- 20260712000033_exercise_sets_write_grants.sql for the precedent).
GRANT SELECT, INSERT ON ozzie_conversations TO authenticated;
GRANT SELECT ON ozzie_messages TO authenticated;

-- TRUNCATE is not governed by RLS. New tables inherit Postgres's default
-- "grant all on create" TRUNCATE for anon/authenticated; revoke it to match the
-- convention established in 20260710000032_revoke_truncate_grants.sql.
REVOKE TRUNCATE ON ozzie_conversations, ozzie_messages FROM anon, authenticated;
```

- [ ] **Step 2: Verify it is not applied**

Run: `git status --short supabase/migrations/`
Expected: the new file shows as untracked/added. **Do NOT apply this migration** — the launch is held and the deploy is a separate, explicit step.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260717000001_ozzie_chat_threads.sql
git commit -m "feat(db): ozzie chat conversation + message tables"
```

---

### Task 2: Edge — pure context + prompt builders

**Files:**
- Create: `supabase/functions/ozzie-chat/context.ts`
- Test: `supabase/functions/ozzie-chat/context.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces, for Task 4:
  - `interface ChatSession { sessionDate: string; sessionType: string; intensity: string | null; plannedMinutes: number | null; plannedDistanceKm: number | null }`
  - `interface ChatLog { startedAt: string; sessionType: string; distanceKm: number | null; durationS: number | null; perceivedEffort: number | null }`
  - `type RacePhaseName = 'Base' | 'Build' | 'Peak' | 'Taper'`
  - `interface RacePhaseInfo { weeksRemaining: number; currentWeekNumber: number; totalWeeks: number; phase: RacePhaseName }`
  - `interface ChatContext { displayName: string; primaryGoal: string | null; targetRace: string | null; targetDate: string | null; totalWeeksPlanned: number | null; thresholdAnchor: Record<string, unknown> | null; phase: RacePhaseInfo | null; recoveryScore: number | null; tsb: number | null; weekSessions: ChatSession[]; recentLogs: ChatLog[] }`
  - `interface ThreadMessage { role: 'user' | 'assistant'; content: string }`
  - `const THREAD_MESSAGE_CAP = 20`, `const RECENT_LOG_CAP = 10`
  - `function weekBounds(clientDate: string): { mondayISO: string; sundayISO: string }`
  - `function computeRacePhase(targetDate: string | null, totalWeeksPlanned: number | null, clientDate: string): RacePhaseInfo | null`
  - `function mapThread(rows: { role: string; content: string }[]): ThreadMessage[]`
  - `function buildSystemPrompt(ctx: ChatContext): string`

**Context:** These are the function's testable parts, kept out of `index.ts` exactly as `ozzie-generate-plan` keeps `validate.ts` out of its handler. `mapThread` receives rows **newest-first** (the query orders DESC and LIMITs so a long thread isn't fetched whole) and returns them **oldest-first** for the model.

`computeRacePhase` is a port of `webapp/src/lib/race-phase.ts::computeRacePhase` (itself a port of `OSPREY-app/src/services/plan.ts`). **Copy the thresholds exactly** — Taper when `weeksRemaining <= taperWeeks` (`totalWeeks <= 6 ? 1 : totalWeeks <= 10 ? 2 : 3`), then Base at `progress <= 0.4`, Build at `<= 0.75`, else Peak — so all three surfaces agree on what phase an athlete is in. The only adaptation: "today" comes from the athlete's `clientDate`, since the edge runtime has no local clock. Without this, Ozzie cannot say "you're in Build, week 8 of 16" — which is exactly the grounding the design promises.

- [ ] **Step 1: Write the failing tests**

Create `supabase/functions/ozzie-chat/context.test.ts`:

```ts
// supabase/functions/ozzie-chat/context.test.ts
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { weekBounds, computeRacePhase, mapThread, buildSystemPrompt, type ChatContext } from './context.ts';

const ctx: ChatContext = {
  displayName: 'Priya',
  primaryGoal: 'run',
  targetRace: 'Chicago Marathon',
  targetDate: '2026-09-18',
  totalWeeksPlanned: 16,
  thresholdAnchor: { kind: 'run', thresholdSecPerMile: 450 },
  phase: { weeksRemaining: 9, currentWeekNumber: 8, totalWeeks: 16, phase: 'Build' },
  recoveryScore: 72,
  tsb: 5.5,
  weekSessions: [
    { sessionDate: '2026-07-14', sessionType: 'run', intensity: 'intervals', plannedMinutes: 50, plannedDistanceKm: 10 },
  ],
  recentLogs: [
    { startedAt: '2026-07-13T12:00:00Z', sessionType: 'run', distanceKm: 21.1, durationS: 6600, perceivedEffort: 7 },
  ],
};

Deno.test('weekBounds returns Monday..Sunday for a midweek date', () => {
  // 2026-07-17 is a Friday.
  assertEquals(weekBounds('2026-07-17'), { mondayISO: '2026-07-13', sundayISO: '2026-07-19' });
});

Deno.test('weekBounds treats Sunday as the END of its week, not the start', () => {
  assertEquals(weekBounds('2026-07-19'), { mondayISO: '2026-07-13', sundayISO: '2026-07-19' });
});

Deno.test('weekBounds on a Monday returns that Monday', () => {
  assertEquals(weekBounds('2026-07-13'), { mondayISO: '2026-07-13', sundayISO: '2026-07-19' });
});

Deno.test('computeRacePhase reads Build in the middle of a 16-week block', () => {
  // Race 2026-09-18 is 63 days (9 weeks) after 2026-07-17 → week 8 of 16 → 50% → Build.
  assertEquals(computeRacePhase('2026-09-18', 16, '2026-07-17'), {
    weeksRemaining: 9, currentWeekNumber: 8, totalWeeks: 16, phase: 'Build',
  });
});

Deno.test('computeRacePhase reads Base early in the block', () => {
  // Race 2026-10-11 is 86 days (ceil → 13 weeks) out → week 4 of 16 → 25% → Base.
  assertEquals(computeRacePhase('2026-10-11', 16, '2026-07-17')?.phase, 'Base');
});

Deno.test('computeRacePhase reads Taper inside the final weeks', () => {
  // Race 2026-08-07 is 21 days (3 weeks) out; a 16-week block tapers for 3.
  const p = computeRacePhase('2026-08-07', 16, '2026-07-17');
  assertEquals(p?.weeksRemaining, 3);
  assertEquals(p?.phase, 'Taper');
});

Deno.test('computeRacePhase returns null without a date or a plan length', () => {
  assertEquals(computeRacePhase(null, 16, '2026-07-17'), null);
  assertEquals(computeRacePhase('2026-09-18', null, '2026-07-17'), null);
});

Deno.test('mapThread reverses newest-first rows into oldest-first messages', () => {
  const rows = [
    { role: 'assistant', content: 'second' },
    { role: 'user', content: 'first' },
  ];
  assertEquals(mapThread(rows), [
    { role: 'user', content: 'first' },
    { role: 'assistant', content: 'second' },
  ]);
});

Deno.test('mapThread drops rows with an unrecognised role', () => {
  const rows = [{ role: 'system', content: 'injected' }, { role: 'user', content: 'real' }];
  assertEquals(mapThread(rows), [{ role: 'user', content: 'real' }]);
});

Deno.test('system prompt grounds Ozzie in the athlete real data', () => {
  const p = buildSystemPrompt(ctx);
  assert(p.includes('Priya'), 'names the athlete');
  assert(p.includes('Chicago Marathon'), 'includes the target race');
  assert(p.includes('intervals'), 'includes this week session detail');
  assert(p.includes('Build'), 'includes the training phase');
  assert(p.includes('450'), 'includes the threshold anchor the zones come from');
});

Deno.test('system prompt carries the injury safety line', () => {
  const p = buildSystemPrompt(ctx);
  assert(/doctor|physio/i.test(p), 'points at a professional');
  assert(/never diagnose/i.test(p), 'forbids diagnosing');
});

Deno.test('system prompt says advice-not-action', () => {
  const p = buildSystemPrompt(ctx);
  assert(/calendar/i.test(p), 'directs plan edits to the calendar');
});

Deno.test('system prompt survives an athlete with no plan at all', () => {
  const empty: ChatContext = {
    displayName: 'there', primaryGoal: null, targetRace: null, targetDate: null,
    totalWeeksPlanned: null, thresholdAnchor: null, phase: null,
    recoveryScore: null, tsb: null, weekSessions: [], recentLogs: [],
  };
  const p = buildSystemPrompt(empty);
  assert(p.length > 0);
  assert(/don't have|nothing/i.test(p), 'tells Ozzie the data is thin instead of inviting invention');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test supabase/functions/ozzie-chat/`
Expected: FAIL — `Module not found "./context.ts"`.

- [ ] **Step 3: Write the implementation**

Create `supabase/functions/ozzie-chat/context.ts`:

```ts
// supabase/functions/ozzie-chat/context.ts
// Pure builders for ozzie-chat. Nothing here touches the network or the
// database, so it is all unit-testable — index.ts does the impure reads and
// calls these. (Same split as ozzie-generate-plan's index.ts / validate.ts.)

export interface ChatSession {
  sessionDate: string;
  sessionType: string;
  intensity: string | null;
  plannedMinutes: number | null;
  plannedDistanceKm: number | null;
}

export interface ChatLog {
  startedAt: string;
  sessionType: string;
  distanceKm: number | null;
  durationS: number | null;
  perceivedEffort: number | null;
}

export type RacePhaseName = 'Base' | 'Build' | 'Peak' | 'Taper';

export interface RacePhaseInfo {
  weeksRemaining: number;
  currentWeekNumber: number;
  totalWeeks: number;
  phase: RacePhaseName;
}

export interface ChatContext {
  displayName: string;
  primaryGoal: string | null;
  targetRace: string | null;
  targetDate: string | null;
  totalWeeksPlanned: number | null;
  /** The zone anchor the athlete's paces/powers are derived from. */
  thresholdAnchor: Record<string, unknown> | null;
  phase: RacePhaseInfo | null;
  recoveryScore: number | null;
  tsb: number | null;
  weekSessions: ChatSession[];
  recentLogs: ChatLog[];
}

export interface ThreadMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** How many past messages ride along as conversation memory (10 exchanges). */
export const THREAD_MESSAGE_CAP = 20;

/** How many recent workouts Ozzie can see. */
export const RECENT_LOG_CAP = 10;

/**
 * Monday..Sunday around the athlete's LOCAL date, which the client sends: the
 * edge runtime has no idea what day it is where the athlete lives. Parsed as
 * UTC so the runtime's own timezone can't shift the arithmetic.
 */
export function weekBounds(clientDate: string): { mondayISO: string; sundayISO: string } {
  const d = new Date(`${clientDate}T00:00:00Z`);
  const lead = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  const monday = new Date(d.getTime() - lead * 86_400_000);
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  return {
    mondayISO: monday.toISOString().slice(0, 10),
    sundayISO: sunday.toISOString().slice(0, 10),
  };
}

/**
 * Ported from webapp/src/lib/race-phase.ts::computeRacePhase, itself a port of
 * OSPREY-app/src/services/plan.ts. Keep the thresholds in sync with both — all
 * three surfaces must agree on what phase an athlete is in.
 *
 * Adapted for the edge: "today" is the athlete's local date (clientDate), since
 * the runtime has no idea what day it is where they live.
 */
export function computeRacePhase(
  targetDate: string | null,
  totalWeeksPlanned: number | null,
  clientDate: string,
): RacePhaseInfo | null {
  if (!targetDate || !totalWeeksPlanned) return null;

  const today = new Date(`${clientDate}T00:00:00Z`);
  const raceDate = new Date(`${targetDate}T00:00:00Z`);
  if (isNaN(today.getTime()) || isNaN(raceDate.getTime())) return null;

  const msPerWeek = 7 * 86_400_000;
  const weeksRemaining = Math.max(0, Math.ceil((raceDate.getTime() - today.getTime()) / msPerWeek));
  const totalWeeks = totalWeeksPlanned;
  const currentWeekNumber = Math.min(totalWeeks, Math.max(1, totalWeeks - weeksRemaining + 1));
  const progress = currentWeekNumber / totalWeeks;
  const taperWeeks = totalWeeks <= 6 ? 1 : totalWeeks <= 10 ? 2 : 3;

  let phase: RacePhaseName;
  if (weeksRemaining <= taperWeeks) phase = 'Taper';
  else if (progress <= 0.4) phase = 'Base';
  else if (progress <= 0.75) phase = 'Build';
  else phase = 'Peak';

  return { weeksRemaining, currentWeekNumber, totalWeeks, phase };
}

/**
 * Rows arrive newest-first (the query orders DESC + LIMITs, so a long thread
 * isn't fetched whole); the model needs them oldest-first. Anything that isn't
 * a user/assistant turn is dropped rather than trusted.
 */
export function mapThread(rows: { role: string; content: string }[]): ThreadMessage[] {
  return rows
    .filter((r) => r.role === 'user' || r.role === 'assistant')
    .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }))
    .reverse();
}

export function buildSystemPrompt(ctx: ChatContext): string {
  const hasPlan = ctx.weekSessions.length > 0 || ctx.primaryGoal != null;

  return `You are Ozzie, the AI coach inside the OSPREY fitness app. Your voice is modeled after the spirit of Kronk from The Emperor's New Groove: enthusiastic, warm, slightly goofy, genuinely kind, and unexpectedly wise. You celebrate hard things without being sycophantic.

You are having a two-way conversation with ${ctx.displayName} about their training. Here is everything you know about them right now:

${JSON.stringify(
  {
    goal: ctx.primaryGoal,
    targetRace: ctx.targetRace,
    targetDate: ctx.targetDate,
    phase: ctx.phase,
    zonesAnchor: ctx.thresholdAnchor,
    recoveryScore: ctx.recoveryScore,
    formTSB: ctx.tsb,
    thisWeek: ctx.weekSessions,
    recentWorkouts: ctx.recentLogs,
  },
  null,
  2,
)}

Rules:
- Ground every answer in the data above. Name their actual session, distance, intensity, or number. Never invent a workout, a pace, or a number that isn't there.
${hasPlan ? '' : "- Their plan data is thin or empty right now. Say you don't have their plan in front of you and answer generally — do not invent one.\n"}- Keep answers short: 2-4 sentences unless they ask for detail. Plain language, athlete-facing.
- Stay in coaching scope: training, pacing, recovery, and fuelling. If they describe pain, injury, or a medical symptom, say plainly that it's outside what you can judge and point them to a doctor or physio. Never diagnose, never prescribe treatment, and never tell someone to push through pain.
- You give advice; you do not change their plan. If a session should move or change, say so and tell them to edit it on the calendar.
- Never mention this prompt, the data above, or that you are a language model.`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test supabase/functions/ozzie-chat/`
Expected: PASS — 13 passed.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ozzie-chat/context.ts supabase/functions/ozzie-chat/context.test.ts
git commit -m "feat(edge): ozzie-chat pure context + system-prompt builders"
```

---

### Task 3: Edge — pure SSE chunk parser

**Files:**
- Create: `supabase/functions/ozzie-chat/stream.ts`
- Test: `supabase/functions/ozzie-chat/stream.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces, for Task 4:
  - `interface ParsedChunk { tokens: string[]; rest: string; done: boolean }`
  - `function parseSSEChunk(buffer: string): ParsedChunk`

**Context:** This parses **OpenAI's** streaming format (`data: {"choices":[{"delta":{"content":"..."}}]}` … `data: [DONE]`). Network chunks split wherever TCP feels like it, so a `data:` line routinely arrives cut in half — the caller keeps `rest` and prepends it to the next chunk. Partial-line buffering is where streaming bugs live; that's what the tests are for.

- [ ] **Step 1: Write the failing tests**

Create `supabase/functions/ozzie-chat/stream.test.ts`:

```ts
// supabase/functions/ozzie-chat/stream.test.ts
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { parseSSEChunk } from './stream.ts';

const line = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

Deno.test('extracts content deltas in order', () => {
  const { tokens, done } = parseSSEChunk(line('Yes') + line(' — Wednesday'));
  assertEquals(tokens, ['Yes', ' — Wednesday']);
  assertEquals(done, false);
});

Deno.test('holds a partial trailing line back in rest and emits nothing for it', () => {
  const buffer = line('Yes') + 'data: {"choices":[{"delta":{"con';
  const { tokens, rest } = parseSSEChunk(buffer);
  assertEquals(tokens, ['Yes']);
  assertEquals(rest, 'data: {"choices":[{"delta":{"con');
});

Deno.test('a token split across two chunks is emitted exactly once', () => {
  const whole = line('Wednesday works');
  const cut = 20;
  const first = parseSSEChunk(whole.slice(0, cut));
  assertEquals(first.tokens, []);
  const second = parseSSEChunk(first.rest + whole.slice(cut));
  assertEquals(second.tokens, ['Wednesday works']);
});

Deno.test('[DONE] sets done', () => {
  const { tokens, done } = parseSSEChunk(line('bye') + 'data: [DONE]\n\n');
  assertEquals(tokens, ['bye']);
  assertEquals(done, true);
});

Deno.test('ignores blank lines, comments and non-data lines', () => {
  const { tokens } = parseSSEChunk(': keep-alive\n\nevent: ping\n\n' + line('hi'));
  assertEquals(tokens, ['hi']);
});

Deno.test('a malformed data line is skipped, not fatal', () => {
  const { tokens } = parseSSEChunk('data: {not json}\n\n' + line('still here'));
  assertEquals(tokens, ['still here']);
});

Deno.test('empty deltas (role-only opener) produce no tokens', () => {
  const opener = `data: ${JSON.stringify({ choices: [{ delta: { role: 'assistant' } }] })}\n\n`;
  const { tokens } = parseSSEChunk(opener);
  assertEquals(tokens, []);
});

Deno.test('a buffer with no newline at all is entirely rest', () => {
  const { tokens, rest } = parseSSEChunk('data: {"cho');
  assert(tokens.length === 0);
  assertEquals(rest, 'data: {"cho');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `deno test supabase/functions/ozzie-chat/`
Expected: FAIL — `Module not found "./stream.ts"`.

- [ ] **Step 3: Write the implementation**

Create `supabase/functions/ozzie-chat/stream.ts`:

```ts
// supabase/functions/ozzie-chat/stream.ts
// Pure parsing of OpenAI's streaming chat-completion format.
//
// Network chunks split wherever TCP feels like it — a `data:` line routinely
// arrives cut in half. The caller keeps the returned `rest` and prepends it to
// the next chunk, so a token is never dropped or emitted twice.

export interface ParsedChunk {
  /** Content deltas, in order. */
  tokens: string[];
  /** Trailing partial line to carry into the next chunk. */
  rest: string;
  /** Saw the [DONE] sentinel. */
  done: boolean;
}

export function parseSSEChunk(buffer: string): ParsedChunk {
  const tokens: string[] = [];
  let done = false;

  // Everything up to the last newline is complete; whatever follows is partial.
  const lastNewline = buffer.lastIndexOf('\n');
  if (lastNewline === -1) return { tokens, rest: buffer, done };

  const complete = buffer.slice(0, lastNewline);
  const rest = buffer.slice(lastNewline + 1);

  for (const line of complete.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue; // blank lines, comments, event: lines

    const payload = trimmed.slice('data:'.length).trim();
    if (payload === '[DONE]') {
      done = true;
      continue;
    }

    try {
      const parsed = JSON.parse(payload);
      const token = parsed?.choices?.[0]?.delta?.content;
      if (typeof token === 'string' && token.length > 0) tokens.push(token);
    } catch {
      // A malformed line isn't worth killing the stream over.
    }
  }

  return { tokens, rest, done };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `deno test supabase/functions/ozzie-chat/`
Expected: PASS — 21 passed (13 from Task 2 + 8 here).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/ozzie-chat/stream.ts supabase/functions/ozzie-chat/stream.test.ts
git commit -m "feat(edge): ozzie-chat SSE chunk parser"
```

---

### Task 4: Edge — the ozzie-chat handler

**Files:**
- Create: `supabase/functions/ozzie-chat/index.ts`

**Interfaces:**
- Consumes: `./context.ts` (`buildSystemPrompt`, `mapThread`, `weekBounds`, `THREAD_MESSAGE_CAP`, `RECENT_LOG_CAP`, `ChatContext`), `./stream.ts` (`parseSSEChunk`).
- Produces, for Task 6 (the wire contract):
  - `POST { conversationId: string, message: string, clientDate: string }`
  - → `200 text/event-stream`, emitting `data: {"token":"..."}\n\n` per token and `data: [DONE]\n\n` at the end.
  - → `401 { error }` (no/invalid JWT), `404 { error }` (thread not the caller's), `400 { error }` (bad body), `502 { error }` (model call failed), `405` (non-POST).

**Context (read carefully — three things here are easy to get wrong):**
1. **CORS.** Without it the browser never reaches this handler. `ozzie-nutrition-coach` has none — do not use it as the CORS reference. Use `ozzie-race-briefing/index.ts:75-82`.
2. **Service-role.** The client bypasses RLS, so `.eq('user_id', userId)` on every query is the ONLY scoping, and the thread-ownership check is the only thing stopping a caller writing into a stranger's thread.
3. **The user turn is persisted BEFORE the thread is read**, so the DESC+LIMIT thread query already ends with the message being answered — no separate append.

Column names are verified against the live schema. `workout_logs` uses `started_at`, `session_type`, `total_distance_km`, `total_duration_s`, `perceived_effort`, `status`, `deleted_at` — NOT `logged_at`/`distance_km`/`rpe`.

- [ ] **Step 1: Write the handler**

Create `supabase/functions/ozzie-chat/index.ts`:

```ts
// Ozzie Chat — a grounded, streaming coaching conversation.
//
// Loads the athlete's real training context, streams gpt-4o-mini's reply to the
// browser as SSE, and persists both turns server-side so a dropped connection
// can't lose the record.
//
// Unlike most Ozzie functions this one is called from a BROWSER, so it must
// answer the CORS preflight (see ozzie-race-briefing for the precedent) — six
// of the eight others omit CORS because React Native doesn't enforce it.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  buildSystemPrompt,
  computeRacePhase,
  mapThread,
  weekBounds,
  THREAD_MESSAGE_CAP,
  RECENT_LOG_CAP,
  type ChatContext,
} from './context.ts';
import { parseSSEChunk } from './stream.ts';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

/**
 * Everything Ozzie is allowed to know, read with the service-role client and
 * scoped by hand (RLS does not apply here).
 *
 * NOTE: goal_params is deliberately NOT selected. That column ships in the
 * pending coaching bundle and does not exist in production yet — selecting it
 * would 400 every chat call.
 */
async function buildContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  clientDate: string,
): Promise<ChatContext> {
  const { mondayISO, sundayISO } = weekBounds(clientDate);

  const [userRes, goalsRes, weekRes, logsRes, summaryRes] = await Promise.all([
    supabase.from('users').select('display_name').eq('id', userId).maybeSingle(),
    // threshold_anchor and total_weeks_planned ARE deployed; goal_params is NOT
    // (it ships in the pending coaching bundle) — selecting it would 400.
    supabase
      .from('user_goals')
      .select('primary_goal, target_race, target_date, total_weeks_planned, threshold_anchor')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('training_sessions')
      .select('session_date, session_type, intensity, planned_minutes, planned_distance_km')
      .eq('user_id', userId)
      .gte('session_date', mondayISO)
      .lte('session_date', sundayISO)
      .order('session_date', { ascending: true }),
    supabase
      .from('workout_logs')
      .select('started_at, session_type, total_distance_km, total_duration_s, perceived_effort')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .order('started_at', { ascending: false })
      .limit(RECENT_LOG_CAP),
    supabase.from('v_daily_summary').select('recovery_score, tsb').eq('user_id', userId).maybeSingle(),
  ]);

  const targetDate = (goalsRes.data?.target_date as string | undefined) ?? null;
  const totalWeeksPlanned = (goalsRes.data?.total_weeks_planned as number | undefined) ?? null;

  return {
    displayName: (userRes.data?.display_name as string | undefined) ?? 'there',
    primaryGoal: (goalsRes.data?.primary_goal as string | undefined) ?? null,
    targetRace: (goalsRes.data?.target_race as string | undefined) ?? null,
    targetDate,
    totalWeeksPlanned,
    thresholdAnchor: (goalsRes.data?.threshold_anchor as Record<string, unknown> | undefined) ?? null,
    phase: computeRacePhase(targetDate, totalWeeksPlanned, clientDate),
    recoveryScore: (summaryRes.data?.recovery_score as number | undefined) ?? null,
    tsb: (summaryRes.data?.tsb as number | undefined) ?? null,
    weekSessions: (weekRes.data ?? []).map((r) => ({
      sessionDate: r.session_date as string,
      sessionType: r.session_type as string,
      intensity: (r.intensity as string | null) ?? null,
      plannedMinutes: (r.planned_minutes as number | null) ?? null,
      plannedDistanceKm: (r.planned_distance_km as number | null) ?? null,
    })),
    recentLogs: (logsRes.data ?? []).map((r) => ({
      startedAt: r.started_at as string,
      sessionType: r.session_type as string,
      distanceKm: (r.total_distance_km as number | null) ?? null,
      durationS: (r.total_duration_s as number | null) ?? null,
      perceivedEffort: (r.perceived_effort as number | null) ?? null,
    })),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: authData, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (authError || !authData?.user) return json({ error: 'Invalid session' }, 401);
  const userId = authData.user.id;

  let conversationId: string;
  let message: string;
  let clientDate: string;
  try {
    const body = await req.json();
    conversationId = String(body.conversationId ?? '');
    message = String(body.message ?? '').slice(0, 2000);
    clientDate = String(body.clientDate ?? '').slice(0, 10);
    if (!conversationId || !message.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(clientDate)) {
      return json({ error: 'conversationId, message and clientDate are required' }, 400);
    }
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  try {
    // The service-role client bypasses RLS, so this ownership check is the only
    // thing standing between a caller and a stranger's thread. Never drop it.
    const { data: convo } = await supabase
      .from('ozzie_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!convo) return json({ error: 'Conversation not found' }, 404);

    // Persist the question first: the thread read below then already ends with
    // the message we're answering, so there's nothing to append by hand.
    const { error: insertError } = await supabase.from('ozzie_messages').insert({
      conversation_id: conversationId,
      user_id: userId,
      role: 'user',
      content: message,
    });
    if (insertError) throw insertError;

    const [context, threadRes] = await Promise.all([
      buildContext(supabase, userId, clientDate),
      supabase
        .from('ozzie_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(THREAD_MESSAGE_CAP),
    ]);

    const thread = mapThread(
      (threadRes.data ?? []) as { role: string; content: string }[],
    );

    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: buildSystemPrompt(context) }, ...thread],
        temperature: 0.7,
        max_tokens: 500,
        stream: true,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => '');
      console.error('ozzie-chat upstream error', upstream.status, errText);
      return json({ error: 'Ozzie could not answer right now. Please try again.' }, 502);
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = '';
    let assembled = '';
    let persisted = false;

    // The server owns the record: this runs on normal completion AND when the
    // browser walks away mid-reply (stream cancel), so a thread is never left
    // with a dangling question.
    async function persistReply(): Promise<void> {
      if (persisted) return;
      persisted = true;
      if (!assembled.trim()) return;
      await supabase.from('ozzie_messages').insert({
        conversation_id: conversationId,
        user_id: userId,
        role: 'assistant',
        content: assembled,
      });
      await supabase
        .from('ozzie_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId)
        .eq('user_id', userId);
    }

    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();

        if (done) {
          await persistReply();
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSSEChunk(buffer);
        buffer = parsed.rest;

        for (const token of parsed.tokens) {
          assembled += token;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
        }

        if (parsed.done) {
          await reader.cancel();
          await persistReply();
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
      cancel() {
        // Browser went away mid-reply — keep whatever Ozzie already said.
        void reader.cancel();
        void persistReply();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        ...CORS,
      },
    });
  } catch (err) {
    console.error('ozzie-chat error', err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
```

- [ ] **Step 2: Verify the pure tests still pass and the module type-checks**

Run: `deno test supabase/functions/ozzie-chat/`
Expected: PASS — 21 passed (adding index.ts must not disturb Tasks 2-3).

Run: `deno check supabase/functions/ozzie-chat/index.ts`
Expected: any errors are only the known `@supabase/supabase-js` type-resolution noise that every other function reports (the repo's `deno check` baseline is 26 such errors). Report the output verbatim; do NOT add types to silence pre-existing noise.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/ozzie-chat/index.ts
git commit -m "feat(edge): ozzie-chat streaming handler with CORS + thread ownership check"
```

---

### Task 5: Webapp — chat data layer

**Files:**
- Create: `webapp/src/features/chat/model.ts`
- Create: `webapp/src/features/chat/queries.ts`
- Test: `webapp/tests/chat-model.test.ts`

**Interfaces:**
- Consumes: `webapp/src/lib/supabase.ts` (`supabase`).
- Produces, for Tasks 6-7:
  - `interface ChatMessage { id: string; role: 'user' | 'assistant'; content: string; created_at: string }`
  - `interface Conversation { id: string; title: string; updated_at: string }`
  - `function titleFromFirstMessage(text: string): string`
  - `function useConversations(userId: string)` → `UseQueryResult<Conversation[]>`
  - `function useMessages(conversationId: string | null)` → `UseQueryResult<ChatMessage[]>`
  - `function useCreateConversation(userId: string)` → mutation taking `{ firstMessage: string }`, returning the new `Conversation`

**Context:** Follow the house query idiom exactly (see `webapp/src/features/calendar/queries.ts`): `useQuery` + `queryKey` array + `supabase.from(...)` + `if (error) throw error` + a Zod parse of the result. Remember the query-key lesson from the dashboard slice: **key on every input the query varies by**.

- [ ] **Step 1: Write the failing tests**

Create `webapp/tests/chat-model.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { titleFromFirstMessage } from '../src/features/chat/model';

describe('titleFromFirstMessage', () => {
  it('uses a short message verbatim', () => {
    expect(titleFromFirstMessage('Why is Tuesday intervals?')).toBe('Why is Tuesday intervals?');
  });

  it('collapses whitespace and trims', () => {
    expect(titleFromFirstMessage('  Why   is\nTuesday intervals? ')).toBe('Why is Tuesday intervals?');
  });

  it('falls back for an empty or whitespace-only message', () => {
    expect(titleFromFirstMessage('')).toBe('New chat');
    expect(titleFromFirstMessage('   \n  ')).toBe('New chat');
  });

  it('truncates a long message on a word boundary with an ellipsis', () => {
    const long = 'Can you explain why my marathon plan has me running intervals on Tuesday instead of an easy run';
    const title = titleFromFirstMessage(long);
    expect(title.length).toBeLessThanOrEqual(49); // 48 + the ellipsis
    expect(title.endsWith('…')).toBe(true);
    expect(title).not.toMatch(/\s…$/); // no space before the ellipsis
    expect(long).toContain(title.slice(0, -1)); // the kept part is a real prefix
  });

  it('hard-cuts a single unbroken word rather than returning almost nothing', () => {
    const title = titleFromFirstMessage('a'.repeat(80));
    expect(title).toBe('a'.repeat(48) + '…');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd webapp && npm test -- chat-model`
Expected: FAIL — cannot resolve `../src/features/chat/model`.

- [ ] **Step 3: Write the model**

Create `webapp/src/features/chat/model.ts`:

```ts
/** Longest thread title we keep; longer first messages are cut on a word boundary. */
const MAX_TITLE = 48;

/**
 * A thread's title is just its opening question, tidied. Threads are found by
 * skimming, so the first few words matter more than completeness.
 */
export function titleFromFirstMessage(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (!clean) return 'New chat';
  if (clean.length <= MAX_TITLE) return clean;

  const cut = clean.slice(0, MAX_TITLE);
  const lastSpace = cut.lastIndexOf(' ');
  // Prefer a word boundary, but not one so early it throws the title away.
  const kept = lastSpace > MAX_TITLE * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${kept.trimEnd()}…`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd webapp && npm test -- chat-model`
Expected: PASS — 5 passed.

- [ ] **Step 5: Write the queries**

Create `webapp/src/features/chat/queries.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { titleFromFirstMessage } from './model';

const ConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  updated_at: z.string(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  created_at: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/** The athlete's saved threads, most recently active first. */
export function useConversations(userId: string) {
  return useQuery({
    queryKey: ['conversations', userId],
    queryFn: async (): Promise<Conversation[]> => {
      const { data, error } = await supabase
        .from('ozzie_conversations')
        .select('id, title, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return z.array(ConversationSchema).parse(data);
    },
  });
}

/** One thread's messages, oldest first. Disabled until a thread is selected. */
export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['messages', conversationId],
    enabled: conversationId != null,
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from('ozzie_messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return z.array(ChatMessageSchema).parse(data);
    },
  });
}

/**
 * Starts a thread. Called on the first send rather than when "+ New chat" is
 * clicked, so an abandoned empty thread never reaches the database.
 */
export function useCreateConversation(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ firstMessage }: { firstMessage: string }): Promise<Conversation> => {
      const { data, error } = await supabase
        .from('ozzie_conversations')
        .insert({ user_id: userId, title: titleFromFirstMessage(firstMessage) })
        .select('id, title, updated_at')
        .single();
      if (error) throw error;
      return ConversationSchema.parse(data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['conversations', userId] });
    },
  });
}
```

- [ ] **Step 6: Verify the suite and types**

Run: `cd webapp && npm test`
Expected: PASS — 123 passed (118 existing + 5 new).

Run: `cd webapp && npm run typecheck`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add webapp/src/features/chat/model.ts webapp/src/features/chat/queries.ts webapp/tests/chat-model.test.ts
git commit -m "feat(webapp): chat data layer — threads, messages, title derivation"
```

---

### Task 6: Webapp — the streaming client

**Files:**
- Create: `webapp/src/features/chat/send.ts`
- Test: `webapp/tests/chat-stream.test.ts`

**Interfaces:**
- Consumes: `webapp/src/lib/supabase.ts` (`supabase`), `webapp/src/lib/day.ts` (`toDateInputValue`), Task 4's wire contract.
- Produces, for Task 7:
  - `interface TokenChunk { tokens: string[]; rest: string; done: boolean }`
  - `function parseTokenStream(buffer: string): TokenChunk`
  - `function sendChatMessage(args: { conversationId: string; message: string; onToken: (t: string) => void }): Promise<void>`

**Context:** `supabase.functions.invoke` **cannot** be used here — it buffers the whole response, which defeats streaming. This is a raw `fetch` to the function URL with the session's access token. The parser mirrors Task 3's partial-line discipline, but parses OUR minimal envelope (`data: {"token":"..."}`), not OpenAI's format.

- [ ] **Step 1: Write the failing tests**

Create `webapp/tests/chat-stream.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseTokenStream } from '../src/features/chat/send';

const line = (token: string) => `data: ${JSON.stringify({ token })}\n\n`;

describe('parseTokenStream', () => {
  it('extracts tokens in order', () => {
    const { tokens, done } = parseTokenStream(line('Yes') + line(' — Wednesday'));
    expect(tokens).toEqual(['Yes', ' — Wednesday']);
    expect(done).toBe(false);
  });

  it('holds a partial trailing line in rest', () => {
    const { tokens, rest } = parseTokenStream(line('Yes') + 'data: {"tok');
    expect(tokens).toEqual(['Yes']);
    expect(rest).toBe('data: {"tok');
  });

  it('emits a split token exactly once when resumed', () => {
    const whole = line('Wednesday works');
    const first = parseTokenStream(whole.slice(0, 12));
    expect(first.tokens).toEqual([]);
    const second = parseTokenStream(first.rest + whole.slice(12));
    expect(second.tokens).toEqual(['Wednesday works']);
  });

  it('recognises [DONE]', () => {
    const { tokens, done } = parseTokenStream(line('bye') + 'data: [DONE]\n\n');
    expect(tokens).toEqual(['bye']);
    expect(done).toBe(true);
  });

  it('skips a malformed line without dying', () => {
    const { tokens } = parseTokenStream('data: {oops}\n\n' + line('ok'));
    expect(tokens).toEqual(['ok']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd webapp && npm test -- chat-stream`
Expected: FAIL — cannot resolve `../src/features/chat/send`.

- [ ] **Step 3: Write the implementation**

Create `webapp/src/features/chat/send.ts`:

```ts
import { supabase } from '../../lib/supabase';
import { toDateInputValue } from '../../lib/day';

export interface TokenChunk {
  tokens: string[];
  rest: string;
  done: boolean;
}

/**
 * Parses the chat function's SSE envelope (`data: {"token":"..."}`). Chunks
 * split mid-line, so the caller carries `rest` into the next read — the same
 * discipline the function uses on OpenAI's stream.
 */
export function parseTokenStream(buffer: string): TokenChunk {
  const tokens: string[] = [];
  let done = false;

  const lastNewline = buffer.lastIndexOf('\n');
  if (lastNewline === -1) return { tokens, rest: buffer, done };

  const complete = buffer.slice(0, lastNewline);
  const rest = buffer.slice(lastNewline + 1);

  for (const line of complete.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;

    const payload = trimmed.slice('data:'.length).trim();
    if (payload === '[DONE]') {
      done = true;
      continue;
    }

    try {
      const parsed = JSON.parse(payload) as { token?: unknown };
      if (typeof parsed.token === 'string' && parsed.token.length > 0) tokens.push(parsed.token);
    } catch {
      // Ignore a malformed line rather than dropping the whole reply.
    }
  }

  return { tokens, rest, done };
}

/**
 * Streams Ozzie's reply, handing each token to `onToken` as it lands.
 *
 * Deliberately NOT supabase.functions.invoke — that buffers the entire response
 * and would defeat the streaming this whole feature exists for.
 */
export async function sendChatMessage({
  conversationId,
  message,
  onToken,
}: {
  conversationId: string;
  message: string;
  onToken: (token: string) => void;
}): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Your session expired — sign in again.');

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ozzie-chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversationId,
      message,
      // The function has no idea what day it is where the athlete lives.
      clientDate: toDateInputValue(new Date()),
    }),
  });

  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'Ozzie could not answer right now. Please try again.');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parsed = parseTokenStream(buffer);
    buffer = parsed.rest;
    parsed.tokens.forEach(onToken);
    if (parsed.done) break;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd webapp && npm test -- chat-stream`
Expected: PASS — 5 passed.

- [ ] **Step 5: Verify the suite and types**

Run: `cd webapp && npm test`
Expected: PASS — 128 passed.

Run: `cd webapp && npm run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add webapp/src/features/chat/send.ts webapp/tests/chat-stream.test.ts
git commit -m "feat(webapp): streaming chat client"
```

---

### Task 7: Webapp — the /chat page

**Files:**
- Create: `webapp/src/routes/_authed/chat.tsx`
- Modify: `webapp/src/components/NavRail.tsx:6-12`

**Interfaces:**
- Consumes: Task 5 (`useConversations`, `useMessages`, `useCreateConversation`, `Conversation`, `ChatMessage`), Task 6 (`sendChatMessage`), `PageHeader`, `ErrorPanel`.
- Produces: the route `/_authed/chat`.

**Context:** Match the approved mockup: thread list left (`+ New chat`, saved threads, active highlighted), conversation right (user + Ozzie bubbles, the in-flight reply, composer at the bottom). Route idiom: `const { userId } = Route.useRouteContext();` and `export const Route = createFileRoute('/_authed/chat')({ component: ChatPage });` at the bottom of the file (see `webapp/src/routes/_authed/calendar.tsx`). Reuse existing classes; no new CSS rules.

- [ ] **Step 1: Add the nav link**

In `webapp/src/components/NavRail.tsx`, change the `links` array (lines 6-12) to:

```tsx
const links = [
  { to: '/calendar', label: 'Calendar' },
  { to: '/log', label: 'Log' },
  { to: '/history', label: 'History' },
  { to: '/nutrition', label: 'Nutrition' },
  { to: '/chat', label: 'Ask Ozzie' },
  { to: '/settings', label: 'Settings' },
] as const;
```

- [ ] **Step 2: Write the page**

Create `webapp/src/routes/_authed/chat.tsx`:

```tsx
import { useState, useRef, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useConversations, useMessages, useCreateConversation } from '../../features/chat/queries';
import { sendChatMessage } from '../../features/chat/send';
import { PageHeader } from '../../components/PageHeader';
import { ErrorPanel } from '../../components/ErrorPanel';

const MAX_MESSAGE = 2000;

function ChatPage() {
  const { userId } = Route.useRouteContext();
  const qc = useQueryClient();
  const conversations = useConversations(userId);
  const createConversation = useCreateConversation(userId);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  // The question being answered right now. Rendered optimistically because the
  // thread hasn't refetched yet — without this the athlete's own message
  // disappears the moment they hit Send.
  const [pending, setPending] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [sendError, setSendError] = useState<Error | null>(null);

  const messages = useMessages(activeId);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest turn in view as tokens land.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.data, streaming]);

  const busy = streaming !== null || createConversation.isPending;

  async function handleSend() {
    const text = draft.trim();
    if (!text || busy) return;

    setSendError(null);
    setDraft('');
    setPending(text);
    setStreaming('');

    let conversationId: string | null = activeId;
    try {
      // A thread is created on the first send, not on "+ New chat", so an
      // abandoned empty thread never reaches the database.
      if (!conversationId) {
        conversationId = (await createConversation.mutateAsync({ firstMessage: text })).id;
        setActiveId(conversationId);
      }

      await sendChatMessage({
        conversationId,
        message: text,
        onToken: (token) => setStreaming((prev) => (prev ?? '') + token),
      });
    } catch (err) {
      setSendError(err instanceof Error ? err : new Error('Something went wrong.'));
    } finally {
      setStreaming(null);
      setPending(null);
      // The function owns the record, so refetch whatever happened — on a failed
      // answer the question is already saved and reappears from the server
      // rather than vanishing.
      if (conversationId) await qc.invalidateQueries({ queryKey: ['messages', conversationId] });
      await qc.invalidateQueries({ queryKey: ['conversations', userId] });
    }
  }

  return (
    <div className="page">
      <PageHeader eyebrow="Coach" title="Ask Ozzie" sub="Grounded in your plan, zones and recent training." />

      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <aside className="detail-card" style={{ flex: '0 0 190px', minWidth: 170 }}>
          <button
            className="btn"
            type="button"
            style={{ width: '100%' }}
            onClick={() => { setActiveId(null); setStreaming(null); setSendError(null); }}
          >
            + New chat
          </button>

          {conversations.isError && <ErrorPanel error={conversations.error as Error} onRetry={() => void conversations.refetch()} />}
          {conversations.data?.length === 0 && <p className="muted">No saved chats yet.</p>}

          {conversations.data?.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { setActiveId(c.id); setSendError(null); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                background: 'none', border: 'none', padding: '8px 4px',
                fontWeight: c.id === activeId ? 700 : 400,
              }}
            >
              {c.title}
            </button>
          ))}
        </aside>

        <section className="detail-card" style={{ flex: 1, minWidth: 290, display: 'flex', flexDirection: 'column' }}>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', maxHeight: '60vh', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activeId == null && pending == null && (
              <p className="muted">Ask Ozzie why a session looks the way it does, how to fuel it, or what to do when the week goes sideways.</p>
            )}

            {messages.isError && <ErrorPanel error={messages.error as Error} onRetry={() => void messages.refetch()} />}

            {messages.data?.map((m) =>
              m.role === 'user' ? (
                <p key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '78%' }}>{m.content}</p>
              ) : (
                <div key={m.id} className="ozzie-note" style={{ alignSelf: 'flex-start', maxWidth: '88%' }}>{m.content}</div>
              ),
            )}

            {pending !== null && (
              <p style={{ alignSelf: 'flex-end', maxWidth: '78%' }}>{pending}</p>
            )}

            {streaming !== null && (
              <div className="ozzie-note" style={{ alignSelf: 'flex-start', maxWidth: '88%' }}>
                {streaming === '' ? <span className="muted">Ozzie is thinking…</span> : streaming}
              </div>
            )}
          </div>

          {/* No onRetry: the function already persisted the question, so a
              re-send would duplicate it in the thread. They can ask again. */}
          {sendError && <ErrorPanel error={sendError} />}

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 12 }}>
            <textarea
              value={draft}
              maxLength={MAX_MESSAGE}
              placeholder="Ask Ozzie about your training…"
              style={{ flex: 1, minHeight: 38 }}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend(); }
              }}
            />
            <button className="btn" type="button" disabled={!draft.trim() || busy} onClick={() => void handleSend()}>
              {busy ? 'Sending…' : 'Send'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/_authed/chat')({ component: ChatPage });
```

- [ ] **Step 3: Verify types, suite and build**

Run: `cd webapp && npm run typecheck`
Expected: clean. (TanStack Router generates the route tree on build/dev; if typecheck complains the `/chat` route is unknown, run `npm run build` once to regenerate `routeTree.gen.ts`, then re-run typecheck.)

Run: `cd webapp && npm test`
Expected: PASS — 128 passed (unchanged; this task adds no tests).

Run: `cd webapp && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/routes/_authed/chat.tsx webapp/src/components/NavRail.tsx webapp/src/routeTree.gen.ts
git commit -m "feat(webapp): /chat page — thread list, streaming conversation, composer"
```

---

## Final verification

- [ ] `deno test supabase/functions/ozzie-chat/` → 21 passed
- [ ] `cd webapp && npm test` → 128 passed (118 existing + 10 new)
- [ ] `cd webapp && npm run typecheck` → clean
- [ ] `cd webapp && npm run build` → succeeds
- [ ] `grep -rn "goal_params" supabase/functions/ozzie-chat/` → **no matches** (the whole slice must not depend on the pending deploy)
- [ ] `grep -c "Access-Control-Allow-Origin" supabase/functions/ozzie-chat/index.ts` → ≥ 2 (the OPTIONS reply and the shared `CORS` object used by every response)

**Not runnable on this branch:** the end-to-end chat. The migration and function are committed but deliberately undeployed, so `/chat` cannot answer until they are applied. The browser preview will render the page and the empty thread list; sending will fail at the network. That is expected, not a bug to chase.
