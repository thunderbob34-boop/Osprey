# Training Baseline — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan built from this spec.

**Goal:** Let an existing athlete self-report a real recent effort (time trial) for their sport, on their phone, and have it become their real, measured pace zone everywhere in the app — instead of the zone being a silent, uncorrectable guess from a self-reported fitness tier.

**Architecture:** Reuse three things that already exist and already work: onboarding's baseline-collection inputs/validators (`app/(onboarding)/baseline.tsx`, `src/services/coaching/baseline.ts`), the webapp's proven `threshold_anchor` read/write pattern (`webapp/src/features/settings/TrainingZonesCard.tsx`, `queries.ts`), and the mobile app's existing zone-display pipeline (`useDisplayZones`, `ZonesCard`). Add one new screen, one new data hook pair, a small react-query conversion for freshness, two new entry points, and three targeted fixes to the plan-generation edge function so that "rebuild my plan on the corrected zones" is actually possible without erasing the athlete's race or resetting their week counter.

**Tech Stack:** React Native / Expo (mobile app), Deno edge function (Supabase), existing `@tanstack/react-query`.

## Why this exists (context, not itself a requirement)

This session found that `OSPREY-app/app/preferences.tsx` has dedicated sub-forms for `ultra`/`lift`/`hyrox`/`crossfit`, but **no path for an existing user with a `run`/`hybrid`/`swim`/`rowing`/`cycling`/`triathlon` goal to ever set or correct `user_goals.threshold_anchor`.** For those goals the pace zone is permanently whatever `TIER_ESTIMATE_SEC_PER_MILE`-style tier default produces (`src/services/coaching/anchor.ts`), with zero way to fix a wrong self-reported tier short of a direct database write (which is how this was fixed for one account this session, and is not a repeatable solution). A real 10:00-mile-effort runner tagged "intermediate" gets threshold-pace guidance over 3 minutes/mile faster than their real fitness — confirmed via the app's own `deriveThresholdSecPerMile` (Riegel projection) formula.

Verification during design also found: (a) fixing the anchor alone leaves already-generated sessions contradicting the new zones (a session prescribing "40 min, 4.3 mi" at an old 7:30/mi assumption is physically impossible at a corrected 11:04/mi pace), and (b) the two existing mechanisms for rebuilding a plan — regenerating via Preferences, or via a race target — each have a real, verified defect: the preferences path unconditionally nulls the athlete's race (`target_race`/`target_date`/`total_weeks_planned`), and the raceTarget path resets `total_weeks_planned` to weeks-remaining-from-today on every call, which is the actual mechanism behind the "regenerating always drops you to Week 1" behavior observed earlier this session. Both must be fixed for a "rebuild this week" offer to be safe to expose at all.

## Global Constraints

- Every existing consumer of `useDisplayZones` (Home's session card, the run screen's target strip, `ZonesCard` on plan-preview) must see IDENTICAL output for identical underlying data before and after this work — the react-query conversion changes only the fetching mechanism, never the zone-resolution logic.
- Non-force, non-baseline-touching plan generation calls must remain **byte-identical** in their generated output to before this change — matches this project's existing discipline (e.g. "non-lift byte-identical", "non-ultra byte-identical" from prior coaching-engine phases). The three edge-fn fixes touch only: the `forceRebuild` boolean, and which columns are included in two `upsert()` payloads. No change to session-generation, zone math, or prompt construction.
- All new database writes go through Row Level Security already in force (`user_goals_update` policy: `user_id = auth.uid()`) — no service-role bypass needed or used client-side.
- Validation errors for baseline inputs must be the EXACT strings already returned by `parseSwimBaseline`/`parseRowingBaseline`/`parseRunBaseline`/`parseFTPBaseline` in `src/services/coaching/baseline.ts` — do not rewrite or duplicate this validation.
- The mobile app's ink/amber design tokens (`Theme`, `Radius`, `BorderWidth` from `src/constants/theme.ts`) drive all new UI — no raw hex colors, no emoji (this app just completed a full emoji-to-vector-icon sweep this session).
- The edge-function deploy (`supabase functions deploy ozzie-generate-plan --use-api`) is its own explicit, confirmed step — never bundled silently into a task's "done" criteria. Same for any new EAS build.

---

## Component 1 — `useDisplayZones` becomes react-query-backed

