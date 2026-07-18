# Mobile Onboarding + Auth Re-skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the first-run surface — the pre-auth shell, sign-in, and all six onboarding steps — off the old teal/navy `Colors` system onto the ink/amber `Theme` system.

**Architecture:** Pure styling migration. `OnboardingShell` is shared by all six onboarding steps and lands first so the steps migrate onto already-migrated chrome. Everything else is an independent file and parallelizes.

**Tech Stack:** React Native / Expo SDK 52, expo-router, TypeScript, Jest (`TZ=Asia/Kolkata`).

**Branch:** `mobile-onboarding-auth-reskin`, off `main` at `4fed4bc`.

**This closes the migration.** The 8-slice program covered Home, tab bar, Settings, Log, Workout, and Stats. A completion audit after the last slice found this surface was never scoped by any of them — which matters more than its size, because **it is the first thing a new user ever sees.** An athlete currently signs up through teal screens and lands in an amber app.

---

## Scope decisions

**IN — the pre-auth shell, even though it isn't strictly "auth".** `app/index.tsx` (redirect gate), `src/components/AppLoadingScreen.tsx` (the splash/font gate), and `app/_layout.tsx` (`Colors.bg` on the ROOT navigator background) all render *before* sign-in. Migrating `SignIn` without them means the app launches teal and flips to amber a beat later. The whole point of this slice is that the first-run flow reads as one app.

**OUT — `src/components/PlaceholderScreen.tsx`.** It has **zero consumers** (`grep -rn "PlaceholderScreen" app src` finds only its own definition). Dead code. Deleting it is not a styling change; flag it as a follow-up instead.

**OUT — `app/(onboarding)/_layout.tsx`** (17 lines): it does not import `Colors`. Nothing to do.

---

## ⚠️ Testing reality

**No screen-level tests exist for any file in this slice.** The 256-test suite proves imports and types survive and nothing more. **"Tests pass" is not evidence a screen looks right.**

These are token substitutions with nothing assertable, so they use typecheck + suite as regression gates plus a self-review checklist. **Do not invent tests that assert a hex equals itself.**

**Verification advantage this slice has:** sign-in and the loading gate are what the web preview shows *before* auth, so they ARE reachable — arguably the most verifiable surface in the whole program. Onboarding steps sit behind sign-up and may not be reachable without creating an account. **Never create an account or submit credentials to verify** — report what could not be reached instead.

---

## Global Constraints

- **STYLING ONLY.** No behavior, prop, or data-flow change. Auth logic, session handling, validation, and navigation must be untouched.
- **Never touch** `src/constants/colors.ts`, or any already-migrated file: `ScreenHeader.tsx`, `paywall.tsx`, `DateField.tsx`, `InputModal.tsx`, `FieldError.tsx`, `Card`/`Button`/`Badge`.
- **`Button.children` is typed `string`** → any button hosting an `<ActivityIndicator>` or multi-element children stays a hand-rolled `TouchableOpacity`. **The recipe:**
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
  // text/spinner colour: Theme.ink;  disabled: opacity 0.5
  ```
  It **mirrors the `Button` primitive deliberately** (`Button.tsx:49-55`) — NOT a manufactured cue.
- **`<Button>` CANNOT FLEX** — it applies `style` to its inner `Pressable` while a row's flex child is its `Animated.View` wrapper, so `flex: 1` silently does nothing. Side-by-side buttons must be hand-rolled.
- **Text inputs:** `Theme.ink` + `borderWidth: 1` + `Theme.line`. **Card containers:** `Theme.panel` + `BorderWidth.card` (2) + `Theme.line`. This 1px-vs-2px split is consistent across every migrated screen.
- **Nested surfaces recede to `Theme.ink`** inside a panel card. The accent tint `Theme.accent + '1F'` is for **ACTIVE/selected chips only**, never passive labels or inputs.
- **A scrim is NOT a surface** — re-derive from `Theme.ink` at the original alpha (`rgba(0,0,0,0.5)` → `rgba(9,9,11,0.5)`).
- **Radius** 8-20 → `Radius.card`; sheet/modal top corners (20), pill (≥20), and dot/thin-bar (≤4) KEEP.
- **Uppercase-label rule:** eyebrow/section labels heading a card or screen → `Theme.accent`; table/column headers + inline field labels → `Theme.textMut`. Both get `fontFamily: 'SpaceGrotesk_700Bold'`.
- `#fff`/`#000` on an accent fill → `Theme.ink`.
- **Do NOT manufacture state cues.**
- **BEFORE migrating a brand token, check what sits BESIDE it.** The program's most-repeated lesson.
- **STAGING RULE:** parallel tasks share one working tree — `git add` **only your own paths**, never `-A` or `.`. Retry once on `index.lock`.
- **Verify per task:** `cd OSPREY-app && npm run typecheck && TZ=Asia/Kolkata npx jest` — clean, 256/256, 30/30.

