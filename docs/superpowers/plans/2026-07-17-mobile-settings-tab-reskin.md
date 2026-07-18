# Mobile Settings Tab — Re-skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Migrate the Settings tab (and its two first-needed shared components) from the old teal/navy `Colors` system to the ink/amber `Theme` system.

**Architecture:** Pure styling swap onto the `Theme`/`Radius`/`BorderWidth`/`Shadow` tokens and `Card`/`Button`/`Badge` primitives already shipped and merged. No behavior, prop, data-flow, or layout change. Third slice of the mobile design-unification program (Home + tab bar already done).

**Tech Stack:** Expo/React Native (SDK 52), TypeScript, Jest (`jest-expo`, `TZ=Asia/Kolkata`).

## Global Constraints

- **Styling only — behavior frozen.** Every conditional render, handler, toggle, mutation, gated section, nav push, unit/metric switch, loading/error/empty state must behave identically. Any behavior change is a defect.
- **Regression gate for EVERY task:** `cd OSPREY-app && npm run typecheck` clean AND `TZ=Asia/Kolkata npx jest` green (241 tests, 30 suites). No new tests (no component-render harness — deliberate). Do not add `.tsx` test files.
- **Never touch `OSPREY-app/src/constants/colors.ts`** — untouched screens still depend on it. Migrate files OFF `Colors`; keep the `Colors` import in any file that still references a *functional* color.
- **Canonical token mapping (apply everywhere):**
  | Old | New |
  |---|---|
  | `Colors.bg` `#060912` (screen/field/container bg) | `Theme.ink` |
  | frosted surface (`Colors.bgCard`, `surfaceTeal`, `surfaceGold`, `goldDim`, `rgba(255,255,255,0.04-0.10)`, `rgba(0,200,200,*)`) | `Theme.panel` |
  | `Colors.border`/`borderTeal`/`borderGold`/`rgba(255,255,255,0.08-0.18)` | `Theme.line` |
  | `Colors.teal` / `Colors.tealDark` / `Colors.gold` (brand accents) | `Theme.accent` |
  | `Colors.textPrimary` | `Theme.text` |
  | `Colors.textSecondary` | `Theme.textSoft` |
  | `Colors.textMuted` | `Theme.textMut` |
  | any `borderRadius` 8–20 | `Radius.card` (4) |
  | pill-shaped chip radius (e.g. 24) | KEEP as-is (intentional pill affordance — migrate its colors only) |
  | `#000` text on an accent-filled button | `Theme.ink` |
  | uppercase section-header label | add `fontFamily: 'SpaceGrotesk_700Bold'` |
- **FUNCTIONAL colors STAY (do not migrate to accent):** any green/amber/red encoding state or data — validation-error red, destructive/delete red (settings danger zone), the plan-replace amber warning (preferences), the intensity/effort/weather-severity legend colors in plan-preview (`INTENSITY_COLORS`, `EFFORT_COLORS` — INCLUDING `EFFORT_COLORS.moderate` which is `Colors.teal` used as a *legend swatch*, not brand — leave it), ZonesCard's green/amber zone dots, HR-zone colors. When in doubt whether a color is brand vs functional, STOP and ask.
- **`Button` primitive constraint:** its `children` is typed `string`, so any button that hosts an `<ActivityIndicator>` spinner (loading state) CANNOT use `<Button>` — keep those hand-rolled as a `TouchableOpacity`/`View` styled to match the primary/secondary look (mirror `Theme.accent` bg / `BorderWidth.card` / `Radius.card` / `Theme.ink` text / disabled opacity). Only plain-text buttons become `<Button>`. (Widening `Button.children`→`ReactNode` is a deferred future task — NOT this slice.)
- **Shared-component reach:** `ScreenHeader` (Task 1) is consumed by ~9 screens repo-wide — re-skinning it makes those (still-teal) screens show an amber header early; that's the accepted transient. `preferences.tsx` (Task 3) is shared with the Workout tab; `paywall.tsx` (Task 6) with the Stats tab — re-skinning here migrates their appearance in those tabs too (intended; first-needer owns it).
- Inventory line numbers below are from plan-writing time — locate current code by style-key name and verify before editing.

