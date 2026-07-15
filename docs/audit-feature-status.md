# OSPREY — Audit-Sourced Feature Ideas: Status

> Every feature idea that has surfaced from an OSPREY audit, in one place, split into **shipped** vs **not yet
> built**. Compiled 2026-07-15 from `OSPREY-app/audit-reports/2026-07-02-fable-audit.md`,
> `OSPREY-app/audit-reports/2026-07-15-sonnet-audit.md`, and `docs/audit-branch-map.md` (which itself catalogs
> the feature work built on spec across the 12 unmerged `claude/*` audit branches). Status verified against
> `main` as of this date — re-check before relying on it if much time has passed.

---

## ✅ Implemented

| Feature | Originating audit | Where it lives | Notes |
|---|---|---|---|
| **Trend-based proactive de-load** — flags an upcoming hard session for de-load when the multi-day ACWR trend is climbing toward the danger zone, instead of only reacting once TSB already tips negative | 2026-07-02 fable-audit (recommendation #1) | `src/hooks/usePlanDeload.ts`, `src/components/DeloadSuggestionCard.tsx`, wired into `app/(tabs)/index.tsx` | Also has a formal design doc: `docs/OSPREY-feature-plans-deload-watch.md`. Fully shipped — not a stub. |
| **Friend / social system** — add-friend UI, friend requests | audit-branch-map.md (harvested concept from branch `djz47h`) | `main` (`48933f5`, `1ddaa1a`, `a5387c8`) | Landed as hand-ported, re-authored commits — not merged from the branch directly. The **AI-narrated activity** layer described alongside "Crew Challenges" in the same branch did *not* ship (see below). |

---

## ❌ Not implemented

### From the 2026-07-02 fable-audit

| Feature | Status |
|---|---|
| **Real Apple Watch bridge** — full `WCSessionDelegate` round-trip so the watch face gets live plan/workout data | **Partially started, not functional.** A native watchOS app *scaffold* now exists (`OSPREY-app/targets/watch/*.swift` — `ContentView.swift`, `WorkoutDataModel.swift`, `index.swift`, ~144 lines total), but there is **no JS-side bridge at all**. `watch-connectivity.ts` and `useWatchSync` — which existed as stubs at the time of the 07-02 audit — are now gone entirely, not just unwired. The phone and watch don't talk to each other yet. |

### From `docs/audit-branch-map.md` (built on spec in unmerged branches, never harvested to `main`)

| Feature | Branch | Notes |
|---|---|---|
| **Fuel Plan / macro-matched meal-prep + exportable grocery list** | `quirky-volta-9lpdro` (`meal-prep.tsx`) | Distinct from the basic Fuel Desk + recipes that *did* ship in the webapp — this is the budget-matched meal-plan + grocery-list export layer specifically. |
| **Live squad race tracking** | `quirky-volta-9lpdro` (`live-race.tsx`) | Real-time tracking of a group of athletes during a race. |
| **Spoken morning check-ins** | `quirky-volta-9lpdro` | Voice-based daily brief; blocked on the same ElevenLabs commercial-licensing gap as Ozzie voice generally (`OZZIE_VOICE_ENABLED = false`). |
| **"Recalibrate"** — real mid-week adaptive plan rebuild | `quirky-volta-9lpdro` | Broader than de-load, which only swaps a single session — this would rebuild the remaining plan. |
| **Anticipation layer** (`OzzieAheadCard`) | `quirky-volta-9lpdro` | Proactively surfaces what's coming before the athlete asks. |
| **Ozzie Live — two-way voice coaching** | `quirky-volta-djz47h` | A real conversation, not canned TTS cues. "Ask Ozzie" today is still a read-only stub. |
| **Life Load** — fused readiness score | `quirky-volta-djz47h` (`LifeLoadCard`) | Blends training load with life-stress/sleep signals into one number. |
| **AI-narrated activity feed** (the "Crew Challenges" narration layer) | `quirky-volta-djz47h` | Confirmed absent — current activity feed (`src/services/activity.ts`) is plain, no narration. |
| **Return-to-training ramp** | `quirky-volta-y77uxz` (`return-to-training.tsx`, `RampBanner`) | Structured ramp-back-up after a break or injury. |
| **Verified effort** | `quirky-volta-y77uxz` | Effort-verification concept; details thin in the source map. |
| **Physique coaching** | `quirky-volta-y77uxz` (`physique.tsx`) | Body-composition-focused coaching track. |

### From the 2026-07-15 sonnet-audit (proposed same day, nothing built yet)

| Feature | Notes |
|---|---|
| **Training Twin** — anonymized cohort benchmarking | Compares an athlete's block (load, ACWR, adherence) against similar athletes by sport/goal/experience tier, without a follow graph. |
| **Race-Day Command Center** — live watch-pushed pacing | Recalculates target splits mid-race from real-time GPS + weather. Depends on the same missing Watch bridge above. |
| **Adaptive live coaching cues** — biometric-driven, not canned | Evolves Ozzie's existing static per-workout-type cues (`useCueBanner`, `ozzie-audio.ts`) into ones generated from real-time HR drift / pace fade / ACWR trend. |

---

## The one thread tying three "not implemented" items together

The **Watch bridge**, **Race-Day Command Center**, and **Ozzie Live / adaptive cues** ideas all converge on the
same missing piece: a real phone↔watch data channel, plus a live-signal coaching layer sitting on top of it.
If prioritizing, that's the single highest-leverage chunk of unbuilt work across all three audits — everything
else on the "not implemented" list is independent of it.