---

## Functional colours — keep

- **`SignIn.tsx` and `reset-password.tsx` `errorText` = `Colors.red`.** Auth validation and failure messages. **Keep.** `theme.ts` has no red token; this is the same call made for `FieldError`, `supplements`, and `log`.
- **`(onboarding)/baseline.tsx` `Colors.red`** — verify its role during the inventory. If it's validation, keep it.

## The one judgment call, pre-decided

**`OnboardingShell`'s `ozzieName` is `Colors.gold` while the shell's progress bar and primary button are `Colors.teal`.** Gold marks Ozzie's *voice*; teal is chrome. A blind swap makes Ozzie's name the same colour as the button beside it.

**Decision: `ozzieName` → `Theme.accent`, same as the chrome.** This matches the established treatment for Ozzie attribution on already-migrated surfaces (the NUTRITION and WEATHER-COACH card headers both moved to accent + Space Grotesk in the Home slice). Hierarchy comes from placement and weight, not a second hue. **Give `ozzieName` `fontFamily: 'SpaceGrotesk_700Bold'`** so it still reads as a distinct voice label. Flag it in your report for the visual pass — if Ozzie's name and the primary button read as confusingly equal, the follow-up is a weight or size change, **not** reintroducing a second brand hue.

---

## File Structure

| File | Lines | Task | Notes |
|---|---|---|---|
| `src/components/onboarding/OnboardingShell.tsx` | 261 | 1 | **Shared by all 6 steps — must land first** |
| `app/(onboarding)/{welcome,name,mode}.tsx` | 48+58+53 | 2 | Three small steps |
| `app/(onboarding)/{goals,health}.tsx` | 159+122 | 3 | Selected-state chips (`surfaceTeal`/`borderTeal`) |
| `app/(onboarding)/baseline.tsx` | 357 | 4 | Largest step; has `Colors.red` — check its role |
| `src/screens/SignIn.tsx` | 396 | 5 | `errorText` red KEEPS |
| `app/reset-password.tsx` | 196 | 6 | `errorText` red KEEPS |
| `app/index.tsx` + `src/components/AppLoadingScreen.tsx` + `app/_layout.tsx` | 82+206+91 | 7 | Pre-auth shell; `_layout` is the root nav background |

**Parallelism:** Task 1 first. Then 2-7 concurrently (all different files).

---

## Task 1: `OnboardingShell.tsx`

**Files:** Modify `OSPREY-app/src/components/onboarding/OnboardingShell.tsx` (261 lines)

**Produces:** migrated chrome that all six onboarding steps render inside. Tasks 2-4 must not re-style it.

- [ ] **Step 1: Inventory every colour**, classifying functional vs decorative. Known sites: `container` `Colors.bg`, a 4px-high progress bar `Colors.teal`, `ozzieName` `Colors.gold`, `title` `Colors.textPrimary`, muted subtitles, a `Colors.border` top divider, `primaryBtn` `Colors.teal`, and a `Colors.bgCard` + `Colors.border` secondary surface.

- [ ] **Step 2: Apply the migration.**
- `Colors.bg` → `Theme.ink`; `bgCard` → `Theme.panel`; `border` → `Theme.line`
- Brand teal → `Theme.accent`; text → `Theme.text`/`textSoft`/`textMut`
- **The progress bar is 4px high — a thin bar. KEEP its radius**, migrate only its colour to `Theme.accent`.
- **`ozzieName` → `Theme.accent` + `fontFamily: 'SpaceGrotesk_700Bold'`** (see the pre-decided call above).
- Card containers get `BorderWidth.card` (2); any text input stays 1px.
- If `primaryBtn` hosts an `<ActivityIndicator>`, hand-roll it per the recipe; if it's string-only, `<Button>` is fine — but **not if it sits in a flex row.**

- [ ] **Step 3: Verify** — `cd OSPREY-app && npm run typecheck && TZ=Asia/Kolkata npx jest` (clean, 256/256, 30/30).

- [ ] **Step 4: Commit** — `git add OSPREY-app/src/components/onboarding/OnboardingShell.tsx && git commit -m "feat(mobile): re-skin OnboardingShell"`

---

## Task 2: `welcome.tsx`, `name.tsx`, `mode.tsx`

