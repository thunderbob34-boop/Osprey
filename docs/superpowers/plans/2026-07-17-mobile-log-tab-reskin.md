# Mobile Log Tab — Re-skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Migrate the Log tab (workout / food / weight logging + the barcode scanner + the hydration card) from the old teal/navy `Colors` system to the ink/amber `Theme` system.

**Architecture:** Pure styling swap onto the `Theme`/`Radius`/`BorderWidth` tokens and `Card`/`Button` primitives already shipped. No behavior, prop, data-flow, or layout change. 4th slice of the mobile design-unification program (Home + tab bar + Settings already merged).

**Tech Stack:** Expo/React Native (SDK 52), TypeScript, Jest (`jest-expo`, `TZ=Asia/Kolkata`).

## Global Constraints

- **Styling only — behavior frozen.** Every conditional, handler, mutation, accordion toggle, edit-mode branch, validation, unit switch, deep-link param, and loading/error/empty state must behave identically.
- **Regression gate for EVERY task:** `cd OSPREY-app && npm run typecheck` clean AND `TZ=Asia/Kolkata npx jest` green (241 tests, 30 suites). No new tests (no component-render harness — deliberate).
- **Never touch `OSPREY-app/src/constants/colors.ts`.**
- **Never touch `OSPREY-app/src/components/FieldError.tsx`** — it's shared with not-yet-migrated screens (challenges/races/routes) and its only color is `Colors.red` (functional validation text). Out of scope entirely.
- **Canonical token mapping:**
  | Old | New |
  |---|---|
  | `Colors.bg` (screen/field/container bg) | `Theme.ink` |
  | frosted surface (`bgCard`, `surfaceTeal`, `rgba(255,255,255,0.02-0.10)`, `rgba(0,200,200,*)`) | `Theme.panel` |
  | `Colors.border`/`borderTeal`/`rgba(255,255,255,0.08-0.18)` | `Theme.line` |
  | `Colors.teal`/`tealDark` (brand) | `Theme.accent` |
  | `Colors.textPrimary` | `Theme.text` |
  | `Colors.textSecondary` | `Theme.textSoft` |
  | `Colors.textMuted` | `Theme.textMut` |
  | `borderRadius` 8–20 | `Radius.card` (4) |
  | pill radius (≥20 on chips/round icon buttons) | **KEEP** (intentional pill affordance) |
  | progress track/fill radius 3 | **KEEP** (thin bars) |
  | `#000` text/spinner on an accent-filled button | `Theme.ink` |
  | uppercase section-header label | add `fontFamily: 'SpaceGrotesk_700Bold'` |
- **FUNCTIONAL colors STAY — do NOT migrate any of these:**
  - **GOLD is functional in this file, not brand.** `dayTypeChipRest` (`goldDim` bg + `rgba(200,154,0,0.3)` border) + `dayTypeChipTextRest` (`Colors.gold`) encode **rest day vs training day**, sitting beside the teal training-day chip. Likewise the **copy-yesterday** food chip (`copyYesterdayChip` `goldDim`) + its gold `ActivityIndicator`/text, which is deliberately gold-distinguished from the teal recent-meal chips. **Mapping gold→`Theme.accent` would erase both distinctions** (the teal siblings become accent). KEEP all gold as `Colors.gold`/`goldDim`.
  - `errorText` `Colors.red` (log load-failure), `inputError.borderColor` `Colors.red` (field validation), food-scanner `errorText` `Colors.red` (barcode lookup failure).
  - `HydrationCard`: `met ? Colors.green : …` on both the icon color and the fill background — **green encodes "hydration target met"**. Keep the green branch; migrate only the not-met teal branch to `Theme.accent`.
  - Camera-overlay scrims `rgba(0,0,0,0.5)` in food-scanner — legibility overlays, not surface tokens. KEEP.
