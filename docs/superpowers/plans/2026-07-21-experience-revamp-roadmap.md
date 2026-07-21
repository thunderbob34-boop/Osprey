# OSPREY Experience Revamp — Execution Roadmap

> **This is a roadmap, not an implementation plan.** Each phase below gets its own `superpowers:writing-plans` plan document at execution time, then runs through `subagent-driven-development` — the cadence used for F3-F7, the mobile companion, and REC-001/002/003. Roadmap phases are scoped so each one is independently shippable and independently reviewable.

**Source audit:** [`OSPREY-app/audit-reports/2026-07-21-experience-audit.md`](../../../OSPREY-app/audit-reports/2026-07-21-experience-audit.md) (finding numbers below reference it)
**Target-state mockups:** [`design-mockups/2026-07-21-experience-revamp/`](../../../design-mockups/2026-07-21-experience-revamp/)

**Goal:** close the gap between what OSPREY's engine computes and what the athlete actually sees, so the app feels like the benchmark-informed product the research promised.

---

## Sequencing principle

Ordered by **user-visible impact per unit of effort**, with one hard dependency: Phase 2 (deploy) gates plan quality for four sports, and Phase 4 (persisted envelope) unlocks pieces of Phases 5-7 cheaply. Everything in Phase 1 is independent and can ship the same day.

| Phase | Theme | Findings | Effort | Ship value |
|---|---|---|---|---|
| 1 | Visual sweep | 1-6 | ~1 day | First impression fixed |
| 2 | Deploy gate | 7 | ~2 hrs + smoke test | Real coaching for 4 sports |
| 3 | System pass | 8 | ~1 day | 30 screens read as one system |
| 4 | Prescription surface | 9 | 2-3 days | The engine becomes visible |
| 5 | Race hub on Home | 10 | ~1 day | Best feature stops being buried |
| 6 | Hyrox pacing pipeline | 11 | 2-3 days | Beats every competitor tool |
| 7 | Hyrox race discovery | 12 | 2-3 days | The sport becomes reachable |
| 8+ | Parity track | 13-25 | scheduled | Benchmark coverage |

---

## Phase 1 — Visual sweep (all S; one plan, ~6 tasks)

**Why first:** every item is small, independent, and lands on a surface the user opens within ten seconds of launching. This is the phase that answers "it doesn't feel revamped."

