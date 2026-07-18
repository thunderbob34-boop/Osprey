# Mobile Workout Tab — Slice A (launcher + strength + recap) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Migrate the Workout tab's launcher, the lift (strength) session screen, the shared post-workout recap, and the muscle diagram from the old teal/navy `Colors` system to the ink/amber `Theme` system.

**Architecture:** Styling swap onto `Theme`/`Radius`/`BorderWidth` + `Card`/`Button`, PLUS two **deliberate design changes the user chose from rendered mockups** (see Design Decisions). 5th slice of the mobile design-unification program (Home + tab bar, Settings, Log already merged).

**Tech Stack:** Expo/React Native (SDK 52), TypeScript, Jest (`jest-expo`, `TZ=Asia/Kolkata`).

---

## Design Decisions (user-approved via visual mockups — these are NOT free choices)

**1. Sport colors → SCHEME B: drop per-sport hues entirely.**
Today `workout.tsx` has a per-sport color table (Run=teal, Lift=gold, Swim=blue, Bike=green, Row=indigo, Hyrox=red) and `recap.tsx` mirrors it in type badges. A blind teal+gold→accent swap would have made Run and Lift identical while the other four stayed distinct. The user chose to **de-color sports entirely**: every sport card and type badge becomes neutral `Theme.panel` / `Theme.line` / `Radius.card` with an **amber accent icon + arrow**, and the sport is conveyed by **icon + label only**. Delete the per-sport `iconColor`/`surface`/`border` table. `workout.tsx` and `recap.tsx` MUST agree.

**2. PR badges → `Theme.accent`.** With sports de-colored, accent is free to mean "highlight/achievement" and has no adjacent color to collide with. Applies to lift's `prBadge`/`prBadgeText` and recap's `prTitle` + highlight chip (currently `Colors.gold`/`goldDim`). Flag for the visual pass — if a gold "medal" reading is missed, that's a follow-up, not a re-decision.

> The effort/RPE ramp decision (gray→green→yellow→amber→orange→red) applies to `endurance.tsx`, which is **Slice B** — not this slice.

---

## Global Constraints

- **Styling only, EXCEPT the two approved design changes above.** No behavior/prop/data-flow change: every timer, interval, subscription, haptic, alert, gate, mutation, and nav must behave identically.
- **Regression gate for EVERY task:** `cd OSPREY-app && npm run typecheck` clean AND `TZ=Asia/Kolkata npx jest` green (241 tests, 30 suites). No new tests.
- **Never touch `OSPREY-app/src/constants/colors.ts`.**
- **Never touch `OSPREY-app/src/components/OzzieAvatar.tsx`** — shared across 5 screens (run, endurance, lift, onboarding, DailySummary). Out of scope for both Workout slices.
- **Canonical token mapping:**
  | Old | New |
  |---|---|
  | `Colors.bg` | `Theme.ink` |
  | frosted (`bgCard`, `surface*`, `rgba(255,255,255,0.02-0.10)`, `rgba(0,200,200,*)`) | `Theme.panel` |
  | `Colors.border`/`borderTeal`/`borderGold` | `Theme.line` |
  | brand `Colors.teal`/`tealDark`/`gold` | `Theme.accent` |
  | `Colors.textPrimary` / `textSecondary` / `textMuted` | `Theme.text` / `Theme.textSoft` / `Theme.textMut` |
  | `borderRadius` 8–20 | `Radius.card` |
  | pill radii (≥20 on chips/round buttons) | **KEEP** |
  | thin progress-bar radii (≤4) | **KEEP** |
  | `#000` text/icon/spinner on an accent fill | `Theme.ink` |
  | uppercase section label | add `fontFamily: 'SpaceGrotesk_700Bold'` |
- **FUNCTIONAL colors STAY — do NOT migrate:**
  - `workout.tsx` plan-alert banner **`warning` severity**: `rgba(245,176,65,0.15)` + `Colors.amber`. (The `positive`/`neutral` teal severities DO migrate to neutral/accent.) **`Colors.amber` #f5a623 vs `Theme.accent` #c8793a are close — flag for the visual pass.**
  - `lift.tsx`: the warmup flame `Colors.amber` (intensity indicator); `micBtnActive` `Colors.red` (voice-recording ACTIVE); `logBtnDone` `Colors.green` (set completed); `setInputDone`'s muted/transparent completed-row de-emphasis.
  - `recap.tsx`: share-error `Colors.red`; "shared" success `Colors.green`.
