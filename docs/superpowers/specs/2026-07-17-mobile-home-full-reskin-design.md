# Mobile Home Surface — Full Re-skin + Tab Bar — Design

**Date:** 2026-07-17
**Status:** Approved (design) — ready for implementation plan
**Origin:** Direct follow-up to the foundation+pilot slice (merged `e2c4bf8`). The user viewed the half-migrated Home screen in the live preview and asked to finish it. This slice takes the Home surface from "4 regions done, rest on the old teal system" to 100% on the ink/amber design language, and migrates the shared bottom tab bar.

The prior slice built the system (`theme.ts` tokens, `Card`/`Button`/`Badge`) and proved it on 4 Home regions. This slice is the same re-skin pattern applied to every remaining old-skin element on the Home surface, plus the tab bar. **No new design decisions** — every choice was locked in the foundation slice's visual-companion session ([[osprey-mobile-design]]). This is styling-only; no behavior, props, data flow, or layout changes.

---

## Global Constraints

- **Styling only.** Every conditional render, press handler, disabled state, metric/imperial branch, severity mapping, and gated section must behave identically after the re-skin. This is a token/primitive swap, not a refactor. The existing 241-test Jest suite staying green (`cd OSPREY-app && npm test`, `TZ=Asia/Kolkata`) + `npm run typecheck` is the regression gate — no new tests expected (no component-render harness exists; that's deliberate, per the foundation slice).
- **Never touch `OSPREY-app/src/constants/colors.ts`.** Screens other than Home still depend on it. This slice migrates Home-surface files off `Colors` onto `Theme`, but leaves `colors.ts` itself intact — other tabs still read it.
- **Functional colors stay.** Any color that encodes *state or meaning* is out of scope and must remain: recovery/battery green-amber-red (`Colors.green`/`amber`/`recoveryRed`), the weather card's 3-severity semantic map (alert=red, caution=amber), the deload card's amber "attention" border, hydration-met green, the bottom-sheet destructive-red row, `ReadinessCard`'s `readiness.color`. Only *brand* colors (teal, gold, navy-frosted surfaces) migrate to ink/amber.
- **The design language is already decided** — ink `#09090B` bg, `panel #101014` surfaces, `line #3F3F46` borders, `accent #c8793a`, 4px radius, 2px borders, `Shadow.emphasis` only on coach-voice cards, Space Grotesk for uppercase labels/headers. Use the `Theme`/`Radius`/`BorderWidth`/`Shadow` tokens and the `Card`/`Button`/`Badge` primitives from the foundation slice. Do not introduce new tokens except where a genuinely new semantic slot is needed (see §7).
- **Do NOT recolor `OzzieAvatar`.** Its teal is inside mascot SVG artwork, and it renders on 4 screens — editing it would bleed beyond Home. Out of scope.
- **Home-local components don't bleed.** `NutritionCard`, `WeatherCoachCard`, `DeloadSuggestionCard`, `BuildPlanBanner` are each imported only by the Home surface (verified) — safe to re-skin in place. The **tab bar (`app/(tabs)/_layout.tsx`) is shared**: re-skinning it changes the chrome under all 5 tabs. That's intended (an amber tab bar over still-teal Workout/Log/Stats/Settings content until their own slices) and the user explicitly chose "everything + tab bar."

---

## 1. `DailySummary.tsx` — screen chrome, header, session card, buttons, week card, states

Migrate every region NOT already done (the recovery card, Ozzie-note+why-panel, quick-stats row, and habit-tip card are already on `Theme` — leave them).

- **Screen container + StatusBar** — `styles.container` bg `Colors.bg` → `Theme.ink`; all 3 `StatusBar backgroundColor={Colors.bg}` → `Theme.ink` (keep `barStyle="light-content"`).
- **Loading/error/refresh** — `ActivityIndicator color`, `RefreshControl tintColor` teal → `Theme.accent`; `stateText`/`errorTitle`/`retryBtn` onto `Theme` (retry button → `Button variant="primary"` or panel/line + accent text; keep `onRetry`).
- **Header** — `greeting` keeps its size/weight but gains `fontFamily: 'SpaceGrotesk_700Bold'`; `date` teal → `Theme.accent`; `activityBtn`/`avatarBtn` frosted-teal round buttons → `panel`/`line`, `Radius.card` (keep the round-ish feel is NOT required — square 4px is the system; keep icon hit areas + `onActivityPress`/`onOzziePress` gating unchanged). `people-outline` icon color teal → `Theme.accent`.
- **Session card** — `sessionCard` container (teal frosted `rgba(0,200,200,0.10)`, `borderRadius:18`) → a plain `<Card>` (panel/line, 4px, **no emphasis** — the amber `emphasis` is reserved for the Ozzie note *inside* it, so the visual hierarchy reads container → coach-voice highlight, matching the webapp). `sessionLabel` teal → `Theme.accent` + Space Grotesk; `viewWeekLink` → `Theme.textMut`/`accent`; `sessionType` → `Theme.text`; `sessionChip`/`sessionChipAccent` → `line`-bordered chips at `Radius.card`, accent chip uses `Theme.accent`. Preserve the `Full week ›` gating and the `distanceKm`/`zone` conditional chips.
- **Start / Adjust buttons** — replace with the `<Button>` primitive. Start → `variant="primary"` with `style={{ flex: 1 }}`; the `sessionType === 'rest'` path passes `disabled` and the `'Rest Day'`/`'Start Session →'` label (arrow stays in the string). Adjust → `variant="secondary"`, same conditional-render guard `(onSwapSession||onCompressSession) && session.sessionId && sessionType!=='rest'`. This is `Button`'s first real consumer — verify its `flex` layout and disabled opacity read correctly next to each other.
- **Week-mileage card** — `weekCard` → `<Card>`; `weekLabel`/`weekTarget` → `Theme.textMut`; `weekMiles` → `Theme.text`; `weekTrack` → a neutral `line`-ish track; `weekFill` teal → `Theme.accent`. Preserve `weekTargetKm != null` gating, fill-width math, metric/imperial switching.
- **ReadinessCard** — `readinessCard` frosted → `<Card>`; label texts → `Theme.textMut`; the `readiness.color`-driven border + label + `readinessCtlValue` color are functional — keep. (Gated on `isPlus`; unchanged.)
- **BodyBatteryTank shell** — `batteryNub`/`batteryShell`/`batteryScoreOverlay`/`batteryScore` neutral-white styling → neutral `Theme` equivalents (`line`/`textMut`); **keep the green/amber/red `fillColor` logic untouched** (functional).
- **Adjust bottom-sheet Modal** — `sheet` raw navy `#0D1424` → `Theme.panel`; `sheetHandle`/`sheetRowGroup`/`sheetRow` borders → `Theme.line`; `sheetTitle`/`sheetRowText` → `Theme.text`; `sheetSectionLabel` → `Theme.textMut` + Space Grotesk; **`sheetRowTextDestructive` stays red** (functional). Preserve `handleSwap`/`handleCompress` close-then-fire behavior and the swap/compress gating.

## 2. `NutritionCard.tsx` (Home-only)

`card` → `<Card>` (or panel/line/4px inline if `Card` doesn't fit the internal layout); `cardLabel`/`sectionLabel` teal → `Theme.accent` + Space Grotesk; `macroNumber` teal → `Theme.accent`; `macroUnit`/`macroLabel`/`amountTarget` → `Theme.textMut`; `tip`/`fuelTipBody` → `Theme.textSoft`; `amount`/`quickAddText`/`fuelTipTitle` → `Theme.text`; hydration track → neutral; `quickAddBtn` → `line`-bordered at `Radius.card`. **Keep functional:** hydration icon `hydrationMet ? Colors.green : accent`, the fuel-tip `Colors.gold` icon → `Theme.accent` (gold is brand, migrates), the loading spinner teal → `accent`. Preserve every conditional (hydration section, quick-adds, fuel tip gated on `showFuelTip`) and `onAddHydration`.

## 3. `WeatherCoachCard.tsx` (Home-only)

The `SEVERITY_STYLE` map is **mostly functional** — `alert` (red) and `caution` (amber) encode weather danger and stay. Only the **`info`** severity's teal/`surfaceTeal`/`borderTeal` → ink/amber (`panel`/`line`/`accent`). Neutral text: `headline` → `Theme.text`, `detail`/`routeChipText` → `Theme.textSoft`, `routeChipName` → `Theme.text`; `card`/`routeChip`/`actionBtn` radii → `Radius.card`. `movedText` green stays (functional). Preserve `showAction` logic, `movingIndoors` spinner, `alreadyIndoors` state, route-chip conditional.

## 4. `DeloadSuggestionCard.tsx` + `BuildPlanBanner.tsx` (Home-only, headerBanner slot)

- **Deload** — `card` → `<Card emphasis>` (the amber attention border is exactly the emphasis treatment); `title`→`Theme.text`, `subtitle`→`Theme.textSoft`; `dismissBtn` → `Button variant="secondary"` (or line-bordered), `acceptBtn` → `Button variant="primary"`. Keep `handleAccept` Alert-confirm → `onAccept`, `isAccepting` disabled+spinner, day formatting.
- **BuildPlan** — `card` → `<Card>`; `title`/`subtitle` → `Theme.text`/`textSoft`; `btn` teal → `Button variant="primary"`. Keep `router.push('/preferences')`.

## 5. `app/(tabs)/_layout.tsx` — bottom tab bar

`tabBarActiveTintColor` teal `#00c8c8` → `Theme.accent`; `tabBarInactiveTintColor` → `Theme.textMut`; `tabBarStyle.backgroundColor` navy → `Theme.ink`; `borderTopColor` → `Theme.line`. Keep the Ionicons set (`home`/`fitness`/`create`/`bar-chart`/`settings`), the focused-solid/unfocused-outline swap, size 22, the `insets.bottom` padding math, and the auth/onboarding redirects — all unchanged.

## 6. Out of scope (leave exactly as-is)

`OzzieAvatar` SVG internals (mascot art, shared across 4 screens); `colors.ts`; every non-Home screen; the 4 already-done Home regions; all functional/state colors listed in Global Constraints.

## 7. New tokens (only if needed)

Prefer reusing `Theme`. If the header's round icon buttons or the battery shell need a subtle "raised neutral surface" distinct from `panel`, that's still `panel`/`line` — do not add a token for it. The only plausibly-new slot is a translucent track color for progress bars (week fill, hydration); if `Theme.line` reads wrong as a track, add a single `Theme.track` token to `theme.ts` (with a value-pin test line, per the constants convention) rather than a raw `rgba`. Decide during implementation; default to reusing `line`.

## 8. Verification

Same as the foundation slice: typecheck + full suite green, plus a **live web-preview visual pass** of the whole Home screen (log in, scroll top-to-bottom, open the Adjust sheet, confirm every region now reads ink/amber with no teal survivors except functional state colors, and the tab bar active tint is amber). Screenshot before/after. The dev-only web-preview fixtures (`app.json` output=single, `secure-session-storage.ts` web branch, `.env.local`) are already committed from the foundation slice — no setup needed.