1. **Purge old-brand pixels** (#1) — mascot teal → `Theme.accent` in `OzzieMascot.tsx:44-46` + `OzzieAvatar.tsx:39-40`; Log gold chips + raw `rgba(200,154,0,…)` literals; Calendar RACE DAY gold; Hyrox stations off danger-red onto `ChartPalette.hyrox`; `calendar-blocking.ts:60` teal.
   *Decision needed:* Log's gold was previously kept as functional (rest vs training day). Its contrast partner is now amber, so it reads as an off-shade mistake. Recommend re-picking from `EffortPalette.rest` (neutral) or switching to fill-vs-outline. **Flag for the user rather than deciding silently** — this reverses an earlier deliberate call.
2. **Fix the launch impression** (#2) — `app.json` splash + adaptive-icon `backgroundColor` `#060912` → `#09090B`; re-export `icon-1024.png` / `splash.png` with amber Ozzie. *Asset work — may need the user's source files.*
3. **Fix the no-plan Home trap** (#3) — disable/repoint the CTA when `type === 'No Session Planned'`, route to build-plan, replace the false "still crunching" promise.
4. **Personal numbers on the session card** (#4) — render the `useDisplayZones` band beside the zone label; ungate macros in plan-preview's session detail; add pace to interval segments.
5. **Calendar hyrox/rowing icons** (#5) — add the two `SESSION_ICON` keys + legend entries. Pair with Phase 2; it becomes a visible bug the moment the generator deploys.
6. **First-run polish** (#6) — instructive empties for Stats/Log (and move the paywall out of the lead), replace the three dev-voice strings, label the Health row with what it actually connects to.

**Exit:** simulator walkthrough of welcome → Home → Log → Stats on a *fresh* account with no old-brand pixel and no dead-end CTA.

## Phase 2 — Deploy the Phase-3 coaching engine (#7)

**The highest-leverage item in the audit and it is already written.** The deployed `ozzie-generate-plan` predates the entire sport-guidance system; Hyrox/ultra/powerlifting/CrossFit athletes currently get generic plans.

- Atomic deploy: generator + the 5 pending migrations (4 enum + `goal_params`), per `docs/DEPLOY-CHECKLIST.md` §2.
- REC-002's Hyrox session type rides along.
- **Device smoke test** each of the four sports' plan generation — several sport screens have never run on a device.
- **Requires explicit user permission** (established pattern for every production deploy).

## Phase 3 — Component grammar pass (#8)

One mechanical pass, app-wide payoff: add `Chip`/border/type tokens, adopt `ScreenHeader` on the three holdouts (`plan-preview`, `preferences`, `food-scanner`), extend `Shadow.emphasis` beyond its 3 current sites, delete the unused `SpaceGrotesk_500Medium` boot load. Best run as a single SDD plan with a mechanical implementer and a strict reviewer, since it touches many files shallowly.

## Phase 4 — The prescription surface (#9)

**The structural fix.** Persist the envelope (or a shared hook) as a single render source, then build the mobile "Your Numbers" surface the webapp already has: %1RM working loads, Prilepin ranges, RPE/RIR, attempt plans, Hyrox split + station loads, CrossFit loads + Fran tier, carb g/hr. Also fixes `useDisplayZones`' hardcoded `'Base'` phase, and makes #4, #11, #13 nearly free.

Port from `webapp/src/features/settings/StrengthZones.tsx:147,202,330` — same parity-test convention as `zone-parity.test.ts`.

## Phase 5 — Race hub on Home (#10)

A NEXT UP countdown strip on Home (see mockup 01), plus rethinking the Stats chip-hub, which currently fronts Races + Challenges + Calendar + Routes *and* the paywall. Moves the benchmark's "Exceeds"-rated feature from two taps deep to the first thing you see.

## Phase 6 — Hyrox pacing pipeline (#11)

The flagship competitor tool class, end to end (mockups 04 + 05):
collect `targetTimeMinutes` (declared, hardcoded empty) → sanity-band against published division finish times → phase the pacing model (runs 1-3 / 4-6 / 7-8 vs today's flat range) → 16-segment pacing board → live runner pace targets → recap deltas. Also default the runner's division from `goal_params.division` instead of re-asking every session.

**Threshold-anchored + phased beats all three competitor models — none combines both.**

## Phase 7 — Hyrox race discovery (#12)

Unpin `race-search.ts:158` from `event_type=running_race`, teach `canonicalDistance()` non-running formats, let `race-event.tsx` express a Hyrox event, fix the "50,000+ running events" copy, and carry `division` through the REC-001 handoff. Needs an event source — recommend seeding the hyrox.com season manually rather than crawling (**hyrox.com disallows `ClaudeBot`; the standing no-crawl rule holds**).

## Phase 8+ — Parity track (#13-25)

Schedule against appetite. Two are S and could join Phase 1 if desired: **#13 race-week fueling render** and **#14 one zone truth**. The rest — HR rendering, hybrid identity tiles, interference radar, station cues, travel/illness flows, onboarding sport coverage, HRV baseline, quiz placement, station history, sign-in value — are each a self-contained M.

**Blocked, not scheduled:** #17 Ozzie action-chat (your OpenAI billing decision). Its near-term S slice — deleting the orphaned `ask-ozzie.tsx` and its "not live yet" copy — can ship in Phase 1.

## Critic catches — fold in where they land

- **Loading feel** — onboarding waits on full LLM generation behind a bare spinner with a silent `.catch()` that produces the Phase 1 #3 trap. Fold the catch fix into Phase 1; skeletons into Phase 3.
- **Equipment never asked** (0 hits app-wide) — a real onboarding gap; competitors ask at step 3. Scope alongside Phase 8's #21.
- **Race-rehearsal ramp** — hyroxvault's mini → ¾ → full simulation ladder has no equivalent. Natural Phase 6 extension.
- **Free-vs-Plus** — Home readiness, CTL/ATL, predictors, and race briefing are all Plus-gated, so several "benchmark-matching" surfaces are invisible free. **Worth an explicit product decision before Phase 4/5** — no point rendering the engine to users who can't see it.

---

## Open questions for the user

1. **Log's gold chips** — keep as functional, or migrate? (Reverses an earlier deliberate decision; see Phase 1 item 1.)
2. **Icon/splash assets** — do you have source files, or should the amber re-color be derived from the existing PNGs?
3. **Free-vs-Plus** — which of the Phase 4/5 surfaces should a free account see?
4. **Phase 2 deploy** — needs your go-ahead; it is the one item that changes production behavior.