- **`log.tsx` keeps its own inline title/subtitle — do NOT swap it for `ScreenHeader`.** `ScreenHeader` renders a back chevron and is for *pushed* sub-screens; `log` is a root tab (Settings likewise keeps an inline title).
- **`Button` constraint:** `children` is typed `string`, so any button hosting an `<ActivityIndicator>` stays HAND-ROLLED (styled `TouchableOpacity`: accent bg, `BorderWidth.card` accent border, `Radius.card`, `Theme.ink` text, disabled/pending opacity). Only plain-text buttons become `<Button>`. **All three `saveBtn`s in log.tsx render a spinner → all stay hand-rolled** (and their `<ActivityIndicator color="#000">` becomes `Theme.ink`).
- Inventory line numbers are from plan-writing time — locate by style-key name and verify before editing.

---

### Task 1: `src/components/HydrationCard.tsx`

**Files:** Modify `OSPREY-app/src/components/HydrationCard.tsx` (~104 ln, ~9 `Colors.` refs). Log-only importer — no bleed.

**Interfaces:** Consumes `Card` from `@/components/ui`; `Theme`, `Radius` from `@/constants/theme`. No public API change (keeps its `emphasized`/`onAdd` props).

- [ ] **Step 1: Card adoption.** Replace the outer `card` `View` with `<Card emphasis={emphasized}>` — the primitive's `emphasis` prop already renders the accent border + offset shadow, which is exactly what the old `cardEmphasized` (teal tint + `borderTeal`) was signalling. Delete the now-dead `card` bg/border/radius and the whole `cardEmphasized` style.
- [ ] **Step 2: Tokens.** `label` (uppercase "HYDRATION") `Colors.teal` → `Theme.accent` **+ `fontFamily: 'SpaceGrotesk_700Bold'`**; `amount` → `Theme.text`; `amountTarget` → `Theme.textMut`; `track` bg → `Theme.line`; `quickAddBtn` bg → `Theme.panel` + border `Theme.line` + radius → `Radius.card`; `quickAddText` → `Theme.text`. **KEEP** track/fill radius 3.
- [ ] **Step 3: FUNCTIONAL.** The icon `color={met ? Colors.green : Colors.teal}` and fill `backgroundColor: met ? Colors.green : Colors.teal` → change ONLY the not-met branch to `Theme.accent`; **keep `Colors.green`** (target met). Keep the `Colors` import for it.
- [ ] **Step 4: Preserve behavior** — `emphasized` styling, `onAdd(oz)` per quick-add, `met` computation, progress clamp, oz/ml formatting via `useUnitPreference`.
- [ ] **Step 5: Verify + Commit** — typecheck + suite; `git commit -m "feat(mobile): re-skin HydrationCard onto Card + ink/amber"`

---

### Task 2: `app/(tabs)/log.tsx` — chrome, header, nutrition card, today's-entries card

**Files:** Modify `OSPREY-app/app/(tabs)/log.tsx` (~1277 ln). This task covers the **display surfaces only**; the three accordion forms are Task 3.

**Interfaces:** Consumes `Card` from `@/components/ui`; `Theme`, `Radius`.

- [ ] **Step 1: Imports + container.** Add `Card` + `Theme`/`Radius` imports (keep `Colors` — functional colors remain). `container` bg → `Theme.ink`. **Keep the inline `title`/`subtitle`** (do NOT use `ScreenHeader`): `title` → `Theme.text`, `subtitle` → `Theme.textMut`.
- [ ] **Step 2: Nutrition card** (`nutritionCard`, conditional on `nutrition`) → `<Card>`; `cardLabel` ("NUTRITION TODAY") → `Theme.textMut` + `SpaceGrotesk_700Bold`; `macroValue` → `Theme.text`; `macroUnit` → `Theme.textMut`; `macroChip`/`tipText` → `Theme.textSoft`; `progressTrack` bg → `Theme.line`; `progressFill` teal → `Theme.accent` (plain calorie bar, no over/under-target switch — safe); `totalText` → `Theme.accent`. **KEEP** track/fill radius 3.
- [ ] **Step 3: Day-type chip — FUNCTIONAL, careful.** The training-day chip's `dayTypeChipText` teal → `Theme.accent`. **The rest-day variant stays GOLD**: leave `dayTypeChipRest` (`goldDim` bg, `rgba(200,154,0,0.3)` border) and `dayTypeChipTextRest` (`Colors.gold`) exactly as-is. Add `SpaceGrotesk_700Bold` to `dayTypeChipText` (font only). This preserves the rest-vs-training distinction.
- [ ] **Step 4: Today's-entries card** (`todayCard`) → `<Card>`; `cardLabel` ("TODAY") same treatment as Step 2; `entryPrimary` → `Theme.text`; `entrySecondary` → `Theme.textSoft`; `emptyText`/`entryDeleteText` → `Theme.textMut`; card border → `Theme.line`. **KEEP `errorText` `Colors.red`** (load-failure). Preserve the `isLoading`/`error`/list branches, the workout + food row rendering, and the edit + delete affordances.
- [ ] **Step 5: Preserve behavior** — the delete-confirm `Alert.alert` (destructive option) and its `onError` toast; edit-mode entry (`editingWorkoutId`/`editingFoodId`); `HydrationCard` usage + `addHydration.mutate(oz)`; unit switching.
- [ ] **Step 6: Verify + Commit** — typecheck + suite; `git commit -m "feat(mobile): re-skin Log chrome, nutrition + today cards"`

