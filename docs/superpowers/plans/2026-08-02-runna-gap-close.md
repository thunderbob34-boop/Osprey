# Plan: Close the Runna gap — OSPREY, Aug 2026

**Status:** ready to implement
**Analysis source:** [`docs/design-references/RUNNA-app-teardown.md`](../../design-references/RUNNA-app-teardown.md)
**Coaching source of truth:** [`docs/coaching/`](../../coaching/) — read `_index.md` first, then the relevant sport file, before touching any plan / zone / fueling / taper logic.

---

## Read this before planning anything

A competitive teardown of Runna (43 captured onboarding screens, Jul 2026) produced a strategic thesis: **Runna prescribes; OSPREY responds.** Runna generates one plan from self-reported inputs and then only lets the athlete rearrange it on a calendar. OSPREY's differentiation is the daily adaptive loop.

**A code audit then found that the loop is already built.** Do not rebuild it. `app/(tabs)/index.tsx` already wires recovery score, today's session, `whyReasoning`, weather coach with move-indoors, hydration, fuel status, ACWR de-load suggestion, training readiness (TSB/CTL), and session swap/compress. `DailySummary.tsx` already renders the expandable "why this session" panel.

The real gap is the **opposite end of the funnel**. OSPREY's onboarding collects six fields:

```ts
// src/types/onboarding.ts — the entire current model
interface OnboardingDraft {
  displayName: string;
  primaryGoal: PrimaryGoal;      // run | lift | hybrid | weight_loss | general_fitness
  experienceTier: ExperienceTier; // beginner | intermediate | advanced
  weeklyRunDays: number;
  weeklyLiftDays: number;
  healthConnected: boolean;
}
```

Runna collects 23. The coaching blueprints in `docs/coaching/` describe an engine that needs a race, a performance anchor, availability, and body mass — **none of which onboarding asks for.** OSPREY has a world-class response layer sitting on top of an input layer too thin to feed it.

Likewise, the fuel math already exists and is unused at the session level: `calculators/shared.ts` exports `dailyCarbGrams` and `sodiumMgPerHourFromSweatRate`; `calculators/running.ts` exports `runningRaceFuelGPerHour` and `runningPaceZones`. Nothing on the session card calls them. `FuelStatus` is only `{ lastLoggedMinutesAgo, recommendation }` — a "have you eaten lately" nudge.

**So the job is: build the inputs and the wiring, not the loop.**

---

## Non-goals

- Do **not** rebuild the home screen, the daily loop, weather coach, hydration, or the de-load system. They work.
- Do **not** add a 23-screen onboarding. The point of the teardown was that half of Runna's screens ask what HealthKit can infer. **Propose, don't interrogate.**
- Do **not** touch `docs/coaching/` content. It is the source of truth; read it, don't edit it.
- No medical claims anywhere in user-facing copy. Match Runna's disclaimer discipline.

---

## Workstreams

Implement in order. Each is independently shippable; land each as its own PR with tests before starting the next.

---

### WS1 — Extend onboarding to feed the coaching engine

**Problem:** the engine can't build a periodized plan because it never learns the race, the anchor, or the athlete's availability.

**Files**
- `src/types/onboarding.ts` — extend `OnboardingDraft` + `DEFAULT_ONBOARDING_DRAFT`
- `app/(onboarding)/` — currently `welcome / name / goals / health / mode`; add screens
- `src/store/onboardingStore.ts`
- `src/services/onboarding.ts`
- New migration in `supabase/migrations/`
- Reuse `app/race-search.tsx` logic rather than duplicating it

**Add to the draft** (each one is required by `docs/coaching/_index.md`, not speculative):

| Field | Why | Source |
|---|---|---|
| `raceGoal: { raceId?, name, date, distance, elevationProfile } \| null` | Drives `computeRacePhase()` in `plan.ts` — Base/Build/Peak/Taper is dead without a date | reuse `race-search.tsx` |
| `performanceAnchor: { kind: 'derived' \| 'self_reported' \| 'timetrial', distance, timeSec, confidence }` | Every pace zone derives from this. `runningPaceZones()` needs a threshold | **derive from HealthKit first** |
| `bodyWeightKg: number` | `dailyCarbGrams()` and `runningRaceFuelGPerHour()` are per-kg. Without it there is no fuel math | HealthKit, else ask |
| `availableDays: Weekday[]` + `longSessionDay: Weekday` | Session placement | ask (2 screens, unavoidable) |
| `equipment: EquipmentId[]` | Lift prescription; only ask when `primaryGoal` includes lifting | ask, conditional |
| `injuryHistory` | See WS2 | ask |

**The anchor is the important one.** Do NOT copy Runna's "type your half-marathon time" wheel picker as the primary path. Order of preference:

