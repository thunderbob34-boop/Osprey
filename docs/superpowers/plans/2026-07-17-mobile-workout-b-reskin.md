# Mobile Workout Tab — Slice B (cardio: run / endurance / hyrox) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Migrate the Workout tab's three cardio session screens (GPS run, endurance/intervals, Hyrox) and the run map component from the old teal/navy `Colors` system to the ink/amber `Theme` system.

**Architecture:** Styling swap onto `Theme`/`Radius`/`BorderWidth` + `Card`/`Button`, PLUS two **user-approved design changes** (see Design Decisions). 6th slice of the mobile design-unification program. Slice A (launcher + lift + recap + MuscleDiagram) is already merged — `recap.tsx` is DONE and must not be re-touched, even though all three of these screens navigate to it on finish.

**Tech Stack:** Expo/React Native (SDK 52), TypeScript, Jest (`jest-expo`, `TZ=Asia/Kolkata`).

---

## Design Decisions (user-approved from rendered mockups — NOT free choices)

**1. SCHEME B — sports/disciplines are de-colored.** Already applied in Slice A to the launcher's sport cards and recap's type badges. Here it governs `endurance.tsx`'s `SESSION_META`, which currently colors swim/bike/run/rowing with brand teal and **cross-training with gold**. Collapse ALL session types to neutral `Theme.panel` / `Theme.line` / `Radius.card` with an amber accent; the session type is conveyed by **label + icon only**. The cross-training gold differentiator goes away — that is the intent of scheme B, not an oversight.

**2. EFFORT / RPE RAMP — the "athletic convention" ramp.** `endurance.tsx`'s `EFFORT_COLOR` map is a monotonic intensity scale. Today it's `easy`=teal, `moderate`=teal, `threshold`=amber, `hard`=red, `max`=red, `rest`=muted — i.e. **easy and moderate are already indistinguishable, and so are hard and max**. Teal can't survive the migration (it would land on top of amber threshold). Replace the whole map with a designed 6-step ramp:

| Step | Colour | Note |
|---|---|---|
| `rest` | `Theme.textMut` (`#A1A1AA`) | neutral |
| `easy` | `#4cde80` green | |
| `moderate` | `#d4c44a` yellow | **new distinct value** (was teal, same as easy) |
| `threshold` | `Theme.accent` (`#c8793a`) | accent lands naturally mid-ramp |
| `hard` | `#e85d32` orange | **new distinct value** (was red, same as max) |
| `max` | `#ff4444` red | |

This is a deliberate improvement: all six steps become distinguishable, where two pairs previously collapsed. Define these as named constants (not inline literals) so the ramp is greppable. Green here means "easy effort" — the standard HR-zone convention — even though green elsewhere in the app means "target met"; that double duty was consciously accepted.

---

## Global Constraints

- **Styling only, EXCEPT the two approved design changes.** No behavior/prop/data-flow change: GPS/location subscriptions, timers, intervals, HealthKit polling, keep-awake, haptics, permission gates, interval auto-advance, voice cues, and all nav must behave identically.
- **Regression gate for EVERY task:** `cd OSPREY-app && npm run typecheck` clean AND `TZ=Asia/Kolkata npx jest` green (241 tests, 30 suites). No new tests.
- **Never touch:** `OSPREY-app/src/constants/colors.ts`; `OSPREY-app/src/components/OzzieAvatar.tsx` (shared across 5 screens — `run.tsx` and `endurance.tsx` both import it, leave it alone); `OSPREY-app/app/workout/recap.tsx` (done in Slice A).
- **Canonical token mapping:**
  | Old | New |
  |---|---|
  | `Colors.bg` | `Theme.ink` |
  | frosted (`bgCard`, `surface*`, `rgba(255,255,255,0.02-0.10)`, `rgba(0,200,200,*)`) | `Theme.panel` |
  | `Colors.border`/`borderTeal`/`borderGold` | `Theme.line` |
  | brand `Colors.teal`/`tealDark`/`gold` | `Theme.accent` |
  | `Colors.textPrimary` / `textSecondary` / `textMuted` | `Theme.text` / `Theme.textSoft` / `Theme.textMut` |
  | `borderRadius` 8–20 | `Radius.card` |
  | pill radii (≥20) and thin bar radii (≤4) | **KEEP** |
  | `#000` on an accent fill | `Theme.ink` |
  | uppercase section label | add `fontFamily: 'SpaceGrotesk_700Bold'` |
