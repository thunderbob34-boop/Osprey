# Pace-Clamp Completeness Fix — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement the plan built from this spec.

**Goal:** Close two gaps in `ozzie-generate-plan`'s existing pace-clamp guardrail (`validateAndClamp` in `validate.ts`): Hyrox compromised-run sessions are silently exempt from any pace clamping at all, and when the clamp does fire for any session, the athlete-facing coaching note can go stale relative to the corrected number.

**Architecture:** Two small, independent additions to the same file (`supabase/functions/ozzie-generate-plan/validate.ts`), landing in the same plan because they touch the same function and the same theme — completing a guardrail that already exists and already works for the run/swim/rowing case. No mobile or webapp changes. No new migration.

**Tech Stack:** Deno edge function (Supabase), existing Deno test convention (`Deno.test` + `assertEquals` from `https://deno.land/std@0.224.0/assert/mod.ts`).

## Why this exists (context, not itself a requirement)

A prior audit found a real prescribed session reading "45 min for 7.00 km," which at the athlete's own easy pace implies a materially different duration. Investigating this live traced the *specific cited example* to a separate, already-diagnosed cause (the webapp's plan-generation calls don't build an envelope at all, so the whole guardrail — pace clamp, polarization, lift-load clamp, fuel — never runs for webapp-originated generations; tracked as its own follow-on plan, "B", not part of this spec). That investigation surfaced two further, genuinely independent defects in the guardrail itself, confirmed by reading the current code directly:

1. **Hyrox compromised-run sessions are never pace-clamped, even when a real envelope is present.** `paceZoneForSession` (`validate.ts`) matches `session_type === 'run'` against a `zones.kind === 'run'` zone. A Hyrox athlete's `blueprintSport` is `'run'`, so they do get a real `RunZone` in `envelope.zones` — but `hyroxGuidance()` (`guidance.ts`) explicitly instructs the LLM to tag the compromised-run session `session_type: "hyrox"`, not `"run"` — so `paceZoneForSession` returns `null` for it, and it sails through unclamped. Naively adding `'hyrox'` to the existing run-band check would clamp to the *wrong* band: `hyroxGuidance`'s own prompt text is explicit that compromised-run pace should be **slower** than open-run pace ("stations pre-fatigue you — do NOT run fresh-5k pace"). The correct target lives at `envelope.hyrox.compromisedRunSplitSecPerKm` — already expressed directly in sec/km, not needing the mi/100m/500m unit-conversion table (`KIND_UNIT_PER_KM`) the existing run/swim/rowing bands use.

2. **When the clamp *does* fire, `ozzie_notes` can go stale.** The clamp step correctly recomputes `planned_distance_km` but returns `{ ...d, planned_distance_km: roundedKm }` — the LLM's own `description`/`ozzie_notes` pass through untouched. The polarization step immediately above it *does* rewrite `description`/`ozzie_notes` when it changes a session's intensity, with an explicit comment explaining why. The pace-clamp step never got the same treatment. Per this session's investigation, the real-world severity is lower than it might first appear — the system prompt's own rules describe `description` as a short generic label ("Easy Run") and `ozzie_notes` as an explanation of *why* a session is placed this week, not a rules requiring exact-number citation — but it's still a real, confirmed gap worth a light, honest fix rather than leaving it silently inconsistent.

## Global Constraints

- Every session type/sport whose behavior is unaffected by these two fixes (i.e., every clamp path except the new hyrox one) must produce **byte-identical output** to before this change. This is edge-fn-only, single-file, and must not touch session-generation, zone math for other sports, or prompt construction.
- No mobile or webapp file changes. No new database migration.
- Match this file's own established internal-helper convention: `bandFor`/`paceZoneForSession`/`carbDayType` are private (unexported) functions inside `validate.ts`, tested only through `validateAndClamp`'s public behavior (construct input days + an envelope, assert on output) in `validate.test.ts` — not unit-tested as standalone exports. The new hyrox-clamp logic follows the same pattern: private, tested through `validateAndClamp`.
- `EnvelopeLike`'s existing fields (`hardSessionShareMax`, `zones`, `fuel`, `strength`) are unchanged. The new `hyrox` field is additive and optional, matching how `strength` is already an optional, hand-narrowed subset of the full envelope's `strength` field (not a full mirror of every field `index.ts`'s own `Envelope.hyrox` carries — only what this file actually reads).
- The runtime data for `envelope.hyrox` already flows through today (the real `Envelope` object built in `index.ts` already carries it; `validateAndClamp(days as never, envelope as never)` passes the whole object through an `as never` cast) — this is a type-and-logic addition inside `validate.ts` only. No change to `index.ts`'s own construction of the envelope it passes in.

## Component 1 — Hyrox compromised-run pace clamp

**What changes in `EnvelopeLike`:** add an optional field mirroring `compromisedRunSplitSecPerKm`'s real shape (a plain `{ min: number; max: number }` band, matching this file's existing `Band` type):
```ts
hyrox?: { compromisedRunSplitSecPerKm: Band } | null;
```