**Files:** Modify `app/(onboarding)/welcome.tsx` (48), `app/(onboarding)/name.tsx` (58), `app/(onboarding)/mode.tsx` (53)

**Consumes:** Task 1's `OnboardingShell`. It will already look migrated — don't re-style it.

- [ ] **Step 1: Inventory all three files' colours.** Known: `welcome` uses `Colors.teal` + `textPrimary`; `name` uses `bgCard`/`border`/`textMuted`/`textPrimary` (a text input — **`Theme.ink` + 1px**, not panel/2px); `mode` uses only `Colors.textMuted`.

- [ ] **Step 2: Apply the migration** per Global Constraints.

- [ ] **Step 3: Verify** (clean, 256/256, 30/30).

- [ ] **Step 4: Commit** — stage exactly the three paths.

---

## Task 3: `goals.tsx`, `health.tsx`

**Files:** Modify `app/(onboarding)/goals.tsx` (159), `app/(onboarding)/health.tsx` (122)

**Consumes:** Task 1's `OnboardingShell`.

Both use `Colors.surfaceTeal` / `Colors.borderTeal` — **selected-state option cards**. `goals.tsx` also uses `Colors.tealDim`.

- [ ] **Step 1: Inventory, and decide the selected-state treatment.** These are the same construct as the chips settled across the app: **selected = `Theme.accent` border + accent text; unselected = `Theme.line` border.** Use the accent tint fill (`Theme.accent + '1F'`) **only if the option has no other active cue** — if the label or an icon also changes on selection, border-only is the established convention (see `challenges.tsx`, `routes.tsx`, `races.tsx`). State which you chose and why.

- [ ] **Step 2: Apply the migration.** `tealDim` is a de-emphasised brand tint — map to `Theme.accent` at reduced alpha or `Theme.textMut` depending on whether it reads as brand or as muted text; say which and why.

- [ ] **Step 3: Verify** (clean, 256/256, 30/30).

- [ ] **Step 4: Commit** — stage exactly the two paths.

---

## Task 4: `baseline.tsx`

**Files:** Modify `app/(onboarding)/baseline.tsx` (357 lines — the largest onboarding step)

**Consumes:** Task 1's `OnboardingShell`.

- [ ] **Step 1: Inventory.** It uses `bgCard`, `border`, `borderTeal`, `surfaceTeal`, `teal`, `textMuted`, `textPrimary`, `textSecondary`, **and `Colors.red`**. **Determine the red's role.** If it's input validation, **KEEP it** — that's the call made for `FieldError`, `supplements`, `log`, `SignIn`. If it's something else, report before migrating.

- [ ] **Step 2: Apply the migration.** Numeric inputs are text inputs → `Theme.ink` + 1px. Selected-state option cards follow whatever Task 3 chose — **read `goals.tsx` first if it has landed, so the two agree.**

- [ ] **Step 3: Verify** (clean, 256/256, 30/30).

- [ ] **Step 4: Commit** — `git add OSPREY-app/app/\(onboarding\)/baseline.tsx`

---

## Task 5: `SignIn.tsx`

**Files:** Modify `OSPREY-app/src/screens/SignIn.tsx` (396 lines)

**This is the single most-seen unmigrated screen** — every user hits it before anything else.

- [ ] **Step 1: Inventory.** Uses `bg`, `bgCard`, `border`, `red`, `teal`, `textMuted`, `textPrimary`. **`errorText`'s `Colors.red` is FUNCTIONAL — KEEP it.**

- [ ] **Step 2: Apply the migration.**
- Email/password fields are text inputs → `Theme.ink` + 1px + `Theme.line`. **Do not make them panel/2px.**
- The primary sign-in button almost certainly hosts an `<ActivityIndicator>` → hand-roll per the recipe, `Theme.ink` spinner.
- A "sign up" / "forgot password" secondary action should NOT get the filled-accent treatment — outline or plain accent text.
- `placeholderTextColor` → `Theme.textMut`.

- [ ] **Step 3: Verify** (clean, 256/256, 30/30).

- [ ] **Step 4: Commit** — `git add OSPREY-app/src/screens/SignIn.tsx`

---

## Task 6: `reset-password.tsx`

**Files:** Modify `OSPREY-app/app/reset-password.tsx` (196 lines)

- [ ] **Step 1: Inventory.** Uses `bg`, `bgCard`, `border`, `red`, `teal`, `textMuted`, `textPrimary`. **`errorText` `Colors.red` KEEPS.**

- [ ] **Step 2: Apply the migration.** Same input/button rules as Task 5. **Read `SignIn.tsx` first if it has landed** — these two screens are one flow and must not seam.

