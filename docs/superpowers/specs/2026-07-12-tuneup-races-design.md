# Tune-Up Race Scheduling & Discovery — Design Spec

**Date:** 2026-07-12
**Status:** Approved direction, pending user review of this document
**Relation to other work:** Extends `webapp/` (see `2026-07-12-osprey-webapp-phase1-design.md`), specifically the `/calendar` surface built in that phase. No changes to `OSPREY-app/`, `ozzie-generate-plan`, or any other edge function in this pass.

## 1. Product intent

Athletes training for a 10K, Half, or Marathon often race a shorter "tune-up" event on a long-run weekend instead of running solo — it's more motivating, and for a marathon specifically, a half-marathon tune-up doubles as a real data point for predicting race-day finish time. Today Osprey has no concept of this: `race_events` exists as a manual race hub (goal race + logistics) but nothing connects a specific plan week to a real, findable local race.

This feature does two things: (1) **identifies** which weeks in an existing plan are good tune-up candidates and at what distance, and (2) **helps the user find a real race** for that weekend via a pre-filled search link — not an in-app race database.

## 2. Architecture

- **Pure client, derived-on-the-fly.** All tune-up identification happens by reading the plan's existing `training_sessions` in the webapp — no changes to `ozzie-generate-plan` or any coaching-domain logic. This works retroactively on plans generated before this feature existed (including the user's current active plan, a half-marathon goal — see §3 for how its distance is actually resolved).
- **No structured race-data API.** Discovery is a deep link to an external race-finder site (RunSignup) with query params pre-filled from data Osprey already has. The user browses real results on the actual source of truth and manually enters the race they pick.
- **Deliberate two-phase design, phase 1 only here:** a later pass could feed the same distance-match rule into `ozzie-generate-plan` so Ozzie's own daily-brief voice proactively surfaces tune-up weeks, and/or replace the deep-link with a structured provider API (RunSignup's API, etc.) for inline results. Both are explicitly deferred — see §9.

## 3. Tune-up ladder & scheduling logic

New pure function, `webapp/src/lib/tuneups.ts`, same shape as `predictions.ts`:

- **Ladder:** 5K (5.0 km) → 10K (10.0 km) → Half (21.0975 km). A distance is only offered if it's **shorter than the plan's goal race distance**.
- **Goal-distance source, in priority order** (found during self-review — see §10 for how this was discovered):
  1. **Primary: `training_plans.target_event_id → race_events.distance_km`.** Clean numeric field. Requires the link to actually be set, which it currently isn't for at least one real plan (see §10) — a one-time backfill for existing plan↔race pairs is part of this feature's implementation, not deferred to later.
  2. **Fallback: parse `user_goals.target_race`.** This is free text (e.g. `"Novant Health Charlotte Marathon (Half Marathon)"`) but it's the actual onboarding input that generated the plan, so unlike `target_event_id` it's reliably populated. Keyword-match, checked in this order to avoid "half marathon" matching "marathon" first: `half marathon`/`half-marathon`/`13.1` → Half; `10k`/`10 k` → 10K; `5k`/`5 k` → 5K; `marathon` (unqualified) → Marathon. No match → tune-up derivation doesn't run for that plan (same as having no goal distance at all).
  3. **No goal distance from either source** → tune-up derivation doesn't run for that plan (no card, no grid markers). A 5K-goal plan also gets no offers, for a different reason (nothing below it on the ladder).
- **Matching rule:** for every week's long run (the `training_sessions` row with the largest `planned_distance_km` for `session_type = 'run'` in that `training_week`), compute the closest ladder distance below the goal. If it's within **±20%** of that planned distance, flag the week as a tune-up opportunity at that ladder distance.
- **Multiple opportunities allowed.** A half-marathon plan can flag both an early 5K-matching week and a later 10K-matching week; no dedup logic needed — YAGNI unless it proves noisy in practice.
- **Effort framing, not a code branch.** Shorter-goal tune-ups (5K/10K under a Half/Marathon goal) are presented as motivational/fun; the marathon's half-marathon tune-up is presented as also feeding the race predictor. Mechanically this needs no special-casing — `useBestRun`/`buildRacePredictor` (already shipped) already picks up whatever the best logged run is, regardless of why it was run. Only the copy differs.

## 4. Discovery: search-assist deep link

- Target site: **RunSignup** (`runsignup.com/Races`), which supports a URL-based search — **verified live during planning** (not assumed): the site's own JSON API requires an API key, but the public "Find a Race" page's Filters panel writes its selections to the URL and a cold navigation to that URL alone reproduces the filtered results, confirmed against real Charlotte, NC race data. No account/API key needed.
- Confirmed query params: `zipcodeRadius` (US zip), `radius` (search radius in miles from that zip), `eventType=running_race` (excludes virtual/nonprofit/other event types), `distance`/`max_distance` (race distance band) + `units` (`K`/`M`/`Y`/`m`), `start_date`/`end_date` (`YYYY-MM-DD`).
- URL is built from: the user's saved `users.location_zip`, a fixed default radius (proposing 25 miles — tunable), the ladder distance expressed as a `distance`/`max_distance` km band around it (e.g. 5K → `distance=4&max_distance=6`), `units=K`, and a date window centered on that week's long-run `session_date` (the surrounding Sat–Sun, ±1 day buffer for date math safety).
- Opens in a new tab. Osprey does not parse or import results — the user finds a race there and returns to Osprey to add it themselves.