- **FUNCTIONAL colors STAY — do NOT migrate:**
  - `run.tsx` **pace-band indicator**: `Colors.green` = in-band, `Colors.textMuted` = no data, **`Colors.amber` = too_fast/too_slow**. Keep all three. (`Colors.amber` #f5a623 vs `Theme.accent` #c8793a are close — that's expected and gets checked in the visual pass; do not "fix" it by migrating.)
  - `endurance.tsx` `intervalDoneIcon` `Colors.green` (interval completed).
  - `hyrox.tsx`: the `Colors.red` "HYROX IN PROGRESS"/destructive text, the `rgba(255,68,68,0.06–0.25)` **station-row surfaces** (functional station marking — do NOT flatten these to `Theme.panel`), and `Colors.green`/`Colors.borderGreen` segment-complete.
- **Two background-derived values must be re-derived from `Theme.ink`, NOT mapped to `Theme.panel`/`Theme.line`:**
  - `run.tsx` map-overlay scrim `rgba(6,9,18,0.75)` → **`rgba(9,9,11,0.75)`** (it's a scrim over a live map, like Slice A's `MUSCLE_SEAM`).
  - Any other `rgba(6,9,18,*)` you encounter.
- **`Button.children` is typed `string`** → any button hosting an `<ActivityIndicator>`/icon/multi-element children stays HAND-ROLLED (styled `TouchableOpacity`: `Theme.accent` bg, `BorderWidth.card` accent border, `Radius.card`, `Theme.ink` text, disabled opacity 0.5). **Known spinner-hosting buttons: `run.tsx`, `endurance.tsx`, and `hyrox.tsx` each have one.** Only string-only CTAs become `<Button>`.
- **Uppercase-label colour rule (settle it here, from Slice A's inconsistency):** eyebrow/section labels that head a card or screen → `Theme.accent`; table/column headers and inline field labels → `Theme.textMut`. Both get `SpaceGrotesk_700Bold`.
- **Do not invent a "current-set"-style cue.** Slice A's plan wrongly assumed one existed in `lift.tsx`; it didn't. Migrate the highlights that are actually there and don't manufacture new state cues.
- Inventory line numbers are from plan-writing time — locate by style-key/JSX and verify before editing.

---

### Task 1: `src/components/RunMap.tsx` (+ its `.web` sibling)

**Files:**
- Modify: `OSPREY-app/src/components/RunMap.tsx` (~26 ln, 1 `Colors.` ref)
- Modify: `OSPREY-app/src/components/RunMap.web.tsx` **if it exists and carries the same colour** — check. The two must not diverge.

**Interfaces:** Consumes `Theme`. No API change.

- [ ] **Step 1: Route polyline.** `<Polyline strokeColor={Colors.teal} strokeWidth={4} />` → `Theme.accent`. Check the `.web` sibling for the same value and migrate it identically.
- [ ] **Step 2: Flag for the visual pass.** Teal had high contrast against both standard and satellite map tiles; muted amber may not. Note this explicitly in your report — if it reads poorly on the map, a brighter route colour is a legitimate functional exception (a GPS trace must stay legible), but do NOT change it on your own; just flag it.
- [ ] **Step 3: Verify + Commit** — typecheck + suite; `git commit -m "feat(mobile): re-skin RunMap route polyline"`

---

### Task 2: `app/workout/run.tsx`

**Files:** Modify `OSPREY-app/app/workout/run.tsx` (~709 ln, ~39 `Colors.` refs).

**Interfaces:** Consumes `Card`, `Button`; `Theme`, `Radius`, `BorderWidth`. Renders the already-migrated `RunMap` (Task 1) and `OzzieAvatar` (**do not touch**).

- [ ] **Step 1: Chrome + stats.** `container` bg → `Theme.ink`; stat tiles → `<Card>` or `Theme.panel`/`Theme.line`/`Radius.card`; text → `Theme.text`/`textSoft`/`textMut`; uppercase labels per the colour rule above + `SpaceGrotesk_700Bold`.
- [ ] **Step 2: The map scrim — re-derive, don't map.** `rgba(6,9,18,0.75)` → `rgba(9,9,11,0.75)` (`Theme.ink` at 0.75). **Not `Theme.panel`** — it's a legibility scrim over a live map.
- [ ] **Step 3: FUNCTIONAL — keep the pace-band trio.** `Colors.green` (in band), `Colors.textMuted` (no data), and `Colors.amber` (too_fast/too_slow) all stay exactly as they are. This is the screen's core feedback signal.
- [ ] **Step 4: Buttons.** The primary control wraps an `<ActivityIndicator>` → **hand-roll** it (and its spinner `#000` → `Theme.ink`). The checkbox mark `#000` → `Theme.ink`. Other `#000`-on-accent → `Theme.ink`; `rgba(255,255,255,0.06)` → `Theme.panel`. Any string-only CTA → `<Button>`.
- [ ] **Step 5: Preserve behavior** — `useRunTracking` (GPS/location subscription), the HealthKit polling `setInterval(poll, 15000)`, the elapsed-time `setInterval`, interval-step expansion + auto-advance, `useCueBanner` + `ozzieSpeak`/`ozzieStop`, the `useSubscription` gate, warmup drills, the End-workout `Alert`, and finish → `router.replace('/workout/recap')`.
- [ ] **Step 6: Verify + Commit** — typecheck + suite; `git commit -m "feat(mobile): re-skin GPS run screen (keep pace-band signals)"`

---

### Task 3: `app/workout/endurance.tsx` — constants + setup screen

**Files:** Modify `OSPREY-app/app/workout/endurance.tsx` (~799 ln — split across Tasks 3 and 4). **This task = the module-level constant tables + the setup/config screen** (activity picker, HealthKit sync). The active-session screen and the remaining styles are Task 4.

**Interfaces:** Consumes `Card`, `Button`; `Theme`, `Radius`, `BorderWidth`. Renders `OzzieAvatar` (**do not touch**).

- [ ] **Step 1: `SESSION_META` — SCHEME B (approved design change 1).** Today swim/bike/run/rowing are `Colors.teal`+`borderTeal` and **cross is `Colors.amber`+`borderGold`**. Collapse ALL of them to neutral `Theme.panel` / `Theme.line` (+ `Theme.accent` where an accent is needed). Delete the now-dead per-type colour fields; keep labels/icons/routes. Cross-training's gold differentiator intentionally goes away.
- [ ] **Step 2: `EFFORT_COLOR` — the new ramp (approved design change 2).** Replace the map with the 6-step athletic ramp from Design Decisions, as **named constants** (e.g. `EFFORT_REST`/`EASY`/`MODERATE`/`THRESHOLD`/`HARD`/`MAX`) rather than inline hexes, then reference them in `EFFORT_COLOR`. `threshold` uses `Theme.accent`; `rest` uses `Theme.textMut`; the other four are the literals in the table. **This intentionally gives `moderate` and `hard` distinct values they didn't have before.**
- [ ] **Step 3: Setup/config screen.** Activity picker chips → `Theme.panel`/`Theme.line` (+ accent when selected); HealthKit sync rows/cards → `<Card>` or panel/line; text tokens; uppercase labels per the colour rule.
- [ ] **Step 4: Preserve behavior** — the HealthKit availability + permission gate and its four `Alert`s, the sync flow, `pickTrackingMode`, and `useUnitPreference`/`METERS_PER_UNIT` conversion.
- [ ] **Step 5: Verify + Commit** — typecheck + suite; `git commit -m "feat(mobile): endurance constants (scheme B + new effort ramp) and setup screen"`

---

### Task 4: `app/workout/endurance.tsx` — active session + styles

**Files:** Modify `OSPREY-app/app/workout/endurance.tsx` — the active-session screen (interval list, timers, controls) and the remaining `StyleSheet`. **Task 3's regions (constants + setup screen) are DONE — do not re-touch.**

**Interfaces:** Consumes `Card`; `Theme`, `Radius`, `BorderWidth`. Uses the `EFFORT_COLOR` ramp Task 3 defined.

- [ ] **Step 1: Interval list + session chrome.** Interval rows → `<Card>` or panel/line/`Radius.card`; the effort swatch/label per row reads from the Task-3 ramp — **do not re-inline any colours**; timers and stat text → `Theme.text`/`textSoft`/`textMut`; uppercase column/section labels per the colour rule.
- [ ] **Step 2: FUNCTIONAL — keep `intervalDoneIcon` `Colors.green`** (interval completed).
- [ ] **Step 3: Buttons.** The session's primary control wraps an `<ActivityIndicator>` → **hand-roll**; its `#000` → `Theme.ink`. `rgba(255,255,255,0.04-0.05)` surfaces → `Theme.panel`.
- [ ] **Step 4: Preserve behavior** — `useRunTracking`, the elapsed `setInterval`, interval auto-complete, `useCueBanner`/`ozzieSpeak`, `useSubscription`, the End-session `Alert`, and finish → `router.replace('/workout/recap')`.
- [ ] **Step 5: Verify + Commit** — typecheck + suite; `git commit -m "feat(mobile): re-skin endurance active session"`

---

### Task 5: `app/workout/hyrox.tsx`

**Files:** Modify `OSPREY-app/app/workout/hyrox.tsx` (~585 ln, ~36 `Colors.` refs). Self-contained.

**Interfaces:** Consumes `Card`, `Button`; `Theme`, `Radius`, `BorderWidth`.

- [ ] **Step 1: THE RUN-vs-STATION DECISION (read carefully).** Hyrox alternates run legs and station legs, and the screen encodes that in three places: the station checkbox (`isRun ? Colors.teal : Colors.red`), the screen accent (`sessionComplete ? Colors.green : currentIsRun ? Colors.teal : Colors.red`), and the segment list tint (`seg.type === 'run' ? Colors.teal : Colors.red`). The teal here is **not brand** — it's the "this is a RUN leg" marker paired against red "STATION". Resolution: **run legs → `Theme.accent`; stations KEEP `Colors.red`; `sessionComplete` KEEPS `Colors.green`.** This preserves a three-way distinction (amber run / red station / green complete). Amber-vs-red is a proven pairing in this app (Settings' danger zone sits beside amber chrome and reads fine). **Flag it for the visual pass** — if amber and red don't separate well here, the follow-up is to push run legs to a neutral treatment, not to recolour the stations.
- [ ] **Step 2: Station-row surfaces — FUNCTIONAL, do NOT flatten.** The `rgba(255,68,68,0.06–0.25)` station-row backgrounds are functional station marking, not frosted-brand surfaces. Keep them. Mapping them to `Theme.panel` would erase the run/station rhythm of the list.
- [ ] **Step 3: Chrome + the rest.** `container` bg → `Theme.ink`; segment/overview rows → `<Card>`; `rgba(255,255,255,0.04)` → `Theme.panel`; the `Colors.teal` fill → `Theme.accent`; `#fff`/`#000` marks on accent → `Theme.ink`; text tokens; uppercase labels per the colour rule; radii per the mapping.
- [ ] **Step 4: FUNCTIONAL — also keep** the `Colors.red` "HYROX IN PROGRESS"/destructive text and `Colors.green`/`Colors.borderGreen` segment-complete.
- [ ] **Step 5: Buttons.** The primary control wraps an `<ActivityIndicator>` → **hand-roll** (`#000` → `Theme.ink`). String-only CTAs → `<Button>`.
- [ ] **Step 6: Preserve behavior** — the 1s `setInterval`, per-segment split capture + success/impact haptics, the division selector (`hyroxStationWeights`), the discard `Alert`, and save → `router.replace('/workout/recap')`.
- [ ] **Step 7: Verify + Commit** — typecheck + suite; `git commit -m "feat(mobile): re-skin hyrox (run=accent, station stays red)"`

---

## After all tasks: visual pass + final review

- **Live web-preview visual pass.** Reach each screen from the Workout launcher. Check specifically:
  1. **The new effort ramp** — open an endurance session with intervals and confirm all six steps read in order (gray → green → yellow → amber → orange → red), especially that `moderate` (yellow) and `threshold` (amber) separate, since they're adjacent and both warm.
  2. **run.tsx's pace-band amber** against accent chrome — `Colors.amber` #f5a623 vs `Theme.accent` #c8793a are close; confirm the out-of-band cue still reads as a warning.
  3. **hyrox run-vs-station** — amber run legs against red stations: is the alternating rhythm still obvious?
  4. **RunMap's route polyline** on actual map tiles — does amber stay legible where teal was?
  5. Endurance session-type chips de-colored (scheme B) and legible by label.
- **Note:** the run/endurance/hyrox screens acquire GPS/HealthKit permissions and write real workout data on finish. **Do not press finish/save on any of them** during the pass — stop the preview to discard instead.
- **Final whole-branch review**, then **finishing-a-development-branch**: merge to main and push (standing user approval).

## Self-Review (plan author)
- Coverage: all 4 Slice-B files + the `.web` sibling have tasks; `endurance.tsx` split into constants+setup (T3) vs active session (T4) given its 799 lines and the fact that the ramp constants must land before the list that consumes them. ✓
- Both approved design decisions stated up front and referenced in the tasks that implement them (T3 for both; T5 inherits scheme B's logic for run-vs-station). ✓
- Functional colours enumerated per task (pace-band trio, interval-done green, hyrox red/green + station surfaces) and the two "re-derive from ink" scrims called out. ✓
- Spinner-hosting buttons flagged hand-roll in all three screens. ✓
- The uppercase-label colour rule is settled here, closing Slice A's inconsistency. ✓
- Explicit instruction not to manufacture a state cue, correcting Slice A's mistaken premise. ✓
