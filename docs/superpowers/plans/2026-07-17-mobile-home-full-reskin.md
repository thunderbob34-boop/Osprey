# Mobile Home Surface — Full Re-skin + Tab Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the mobile Home surface from half-migrated to 100% on the ink/amber design system, and migrate the shared bottom tab bar.

**Architecture:** Pure styling swap. Every remaining old-`Colors`-token region on the Home surface (and its Home-only child cards, and the shared tab bar) moves onto the `Theme`/`Radius`/`BorderWidth`/`Shadow` tokens and the `Card`/`Button`/`Badge` primitives already shipped in the foundation slice (`e2c4bf8`). No behavior, prop, data-flow, or layout change.

**Tech Stack:** Expo/React Native (SDK 52), TypeScript, Jest (`jest-expo`, `TZ=Asia/Kolkata`).

## Global Constraints

- **Styling only — behavior is frozen.** Every conditional render, press handler, disabled state, metric/imperial branch, gated section, severity map, and spinner must behave identically after each task. If a change would alter behavior, it's wrong.
- **Regression gate for EVERY task:** `cd OSPREY-app && npm run typecheck` clean AND `TZ=Asia/Kolkata npx jest` green (241 tests, 30 suites). No new tests are written — this codebase has no component-render harness and adding one is out of scope (established in the foundation slice). Do not add `.tsx` test files.
- **Never touch `OSPREY-app/src/constants/colors.ts`.** Migrate Home-surface files OFF `Colors` onto `Theme`, but leave `colors.ts` intact (other tabs still read it).
- **Functional colors STAY (do not migrate):** recovery/battery `Colors.green`/`Colors.amber`/`Colors.recoveryRed` fill logic; the weather card's `alert`(red)/`caution`(amber) severities; the deload card's amber attention border (becomes `Card emphasis`, same amber); hydration-met green; the bottom-sheet destructive-red row (`sheetRowTextDestructive`); `ReadinessCard`'s `readiness.color`. Only *brand* colors migrate: `Colors.teal`, `Colors.gold`, and the navy/teal frosted surfaces (`Colors.bg`, `bgCard`, `surfaceTeal`, `borderTeal`, and raw `rgba(0,200,200,*)`/`rgba(255,255,255,*)` surface values).
- **Token mapping (apply consistently everywhere):**
  | Old | New |
  |---|---|
  | `Colors.bg` `#060912` (screen/nav bg) | `Theme.ink` |
  | frosted surface (`Colors.bgCard`, `surfaceTeal`, `rgba(255,255,255,0.04-0.10)`, `rgba(0,200,200,0.06-0.18)`) | `Theme.panel` |
  | `Colors.border`/`borderTeal`/`rgba(255,255,255,0.08-0.18)` | `Theme.line` |
  | `Colors.teal` / `Colors.gold` (brand accent) | `Theme.accent` |
  | `Colors.textPrimary` `#fff` | `Theme.text` |
  | `Colors.textSecondary` | `Theme.textSoft` |
  | `Colors.textMuted` | `Theme.textMut` |
  | any `borderRadius` 8–20 | `Radius.card` (4) |
  | progress-track background (week fill, hydration) | `Theme.line` (do NOT add a new token — reuse `line`; YAGNI) |
  | uppercase section labels / headers | add `fontFamily: 'SpaceGrotesk_700Bold'` |
- **`Colors` import may remain** in files that still reference a functional color (green/amber/red). Only remove the `Colors` import from a file if NO functional color reference survives. Import `Theme` (and `Radius`/`BorderWidth`/`Shadow`/`Card`/`Button`/`Badge` as needed) in every touched file.
- Spec: `docs/superpowers/specs/2026-07-17-mobile-home-full-reskin-design.md`. Line citations below reflect the file at plan-writing time — verify against current content before editing; apply by region/style-key name, not blindly by line number.

---

### Task 1: `DailySummary.tsx` — screen chrome, header, loading/error/refresh states

**Files:**
- Modify: `OSPREY-app/src/screens/DailySummary.tsx` (container/StatusBar ~L119-164 + styles `container` L561-564, `centeredState`/`stateText`/`errorTitle`/`retryBtn`/`retryBtnText` L565-595; header JSX L170-197 + styles `greeting`/`date`/`headerRight`/`activityBtn`/`avatarBtn` L610-647)

**Interfaces:**
- Consumes: `Theme`, `Radius` from `@/constants/theme` (add import if absent).
- Produces: nothing new — this is an in-place restyle.

