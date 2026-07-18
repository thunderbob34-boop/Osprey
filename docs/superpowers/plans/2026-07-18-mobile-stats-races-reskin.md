# Mobile Stats Races Cluster Re-skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Stats tab's races cluster (`races.tsx`, `race-event.tsx`, `race-search.tsx`) off the old teal/navy `Colors` system onto the ink/amber `Theme` system.

**Architecture:** Pure styling migration, the last one in the program. `races.tsx` is the largest screen file in the app (1375 lines, ~104 `Colors.` refs) and splits cleanly along its existing section boundaries: three self-contained panel components (Logistics / Retrospective / Partners), then the main screen. The two smaller screens are independent files and run in parallel.

**Tech Stack:** React Native / Expo SDK 52, expo-router, TypeScript, Jest (`TZ=Asia/Kolkata`).

**Branch:** `mobile-stats-races-reskin`, off `main` at `3469e72`.

**This is the FINAL slice.** When it merges, `colors.ts` will have no remaining consumers among the migrated surfaces and the whole design-unification program is complete.

---

## ⚠️ Testing reality

**No screen-level tests exist for any of these three screens** — only service-layer tests (`src/services/__tests__/races-challenges.test.ts`) which never render a component. The 244-test suite proves imports and types survive and nothing more. **"Tests pass" is not evidence a screen still looks right.**

These are token-substitution tasks with nothing assertable, so they use typecheck + suite as regression gates plus an explicit self-review checklist. **Do not invent tests that assert a hex equals itself.**

Unlike the previous slice, these three are all **pushed screens** (not tab routes), so they ARE reachable in the Expo web preview by URL — `/races`, `/race-search`. Use that.

---

## Global Constraints

Every task's requirements implicitly include this section.

- **STYLING ONLY.** No behavior, prop, or data-flow change. No refactors.
- **Never touch** `src/constants/colors.ts`, `app/paywall.tsx`, `src/components/ScreenHeader.tsx`, `src/components/DateField.tsx`, `src/components/InputModal.tsx`, or `src/components/FieldError.tsx`. **All are already migrated or deliberately excluded** — `DateField` and `InputModal` landed in the previous slice, and `FieldError`'s only colour is functional validation red (`theme.ts` has no red token, so migrating it means `Colors.red` → `Colors.red`).
- **`Button.children` is typed `string`** → any button hosting an `<ActivityIndicator>` or multi-element children MUST stay a hand-rolled `TouchableOpacity`. **The recipe:**
  ```ts
  {
    backgroundColor: Theme.accent,
    borderWidth: BorderWidth.card,
    borderColor: Theme.accent,
    borderRadius: Radius.card,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  }
  // text/spinner colour: Theme.ink
  // disabled: opacity 0.5
  ```
  This **mirrors the `Button` primitive on purpose** (`Button.tsx:49-55`). It is NOT a manufactured cue — it is specified here so reviewers don't flag it, which happened three times in an earlier slice.
  **A small subordinate icon glyph must NOT get this filled-accent treatment** — that's for primary actions only. A bare accent glyph is correct there.
- **`<Button>` CANNOT FLEX.** It applies its `style` to the inner `Pressable`, but a row's flex child is Button's `Animated.View` wrapper (transform only), so `style={{flex: 1}}` **silently does nothing** and the button collapses to text width. **Any side-by-side button row must be hand-rolled.**
- **`Card.style` is typed `ViewStyle`, not `StyleProp<ViewStyle>`** → pass one spread-merged object, not an array.
- **Uppercase-label rule:** eyebrow/section labels heading a card or screen → `Theme.accent`; table/column headers and inline field labels → `Theme.textMut`. Both get `fontFamily: 'SpaceGrotesk_700Bold'`.
- **Nested surfaces recede to `Theme.ink`.** A small surface inside a `Theme.panel` card must NOT also be `Theme.panel` — same fill as its parent reads flat. Give it `Theme.ink`. The accent tint (`Theme.accent + '1F'`) is reserved for **ACTIVE/selected** chips, never passive labels or inputs. This rule is now consistent across `routes.tsx`, `challenges.tsx`, `stats.tsx`, `DateField`, and `InputModal`.
- **A scrim is NOT a surface.** A modal backdrop provides contrast over arbitrary content beneath. Never map it to `Theme.panel`; re-derive from `Theme.ink` at the original alpha — `rgba(0,0,0,0.5)` → `rgba(9,9,11,0.5)`. All three existing scrims in the app now follow this.
- **Radius:** 8-20 → `Radius.card`. **Sheet/modal top corners (20) KEEP** — a large top radius is a sheet affordance, not card chrome (precedent: `src/screens/DailySummary.tsx:889`). Pill (≥20) and dot/thin-bar (≤4) radii KEEP.
- **Card borders use `BorderWidth.card` (2); text inputs use 1px.** This distinction is established across the migrated screens — inputs are `Theme.ink` + 1px + `Theme.line`; card containers are `Theme.panel` + 2px + `Theme.line`.
- **`#fff`/`#000` marks on an accent fill → `Theme.ink`.**
- **Do NOT manufacture state cues.** Migrate highlights that exist; don't invent new ones.
- **BEFORE migrating a brand token, check what sits BESIDE it.** The program's most-repeated lesson. A colour whose sibling is a *different* colour conveying a *different* meaning is a signal, not brand.
- **STAGING RULE:** parallel tasks share one working tree. Each implementer stages **only its own file paths** — never `git add -A` or `git add .`. Retry once on `index.lock` contention.
- **Verify per task:** `cd OSPREY-app && npm run typecheck && TZ=Asia/Kolkata npx jest` — typecheck clean, 244/244 tests, 30/30 suites.