- **`lift.tsx` current-set row highlight (`rgba(0,200,200,0.08)`) must NOT be flattened to `Theme.panel`** — that would erase the "this is your current set" cue in a table of otherwise-identical rows. Replace with an accent-tinted background (e.g. `rgba(200,121,58,0.10)`) or a `Theme.accent` left border. Preserving the cue is required; the exact device is the implementer's call.
- **`Button.children` is typed `string`** → any button hosting an `<ActivityIndicator>`/icon/multi-element children stays HAND-ROLLED (styled `TouchableOpacity`: `Theme.accent` bg, `BorderWidth.card` accent border, `Radius.card`, `Theme.ink` text, disabled opacity 0.5). In this slice: **lift's finish button** and **recap's share button** both wrap spinners → hand-rolled. Recap's home button is string-only → `<Button>`.
- Neither `lift.tsx` nor `recap.tsx` nor `workout.tsx` imports `ScreenHeader`; they keep their own headers. Do not adopt it.
- Inventory line numbers are from plan-writing time — locate by style-key/JSX and verify before editing.

---

### Task 1: `src/components/MuscleDiagram.tsx`

**Files:** Modify `OSPREY-app/src/components/MuscleDiagram.tsx` (~298 ln, ~8 `Colors.` refs). Used only by `lift.tsx`.

**Interfaces:** Consumes `Theme`, `Radius` from `@/constants/theme`. No API change (keeps its worked-groups prop + front/back toggle).

- [ ] **Step 1: SVG anatomy constants (the careful part).** In the constants block (~:14-19):
  - `HIGHLIGHT_FILL` (`Colors.teal`) → `Theme.accent` **AND** `HIGHLIGHT_GLOW` (`rgba(0,200,200,0.30)`) → `rgba(200,121,58,0.30)`. **These two MUST move together** — the glow is a halo around the fill; migrating one without the other leaves a mismatched teal halo around an amber muscle.
  - `MUSCLE_SEAM` is `rgba(6,9,18,0.7)` — that's the OLD screen background used as an inter-muscle seam. **Re-derive it from `Theme.ink`: `rgba(9,9,11,0.7)`. Do NOT map it to `Theme.line`** (it's a knockout seam, not a border).
  - `BODY_FILL`/`BODY_STROKE`/`MUSCLE_FILL` are neutral white alphas for unworked regions — leave as-is or map to equivalent neutrals; do not tint them.
- [ ] **Step 2: Styles.** container border → `Theme.line`; container radius 14 → `Radius.card`; the `rgba(255,255,255,0.05)` surface → `Theme.panel`; the active toggle's `surfaceTeal`/`borderTeal` → `Theme.panel` + `Theme.accent` border; toggle label teal → `Theme.accent`. **KEEP the toggle pill radii (20/16).** The front/back toggle is a 2-button segmented control with state-dependent styling — keep it hand-rolled.
- [ ] **Step 3: Preserve behavior** — the front/back `useState` toggle, `ALL_TRACKABLE_GROUPS` expansion of "Full Body", and the `MIRROR` transform symmetry.
- [ ] **Step 4: Verify + Commit** — typecheck + suite; `git commit -m "feat(mobile): re-skin MuscleDiagram (highlight fill + glow move together)"`

---

### Task 2: `app/(tabs)/workout.tsx` — launcher (SCHEME B)

**Files:** Modify `OSPREY-app/app/(tabs)/workout.tsx` (~241 ln, ~31 refs).

**Interfaces:** Consumes `Card` from `@/components/ui`; `Theme`, `Radius`, `BorderWidth`.

- [ ] **Step 1: De-color the sport table (the approved design change).** The per-sport config (~:30-90) currently gives each of the 6 sports its own `iconColor` + `surface` + `border`. **Collapse it:** every sport card renders `Theme.panel` bg + `Theme.line` border + `Radius.card`, with the icon and the trailing arrow in `Theme.accent`. Remove the now-dead per-sport color fields (keep the icon name, title, subtitle, and route — those still differentiate the sports). The 6 cards are multi-element (icon + title + subtitle + arrow) so they **cannot** be `<Button>`s — keep them `TouchableOpacity`, optionally wrapped in `<Card>`.
- [ ] **Step 2: Chrome + text.** `container` bg → `Theme.ink`; `title`/`cardTitle` → `Theme.text`; `subtitle`/`cardSub` → `Theme.textSoft`/`Theme.textMut`; card radii → `Radius.card`.
- [ ] **Step 3: Plan-alert banner — FUNCTIONAL, partial migration.** The banner has three severities. **KEEP the `warning` severity amber** (`rgba(245,176,65,0.15)` bg + `Colors.amber`) — it encodes an actual alert. Migrate only the `positive` (`rgba(0,210,190,0.12)`) and `neutral` (`rgba(0,180,170,0.08)`) teal severities to `Theme.panel`/`Theme.accent`. The banner's CTA is string-only → `<Button variant="secondary">`; the dismiss ✕ is glyph-only → keep hand-rolled.
- [ ] **Step 4: Preserve behavior** — `usePlanAdaptation` alert + its AsyncStorage dismissal persistence (`DISMISSED_ALERT_KEY`), `Haptics.selectionAsync`, and the `pickTrackingMode` branch routing (run → `/workout/run` vs `/workout/endurance?mode=outside`).
- [ ] **Step 5: Verify + Commit** — typecheck + suite; `git commit -m "feat(mobile): re-skin Workout launcher, de-color sport cards (scheme B)"`

