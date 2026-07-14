# Coaching-Engine Phase 2b-ii-web — Webapp Training Zones Editor — Design Spec

> Created 2026-07-14. The analyst-surface counterpart to 2b-ii: a **Training Zones** panel on the webapp
> (`webapp/`) that lets an athlete view and edit their per-sport training anchor with a live zone-band preview,
> writing the same `user_goals.threshold_anchor` the mobile onboarding Baseline step writes. This is the anchor
> **edit path** deliberately kept off mobile (see `2026-07-14-coaching-engine-phase2b-ii-design.md` §2/§10).

## 1. Why this exists

Mobile 2b-ii captures a self-reported anchor **once**, at onboarding, and has no edit path — by design. The webapp
is the "plan-editing a phone can't do well" surface (`CLAUDE.md`), so it owns viewing and editing zones. Precise
anchor entry (two swim time-trials, band breakdowns) suits a big screen and the analyst context far better than a
phone form. This slice makes the webapp the home for managing training zones.

**Decisions locked in brainstorming:**
- **Editor + live zone-band preview** (not a bare editor) — the analyst-depth version: as the athlete types their
  times, it live-computes the anchor and shows the full zone breakdown; a stored anchor shows its bands.
- **All three endurance sports** (run / swim / rowing), each independently settable — the `threshold_anchor` map
  is multi-sport and the webapp is where you'd manage them.
- **Webapp-only:** no migration, no edge-fn. The `threshold_anchor` column exists (Phase 1); pure logic is
  **ported** into `webapp/src/lib/` per the webapp's established mirror convention.

## 2. Surface & convention

- **Route:** the existing settings route (`webapp/src/routes/_authed/settings.tsx`) — a new `TrainingZonesCard`
  alongside the existing Units / Location / Tier cards, reusing the webapp's `card` / `settings-row` / `btn` /
  `input` styles.
- **Mirror convention:** the webapp does not import from `OSPREY-app/`; it **ports pure logic verbatim** with a
  `// ported from OSPREY-app/…` comment (precedent: `lib/predictions.ts`, `lib/units.ts`). 2b-ii-web ports the
  baseline parse + the zone-band calculators the same way (§4).

## 3. The Training Zones card

One section per endurance sport (Run / Swim / Rowing). Each section has two states:

- **Anchor set** (a `threshold_anchor` entry exists for the sport): render the anchor (e.g. "Swim CSS 95 s/100m")
  and its full **zone bands** (easy / threshold / interval / VO2 — via the ported calculator), plus an inline
  editor to change it and a **Clear** control to remove it.
- **Not set:** render the editor with a **live band preview** — as valid inputs are entered, compute the anchor
  (parse) → the bands (calculator) → render them beneath the fields. Show an honest note: *"Not set — Ozzie
  estimates these from your training and experience. Enter your numbers to set them precisely."* **No standalone
  tier estimate is shown when unset** — that deliberately avoids displaying a number that may differ from the
  plan's actual log-derived anchor.

Per-sport editor inputs (mm:ss where relevant):
- **Swim** → 400 m TT + 200 m TT → `parseSwimBaseline` → `cssSecPer100` → `swimPaceZones`.
- **Rowing** → 2 k time → `parseRowingBaseline` → `splitSecPer500` → `rowingTrainingZones`.
- **Run** → distance (mi) + time → `parseRunBaseline` → `thresholdSecPerMile` → `runningPaceZones`.

**Validation** is the ported parse (positive/plausible + swim 400 > 200); invalid input disables Save and shows the
parse's inline error. **Save** writes the merged map (§5); the live preview means the athlete sees exactly what
they're saving before they save it.

## 4. Ported pure logic (`webapp/src/lib/`)

Mirror verbatim from OSPREY-app, each with a `// ported from …` header (keep in sync; §9 risk):
- **`webapp/src/lib/baseline.ts`** — `parseSwimBaseline`, `parseRowingBaseline`, `parseRunBaseline` (mirror
  `OSPREY-app/src/services/coaching/baseline.ts`) + `deriveThresholdSecPerMile` (mirror
  `OSPREY-app/src/services/coaching/anchor.ts`). Omit the mobile-onboarding-only `anchorKeyForGoal` /
  `toSelfReportAnchor`.
- **`webapp/src/lib/training-zones.ts`** — `swimPaceZones`, `runningPaceZones`, `rowingTrainingZones` and their
  band types (mirror `OSPREY-app/src/services/calculators/{swimming,running,rowing}.ts`). `computeCSSPer100` comes
  along inside `parseSwimBaseline`.