**Why:** Without this, a corrected baseline is durable in the database but invisible everywhere else until the app restarts — `useDisplayZones` currently re-fetches only on `[userId]` change, with no invalidation path. This is the same class of dead-data bug found and fixed repeatedly elsewhere this session (Home's Load tile, the Stats volume chart).

**What changes:** `src/hooks/useDisplayZones.ts`'s internals move from local `useState`+`useEffect` to `useQuery({ queryKey: ['display-zones', userId], queryFn: ... })`, wrapping the exact same async body (same 5 parallel Supabase reads, same `resolveZones`/`resolveMaxHR`/`ultraHRZones` calls, same returned shape `DisplayZones | null`). No caller of `useDisplayZones()` changes — the hook's public signature and return type are unchanged.

**What doesn't change:** the zone-resolution math, the sport branches, the `sport === 'lift'` early return, the confidence computation. This is a pure data-fetching-mechanism swap.

## Component 2 — Training Baseline screen (new)

**Route:** `OSPREY-app/app/training-baseline.tsx` (top-level pushed screen, matching `preferences.tsx`/`races.tsx`'s existing convention — not nested under a tab).

**Which anchor(s) it shows**, resolved via the athlete's current `primary_goal`:
- `anchorKeyForGoal(primaryGoal)` returns `'run'` for `run`/`hybrid`/`ultra`/`hyrox`, `'swim'`, `'row'`, or `'bike'` for cycling → show that ONE anchor's input row.
- `primaryGoal === 'triathlon'` → `anchorKeyForGoal` returns `null` for triathlon (it's a composite, per `blueprintSport`'s own comment) — show all THREE relevant rows (run, swim, bike) so a triathlete isn't dead-ended.
- `primaryGoal` is `lift`/`crossfit`/`weight_loss`/`general` (no pace anchor at all) → the screen is unreachable (see Component 4 — entry points are hidden, not merely a dead screen).

**Per-anchor row**, reusing the EXACT input components and validators already proven in onboarding:
- Run: distance (mi) + time (min:sec) → `parseRunBaseline`.
- Swim: 400m time + 200m time → `parseSwimBaseline`.
- Rowing: 2k time → `parseRowingBaseline`.
- Cycling: FTP (watts), or best 20-min power (watts) if FTP blank → `parseFTPBaseline` (mirrors onboarding's `estimateFTPFromTwentyMinPower` fallback).
- As the athlete types, a live preview shows the computed zone set (e.g. "Threshold 11:04/mi · Easy 12:04–13:04/mi") using the same `runningPaceZones`/`swimPaceZones`/`rowingTrainingZones`/`cyclingPowerZones` formatters `ZonesCard.tsx` already uses — visible before anything is saved.
- If an anchor is already stored, show its current resolved value read-only above the (empty) input fields, mirroring the webapp's `stored ?? preview` display — there is no raw distance/time to pre-fill since only the derived value is persisted.
- **Save** writes the parsed value into `user_goals.threshold_anchor` immediately (merges into the existing JSONB map — other sports' anchors are untouched), disabled until the current input parses successfully. **Clear** removes that sport's entry, reverting to the tier estimate.
- On successful save: invalidate `['display-zones', userId]` (Component 1) so every other open/next-visited screen reflects it immediately, and show the "Rebuild this week?" offer described in Component 3.

**Data hook** (new, mirrors webapp's `queries.ts` `useThresholdAnchor`/`useUpdateThresholdAnchor` exactly): `src/hooks/useThresholdAnchor.ts` — a `useQuery` reading `user_goals.threshold_anchor` for the current user, and a `useMutation` writing it back via `.update(...).eq('user_id', userId).select('user_id')`, throwing `'Could not save — no goals record found for your account.'` if the update matches zero rows (mirrors the webapp's existing guard against a silent no-op).

**Shared code extraction:** `TimeRow` and `NumberField` currently live as unexported local components inside `app/(onboarding)/baseline.tsx`. Extract them into `src/components/BaselineInputs.tsx`; onboarding's `baseline.tsx` imports from there instead of defining them locally (behavior unchanged — this is a pure relocation, verified by onboarding's existing tests still passing unmodified).

## Component 3 — "Rebuild this week?" offer

**Why:** Correcting the anchor alone leaves already-generated sessions in the current week possibly contradicting the new zones (verified: a 4.3mi session prescribed under a 7:30/mi assumption takes ~48 min at a corrected 11:04/mi pace, not the 40 min it says).

**What it is:** after a successful baseline save, the screen shows a secondary, explicitly-optional action: "Rebuild this week on your new zones?" Tapping it calls `invokeGeneratePlan({ force: true })` with **no** `preferences` or `raceTarget` in the body — relying entirely on Component 5's edge-fn fix so this call (a) actually rebuilds instead of no-op'ing, and (b) does so without touching the athlete's race or resetting `total_weeks_planned`. Not shown/offered if the athlete has no active plan yet (nothing to rebuild). Also invalidates `['display-zones', userId]` again after completion (a rebuild can pick up a new `bestRunEffort` from real logged runs, changing `zonesConfidence`).

## Component 4 — Entry points

- **Settings** (`app/(tabs)/settings.tsx`): a new row, "Training Baseline" / "Sharpen your training paces", placed near "Training Preferences", visible only when `blueprintSport(primaryGoal) != null || primaryGoal === 'triathlon'` (reuses the existing function directly rather than hand-listing enum values — note `user_goals.primary_goal`'s real stored spelling is `general_fitness`, not preferences.tsx's locally-mapped `'general'`, so hand-listing would risk exactly this kind of mismatch). This correctly hides the row for `lift`/`crossfit`/`weight_loss`/`general_fitness`, which have no pace anchor to set.
- **`src/components/ZonesCard.tsx`**: the existing "Estimated" tag + nudge text becomes tappable (wrap in `TouchableOpacity`, navigate to `/training-baseline`) — the exact moment an athlete would notice and want to fix this. No visual change when zones are already measured (no tag, nothing new to tap).

## Component 5 — `ozzie-generate-plan` edge-function fixes (v24)

Three isolated, minimal changes to `supabase/functions/ozzie-generate-plan/index.ts`. Each is independently testable and none touches session-generation, zone math, or prompt construction.

**5a — bare `force` actually forces a rebuild.**
Current (line ~469): `const forceRebuild = body.force === true && (Boolean(body.preferences) || Boolean(body.raceTarget));`
Fixed: `const forceRebuild = body.force === true;`
This is what Component 3's rebuild call relies on — today it silently no-ops because it deliberately posts neither `preferences` nor `raceTarget` (to avoid the two data-corrupting behaviors below).

**5b — the `preferences` upsert branch stops erasing the athlete's race.**
Current (~line 578-591): the upsert unconditionally includes `target_race: null, target_date: null, total_weeks_planned: null`, wiping any existing race context every time "Regenerate My Plan" runs from Preferences.
Fixed: remove those three keys from the upsert payload entirely. Supabase's `.upsert()` only includes listed columns in its `ON CONFLICT DO UPDATE SET` clause, so omitting them leaves the existing stored values untouched — a preferences-only regeneration (goal/experience/days-per-week change) no longer touches race fields at all.

**5c — the `raceTarget` branch stops resetting the week counter when re-targeting the SAME race.**
Current (~line 598-632): `raceGoalsRow` is selected without `target_date`/`total_weeks_planned`, so the upsert always writes `total_weeks_planned: race.weeksOut ?? null` — recomputed fresh from today, every time, even for the identical race.
Fixed: add `target_date, total_weeks_planned` to the `raceGoalsRow` select. If `race.raceDate === raceGoalsRow?.target_date` (same race, not a new one), write the EXISTING stored `total_weeks_planned` instead of the freshly computed `race.weeksOut` — the week-of-17 counter then reads correctly regardless of how many times the same race is rebuilt against. A genuinely new/different race still gets a fresh `weeksOut` as today.

**Testing:** add/extend Deno tests in `validate.test.ts` or a new `regenerate.test.ts` covering: bare-force alone now rebuilds; a preferences-only regen preserves an existing race; a same-race raceTarget regen preserves `total_weeks_planned`; a genuinely new race still computes fresh `weeksOut`. Full existing suite must stay green (currently 51/51 per the last deploy's verification).

**Deploy:** `supabase functions deploy ozzie-generate-plan --use-api`, confirmed explicitly before firing (see Global Constraints).

## Verification (end to end, on the real account)

1. `deno check` + full Deno test suite green on the edge function; `tsc`/Jest green on mobile.
2. Live: open Training Baseline, confirm the current tier-estimated zone shows, enter a real effort, confirm the live preview computes correctly, Save.
3. Confirm Home/run-screen/plan-preview all reflect the corrected pace immediately, same session, no app restart.
4. Tap "Rebuild this week?" — confirm the current week's sessions regenerate at the corrected pace (a threshold session's minutes and miles are now mutually consistent), AND the race hub still reads the correct target race and "Week N of 17" (not reset to Week 1).
5. Confirm a plain, non-baseline "Regenerate My Plan" from Preferences (goal/days-per-week change only) no longer nulls the athlete's race.

## Explicitly out of scope (deferred)

- A "current weekly mileage" onboarding/preferences input — a real, separately-identified gap, but a schema + engine change, not part of this fix.
- The plan generator's general duration/distance rounding slop beyond the specific race-context/week-counter defects fixed here.
- Any change to onboarding's own baseline flow or its local-then-save-at-the-end behavior.
- A new EAS build to ship this to a physical device — separate, explicit step after this lands.