---

### Task 3: `app/workout/lift.tsx` — pre-workout screens

**Files:** Modify `OSPREY-app/app/workout/lift.tsx` (~1298 ln — split across Tasks 3 and 4). **This task = the pre-workout half only:** the exercise-picker modal, the loading state, the template/prescription preview screen, and the warmup screen (+ their style keys).

**Interfaces:** Consumes `Card`, `Button`; `Theme`, `Radius`, `BorderWidth`. Renders the already-migrated `MuscleDiagram` (Task 1).

- [ ] **Step 1: Exercise-picker modal + loading.** Modal surface → `Theme.panel`, borders → `Theme.line`, radii → `Radius.card`; row text → `Theme.text`/`Theme.textMut`; any `ActivityIndicator` teal → `Theme.accent`.
- [ ] **Step 2: Preview screen.** Header/title → `Theme.text`; the scrollable exercise list rows → `<Card>` or `Theme.panel`/`Theme.line`; meta/secondary text → `Theme.textSoft`/`Theme.textMut`; uppercase section labels → `Theme.accent` + `SpaceGrotesk_700Bold`; footer CTA → `<Button variant="primary">` **only if string-only** — if it hosts a spinner, hand-roll it.
- [ ] **Step 3: Warmup screen.** Surfaces/text per the mapping. **KEEP the warmup flame `Colors.amber`** (functional intensity indicator) — do not migrate it to accent.
- [ ] **Step 4: Preserve behavior** — exercise add/remove from the picker, the template/prescription load, and the transition into the active session.
- [ ] **Step 5: Verify + Commit** — typecheck + suite; `git commit -m "feat(mobile): re-skin lift pre-workout screens (picker, preview, warmup)"`

---

### Task 4: `app/workout/lift.tsx` — active session

**Files:** Modify `OSPREY-app/app/workout/lift.tsx` — **the active-session half:** header, rest banner, set table (exercise cards, column headers, set rows), add-exercise, footer finish button, plate-calculator modal, and the remaining style keys. **Task 3's regions are DONE — do not re-touch them.**

**Interfaces:** Consumes `Card`; `Theme`, `Radius`, `BorderWidth`.

- [ ] **Step 1: Header + rest banner.** Header text → `Theme.text`/`Theme.textMut`; the rest-timer text (currently `Colors.teal`, an active-rest state) → `Theme.accent`; banner surface → `Theme.panel`/`Theme.line`/`Radius.card`. The +15s / Skip controls are glyph/multi-child → keep hand-rolled.
- [ ] **Step 2: Set table.** Exercise cards → `<Card>`; column headers → `Theme.textMut` + `SpaceGrotesk_700Bold`; set-row inputs → `Theme.panel`/`Theme.line`/`Radius.card`.
- [ ] **Step 3: THE CURRENT-SET CUE — do not flatten.** The current/next-set row highlight is `rgba(0,200,200,0.08)`. Mapping it to `Theme.panel` would make it identical to every other row and **erase the cue**. Replace with an accent-tinted background (`rgba(200,121,58,0.10)`) or a `Theme.accent` left border — implementer's choice, but the row MUST remain visibly distinct.
- [ ] **Step 4: FUNCTIONAL — keep.** `logBtnDone` `Colors.green` (set completed) and `setInputDone`'s completed-row de-emphasis stay. `micBtnActive` `Colors.red` (recording ACTIVE) stays. The PR badge migrates to `Theme.accent` per Design Decision 2, and its `#000` text → `Theme.ink`. Other `#000`-on-accent marks (log ✓ checkbox, etc.) → `Theme.ink`.
- [ ] **Step 5: Finish button — HAND-ROLL.** It wraps an `<ActivityIndicator>` → cannot be `<Button>`. Style it to the established hand-rolled pattern and change its spinner `color="#000"` → `Theme.ink`.
- [ ] **Step 6: Plate-calculator modal.** Surface/text/radii per the mapping.
- [ ] **Step 7: Preserve behavior** — the 1s elapsed-timer `setInterval`; the rest countdown via the store (`tickRestTimer`/`addRestSeconds`/`skipRestTimer`); add/remove/complete set; the voice-logging flow (mic permission gate, record/parse/cancel); plate math; the 3-button discard/finish `Alert` (Cancel / Discard & Exit `router.dismissTo` / Finish & Save); finish → `router.replace('/workout/recap')`; all haptics.
- [ ] **Step 8: Verify + Commit** — typecheck + suite; `git commit -m "feat(mobile): re-skin lift active session (keep current-set cue + done/recording states)"`