**What changes in `validateAndClamp`'s step (b) (the pace-clamp map):** for a day whose `session_type === 'hyrox'`, clamp `planned_distance_km` against `envelope.hyrox.compromisedRunSplitSecPerKm` directly (implied pace = `(planned_minutes * 60) / planned_distance_km`, already in sec/km — no `KIND_UNIT_PER_KM` division needed), using the exact same clamp-and-round logic already proven for the run/swim/rowing case (round toward the safe edge: floor when clamped up to `band.min`, ceil when clamped down to `band.max`). Every other session type continues through the existing `paceZoneForSession` path unchanged. If `envelope.hyrox` is absent (a non-Hyrox athlete, or an older caller not yet posting it), a `session_type: 'hyrox'` day is left untouched — matching how the existing clamp already no-ops when its own zone is unavailable.

**Why this is safe to fold into the same step, not a separate pass:** `paceZoneForSession` already returns `null` unconditionally for `session_type === 'hyrox'` today, so there is zero overlap between the new hyrox branch and the existing pace-zone branch — no session is ever eligible for both.

## Component 2 — Clarifier note when a clamp changes distance

**What changes:** whenever a clamp actually changes `planned_distance_km` (`target !== implied`, in either the existing run/swim/rowing path or the new hyrox path from Component 1), append a fixed, short clarifying sentence to `ozzie_notes`: `` `${d.ozzie_notes} (Nudged slightly to match your pace zone.)` ``. `description` is never touched — it's meant to stay a short label ("Easy Run"), and appending a sentence to it would read as broken, unlike `ozzie_notes`, which is already meant to be a full sentence.

**Why an append, not a rewrite:** unlike polarization's rewrite (which replaces stale prose describing a session that fundamentally changed *intensity*), a pace-clamp is a minor magnitude nudge — the original coaching rationale in `ozzie_notes` (why this session is placed this week) is still true and worth keeping. Appending a short, always-accurate clarifier is honest without discarding real content, and requires no parsing or guessing whether the original prose happened to cite a specific number.

## Verification

1. `deno check` + full Deno test suite green on the edge function (current baseline, captured 2026-07-22: 61 passed — see the immediately-prior Training Baseline plan's corrected baseline note; `deno check` on `index.ts` has 26 pre-existing, unrelated errors that must stay exactly 26).
2. New Deno tests in `validate.test.ts`, added through `validateAndClamp`'s existing public-behavior test style, covering: a Hyrox day within the compromised-run band (no-op, `changed` stays empty); a Hyrox day faster than the band (clamped up, distance reduced, floor-rounded); a Hyrox day slower than the band (clamped down, distance increased, ceil-rounded); a Hyrox day when `envelope.hyrox` is absent (untouched, matching today's behavior exactly); an existing run-day clamp firing → `ozzie_notes` gains the clarifier suffix; a Hyrox-day clamp firing → `ozzie_notes` also gains the clarifier suffix; a day where no clamp fires at all → `ozzie_notes` is byte-identical to input (no suffix).
3. Full existing suite must stay green — non-hyrox, non-clamped sessions produce byte-identical output to today.

## Explicitly out of scope (deferred)

- The webapp envelope-building gap that produced the *specific* "45 min / 7.00 km" example cited in the originating audit finding — that is its own, larger, separate plan ("B" in this session's execution queue), tracked independently.
- Any change to `hyroxGuidance()`'s prompt text itself, or to how the LLM is instructed to write Hyrox sessions.
- A general "reconcile prose after any structural change" mechanism — this spec's Component 2 is scoped specifically to the pace-clamp's own distance adjustment, not a broader prose-consistency system.
- Any change to session types other than `hyrox` gaining a new clamp path (bike/lift/cross remain prompt-only by design, unchanged).