Tier estimates and the log-derivation are **not** ported (the webapp shows self-report bands + live preview only;
the resolved/estimated view is out of scope, §10).

## 5. Data hooks (`features/settings/queries.ts`)

Mirror the existing `useUnits` / `useUpdateUnits` shape (TanStack Query):
- **`useThresholdAnchor(userId)`** — `select('threshold_anchor').from('user_goals').eq('user_id', userId).maybeSingle()`,
  then **zod-parse** the JSONB into `ThresholdAnchorMap` (a `zod` schema in `lib/schemas.ts`, matching the webapp's
  schema convention). A malformed/partial column parses to the valid subset (or `{}`) rather than throwing — this
  also hardens the read that mobile does with an unchecked cast (a gap the 2b-ii review flagged).
- **`useUpdateThresholdAnchor(userId)`** — `mutationFn(nextMap: ThresholdAnchorMap)` →
  `supabase.from('user_goals').update({ threshold_anchor: nextMap }).eq('user_id', userId)`, invalidating the
  query on success. **Merge happens in the component** (it holds the current map from `useThresholdAnchor`):
  Save computes `{ ...current, [key]: { …, source: 'self_report' } }`; Clear computes `{ ...current }` minus the
  key. Writing the whole column is last-write-wins (acceptable for a single user; §9).

RLS already permits this: `GRANT … UPDATE ON user_goals TO authenticated` + policy `user_goals_update USING
(user_id = auth.uid())` (`20260628000002`). Every onboarded user has a `user_goals` row (`completeOnboarding`
inserts it), so `update … eq(user_id)` always targets an existing row.

## 6. Data model
- **No migration.** Reads/writes the existing `user_goals.threshold_anchor JSONB`.
- Shape (same as mobile 2b-ii): `{ run?: {thresholdSecPerMile, source}, swim?: {cssSecPer100, source}, row?: {splitSecPer500, source} }`, `source: 'self_report'`. Rowing key is `row`.
- The mobile app reads this column already (`build-envelope`), so a zone edited on the webapp flows into the next
  generated plan with no other change — the two surfaces meet at the column.

## 7. Testing (TDD)
- Webapp tests (its `tests/` setup; `TZ=America/New_York` precedent): the ported `baseline` parse/validate (incl.
  400 > 200 and plausibility), the three band calculators (a value or two each, matching the OSPREY-app suite so
  drift is caught), the `ThresholdAnchorMap` zod schema (valid / partial / malformed → safe), and the component's
  merge/clear helper (preserves other sports' entries).
- The card UI is React — verified by the webapp's typecheck + in the browser preview; the pure logic is the TDD core.
- The webapp's existing suite stays green.

## 8. Deploy
Webapp-only. No migration, no edge-fn. Ships with the webapp's own deploy (`webapp/`, Cloudflare per
`wrangler.toml`) — independent of the mobile app + edge-fn go-live coupling. The column and RLS are already live.

## 9. Risks & open questions
- **Ported zone math can drift from mobile's.** Two copies of `swimPaceZones` etc. The mitigation is the webapp's
  standing convention: the `// ported from …` comment + **shared test values** (§7 pins the same numbers the
  OSPREY-app suite pins), so a drift fails a test. A future consolidation into a shared package is possible but out
  of scope (matches how `predictions.ts` is handled today).
- **Last-write-wins on the whole column.** Two browser tabs editing different sports at once could clobber; single
  user, negligible. A `jsonb ||` merge would need an RPC (migration/edge-fn) — deliberately avoided.
- **`source` is always `self_report` here** (a webapp entry is a self-report). No confidence/measured-vs-estimated
  surfacing yet.
- **A no-row UPDATE silently no-ops.** `update … eq(user_id)` on an account with no `user_goals` row affects 0 rows
  without erroring — the save would appear to succeed but persist nothing. Every onboarded user has a row, but the
  plan must guard: request the affected count (or a follow-up read) and surface "couldn't save" if nothing changed,
  rather than assuming success. (Upsert is unsuitable — `user_goals.primary_goal` is `NOT NULL` and a zones edit
  has no goal to supply.)
- **Open:** should Clearing a sport delete just that key or the whole column when it's the last entry? Lean: delete
  the key, write the remaining map (or `null` when empty). Plan detail.

## 10. Out of scope
The resolved/estimated view (showing tier- or log-derived zones when no self-report exists — needs the tier
estimates + `build-envelope` log-derivation ported); cycling FTP + HR zones (2b-iii / 2c); a measured-vs-estimated
confidence UI; editing zones from the mobile app; a shared cross-surface calculator package.