---

### Task 1: Shared components — `ScreenHeader` + `ZonesCard`

**Files:**
- Modify: `OSPREY-app/src/components/ScreenHeader.tsx` (75 ln)
- Modify: `OSPREY-app/src/components/ZonesCard.tsx` (194 ln)

**Interfaces:** Consumes `Theme`/`Radius`/`BorderWidth` (add imports). No API change to either component.

- [ ] **Step 1: ScreenHeader.** `header.borderBottomColor` `Colors.border` → `Theme.line`; `title.color` `Colors.textPrimary` → `Theme.text`; the inline chevron `color={Colors.teal}` → `Theme.accent`; `borderBottomWidth: 1` → `BorderWidth.card`. No functional colors. Preserve the `defaultBack()` `router.canGoBack()` fallback. Remove the `Colors` import (nothing functional remains).

- [ ] **Step 2: ZonesCard.** `card` `surfaceTeal`/`borderTeal`/radius14 → `Theme.panel`/`Theme.line`/`Radius.card` (or wrap in `<Card>` if clean); `label` `Colors.teal` → `Theme.accent` + `SpaceGrotesk_700Bold` (uppercase "YOUR ZONES"); `tag` `goldDim` bg → `Theme.panel`, `tagText` `Colors.gold` → `Theme.accent`, tag radius6 → `Radius.card`; `rowLabel` → `Theme.textSoft`, `rowValue` → `Theme.text`, `nudge` → `Theme.textMut`. **KEEP the zone dot `Colors.green`/`Colors.amber` (aerobic vs threshold — functional).** Preserve the null-returns (no display / empty rows / lift goal), the `isEstimated` tag + nudge conditionals.

- [ ] **Step 3: Verify** — `cd OSPREY-app && npm run typecheck && TZ=Asia/Kolkata npx jest` clean + 241/241.
- [ ] **Step 4: Commit** — `git add OSPREY-app/src/components/ScreenHeader.tsx OSPREY-app/src/components/ZonesCard.tsx && git commit -m "feat(mobile): re-skin ScreenHeader + ZonesCard onto the ink/amber system"`

---

### Task 2: `app/(tabs)/settings.tsx`

**Files:** Modify `OSPREY-app/app/(tabs)/settings.tsx` (791 ln, styles ~666-791)

**Interfaces:** Consumes `Card`, `Button` from `@/components/ui`; `Theme`, `Radius` from `@/constants/theme`.

- [ ] **Step 1: Container + text + surfaces.** `container.bg` → `Theme.ink`; the 7 `styles.card` `<View>` blocks + `signOutBtn` → `Theme.panel`/`Theme.line`/`Radius.card` (adopt `<Card>` for the 7 content cards where clean); text: `title`/`cardValue`/`signOutText` → `Theme.text`, `subtitle`/`chevron`/`linkText`/`versionText`/`cardLabel` → `Theme.textMut`, `switchRowSub`/`planRowSub`/`dangerSub`/`unitOptionText` → `Theme.textSoft`; `cardLabel`/`dangerLabel` uppercase → add Space Grotesk; `rowDivider` → `Theme.line`.

- [ ] **Step 2: Accent + controls.** `unitOptionActive` surfaceTeal/borderTeal → `Theme.panel`/`Theme.line`+accent, `unitOptionTextActive` → `Theme.accent`; `primaryBtn` bg → `Theme.accent`; `subLinkText`/`exportBtnText` → `Theme.accent`, `exportBtn` surface → panel/line; inline `ActivityIndicator color={Colors.teal}` (all occurrences) → `Theme.accent`; `Switch` `trackColor` true `Colors.tealDark`/`thumbColor Colors.teal` → `Theme.accent`; radii → `Radius.card`.