1. **Derive** from HealthKit history (`src/services/healthkit-import.ts`) — best recent effort → estimated threshold. Show the athlete what you derived and let them correct it: *"Based on your last 90 days I've got you around a 2:14 half. Sound right?"* Mark `kind: 'derived'`.
2. If insufficient history, fall back to a self-reported estimate. Mark `kind: 'self_reported'` and set a lower `confidence`.
3. Schedule a re-anchor: after 3 weeks of logged training, recompute and prompt to update. This is the single largest structural advantage over Runna — **their anchor never moves.**

**Onboarding UX rules (from the teardown, Part II):**
- One question per screen. One decision, one headline, one helper line, one bottom-pinned CTA.
- Every helper line must teach. Pull the rationale from `docs/coaching/`. Example, on run days/week: *"At most one more day than you currently run — that's the ramp your tendons can absorb."* Not filler; real coaching.
- Put self-correction **inside** the option card, the way Runna's Beginner card redirects a too-slow runner to a different plan.
- **Echo-back summary screen before generating.** List every collected value as plain bullets, then one button. Cheap, and it is the moment the athlete decides to trust the output.
- Replace any spinner during generation with two staged states showing real intermediate artifacts (Ozzie's reasoning, then a partial week rendering).
- Progress bar + back + X on every screen.
- Pre-fill everything HealthKit can answer and present it as confirmable, not blank.

**Acceptance**
- A user completing onboarding with a race selected produces a plan whose `computeRacePhase()` returns a real phase.
- `performanceAnchor.kind === 'derived'` for any user with ≥8 weeks of HealthKit runs.
- Unit tests in `src/services/__tests__/onboarding.test.ts` for anchor derivation, including the insufficient-history fallback.
- Existing users without the new fields must not break: make columns nullable, and gate new UI on presence.

---

### WS2 — A real injury model

**Problem:** `computeInjuryRisk()` in `src/services/performance.ts` is ACWR only — a load-spike detector. It knows a spike happened; it does not know the athlete has a five-year history of posterior tibial tendinopathy. Runna at least *asks*, then does nothing with it. OSPREY should ask and then act.

**Files**
- `src/services/injury.ts` (new)
- `src/types/injury.ts` (new)
- `app/(onboarding)/injury.tsx` (new)
- `src/services/performance.ts` — feed history into risk output
- `src/services/plan.ts` — apply load caps
- New migration: `injury_history`, `injury_events`

**Model** — three levels, not Runna's one bucket:

```ts
type InjuryStatus = 'none' | 'historical' | 'current';
type BodyRegion = 'foot' | 'achilles' | 'calf' | 'shin' | 'knee' | 'hamstring'
                | 'hip' | 'glute' | 'low_back' | 'shoulder' | 'elbow' | 'wrist' | 'other';
type TissueType = 'tendon' | 'bone' | 'muscle' | 'joint' | 'unknown';

interface InjuryRecord {
  region: BodyRegion;
  tissue: TissueType;
  status: InjuryStatus;
  onsetAt?: string;
  currentPainLevel?: 0 | 1 | 2 | 3;  // 0–3 only; never a 10-point clinical scale
}
```

**What it must actually do** — this is the part Runna skips:

1. **Load caps at plan generation.** A `historical` tendon record caps weekly progression tighter than `maxWeeklyProgression()`'s default 10%. A `current` record caps harder and suppresses the matching high-stress session type (no hills or plyos on a current Achilles).
2. **Bidirectional link to ACWR.** When `computeInjuryRisk()` fires a spike AND there is a record for a loaded region, escalate the de-load suggestion's urgency and name the region in the copy.
3. **A return-to-run ladder** for `status: 'current'` — walk/run progression gated on symptom check-ins, not on the calendar. Source the progression rules from the red-flags section of the relevant `docs/coaching/*.md` file.
4. **Symptom check-in** surfaced on the home screen only when a `current` record exists. Never nag otherwise.

**Copy discipline:** never diagnose. Mirror the constraint already in `supabase/functions/ozzie-daily-brief/index.ts` line 25 — *flag patterns, suggest a professional, never name a condition.* Reuse Runna's consent pattern: explicit consent line, and a "Prefer not to say" that degrades gracefully.

**Acceptance**
- Tests in `src/services/__tests__/injury.test.ts`: each status × tissue combination produces the expected progression cap.
- A `current` Achilles record demonstrably removes hill sessions from a generated plan.
- No user-facing string contains a diagnosis. Add a test asserting this against a banned-terms list.

---

### WS3 — Wire fueling to sessions

**Problem:** the math exists and nothing calls it. This is Runna's single largest hole (they have a *checkbox*), and OSPREY can close it in one workstream.

**Files**
- `src/services/nutrition.ts` — extend beyond `fetchFuelStatus`
- `src/services/calculators/*.ts` — already exports what you need; do not rewrite
- `src/screens/DailySummary.tsx` — attach to the session card
- `src/components/NutritionCard.tsx`
- `app/workout/run.tsx`, `app/workout/endurance.tsx` — in-session prompts

**Build `sessionFuelPlan(session, athlete)` returning:**

```ts
interface SessionFuelPlan {
  before:  { carbG: Range; timingMin: number; note: string } | null;
  during:  { carbGPerHour: Range; fluidMlPerHour: Range;
             sodiumMgPerHour: number; firstIntakeAtMin: number } | null;
  after:   { carbG: Range; proteinG: number; windowMin: number };
  rationale: string;   // one athlete-facing sentence — feeds whyReasoning
}
```

Rules:
- Attach a `during` plan to **every session over ~75 minutes**, and to every session in race week regardless of duration.
- Derive from the existing exports — `dailyCarbGrams`, `runningRaceFuelGPerHour`, `sodiumMgPerHourFromSweatRate` — swapping the per-sport parameters, exactly as the blueprints specify. Do not invent new coefficients.
- Sweat rate: default from body mass and forecast temperature (`weather-context.ts` already has the forecast). Let the athlete refine it with a logged weigh-in around a long session, and store it.
- Surface it **on the session card**, not in a nutrition tab. The prescription belongs next to the work it fuels.
- During long sessions, fire an intake prompt on the schedule the plan specifies. `notifications.ts` exists.

**Acceptance**
- Every generated session ≥75 min has a non-null `during` plan.
- Snapshot tests per sport asserting carb/hr falls in the blueprint's published range.
- Displayed values are ranges, never single numbers (matches the `2:08–2:16` honesty rule).

---

### WS4 — Session taxonomy and explainers

**Problem:** Runna's colour-coded session vocabulary lets an athlete read a week's shape without reading words, and their first-encounter explainer sheets teach the training model. OSPREY has neither.

**Files**
- `src/constants/colors.ts` — add the taxonomy
- `src/components/SessionChip.tsx` (new)
- `src/components/SessionExplainerSheet.tsx` (new)
- Apply in `DailySummary.tsx`, `app/calendar.tsx`, `app/plan-preview.tsx`, `app/(tabs)/workout.tsx`

**Rules**
- One canonical colour per session type, used identically in every surface. Easy / Long / Tempo / Threshold / Intervals / Hills / Lift / Cross / Rest.
- Reserve saturated colour **exclusively** for this taxonomy. Everything else stays greyscale plus the single teal accent. Restraint is what makes it legible.
- Selection state = 1px accent border, never a fill.
- Explainer sheet shows on first encounter with each type: what it is, why it's in the plan, what it should feel like — sourced from `docs/coaching/`. Text-first; video optional later.
- Persist "seen" per type so it never re-interrupts.

**Acceptance**
- A session type renders the same colour in all four surfaces (test this).
- Explainer appears exactly once per type per user.

---

### WS5 — Paywall after value, not before it

**Problem:** Runna paywalls after eight minutes of onboarding and before the athlete sees a single session. It converts on sunk cost and it's their most-complained-about moment. RevenueCat is already wired here — do the better thing.

**Files**
- `app/paywall.tsx`, `src/services/subscriptions.ts`, `src/hooks/useSubscription.ts`

**Change:** generate and deliver week one in full, unpaywalled. Gate at the week-one → week-two boundary. Convert on demonstrated value.

**Acceptance**
- A new user reaches a fully interactive week-one session without a paywall.
- The gate fires reliably at the boundary; verify restore-purchases still works.

---

### WS6 — Re-anchor loop

**Problem:** Runna's fitness anchor is set once and never moves. That is their deepest structural flaw. Make OSPREY's move.

**Files**
- `src/services/performance.ts`, `src/services/plan.ts`, `supabase/functions/ozzie-daily-brief/`

**Change:** every 3 weeks, recompute the performance anchor from logged training. If it has moved beyond a threshold, surface it in the daily brief — *"Your threshold has improved ~4%. Want me to update your paces?"* — and on acceptance, regenerate remaining weeks with the new zones. Log every re-anchor so `stats.tsx` can chart the progression.

**Acceptance**
- Simulated 6 weeks of improving training triggers exactly one re-anchor prompt.
- Accepting it changes future session paces; declining leaves the plan untouched.

---

## Conventions to respect

- Read `CLAUDE.md` and `docs/coaching/_index.md` before writing plan/zone/fuel/taper code. Blueprints are the source of truth; app output must match them.
- User-facing coaching copy stays athlete-facing and plain-language, in the blueprint voice.
- Tests alongside: `src/services/__tests__/`, `src/hooks/__tests__/`, `src/types/__tests__/`. `jest-expo`.
- TypeScript strict. `zod` for new external boundaries; `react-hook-form` for new forms.
- New tables need a migration in `supabase/migrations/` **with RLS policies** — see `20260713000001_fix_social_rpc_idor_and_consent.sql` for the pattern the repo already corrected once.
- One PR per workstream. Do not batch.

## Ordering rationale

WS1 unblocks everything — the engine can't do its job without inputs. WS2 and WS3 both consume WS1's new fields, and are the two gaps Runna structurally cannot close quickly, so they carry the most competitive weight. WS4 and WS5 are polish and funnel. WS6 is the long-term moat and depends on WS1's anchor being a first-class object.