- [ ] **Step 3: Verify** (clean, 256/256, 30/30).

- [ ] **Step 4: Commit** — `git add OSPREY-app/app/reset-password.tsx`

---

## Task 7: the pre-auth shell

**Files:** Modify `OSPREY-app/app/index.tsx` (82), `OSPREY-app/src/components/AppLoadingScreen.tsx` (206), `OSPREY-app/app/_layout.tsx` (91)

These render before sign-in. If they stay teal, the app launches teal and flips to amber.

- [ ] **Step 1: Inventory all three.** `index.tsx`: `bg`/`teal`/`textMuted`/`textPrimary`. `AppLoadingScreen`: `bg`/`teal`. `_layout.tsx`: `Colors.bg` only — **this is the ROOT navigator background**, so it sits behind every screen in the app; getting it wrong is visible everywhere.

- [ ] **Step 2: Apply the migration.** `Colors.bg` → `Theme.ink` in all three. Any spinner or brand mark → `Theme.accent`.

**Be careful in `_layout.tsx`:** it is app-root wiring (providers, font loading, nav theme). **Change only the colour value** — touch no provider, no font-loading logic, no navigation config.

- [ ] **Step 3: Verify** (clean, 256/256, 30/30).

- [ ] **Step 4: Commit** — stage exactly the three paths.

---

## Task 8: Visual pass, whole-branch review, merge, and the final audit

- [ ] **Step 1: Visual pass.** Start the Expo dev server (`.claude/launch.json`: `OSPREY-app (Expo)`, port 8081).

**Sign-in and the loading gate are the pre-auth surface, so they render before any account state** — the most verifiable screens in the program. Check: ink ground, amber brand mark, inputs receding at 1px, the primary button filled with an ink label, and error text still red.

**Onboarding steps sit behind sign-up.** **Do NOT create an account, enter credentials, or submit any form to reach them.** If they can't be reached, say so plainly rather than reporting an unverified check as passed.

react-native-web ignores synthetic `MouseEvent`/`PointerEvent`, so `Pressable`s can't be driven; navigate by URL where possible.

- [ ] **Step 2: Whole-branch review.** `scripts/review-package <merge-base> HEAD`, dispatched on the most capable model. Ask specifically for cross-file seams — this is one continuous flow (launch → loading → sign-in → six onboarding steps → app), and every prior slice's final review found at least one seam between sibling screens.

- [ ] **Step 3: Fix Critical/Important findings**, re-verify.

- [ ] **Step 4: Merge and push.**

```bash
git checkout main && git merge --no-ff mobile-onboarding-auth-reskin
cd OSPREY-app && npm run typecheck && TZ=Asia/Kolkata npx jest
git push origin main
```

- [ ] **Step 5: THE FINAL COMPLETION AUDIT.** This is what makes the claim defensible.

```bash
cd OSPREY-app
# 1. Which files still reference the old system?
grep -rln "constants/colors" app src | sort
# 2. What does each use it FOR? Chrome tokens here = still unmigrated.
for f in $(grep -rln "constants/colors" app src); do
  echo "--- $f"; grep -o "Colors\.[a-zA-Z]*" "$f" | sort -u | tr '\n' ' '; echo
done
# 3. THE ONE THE PROGRAM MISSED FOR EIGHT SLICES — presentation hiding in
#    non-UI layers. A service returning colours is invisible to screen review.
grep -rn "Colors\." src/services src/hooks 2>/dev/null || echo "clean: no colours in services or hooks"
```

**Report the result honestly.** Any file still using `Colors.bg`/`bgCard`/`border`/`teal`/`textPrimary`/`textSecondary` is **chrome and still unmigrated**. Files using only `red`/`green`/`amber`/`gold` are **correct and finished** — `colors.ts` is meant to survive as the functional-signal palette. **Do not claim the migration is complete unless check 3 is clean and check 2 shows no chrome tokens.** An earlier merge commit in this program claimed completion while ~16 files were still on teal; do not repeat that.

---

## Execution notes

**Wave 1:** Task 1 alone (shared shell).
**Wave 2:** Tasks 2, 3, 4, 5, 6, 7 in parallel — six different file sets. Cap concurrency at ~3 to avoid `index.lock` contention on commits.
**Wave 3:** Task 8.

**Before dispatching:** archive the previous slice's `task-*.md` from `.superpowers/sdd/`. Task numbers are reused every slice and a stale brief was dispatched by mistake two slices ago. Regenerate every brief; never point an agent at a brief file you did not just create.