---

### Task 3: `app/(tabs)/log.tsx` — the three accordion sections (workout / food / weight)

**Files:** Modify `OSPREY-app/app/(tabs)/log.tsx` (the accordion regions + their style keys). Task 2's regions are DONE — do not re-touch them.

**Interfaces:** Consumes `Card`; `Theme`, `Radius`. (`Button` NOT used for the save buttons — see below.)

- [ ] **Step 1: Accordion headers + forms.** The three `actionCard` `TouchableOpacity` accordion headers → `<Card>` wrapping the touchable (keep them touchable; they are NOT `<Button>`); `actionTitle` → `Theme.text`; `actionChevron` teal → `Theme.accent`. The three `form` containers (`rgba(255,255,255,0.02)`) → `Theme.panel` + `Theme.line` border + `Radius.card` (or `<Card>` if clean).
- [ ] **Step 2: Inputs, labels, chips.** `input` bg → `Theme.panel`, border → `Theme.line`, radius → `Radius.card`, text → `Theme.text`; `fieldLabel` → `Theme.textMut` + `SpaceGrotesk_700Bold`; `chip` bg → `Theme.panel`, border → `Theme.line`, **KEEP pill radius 20**; `chipText` → `Theme.textSoft`; `chipActive` (`surfaceTeal`/`borderTeal`) → `Theme.panel`/`Theme.line` + accent, `chipTextActive` → `Theme.accent`; `recentChip` surface → `Theme.panel`, `recentChipName` → `Theme.accent`, `recentChipMeta` → `Theme.textMut`; `resultsBox` bg → `Theme.panel` + border `Theme.line`, `resultName` → `Theme.text`, `resultMeta` → `Theme.textMut`; `scanBtn` surface → `Theme.panel`/`Theme.line` (**KEEP pill radius 20**), `scanBtnText` → `Theme.accent`; `weightSummaryText` → `Theme.textSoft`; `chartDateRange`/`analyzingText` → `Theme.textMut`.
- [ ] **Step 3: Copy-yesterday chip — FUNCTIONAL, do NOT migrate.** Leave `copyYesterdayChip` (`goldDim`) and its gold text + gold `ActivityIndicator` exactly as-is — the gold deliberately distinguishes it from the (now-accent) recent-meal chips.
- [ ] **Step 4: Save buttons — HAND-ROLL all three.** Each `saveBtn` renders an `<ActivityIndicator>` when pending, so none can use `<Button>`. Style each to match the established hand-rolled pattern: `Theme.accent` bg, `BorderWidth.card` accent border, `Radius.card`, `saveBtnText` `#000` → `Theme.ink`, and change the pending `<ActivityIndicator color="#000">` → `Theme.ink`. Preserve the Save-vs-Update label logic and `disabled`/`accessibilityState.busy` on pending mutations.
- [ ] **Step 5: FUNCTIONAL — keep `inputError.borderColor` `Colors.red`** (per-field validation ring). Do not touch `FieldError.tsx`.
- [ ] **Step 6: Preserve behavior** — `openSection` accordion toggling incl. the `openFood` deep-link param from food-scanner; the photo-meal flow (ImagePicker perms, `estimateMealFromPhoto`, `analyzingPhoto`, confidence note, "didn't catch food" alert); barcode nav `router.push('/food-scanner')`; food-name search (`searching`/`foodResults`/select-row autofill from `quantityG`); copy-yesterday mutation; `fieldErrors`/`clearFieldError`; the weight SVG chart `chartWidth` onLayout; kg/lb + km/mi switching.
- [ ] **Step 7: Verify + Commit** — typecheck + suite; `git commit -m "feat(mobile): re-skin Log workout/food/weight accordion forms"`