- [ ] **Step 3: Buttons.** `primaryBtn` "Upgrade" (plain text) → `<Button variant="primary">`; `signOutBtn` → `<Button variant="secondary">`. **Hand-roll (spinner):** the health-connect `primaryBtn`, `exportBtn`, `dangerBtn` (each wraps an ActivityIndicator) — keep as styled `TouchableOpacity`. Keep the unit segmented control hand-rolled.

- [ ] **Step 4: FUNCTIONAL — do NOT migrate the danger zone.** `dangerCard` (`rgba(255,68,68,*)` bg/border), `dangerLabel`/`dangerBtnText` `Colors.red`, `dangerBtn` red border, its red `ActivityIndicator` — all STAY (destructive delete-account affordance). `dangerLabel` may still gain Space Grotesk (font only), but its color stays red.

- [ ] **Step 5: Preserve ALL behavior** — the 6 `useEffect` loaders; calendar/supplement/race-week/evening-brief/nudge toggles; `handleConnectHealth`/`handleRestore`/`handleExportData`/two-step `handleDeleteAccount`/`handleSignOut`; `isHealthKitSupported()` gate; `plusActive`-gated upgrade button; `setUnits.mutate`; nav pushes to `/paywall`,`/supplements`,`/plan-preview`,`/preferences`.

- [ ] **Step 6: Verify + Commit** — typecheck+suite; `git commit -m "feat(mobile): re-skin Settings screen (keep danger-zone red)"`

---

### Task 3: `app/preferences.tsx` (shared with Workout tab)

**Files:** Modify `OSPREY-app/app/preferences.tsx` (816 ln, styles ~701-816)

**Interfaces:** Consumes `Button` from `@/components/ui`; `Theme`, `Radius`.

- [ ] **Step 1: Container + inputs + chips.** `container.bg` → `Theme.ink`; `input`/`chip`/`chipLarge` bg → `Theme.panel`, borders → `Theme.line`; input/chip radii 10 → `Radius.card`; **chip pill radius 24 → KEEP** (migrate its colors only); `placeholderTextColor` `Colors.textMuted` → `Theme.textMut`.
- [ ] **Step 2: Text + accent.** `title`/`input` text → `Theme.text`; `subtitle`/`helperText`/`chipText`/`chipTextLarge` → `Theme.textSoft`; `sectionLabel`/`skipText` → `Theme.textMut`, `sectionLabel` uppercase → add Space Grotesk; `chipSelected` surfaceTeal/borderTeal → `Theme.panel`/`Theme.line`+accent, `chipTextSelected` → `Theme.accent`; `generateBtn` bg → `Theme.accent`; `ActivityIndicator color={Colors.teal}` → `Theme.accent`.
- [ ] **Step 3: Buttons + functional.** `generateBtn` wraps spinner → **hand-roll** (accent-styled); `skipBtn` → `<Button variant="secondary">`. **FUNCTIONAL KEEP:** `replaceWarning.color: Colors.amber` (regenerate-replaces-plan warning) — stays amber.
- [ ] **Step 4: Preserve behavior** — `loadSaved` seeding; goal-conditional sections (`isTriathlon`/`isUltra`/`isLift`/`isHyrox`/`isCrossfit`); the full `handleGenerate` (param parsing, Supabase mutations, ordered `goal_params` writes, `invokeGeneratePlan`, `router.replace('/plan-preview')`); `loadingPrefs` early return; `hasGeneratedBefore` warning/label; all chip toggles.
- [ ] **Step 5: Verify + Commit** — typecheck+suite; `git commit -m "feat(mobile): re-skin preferences screen (shared with Workout tab)"`

---

### Task 4: `app/plan-preview.tsx` (renders ZonesCard)

**Files:** Modify `OSPREY-app/app/plan-preview.tsx` (776 ln, styles ~583-776)

**Interfaces:** Consumes `Card`, `Button` from `@/components/ui`; `Theme`, `Radius`. Renders the already-migrated `ZonesCard` (Task 1).