## 5. Data model changes

- **`users.location_zip text null`** — a US zip code, not free-text city/state. Refined during planning: RunSignup's search (verified live, see §4) filters via a `zipcodeRadius` query param that specifically wants a zip, not a city name — still "no geocoding" as originally intended, just the exact simple format the target site needs. Set once in `/settings`, reused for every tune-up search. Migration follows the existing numbered convention (`supabase/migrations/`).
- **No changes to `race_events` schema** — all needed columns (`name`, `distance_km`, `event_date`, `goal_time_s`, `result_time_s`, `notes`) already exist.
- **New gap identified during design:** the webapp currently only *reads* `race_events` (Calendar pins/countdown from the Phase 1 build) — there's no create form. This feature needs one: a minimal add-race form (name, date, distance, optional URL/notes) writing to `race_events`. Scoped as part of this feature, not a separate one, since the tune-up flow has nowhere to land without it.

## 6. UI placement

Both live on `/calendar`, where race data already surfaces (Phase 1 built the month grid, race pins, and side pane):

- **Month grid:** a tune-up-eligible week's long-run chip gets a small distinct marker (visually related to but different from the existing race-pin ★, so a *real* race and a *tune-up opportunity* read as different things at a glance).
- **Side pane:** selecting a tune-up-eligible session shows the existing session detail plus a new card — ladder distance, one line of context ("This week's long run (≈11km) is close to a 10K"), and a "Find a race near you" button that opens the RunSignup deep link. If `users.location_zip` is unset, the button instead prompts to set it in Settings first.
- **Add-race form:** reachable from the side pane (e.g., "Add the race you found" under the tune-up card) and generally from wherever race events are managed — exact entry point is an implementation detail, not a design fork.

## 7. Data layer

- `features/calendar/queries.ts` gains a `useGoalDistanceKm(planId)` (implements the two-source lookup from §3: `target_event_id → race_events.distance_km` first, `user_goals.target_race` keyword-parse second) and a `useTuneUpWeeks(sessions, goalDistanceKm)` — the latter a pure computation over already-fetched `training_sessions`, not a new network call.
- `features/settings/queries.ts` gains `location_zip` to the existing units read/write pattern (same shape as the units toggle already shipped).
- New `features/races/queries.ts` (or folded into `features/calendar/`) for the add-race mutation.

## 8. Testing

- `tuneups.ts`'s ladder-matching function is pure and unit-tested the same way as `predictions.ts` and the sets-grid reducer: given a set of weeks + a goal distance, assert which weeks flag and at what distance, including the "5K goal → no offers" and "±20% boundary" edge cases.
- The `user_goals.target_race` keyword parser (§3, fallback path) is pure and separately tested: `"Novant Health Charlotte Marathon (Half Marathon)"` → Half (not Marathon — the ordering rule is the whole point of the test), plus `10K`/`5K`/unqualified-`marathon`/no-match cases.
- The RunSignup URL builder is a pure function too (`location + distance + date → URL`) and unit-tested for correct query-param encoding.
- Live browser verification against the real account per repo convention. The current active plan's goal is a half marathon (per `user_goals.target_race`, once the fallback parser resolves it — `target_event_id` isn't linked, see §10), so its own ladder only offers 5K/10K tune-ups, not a half-marathon one; verify at least one of those actually flags on a real week. The marathon → half-marathon scenario needs a second plan (real or seeded) to exercise directly.

## 9. Out of scope for this pass (explicit)

- Any change to `ozzie-generate-plan` or coaching-domain logic in `docs/coaching/` — tune-up weeks are derived, not generated. (Deferred upgrade, not rejected: see §2.)
- Structured race-database API integration (RunSignup API or otherwise) — deep link only.
- Automatic parsing/import of the race the user picks — manual entry via the new add-race form.
- Mobile app (`OSPREY-app/`) — webapp only.
- Geocoding, radius math, or map display — `location_zip` is passed straight through to the external site's own search.
- A second race-finder site or fallback — single provider (RunSignup) for v1.

## 10. Risks & mitigations

- **±20% tolerance is a guess.** No real usage data yet to validate it. Flagged as a named constant, easy to tune after the user tries it against their own active plan.
- **RunSignup coverage gaps** (a real local race not on RunSignup) — acceptable for v1 given the user already knows how to search other sites themselves; not a blocker, just a known limitation to mention in the UI copy if it comes up later.
- **Goal-distance resolution — real bug found during self-review.** The design originally assumed `training_plans.target_event_id` would be reliably set; checking it against the real account showed it's `null` on the actual active plan, even though a matching `race_events` row exists (Novant Health Charlotte Marathon — which, per `user_goals.target_race`, the user is actually registered for at the **half marathon** distance, not the full marathon the race's name implies). §3's two-source resolution (linked event first, `user_goals.target_race` keyword-parse second) plus a one-time backfill of the existing plan↔race link are the fix, folded into this feature rather than deferred. The keyword parser is still a heuristic over free text and could miss an unusually-worded `target_race` — acceptable for v1 (falls through to "no derivation," not a crash or wrong answer), worth revisiting if it misses often in practice.