---

## User-approved design decisions — settled, do NOT reopen

1. **The Logistics/Retrospective panel-identity split COLLAPSES to a single accent.** Today `logisticsTitle` is `Colors.teal` (`races.tsx:1153`) and `retroTitle` is `Colors.gold` (`races.tsx:1271`) — a deliberate two-tone cue so the user knows which panel is open. **The user was shown this trade-off and chose to collapse it.** Both become `Theme.accent`. The disambiguation cue goes away on purpose. **This is a decision, not a defect — a reviewer must not flag it.**

2. **The pacing-delta pair KEEPS green/amber.** `deltaBadgeGood` / `deltaValueGood` (ahead of goal) vs `deltaBadgeMiss` / `deltaValueMiss` (behind goal) is a functional pass/fail signal, directly analogous to the pace-band amber and the calendar's day states. **Keep the green and amber**, including the raw rgba fills at `races.tsx:1278-1284`.

## Controller decision — `race-search.tsx`'s bespoke header

Every other screen in the Stats tab uses the shared, already-migrated `ScreenHeader`; `race-search.tsx` hand-rolls its own back-arrow header instead. Recon flagged this as a possible consistency fix.

**Decision: KEEP the bespoke header and style it to match.** Swapping in `ScreenHeader` is a structural/component change, not a token substitution, and this slice's mandate is styling-only. Converting it would also change the screen's layout and back behaviour, which no test covers. **Flag it as a follow-up** if the visual pass shows the two headers reading differently; do not convert it here.

---

## File Structure

| File | Lines | `Colors.` refs | Task | Notes |
|---|---|---|---|---|
| `app/races.tsx` — Logistics + Retro + Partners panels | ~1375 total | ~104 total | 1 | Self-contained components at `:93-236`, `:283-431`, `:440-546` + style blocks `:1135-1204`, `:1259-1307`, `:1308+` |
| `app/races.tsx` — main screen + list/form styles | — | — | 2 | `RacesScreen` at `:549+`, styles `:1000-1134` and `:1205-1258`. **MUST follow Task 1 — same file.** |
| `app/race-event.tsx` | 455 | 25 | 3 | Mechanical. 5 `ActivityIndicator` sites. |
| `app/race-search.tsx` | 309 | 28 | 4 | Mechanical + bespoke header (keep, style it). 2 `ActivityIndicator` sites. |

**Parallelism:** Tasks 1, 3, 4 touch three different files → run concurrently. Task 2 waits for Task 1.

---

## Task 1: `races.tsx` — the three panels

**Files:**
- Modify: `OSPREY-app/app/races.tsx` — **ONLY** `LogisticsPanel` (~`:93-236`), `RetroPanel` (~`:283-431`), `PartnersPanel` (~`:440-546`), and their style blocks (`// ── Logistics panel ──` ~`:1135`, `// ── Retro panel ──` ~`:1259`, `// ── Partners panel ──` ~`:1308`).

**Interfaces:**
- Produces: nothing consumed by later tasks. Task 2 owns the rest of this file and must not re-migrate your regions.

### The two decisions this task carries

**COLLAPSE the panel identity.** `logisticsTitle` (`:1153`, `Colors.teal`) and `retroTitle` (`:1271`, `Colors.gold`) both become `Theme.accent`. They are uppercase section labels heading their panels, so both also get `fontFamily: 'SpaceGrotesk_700Bold'`. The two-tone "which panel am I in" cue disappears by user decision.

**KEEP the pacing delta.** At `:1278-1284`:
```ts
deltaBadgeGood: { backgroundColor: 'rgba(76,222,128,0.07)', borderColor: 'rgba(76,222,128,0.25)' },
deltaBadgeMiss: { backgroundColor: 'rgba(245,166,35,0.07)', borderColor: 'rgba(245,166,35,0.25)' },
```
and at `:1288-1289`:
```ts
deltaValueGood: { color: Colors.green },
deltaValueMiss: { color: Colors.amber },
```
**Leave all four exactly as they are** and add a `// FUNCTIONAL — pass/fail against goal time, not brand` comment above the badge pair, matching how the Workout and Stats slices annotated their preserved signals.