- [ ] **Step 1: Container + panels.** `container.bg` → `Theme.ink`; `summaryCard`/`noteCard`/`detailPanel`/`scheduleCard`/`raceCard` (surfaceTeal/surfaceGold/bgCard) → `Theme.panel` (adopt `<Card>` for `raceCard`/`summaryCard`/`scheduleCard`/`noteCard` where clean), their borders (borderTeal/borderGold/border) → `Theme.line`, radii → `Radius.card`; inner frosted tiles `summaryItem`/`macroItem` `rgba(0,200,200,0.1)` → `Theme.panel`.
- [ ] **Step 2: Text + accent + gold.** text `textPrimary`→`Theme.text`, `textSecondary`→`Theme.textSoft`, `textMuted`→`Theme.textMut`; uppercase labels (`summaryLabel`/`scheduleLabel`/`raceCardLabel`/`detailSectionLabel`) → add Space Grotesk; teal accents (`summaryValue`/`typeCount`/`sessionDistance`/`exerciseMeta`/`macroValue`/`noteText`/`backText`/`buildBtn`/`homeBtn` bg/`ActivityIndicator`) → `Theme.accent`; **decorative race-phase GOLD** (`raceCardLabel`/`phaseSegmentActive` bg/`phaseLabelActive`) → `Theme.accent` (gold is brand, migrates).
- [ ] **Step 3: Buttons.** `buildBtn`/`homeBtn` (plain text) → `<Button variant="primary">`. Keep the inline back header (custom, not ScreenHeader).
- [ ] **Step 4: FUNCTIONAL — do NOT migrate.** The `INTENSITY_COLORS` map (green/amber/red per easy/moderate/threshold/interval/race), the `EFFORT_COLORS` map (green/teal/amber/red — **including `EFFORT_COLORS.moderate: Colors.teal`, a legend swatch, keep**), `heatNote.color: Colors.amber` + `heatNoteAlert.color: Colors.red` (weather severity), and `segmentEffort`'s use of EFFORT_COLORS — ALL stay. These are data/intensity/weather legends.
- [ ] **Step 5: Preserve behavior** — `isViewOnly` split (from-Settings live-fetch vs post-gen params); `fetchCurrentWeekSessions`; `fetchRaceGoal`+`computeRacePhase`; loading/loadError/empty states; expandable `expandedDate` rows + `SessionDetailPanel`; unit-aware `formatDistance`/`formatPace`; macros/hydration/weather annotations; `goHome` invalidateQueries; nav to `/preferences`.
- [ ] **Step 6: Verify + Commit** — typecheck+suite; `git commit -m "feat(mobile): re-skin plan-preview (keep intensity/effort/weather legends)"`

---

### Task 5: `app/supplements.tsx` (renders ScreenHeader)

**Files:** Modify `OSPREY-app/app/supplements.tsx` (358 ln, styles ~285-358)

**Interfaces:** Consumes `Card`, `Button` from `@/components/ui`; `Theme`, `Radius`. Renders the already-migrated `ScreenHeader` (Task 1) and `FieldError`.

- [ ] **Step 1: Container + surfaces.** `container.bg` → `Theme.ink`; `input`/`chip` bg (currently `Colors.bg`) → `Theme.ink` (keep field-bg = screen-bg + border look — the `Theme.line` border distinguishes them); `reminderRow`/`addCard` bg → `Theme.panel` (adopt `<Card>` for `addCard`, optionally `reminderRow` list items), borders → `Theme.line`, radii 9/10/12/14 → `Radius.card`.
- [ ] **Step 2: Text + accent.** `reminderName`/`addTitle`/`input`/`switchLabel` → `Theme.text`; `empty`/`reminderDose`/`reminderMeta`/`fieldLabel`/`chipText`/`switchHint` → `Theme.textMut`; `fieldLabel` uppercase "TIME" → add Space Grotesk; `chipActive` surfaceTeal/borderTeal → `Theme.panel`/`Theme.line`+accent, `chipTextActive` → `Theme.accent`; `addBtn` bg → `Theme.accent`; `Switch` `trackColor` true → `Theme.accent`; `ActivityIndicator color={Colors.teal}` → `Theme.accent`.
- [ ] **Step 3: Buttons + functional.** `addBtn` wraps spinner → **hand-roll**. Time/minute chips → keep. **FUNCTIONAL KEEP:** `inputError.borderColor: Colors.red` (validation error).
- [ ] **Step 4: Preserve behavior** — `load`/`fetchSupplementReminders`; `handleAdd` (notif-permission gate + `createSupplementReminder` + `reconcileSupplementReminders`); optimistic `handleToggle` + reconcile; `handleDelete`→confirm→`confirmDelete`; `nameError` validation; loading/empty states.
- [ ] **Step 5: Verify + Commit** — typecheck+suite; `git commit -m "feat(mobile): re-skin supplements screen"`

