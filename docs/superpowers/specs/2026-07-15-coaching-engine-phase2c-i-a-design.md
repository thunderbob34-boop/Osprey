# Coaching-Engine Phase 2c-i-a — Turn Cycling On — Design Spec

> Created 2026-07-15. "Half 1" of cycling: make cycling a **selectable primary sport** that generates bike-focused
> plans. Intensity guidance comes from the heart-rate zones shipped in 2b-iii; precise **power (FTP) zones are the
> follow-up, 2c-i-b**. This is the sport-selection pattern from 2b-i applied to cycling. Read the 2b-i spec/plan and
> the Phase 2 spec (§2, §3, §11) alongside.

## 1. Why this exists / what half 1 delivers

The primary-goal picker offers run/lift/hybrid/weight_loss/swim/rowing/hyrox/triathlon — but **not cycling**. A
cyclist can't declare their sport, so they can't get a bike-focused plan. 2c-i-a adds cycling to the picker and
routes a cycling athlete's training days to the **bike**, so their plan is genuinely cycling-focused.

**Intensity guidance in half 1 comes from heart rate** (the universal `hrZones` fallback from 2b-iii): a cyclist has
no pace anchor and — until 2c-i-b — no FTP, so `computeEnvelope` produces `zones: null` for them and the prompt's HR
guidance (already universal) structures their bike cardio. **Power (FTP) zones are 2c-i-b** (the FTP-input screens +
the power-zone engine). So half 1 = "cycling is a real, selectable, bike-focused sport, guided by HR"; half 2 makes
it precise with watts.

**Decisions locked in brainstorming:**
- **Two halves: turn cycling on (this), then add FTP** — smaller, ships value sooner, mirrors 2b-i → 2b-ii/web.
- Half 1 reuses the multi-sport machinery; it does **not** touch the `ZoneSet`, `validate.ts`, or the power-zone
  calculators (all 2c-i-b) — it's selection + day-routing only.

## 2. Sport selection (mirrors 2b-i exactly)

Add `cycling` everywhere the goal flows — the same set of edits 2b-i made for swim/rowing/hyrox:
- **`PrimaryGoal`** (`src/types/onboarding.ts`) and **`TrainingGoal`** (`src/types/preferences.ts`) += `'cycling'`.
- **Onboarding** `goals.tsx` — a Cycling `GOALS` chip; the schedule picker's primary-day label reads "Ride days per
  week" for cycling (extend `primaryDayLabel`).
- **Plan-builder** `preferences.tsx` — a Cycling option in `GOAL_OPTIONS`.
- **`ONBOARDING_GOAL_TO_PREFERENCES`** (`onboarding.ts`) — `cycling → 'cycling'`.
- **Edge-fn `PRIMARY_GOAL_MAP`** (`index.ts`) — `cycling → 'cycling'`.

## 3. Migration

`primary_goal_enum` lacks `cycling` (it has run/lift/hybrid/weight_loss/general_fitness/triathlon/swim/rowing/hyrox).
Add it, exactly like 2b-i's `20260714000003`:
```sql
ALTER TYPE primary_goal_enum ADD VALUE IF NOT EXISTS 'cycling';
```
`session_type_enum` already has `'bike'` (migration `20260702000015`), so bike sessions store fine — no session_type
change. Committed as a repo migration; applied via MCP `apply_migration` at go-live (idempotent, backward-compatible),
joining the pending migration already recorded in `docs/DEPLOY-CHECKLIST.md`.

## 4. Day-routing — a cycling athlete rides (mirrors 2b-i's `routeDisciplineDays`)

Today the edge-fn day-split (`goals.ts` `ENDURANCE_PRIMARY` / `routeDisciplineDays`) has no `cycling` entry, so a
cycling primary would fall through `?? 'run'` and get a **run** plan. Fix it:
- `EnduranceDiscipline` += `'cycling'`; `ENDURANCE_PRIMARY` += `cycling → 'cycling'`.
- `routeDisciplineDays` routes a cycling-primary athlete's main day count to **`weeklyBikeDays`** (with `weeklyRunDays`
  0), leaving the existing `includeBike` cross-training path for non-cycling goals. run/hybrid/etc. stay byte-identical
  (regression-guarded, like 2b-i).

The edge-fn user message already sends `weeklyBikeDays`, so the LLM sees a bike-heavy week and builds a cycling plan.
The prompt already permits `bike` sessions and (via 2b-iii) carries HR guidance for them — no new prompt rule needed
in half 1.

## 5. What half 1 does NOT touch (all 2c-i-b)
- The `ZoneSet` union, `blueprintSport`, and `computeEnvelope`'s zone branches — cycling stays `zones: null` → HR
  fallback. (`blueprintSport('cycling')` returns `null` in half 1; 2c-i-b adds the `'cycling'` branch.)
- `validate.ts` — unchanged (no cycling `ZoneSet` kind yet, so nothing to no-clamp).
- The power-zone calculators, FTP self-report, `threshold_anchor.bike`, and the Baseline / webapp FTP inputs.

## 6. Deploy
App (types + pickers + mapping) + edge fn (`PRIMARY_GOAL_MAP`, `routeDisciplineDays`) + the migration. Joins the
go-live redeploy + migration coupling already recorded for 2a/2b-i/2b-iii in `docs/DEPLOY-CHECKLIST.md`. No
`validate.ts` change.

## 7. Testing (TDD)
- App (Jest): `ONBOARDING_GOAL_TO_PREFERENCES.cycling === 'cycling'`; `primaryDayLabel('cycling')` = "Ride days per
  week"; the pickers typecheck with the widened unions.
- Edge fn (Deno): `routeDisciplineDays('cycling', …)` routes the main count to `weeklyBikeDays`, run 0; run/hybrid
  stay byte-identical (extend the existing `goals.test.ts`).
- The picker chips are RN/React UI — typecheck + on-device.
- Existing 145 Jest + Deno suites stay green; `no-restricted-syntax` lint clean.

## 8. Out of scope (where cycling continues)
- **2c-i-b — FTP power zones + input:** the `{ kind: 'cycling', ftpWatts, bands }` `ZoneSet`, `computeEnvelope`
  power branch, `validate.ts` cycling no-clamp, the edge-fn watts guidance, `selfReportAnchor.ftpWatts` /
  `threshold_anchor.bike`, and the FTP inputs (mobile Baseline + webapp Training Zones card + `parseFTPBaseline` +
  the webapp `cyclingPowerZones` port/parity).
- **2c-ii — Triathlon composite** (needs the bike anchor from 2c-i-b).
- **2c-iii — Fuel-per-day-type.**