---

### Task 4: `app/food-scanner.tsx`

**Files:** Modify `OSPREY-app/app/food-scanner.tsx` (~247 ln, ~16 refs). Standalone route, no shared components.

**Interfaces:** Consumes `Button` from `@/components/ui`; `Theme`, `Radius`.

- [ ] **Step 1: Container + text.** `container` bg → `Theme.ink`; `closeBtnText`/`hint`/`statusText`/`title` → `Theme.text`; `hintSmall` → `Theme.textSoft`; `subtitle`/`linkText` → `Theme.textMut`.
- [ ] **Step 2: Accent + radii.** `torchBtnOn` bg / `frame.borderColor` / `manualBtn` bg / `primaryBtn` bg teal → `Theme.accent`; `manualBtnText` + `primaryBtnText` `#000` → `Theme.ink`; the inline torch icon `color={torchOn ? '#000' : Colors.textPrimary}` → `Theme.ink` / `Theme.text`; `ActivityIndicator color={Colors.teal}` (both) → `Theme.accent`; radii `frame` 16 / `manualBtn` 10 / `primaryBtn` 12 → `Radius.card`. **KEEP** the `closeBtn`/`torchBtn` pill radius 20 and the `rgba(0,0,0,0.5)` camera scrims.
- [ ] **Step 3: Buttons.** `manualBtn` and `primaryBtn` are string-only → `<Button variant="primary">`; the permission-screen secondary → `<Button variant="secondary">`. Keep `closeBtn`/`torchBtn` (icon-only overlay chrome) and the link touchable raw.
- [ ] **Step 4: FUNCTIONAL — keep `errorText` `Colors.red`** (barcode lookup failure).
- [ ] **Step 5: Preserve behavior** — `useCameraPermissions` gate + permission-denied screen; torch toggle; `lookupBarcode` with the `scanned` re-entry lock; Haptics on hit; `router.replace('/(tabs)/log', {openFood:'1'})` on success (this drives log's deep-link accordion); `router.back()` on close.
- [ ] **Step 6: Verify + Commit** — typecheck + suite; `git commit -m "feat(mobile): re-skin food-scanner"`

---

## After all tasks: visual pass + final review

- **Live web-preview visual pass:** open the Log tab; confirm the nutrition + today cards, the three accordion forms (expand each), chips, inputs, and save buttons read ink/amber. **Specifically check the two GOLD affordances** — the rest-day chip beside a training-day chip, and the copy-yesterday chip beside recent-meal chips: confirm gold still reads as clearly distinct from the new amber accent. If they're too close, note it as a follow-up (make rest-day/copy-yesterday neutral instead of gold) rather than silently changing semantics. Also confirm `HydrationCard`'s emphasized state and its met-green.
- **Final whole-branch review**, then **finishing-a-development-branch**: merge to main and push (the user has standing approval to merge + push this slice).

## Self-Review (plan author)
- Coverage: all 3 files have tasks; `log.tsx` split into display (T2) vs forms (T3) given its 1277 lines. ✓
- The gold judgment call is documented as FUNCTIONAL with the reasoning (adjacent teal siblings) in both Global Constraints and the per-task steps. ✓
- Every spinner-hosting button flagged hand-roll; only string-only buttons use `<Button>`. ✓
- `FieldError.tsx` and `colors.ts` explicitly out of scope; `ScreenHeader` explicitly NOT adopted for a root tab. ✓