---

### Task 6: `app/paywall.tsx` (shared with Stats tab)

**Files:** Modify `OSPREY-app/app/paywall.tsx` (372 ln, styles ~279-372)

**Interfaces:** Consumes `Card` from `@/components/ui`; `Theme`, `Radius`. Renders `OzzieMascot` (leave — mascot art).

- [ ] **Step 1: Container + surfaces + text.** `container.bg` → `Theme.ink`; `featuresCard`/`packageChip` bg → `Theme.panel` (adopt `<Card>` for `featuresCard`), borders → `Theme.line`, radii 12/16 → `Radius.card` (keep `packageChip` `borderWidth:1.5` or bump to `BorderWidth.card` — prefer `BorderWidth.card` for consistency); text: `featureTitle` → `Theme.text`, `logoTagline`/`featureDesc`/`packageChipLabel` → `Theme.textSoft`, `packageChipPrice`/`restoreBtnText`/`legal`/`legalLink` → `Theme.textMut`; inline close-icon + restore-spinner `color={Colors.textMuted}` → `Theme.textMut`.
- [ ] **Step 2: Accent.** `logoTitle`/`featureCheck` `Colors.teal` → `Theme.accent`; `packageChipActive` border/bg teal+surfaceTeal → `Theme.accent`/`Theme.panel`, `packageChipLabelActive`/`packageChipPriceActive` → `Theme.accent`; `subscribeBtn` bg → `Theme.accent`; `subscribeBtnText` `#000` → `Theme.ink`, `subscribeBtnSub` `rgba(0,0,0,0.5)` stays (on-accent readable).
- [ ] **Step 3: Buttons.** `subscribeBtn` (wraps spinner + 2 text lines) → **hand-roll** (accent-styled); `restoreBtn` (wraps spinner) → **hand-roll**. Package chips + close/legal touchables → keep.
- [ ] **Step 4: Preserve behavior** — `getOfferings` load + default-select; `selectedPackage`/price derivation; `handleSubscribe`→`purchaseOspreyPlus`→refresh+`router.back`; `handleRestore`; `packages.length>1` chip-row gate; `purchasing`/`restoring` disabled/busy states; label/period formatters.
- [ ] **Step 5: Verify + Commit** — typecheck+suite; `git commit -m "feat(mobile): re-skin paywall (shared with Stats tab)"`

---

## After all tasks: visual pass + final review

- **Live web-preview visual pass:** open Settings, scroll it, and navigate into Preferences, Plan Preview, Supplements, and Paywall. Confirm each reads ink/amber with no teal survivors except functional colors (danger-zone red, validation red, intensity/effort/weather legends, zone dots, plan-replace amber). Also spot-check 1-2 of the 8 OTHER screens that use `ScreenHeader` (e.g. `activity`, `friends`) render fine with the amber header over their still-teal bodies. Screenshot.
- **Final whole-branch review**, then **finishing-a-development-branch** (merge; push only if asked — the user has been saying "merge and push", so offer/confirm).

## Self-Review (plan author)
- Coverage: all 5 Settings route files + 2 shared components have a task. ✓
- Shared-component ownership: ScreenHeader/ZonesCard in T1 (before their consumers T4/T5). preferences/paywall flagged as cross-tab. ✓
- Functional colors enumerated per task (danger red, validation red, plan-replace amber, intensity/effort/weather legends, zone dots). ✓
- Button-spinner constraint called out per affected button (hand-roll list). ✓