- [ ] **Step 1: Add the theme import** (if `DailySummary.tsx` doesn't already import `Theme` — it does from the foundation slice; confirm `Radius` is included).

- [ ] **Step 2: Screen container + StatusBar.** `styles.container.backgroundColor` `Colors.bg` → `Theme.ink`. All three `StatusBar backgroundColor={Colors.bg}` → `Theme.ink` (keep `barStyle="light-content"`).

- [ ] **Step 3: Loading/error/refresh.** `ActivityIndicator color={Colors.teal}` (L122) and `RefreshControl tintColor={Colors.teal}` (L164) → `Theme.accent`. `stateText` → `Theme.textMut`; `errorTitle` → `Theme.text`; `retryBtn` bg `Colors.teal` → `Theme.accent`, `borderRadius` → `Radius.card`; `retryBtnText` stays dark (`Theme.ink`) on the amber button. Keep `onRetry` gating.

- [ ] **Step 4: Header.** `greeting` → add `fontFamily: 'SpaceGrotesk_700Bold'` (keep fontSize 28); `date` `Colors.teal` → `Theme.accent`; `activityBtn` (`surfaceTeal`/`borderTeal`, radius 20) → `Theme.panel`/`Theme.line`, `Radius.card`; `avatarBtn` (`bgCard`/`border`, radius 20) → `Theme.panel`/`Theme.line`, `Radius.card`; `Ionicons name="people-outline" color={Colors.teal}` → `Theme.accent`. Preserve `onActivityPress`/`onOzziePress` conditional rendering and hit areas; leave `OzzieAvatar` untouched.

- [ ] **Step 5: Verify.** `cd OSPREY-app && npm run typecheck && TZ=Asia/Kolkata npx jest` — both clean/green.

- [ ] **Step 6: Commit.**
```bash
git add OSPREY-app/src/screens/DailySummary.tsx
git commit -m "feat(mobile): re-skin Home chrome, header, and loading/error states"
```

---

### Task 2: `DailySummary.tsx` — session card container + Start/Adjust buttons

**Files:**
- Modify: `OSPREY-app/src/screens/DailySummary.tsx` (session card JSX L260-347 + styles `sessionCard`/`sessionLabel`/`viewWeekLink`/`sessionType`/`sessionChips`/`sessionChip`/`sessionChipText`/`sessionChipAccent`/`sessionChipAccentText` L745-797; buttons JSX L321-346 + styles `sessionActionsRow`/`startBtn`/`startBtnText`/`startBtnDisabled`/`adjustBtn`/`adjustBtnText` L830-861)
- Maybe modify: `OSPREY-app/src/components/ui/Button.tsx` (additive optional `accessibilityLabel?` prop + `accessibilityState` forwarding — see Step 4; skip if using the text-derived-label fallback)

**Interfaces:**
- Consumes: `Card`, `Button` from `@/components/ui`; `Theme`, `Radius` from `@/constants/theme`.
- This is `Button`'s FIRST real consumer — verify its `flex` layout and disabled state read correctly.

- [ ] **Step 1: Import `Card` and `Button`** from `@/components/ui` (`Card` is likely already imported from the foundation slice; add `Button`).

- [ ] **Step 2: Session card container → plain `<Card>`.** Replace the `<View style={styles.sessionCard}>` wrapper with `<Card>` (NO `emphasis` — the amber emphasis stays on the Ozzie note nested inside it, preserving the container→highlight hierarchy). Keep ALL children exactly (the DONE Ozzie-note `<Card emphasis>`+why-panel at L296-319 stays untouched; the Start/Adjust row is restyled in Step 4). Delete the now-unused `sessionCard` style object.

- [ ] **Step 3: Session header + chips.** `sessionLabel` `Colors.teal` → `Theme.accent` + `fontFamily: 'SpaceGrotesk_700Bold'`; `viewWeekLink` → `Theme.textMut` (or `accent` for the `›` affordance — match the webapp's link treatment, accent); `sessionType` → `Theme.text`; `sessionChip` (`rgba(255,255,255,0.08)`, radius 8) → `Theme.panel` bg + `Theme.line` border + `Radius.card`; `sessionChipText` → `Theme.text`; `sessionChipAccent` (`rgba(0,200,200,0.18)`) → `Theme.accent` border/tint; `sessionChipAccentText` `Colors.teal` → `Theme.accent`. Preserve `Full week ›` gating + `distanceKm`/`zone` conditional chips.

- [ ] **Step 4: Start/Adjust → `<Button>`.** Replace the two `TouchableOpacity`s:
```tsx
<View style={styles.sessionActionsRow}>
  <Button
    variant="primary"
    onPress={() => onStartSession?.(session)}
    disabled={session.sessionType === 'rest'}
    style={{ flex: 1 }}
  >
    {session.sessionType === 'rest' ? 'Rest Day' : 'Start Session →'}
  </Button>
  {(onSwapSession || onCompressSession) && session.sessionId && session.sessionType !== 'rest' ? (
    <Button variant="secondary" onPress={() => setAdjustSheetOpen(true)}>
      Adjust
    </Button>
  ) : null}
</View>
```
Keep `sessionActionsRow` (layout: `flexDirection: 'row'`, `gap`). Delete `startBtn`/`startBtnText`/`startBtnDisabled`/`adjustBtn`/`adjustBtnText`.

**Accessibility:** `Button` wraps a `Pressable`, which by default exposes `role="button"` and derives its accessible name from the child text ("Start Session →" / "Rest Day" / "Adjust") — so the buttons stay accessible with sensible labels even without explicit props. To keep parity with the old explicit labels ("Start session"/"Rest day") and the `disabled` state announcement, make a small additive change to `OSPREY-app/src/components/ui/Button.tsx`: add optional `accessibilityLabel?: string` to its prop type and forward it (plus `accessibilityState={{ disabled: !!disabled }}`) to the inner `Pressable`. Then pass `accessibilityLabel={session.sessionType === 'rest' ? 'Rest day' : 'Start session'}` on the Start `Button`. This is a backward-compatible prop addition (every existing/future caller is unaffected) — not a redesign. If you'd rather not touch `Button`, the text-derived label is an acceptable fallback; do not drop `role="button"` (Pressable provides it automatically).

- [ ] **Step 5: Verify.** typecheck + suite green.

- [ ] **Step 6: Commit.**
```bash
git add OSPREY-app/src/screens/DailySummary.tsx
git commit -m "feat(mobile): re-skin Home session card + Start/Adjust onto Card/Button"
```

---

### Task 3: `DailySummary.tsx` — week card, ReadinessCard, BodyBattery shell, Adjust bottom sheet

**Files:**
- Modify: `OSPREY-app/src/screens/DailySummary.tsx` (week card JSX L361-384 + styles `weekCard`/`weekRow`/`weekLabel`/`weekNumbers`/`weekMiles`/`weekTarget`/`weekTrack`/`weekFill` L865-905; `ReadinessCard` JSX L513-530 + styles `readinessCard`/`readinessTitle`/`readinessSub`/`readinessCtlLabel`/`readinessCtlSub` L650-671; battery styles `batteryNub`/`batteryShell`/`batteryScoreOverlay`/`batteryScore` L698-740; bottom-sheet JSX L405-505 + styles `sheet`/`sheetHandle`/`sheetTitle`/`sheetSectionLabel`/`sheetRowGroup`/`sheetRow`/`sheetRowLast`/`sheetRowText`/`sheetCloseBtn`/`sheetCloseBtnText` L933-984)

**Interfaces:**
- Consumes: `Card` from `@/components/ui`; `Theme`, `Radius` from `@/constants/theme`.

- [ ] **Step 1: Week-mileage card.** `weekCard` → `<Card>` (delete the style object's bg/border/radius; keep layout). `weekLabel`/`weekTarget` → `Theme.textMut`; `weekMiles` → `Theme.text`; `weekTrack` → `Theme.line`; `weekFill` `Colors.teal` → `Theme.accent`. Preserve `weekTargetKm != null` gating, fill-width math, metric/imperial switching.

- [ ] **Step 2: ReadinessCard.** `readinessCard` frosted → `<Card>` (keep the inline `borderColor: readiness.color + '33'` — functional, drives the readiness tint); label texts (`readinessTitle`/`readinessSub`/`readinessCtlLabel`/`readinessCtlSub`) → `Theme.textMut`; the inline `readinessCtlValue color={Colors.teal}` → `Theme.accent` (this is a brand label color, not functional; the `readiness.color` label above it stays). Keep `isPlus` gating + tsb sign formatting.

- [ ] **Step 3: BodyBattery shell.** `batteryNub`/`batteryShell` neutral-white (`rgba(255,255,255,0.35)`, `rgba(0,0,0,0.4)`) → `Theme.line`/`Theme.panel` equivalents, `batteryShell.borderRadius` → `Radius.card`; `batteryScore` keeps `#fff` + textShadow (readable overlay on colored fill). **Do NOT touch the `fillColor` green/amber/red logic** (L31-35) — functional.

- [ ] **Step 4: Adjust bottom sheet.** `sheet` raw navy `#0D1424` → `Theme.panel` (keep `borderTopLeftRadius`/`borderTopRightRadius: 20` — a sheet, not a card; OR drop to `Radius.card` — prefer keeping 20 for the sheet's rounded-top affordance since it's a distinct surface type, note this as an intentional exception). `sheetHandle` → `Theme.line`; `sheetTitle`/`sheetRowText` → `Theme.text`; `sheetSectionLabel` → `Theme.textMut` + Space Grotesk; `sheetRowGroup`/`sheetRow` borders → `Theme.line`; `sheetCloseBtn` border → `Theme.line`, `sheetCloseBtnText` → `Theme.textSoft`. **`sheetRowTextDestructive` stays `Colors.red`** (functional). Preserve `handleSwap`/`handleCompress` close-then-fire + swap/compress gating + emoji labels.

- [ ] **Step 5: Verify.** typecheck + suite green.

- [ ] **Step 6: Commit.**
```bash
git add OSPREY-app/src/screens/DailySummary.tsx
git commit -m "feat(mobile): re-skin Home week card, readiness, battery shell, adjust sheet"
```

---

### Task 4: `NutritionCard.tsx`

**Files:**
- Modify: `OSPREY-app/src/components/NutritionCard.tsx` (styles L167-263 + inline icon colors L57/74/86/111)

**Interfaces:**
- Consumes: `Card` from `@/components/ui`; `Theme`, `Radius` from `@/constants/theme`.
- Renders ONLY on Home (verified) — no bleed risk.

- [ ] **Step 1: Card container + labels.** `card` (`bgCard`/`borderTeal`, radius 14) → `<Card>` (or panel/line/`Radius.card` inline if `Card` breaks the internal layout — prefer `Card`). `cardLabel`/`sectionLabel` `Colors.teal` → `Theme.accent` + Space Grotesk; `macroNumber` `Colors.teal` → `Theme.accent`; `macroUnit`/`macroLabel`/`amountTarget` → `Theme.textMut`; `tip`/`fuelTipBody` → `Theme.textSoft`; `amount`/`quickAddText`/`fuelTipTitle` → `Theme.text`.

- [ ] **Step 2: Hydration + quick-adds + fuel tip.** `hydrationSectionEmphasized` (`rgba(0,200,200,0.08)`/`borderTeal`) → `Theme.panel`/`Theme.line` + `Radius.card`; `track` → `Theme.line`; `quickAddBtn` (`rgba(255,255,255,0.06)`, radius 10) → `Theme.panel`/`Theme.line` + `Radius.card`; `divider` → `Theme.line`. Inline icons: hydration `Ionicons color={hydrationMet ? Colors.green : Colors.teal}` → `hydrationMet ? Colors.green : Theme.accent` (KEEP the green-met branch); fuel-tip `Ionicons color={Colors.gold}` → `Theme.accent`; loading spinner `Colors.teal` → `Theme.accent`.

- [ ] **Step 3: Verify.** typecheck + suite green. Preserve every conditional (hydration section, quick-adds, fuel tip gated on `showFuelTip`) + `onAddHydration`.

- [ ] **Step 4: Commit.**
```bash
git add OSPREY-app/src/components/NutritionCard.tsx
git commit -m "feat(mobile): re-skin NutritionCard onto the ink/amber system"
```

---

### Task 5: `WeatherCoachCard.tsx` + `DeloadSuggestionCard.tsx` + `BuildPlanBanner.tsx`

**Files:**
- Modify: `OSPREY-app/src/components/WeatherCoachCard.tsx` (`SEVERITY_STYLE` L14-33 + styles L88-151)
- Modify: `OSPREY-app/src/components/DeloadSuggestionCard.tsx` (styles L74-124)
- Modify: `OSPREY-app/src/components/BuildPlanBanner.tsx` (styles L25-57)

**Interfaces:**
- Consumes: `Card`, `Button` from `@/components/ui`; `Theme`, `Radius`.
- All three render ONLY on Home (verified) — no bleed.

- [ ] **Step 1: WeatherCoachCard.** In `SEVERITY_STYLE`, migrate ONLY the `info` severity's teal (`surfaceTeal`/`borderTeal`/`Colors.teal`) → `Theme.panel`/`Theme.line`/`Theme.accent`. **Leave `alert` (red) and `caution` (amber) untouched — functional.** Neutral text: `headline` → `Theme.text`; `detail`/`routeChipText` → `Theme.textSoft`; `routeChipName` → `Theme.text`; `card`/`routeChip`/`actionBtn` radii → `Radius.card`. `movedText` green stays. Preserve `showAction`, `movingIndoors` spinner, `alreadyIndoors`, route-chip conditional.

- [ ] **Step 2: DeloadSuggestionCard → `<Card emphasis>`.** The amber attention border IS the emphasis treatment. `title` → `Theme.text`, `subtitle` → `Theme.textSoft`; `dismissBtn` → `<Button variant="secondary">`, `acceptBtn` → `<Button variant="primary">` (keep `isAccepting` disabled+spinner via `disabled` prop; the `ActivityIndicator color="#000"` stays dark on the amber button). Keep `handleAccept` Alert-confirm → `onAccept` + day formatting.

- [ ] **Step 3: BuildPlanBanner → `<Card>`.** `title`/`subtitle` → `Theme.text`/`textSoft`; `btn` `Colors.teal` → `<Button variant="primary">`. Keep `router.push('/preferences')`.

- [ ] **Step 4: Verify.** typecheck + suite green.

- [ ] **Step 5: Commit.**
```bash
git add OSPREY-app/src/components/WeatherCoachCard.tsx OSPREY-app/src/components/DeloadSuggestionCard.tsx OSPREY-app/src/components/BuildPlanBanner.tsx
git commit -m "feat(mobile): re-skin Home weather/deload/build-plan cards"
```

---

### Task 6: `app/(tabs)/_layout.tsx` — bottom tab bar

**Files:**
- Modify: `OSPREY-app/app/(tabs)/_layout.tsx` (L34-54)

**Interfaces:**
- Consumes: `Theme` from `@/constants/theme`.
- SHARED file — this changes the tab bar under all 5 tabs (intended; the user chose this).

- [ ] **Step 1: Tab bar tints.** `tabBarActiveTintColor` `Colors.teal` → `Theme.accent`; `tabBarInactiveTintColor` → `Theme.textMut`; `tabBarStyle.backgroundColor` navy `rgba(6,9,18,0.92)` → `Theme.ink` (keep it opaque or preserve the slight translucency — prefer solid `Theme.ink` for consistency with the screen bg); `borderTopColor` `Colors.border` → `Theme.line`. Keep Ionicons set, focused-solid/unfocused-outline swap, size 22, `insets.bottom` math, auth/onboarding redirects — all unchanged.

- [ ] **Step 2: Verify.** typecheck + suite green.

- [ ] **Step 3: Commit.**
```bash
git add OSPREY-app/app/(tabs)/_layout.tsx
git commit -m "feat(mobile): re-skin bottom tab bar active tint to amber"
```

---

## After all tasks: visual verification + final review

- **Live web-preview visual pass** (the `OSPREY-app (Expo)` launch config; dev fixtures already committed): log in, scroll Home top-to-bottom, open the Adjust sheet, trigger a refresh. Confirm every region reads ink/amber with NO teal survivors except functional state colors (recovery/battery green-amber-red, weather alert/caution, destructive-red sheet row), and the tab bar active tint is amber. Screenshot before/after.
- **Final whole-branch review** (per subagent-driven-development) across the full branch diff, then **finishing-a-development-branch** to merge (no push unless the user asks).

## Self-Review (plan author)

- **Spec coverage:** §1→T1+T2+T3, §2→T4, §3→T5(weather), §4→T5(deload/buildplan), §5→T6, §7 (track token) → resolved in Global Constraints (reuse `Theme.line`, no new token). All spec sections have a task. ✓
- **No behavior drift:** every task's steps end by re-stating the conditionals/handlers to preserve. The one real structural change (Start/Adjust → `Button`) has an explicit a11y-preservation guard with a STOP-and-report escape hatch. ✓
- **Type consistency:** `Card`/`Button`/`Badge` prop shapes referenced match their foundation-slice definitions (`Card {emphasis?,children,style?}`, `Button {variant?,onPress,children:string,disabled?,style?}`). ✓