---

### Task 5: `app/workout/recap.tsx` (shared by all 4 workout types)

**Files:** Modify `OSPREY-app/app/workout/recap.tsx` (~388 ln, ~44 refs). Reached from lift, run, endurance, and hyrox — one migration serves all four, so it must not assume a sport.

**Interfaces:** Consumes `Card`, `Button`; `Theme`, `Radius`, `BorderWidth`.

- [ ] **Step 1: Type badges — SCHEME B (must match Task 2).** The 5-way badge palette (`badgeRun` teal, `badgeLift` gold, `badgeBlue`, `badgeGreen`, `badgeHyrox` red) collapses to **one neutral badge style**: `Theme.panel` bg + `Theme.line` border + `Theme.accent` text + `Radius.card`. Delete the per-type color entries. The workout type is conveyed by the badge's label.
- [ ] **Step 2: Cards + text.** The 4 `card` blocks → `<Card>`; the `rgba(255,255,255,0.04)` surface → `Theme.panel`; text → `Theme.text`/`Theme.textSoft`/`Theme.textMut`; uppercase labels → `SpaceGrotesk_700Bold`; the split-pace readout (brand teal) → `Theme.accent`; the top-level `ActivityIndicator` → `Theme.accent`.
- [ ] **Step 3: PR treatment (Design Decision 2).** `prTitle` `Colors.gold` and the gold/`goldDim` highlight chip → `Theme.accent` / accent-tinted. Flag in the report for the visual pass.
- [ ] **Step 4: Buttons.** The share button wraps an `<ActivityIndicator>` → **hand-roll**. The home CTA is string-only → `<Button variant="primary">`; its `#000` text → `Theme.ink`.
- [ ] **Step 5: FUNCTIONAL — keep.** Share-error `Colors.red` and the "shared" success `Colors.green` stay.
- [ ] **Step 6: Preserve behavior** — `useQuery(fetchWorkoutRecap)`, `ozzieSpeak` on mount, `useUnitPreference` + `formatWeightKg`/`lbToKg` unit switching, the `shareWorkout` async flow with its pending/error/shared states, and haptics.
- [ ] **Step 7: Verify + Commit** — typecheck + suite; `git commit -m "feat(mobile): re-skin workout recap, de-color type badges (scheme B)"`

---

## After all tasks: visual pass + final review

- **Live web-preview visual pass:** open the Workout tab and confirm the de-colored sport cards read clearly (icon + label carry the distinction now that color doesn't). Then check, specifically:
  1. **The plan-alert banner's amber `warning`** against nearby accent chrome — `Colors.amber` #f5a623 vs `Theme.accent` #c8793a are close; confirm the warning still reads as an alert.
  2. **The lift current-set row cue** — is the current set still obviously distinct in the table?
  3. **The PR badge on accent** — does it still read as an achievement, or is a gold "medal" reading missed? (Follow-up if so, not a re-decision.)
  4. **MuscleDiagram's highlight** — fill and glow should match (amber halo around amber muscle, no teal remnant).
  5. Recap's neutral type badges + the green/red share states.
- **Final whole-branch review**, then **finishing-a-development-branch**: merge to main and push (standing user approval).

## Self-Review (plan author)
- Coverage: all 4 Slice-A files have tasks; `lift.tsx` split into pre-workout (T3) vs active session (T4) given its 1298 lines. ✓
- Both user-approved design decisions are stated up front and referenced in the tasks that implement them (T2 + T5 for scheme B; T4 + T5 for PR). ✓
- Functional colors enumerated per task (warning amber, warmup flame amber, recording red, set-done green, share red/green) + the two "do not flatten" cues (current-set row, MuscleDiagram seam/glow pairing). ✓
- Spinner-hosting buttons flagged hand-roll (lift finish, recap share); only string-only buttons use `<Button>`. ✓
- `colors.ts` and `OzzieAvatar` explicitly out of scope. ✓