`feelChipActive` (`:1302`, `Colors.surfaceGold`/`borderGold`) is the 1-5 "how did it feel" selector — a generic **selected-chip** state, not a semantic scale. It becomes the active-chip treatment: `Theme.accent + '1F'` fill with a `Theme.accent` border. (This is the one place the accent tint IS correct — it's an active chip.)

- [ ] **Step 1: Read the three components and their style blocks, and inventory every colour**, classifying each functional vs decorative. Line numbers above are plan-time — verify against the current file.

- [ ] **Step 2: Apply the migration** per the mapping in Global Constraints, plus the two decisions above.

Panels are modal-ish overlays — if any has a **scrim**, re-derive it from `Theme.ink` (`rgba(9,9,11,<same alpha>)`), do not flatten it to a surface. If any has sheet-style top corners at 20, keep 20.

- [ ] **Step 3: Hand-roll every spinner button.** `races.tsx` has 8 `ActivityIndicator` sites; the ones in your regions include the Logistics "Save Logistics" and "Generate/Refresh briefing" controls and the Retro "Save Retrospective" and "Generate/Refresh" controls. Use the recipe in Global Constraints, with `<ActivityIndicator color={Theme.ink} />`.

- [ ] **Step 4: Verify**

```bash
cd OSPREY-app && npm run typecheck && TZ=Asia/Kolkata npx jest
```
Expected: typecheck clean, 244/244, 30/30.

- [ ] **Step 5: Commit**

```bash
git add OSPREY-app/app/races.tsx
git commit -m "feat(mobile): re-skin races panels (collapse panel identity, keep pacing delta)"
```

---

## Task 2: `races.tsx` — main screen

**Files:**
- Modify: `OSPREY-app/app/races.tsx` — everything Task 1 did not touch: `RacesScreen` (~`:549+`), the shared/list/card styles (~`:1000-1134`), and the add-race form styles (~`:1205-1258`).

**Interfaces:**
- Consumes: Task 1's work is already in the file. **Read the current file. Do not re-migrate the three panels or their style blocks.**

**MUST run AFTER Task 1 — same file.**

- [ ] **Step 1: Read the current file** (post-Task-1) and inventory every remaining `Colors.` reference.

- [ ] **Step 2: Apply the migration** per Global Constraints.

Specific notes:
- The race list/cards, the countdown label (`countdownLabel` at `:48` has **no colour coding** — don't add any), the add-race form, and the empty/loading states.
- `router.push('/paywall')` appears twice in this file — style the CTA buttons, but do not touch the navigation or `paywall.tsx`.
- This file imports `DateField`, `InputModal`, and `FieldError`, **all already migrated or deliberately excluded**. Do not touch them. Their appearance inside your migrated screen is correct.
- The remaining spinner buttons here include "Save Race". Hand-roll per the recipe.

- [ ] **Step 3: Handle the `Colors` import.** Drop it ONLY if genuinely no reference survives. Task 1 kept `Colors.green`/`Colors.amber` for the pacing delta, so it almost certainly stays. Verify with `grep -n "Colors\." app/races.tsx` before removing.

- [ ] **Step 4: Verify**

```bash
cd OSPREY-app && npm run typecheck && TZ=Asia/Kolkata npx jest
```
Expected: typecheck clean, 244/244, 30/30.

- [ ] **Step 5: Commit**

```bash
git add OSPREY-app/app/races.tsx
git commit -m "feat(mobile): re-skin races main screen"
```

---

## Task 3: `race-event.tsx`

**Files:**
- Modify: `OSPREY-app/app/race-event.tsx` (455 lines, ~25 `Colors.` refs)

**Interfaces:**
- Consumes/produces nothing. Imports `ScreenHeader` — **already migrated, do not touch.**

Recon found this file mechanical. **Run the Step 1 inventory anyway** — "recon said so" isn't the same as having looked.

- [ ] **Step 1: Inventory every colour**, classifying functional vs decorative. Watch for race-status colour coding (upcoming / past / goal / PR) — if a status IS colour-coded against a differently-meaning sibling, that's functional and must be preserved. Report it rather than migrating it if you find one.

- [ ] **Step 2: Apply the migration** per Global Constraints.

- [ ] **Step 3: Hand-roll the spinner controls.** There are 5 `ActivityIndicator` sites, including "Train for This Event", "Add to My Races", and a full-screen loading overlay. Buttons use the recipe (`Theme.ink` spinner). **The full-screen overlay is not a button** — if it has a scrim, re-derive it from `Theme.ink` at the original alpha rather than flattening it to a surface.

**If "Train for This Event" and "Add to My Races" sit side by side in a row, they MUST be hand-rolled** — `<Button>` cannot flex (see Global Constraints).

- [ ] **Step 4: Verify**

```bash
cd OSPREY-app && npm run typecheck && TZ=Asia/Kolkata npx jest
```
Expected: typecheck clean, 244/244, 30/30.

- [ ] **Step 5: Commit**

```bash
git add OSPREY-app/app/race-event.tsx
git commit -m "feat(mobile): re-skin race-event screen"
```

---

## Task 4: `race-search.tsx`

**Files:**
- Modify: `OSPREY-app/app/race-search.tsx` (309 lines, ~28 `Colors.` refs)

**Interfaces:**
- Consumes/produces nothing. **This screen does NOT use `ScreenHeader`** — it hand-rolls its own back-arrow header at ~`:128-140`.

**Controller decision — keep the bespoke header.** Style it to match the migrated `ScreenHeader` look (ink ground, `Theme.accent` back chevron, `Theme.text` title, `Theme.line` bottom border at `BorderWidth.card`), but **do NOT swap in the `ScreenHeader` component.** That's a structural change beyond this slice's styling-only mandate, and it would alter layout and back behaviour that no test covers. Note in your report how closely the styled result matches `ScreenHeader`, so the visual pass can judge whether a follow-up conversion is worth it.

- [ ] **Step 1: Inventory every colour**, classifying functional vs decorative. The search results list may colour-code result types — check before migrating.

- [ ] **Step 2: Apply the migration** per Global Constraints, including the header per the decision above.

- [ ] **Step 3: Hand-roll the spinner controls** (2 `ActivityIndicator` sites) per the recipe.

- [ ] **Step 4: Verify**

```bash
cd OSPREY-app && npm run typecheck && TZ=Asia/Kolkata npx jest
```
Expected: typecheck clean, 244/244, 30/30.

- [ ] **Step 5: Commit**

```bash
git add OSPREY-app/app/race-search.tsx
git commit -m "feat(mobile): re-skin race-search screen"
```

---

## Task 5: Visual pass, whole-branch review, merge

**Files:** none (verification only).

- [ ] **Step 1: Visual pass**

Start the Expo dev server (`.claude/launch.json` name: `OSPREY-app (Expo)`, port 8081). **These are pushed screens, so URL navigation works** — unlike the last slice's tab route. Visit `http://localhost:8081/races` and `http://localhost:8081/race-search`.

**Known preview limits:** react-native-web ignores synthetic `MouseEvent`/`PointerEvent`, so `Pressable`s cannot be driven — panels and modals that require a tap may be unreachable. Navigate by URL. Say plainly what could not be reached rather than reporting an unverified check as passed. An account with no saved races will show empty states.

**Check specifically:**
1. The collapsed panel identity — Logistics and Retrospective now both accent. Confirm this reads acceptably rather than confusingly (it was a deliberate trade-off).
2. The pacing-delta green/amber pair still reads as a pass/fail signal.
3. `race-search`'s bespoke header against the `ScreenHeader` used on `races`/`race-event` — do they look like the same app?
4. Nested surfaces (chips, inputs) recede rather than sitting flush on their cards.

**Do NOT press any destructive or write action** — saving a race, saving logistics, saving a retrospective, or generating a briefing all write real data to the user's account and some call a paid LLM endpoint.

- [ ] **Step 2: Whole-branch review**

Run `scripts/review-package <merge-base> HEAD` and dispatch a final review on the most capable model. Point it at this plan, the progress ledger, and the design decisions. Ask for the cross-file view the per-task reviews cannot give — and specifically for the seam between Tasks 1 and 2, which split one file.

- [ ] **Step 3: Fix any Critical/Important findings**, then re-verify.

- [ ] **Step 4: Merge and push**

```bash
git checkout main && git merge --no-ff mobile-stats-races-reskin
cd OSPREY-app && npm run typecheck && TZ=Asia/Kolkata npx jest
git push origin main
```

- [ ] **Step 5: Confirm the program is complete**

After merging, check what still references the old system:

```bash
cd OSPREY-app && grep -rln "constants/colors" app src | sort
```

Report the remaining consumers. `colors.ts` itself stays (it still owns `Colors.green`/`red`/`amber`/`gold` as functional signal colours referenced by migrated screens) — but no screen should still be using it for *chrome*. List anything that is, as the program's remaining tail.

---

## Execution notes

**Suggested wave 1:** Tasks 1, 3, 4 in parallel (three different files).
**Wave 2:** Task 2 (after Task 1 frees `races.tsx`), then Task 5.

**Before dispatching:** archive the previous slice's `task-*.md` files out of `.superpowers/sdd/`. Task numbers are reused every slice and a stale brief was dispatched by mistake last time. Regenerate every brief from this plan; never point an agent at a brief file you did not just create.
