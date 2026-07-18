# Mobile Stats Core Re-skin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Stats tab's core screens (stats / calendar / challenges / routes) and three shared form components off the old teal/navy `Colors` system onto the ink/amber `Theme` system, including a new chart palette.

**Architecture:** Pure styling migration. A new `ChartPalette` token group is added to `theme.ts` as a **separate export** (never as keys on `Theme` — the pinning test uses `toEqual`, so adding a key there fails it). All chart series, legends, and per-sport UI then consume that one source. Screens are migrated file-by-file so implementers can run in parallel.

**Tech Stack:** React Native / Expo SDK 52, expo-router, `react-native-svg` (charts are hand-rolled — no charting library), TypeScript, Jest (`TZ=Asia/Kolkata`).

**Branch:** `mobile-stats-core-reskin`, off `main` at `8f3d5f2`.

---

## ⚠️ Testing reality — read this before you rely on the suite

**No screen-level tests exist for ANY Stats screen.** The only related tests are service-layer (`src/services/__tests__/calendar.test.ts`, `src/services/__tests__/races-challenges.test.ts`) and neither renders a screen. The 241-test suite therefore **cannot catch a visual regression in this slice** — it only proves you didn't break a module import or a type.

Consequence: `npm run typecheck` + the suite are necessary but **not sufficient**. The visual pass and the whole-branch review carry more weight here than in any prior slice. Do not report "tests pass" as evidence that a screen still looks right.

The one genuine TDD task in this plan is **Task 1** (theme tokens), which gets a real pinning test written before the tokens. Tasks 2-9 are token substitutions with no assertable behavior; they use typecheck + suite as regression gates and an explicit self-review checklist instead of fabricated tests. Do not invent tests that assert a hex value equals itself.

---

## Global Constraints

Every task's requirements implicitly include this section.

- **STYLING ONLY.** No behavior, prop, or data-flow change. No refactors, no "while I'm here" improvements.
- **Never touch `src/constants/colors.ts`.** It still owns every screen not yet migrated.
- **Never touch `app/paywall.tsx` or `src/components/ScreenHeader.tsx`** — both already migrated in an earlier slice. `router.push('/paywall')` calls stay exactly as they are.
- **Out of scope entirely:** `app/races.tsx`, `app/race-event.tsx`, `app/race-search.tsx` (that's Stats Slice B).
- **`Button.children` is typed `string`.** Any button hosting an `<ActivityIndicator>`, an icon, or multiple children MUST stay a hand-rolled `TouchableOpacity`. **The hand-rolled recipe is:**
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
  // disabled state: opacity 0.5
  ```
  This recipe **mirrors the `Button` primitive on purpose** (`Button.tsx:49-55`). It is NOT a manufactured state cue — in the previous slice this recipe lived only in dispatch prompts and reviewers flagged it as invented three separate times. It is specified here so that never happens again.
- **`<Button>` CANNOT FLEX.** `Button` applies its `style` prop to the inner `Pressable`, but the flex child of a row is Button's `Animated.View` wrapper (which carries only the press transform). `style={{ flex: 1 }}` on a `<Button>` **silently does nothing** and the button collapses to text width. Any side-by-side button row must use hand-rolled `TouchableOpacity`. (A flex-capable Button API is deferred to a primitives-hardening slice.)
- **`Card.style` is typed `ViewStyle`, not `StyleProp<ViewStyle>`** → callers pass a single spread-merged object, not an array.
- **Uppercase-label colour rule:** eyebrow/section labels heading a card or screen → `Theme.accent`. Table/column headers and inline field labels → `Theme.textMut`. Both get `fontFamily: 'SpaceGrotesk_700Bold'`.
- **Do NOT manufacture state cues.** Migrate highlights that actually exist; don't invent new ones.
- **Radius:** 8-20 → `Radius.card`. Pill (≥20) and thin-bar/dot (≤4) radii KEEP their values.
- **`#fff` / `#000` marks sitting on an accent fill → `Theme.ink`.**
- **BEFORE migrating a brand token, check what sits BESIDE it.** This program's most-repeated lesson: `log.tsx`'s gold was functional because a teal sibling meant "training day"; hyrox's teal meant "run leg" against red "station". A colour with a differently-coloured sibling is probably a signal, not brand.
- **CONCURRENT-AGENT STAGING RULE:** parallel tasks share one working tree. Each implementer must `git add` **only its own file paths** — never `git add -A` or `git add .`. (Last slice two agents collided and one swept the other's edits into its commit.)
- **Verify per task:** `cd OSPREY-app && npm run typecheck && TZ=Asia/Kolkata npx jest` — typecheck clean, 241/241 tests, 30/30 suites.

---

## User-approved design decisions — settled, do NOT reopen

These were decided by the user from rendered mockups. A reviewer must not flag them as defects.

1. **Chart palette = "amber leads, muted categoricals support."** Run keeps `Theme.accent`; the other seven sports get desaturated, ink-tuned hues. Scheme B (drop hues, identify by icon+label) — which the Workout tab adopted — **explicitly does NOT apply here**: a stacked-bar segment has room for neither an icon nor a label, so colour is its only encoding.
2. **TSB/FORM keeps red/green** (`Colors.green` if `tsb >= 0` else `Colors.red`) — a functional good/bad threshold, not brand.
3. **Injury-risk banner keeps a 3-tier severity system** (high = red / moderate = amber / info = neutral).
4. **Calendar day-states keep their 3-way distinction:** gold = race day, green = completed, teal(→accent) = planned. Only the literal hues remap. The planned-vs-completed cue is **opacity-based** (`cellIcon` 0.45 vs `cellIconDone` 1.0) with a legend reading "Faded = planned · Solid = completed" — preserve it. There is no "missed" state in this UI; do not add one.

---

## File Structure

| File | Lines | `Colors.` refs | Task | Risk |
|---|---|---|---|---|
| `src/constants/theme.ts` | 36 | — | 1 | Low — additive only |
| `src/constants/__tests__/theme.test.ts` | 33 | — | 1 | Low |
| `src/components/FieldError.tsx` | 17 | 1 | **none — see below** | — |
| `src/components/DateField.tsx` | 183 | 7 | 2 | Low |
| `src/components/InputModal.tsx` | 160 | 11 | 3 | Low |
| `app/routes.tsx` | 366 | 36 | 4 | Low — fully mechanical |
| `app/calendar.tsx` | 354 | 23 | 5 | **Medium — day-state signals** |
| `app/challenges.tsx` | 651 | 51 | 6 | Medium — `activePip` is functional |
| `app/(tabs)/stats.tsx` | 851 | 86 | 7 + 8 | **High — charts + severity banner** |

### `FieldError.tsx` gets NO task — deliberately

Recon flagged it as un-migrated, and it is. But its **only** colour reference is `Colors.red`, used for inline form-validation text:

```tsx
const styles = StyleSheet.create({
  text: { fontSize: 12, color: Colors.red, marginTop: -6, marginBottom: 4 },
});
```

Validation red is **functional**, and this program has kept it every time it appeared (`log.tsx` `errorText`, `supplements.tsx` validation, `food-scanner.tsx` barcode error). `theme.ts` has no red token and this slice is not the place to introduce a semantic-danger scale. Migrating this file would mean changing `Colors.red` → `Colors.red`.

**Action: leave `FieldError.tsx` untouched.** This is recorded here so the whole-branch reviewer doesn't flag it as a missed file. If a future slice introduces a danger token, it can revisit.

---

## Task 1: Chart palette tokens

**Files:**
- Modify: `OSPREY-app/src/constants/theme.ts` (append after `Theme`, do not edit `Theme` itself)
- Modify: `OSPREY-app/src/constants/__tests__/theme.test.ts` (append a new `describe`)

**Interfaces:**
- Produces: `ChartPalette` — a `const` object exported from `@/constants/theme`, with per-sport keys `run | bike | swim | rowing | lift | hyrox | cross | race` plus `neutral`. Tasks 7 and 8 consume it. Keys match the `SportType` union in `@/types/stats`.

**⚠️ Do NOT add these as keys on `Theme`.** `theme.test.ts` asserts `expect(Theme).toEqual({...})` — an exact match. Adding a key to `Theme` fails that test. `ChartPalette` is a **separate export**.

- [ ] **Step 1: Write the failing pinning test**

Append to `OSPREY-app/src/constants/__tests__/theme.test.ts`:

```ts
import { ChartPalette } from '@/constants/theme';

describe('ChartPalette — pinned chart series colours (2026-07-18)', () => {
  it('leads with the brand accent for run and keeps seven muted categoricals', () => {
    expect(ChartPalette).toEqual({
      run: '#c8793a',
      bike: '#5b7fa6',
      swim: '#5aa06d',
      rowing: '#6b6fa8',
      lift: '#a8935c',
      hyrox: '#b05f4f',
      cross: '#9c6b8a',
      race: '#d4c44a',
      neutral: '#7d8aa5',
    });
  });

  it('uses the exact Theme.accent value for run, not a copy that can drift', () => {
    expect(ChartPalette.run).toBe(Theme.accent);
  });

  it('gives every sport a distinct colour (a stacked bar has no other encoding)', () => {
    const sports = Object.entries(ChartPalette)
      .filter(([key]) => key !== 'neutral')
      .map(([, value]) => value);
    expect(new Set(sports).size).toBe(sports.length);
  });
});
```

Note the existing file already imports `Theme` on line 1 — add `ChartPalette` to that same import rather than adding a second import statement.

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd OSPREY-app && TZ=Asia/Kolkata npx jest src/constants/__tests__/theme.test.ts
```

Expected: FAIL — `ChartPalette` is not exported from `@/constants/theme` (TypeScript/module resolution error, or `undefined` received).

- [ ] **Step 3: Add the tokens**

Append to `OSPREY-app/src/constants/theme.ts`, after the `Theme` export:

```ts
// Chart series colours. A stacked-bar segment has room for neither an icon nor
// a label, so colour is its ONLY encoding — which is why the Workout tab's
// "scheme B" (drop hues, identify by icon + label) deliberately does not apply
// here. Decided from rendered mockups, 2026-07-18.
//
// Run leads with the brand accent; the other seven are desaturated and tuned to
// sit on Theme.ink without competing with it. Hues are spread so that sports
// ADJACENT in SPORT_ORDER (stats.tsx) don't collide — notably bike and swim,
// which stack next to each other, sit on opposite sides of the blue/green line.
//
// `neutral` is the second series on the fitness/fatigue chart (ATL against
// accent's CTL); it is not a sport.
export const ChartPalette = {
  run: Theme.accent,
  bike: '#5b7fa6',
  swim: '#5aa06d',
  rowing: '#6b6fa8',
  lift: '#a8935c',
  hyrox: '#b05f4f',
  cross: '#9c6b8a',
  race: '#d4c44a',
  neutral: '#7d8aa5',
} as const;
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd OSPREY-app && TZ=Asia/Kolkata npx jest src/constants/__tests__/theme.test.ts
```

Expected: PASS. Then confirm the pre-existing `Theme` pinning test still passes — if it fails, you added a key to `Theme` instead of creating a separate export.

- [ ] **Step 5: Full verification**

```bash
cd OSPREY-app && npm run typecheck && TZ=Asia/Kolkata npx jest
```

Expected: typecheck clean; **244 tests / 30 suites** (241 + the 3 new ones).

- [ ] **Step 6: Commit**

```bash
git add OSPREY-app/src/constants/theme.ts OSPREY-app/src/constants/__tests__/theme.test.ts
git commit -m "feat(mobile): add ChartPalette tokens for the Stats charts"
```

---

## Task 2: `DateField.tsx`

**Files:**
- Modify: `OSPREY-app/src/components/DateField.tsx` (183 lines, 7 `Colors.` refs)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: nothing consumed by later tasks. Used by `challenges.tsx` (Task 6) and `races.tsx` (Slice B) — so its visual result must stand on its own in both.

- [ ] **Step 1: Read the file and inventory every colour**

Before editing, list each `Colors.` reference and classify it **functional** (encodes meaning against a differently-coloured sibling) or **decorative/brand** (chrome). This is a date picker — expect selected-day vs unselected-day states, which are a generic selected/unselected pattern (decorative → accent), not a semantic signal.

If you find a colour whose sibling is a *different* colour conveying a *different meaning*, STOP and report it rather than migrating it.

- [ ] **Step 2: Apply the migration**

- Surfaces: `Colors.bg` → `Theme.ink`; card/field surfaces and `rgba(255,255,255,0.0x)` → `Theme.panel`
- Borders → `Theme.line`, at `BorderWidth.card` for card-like surfaces (keep 1px for pills/dots)
- Brand teal → `Theme.accent`
- Text: primary → `Theme.text`, secondary → `Theme.textSoft`, muted → `Theme.textMut`
- Radius 8-20 → `Radius.card`; pill (≥20) and dot (≤4) radii KEEP
- `#fff`/`#000` on an accent fill → `Theme.ink`
- Uppercase labels per the Global Constraints rule
- Add `import { Theme, Radius, BorderWidth } from '@/constants/theme';`. Drop the `Colors` import **only if** no reference survives.

- [ ] **Step 3: Verify**

```bash
cd OSPREY-app && npm run typecheck && TZ=Asia/Kolkata npx jest
```

Expected: typecheck clean, 244/244, 30/30.

- [ ] **Step 4: Commit**

```bash
git add OSPREY-app/src/components/DateField.tsx
git commit -m "feat(mobile): re-skin DateField"
```

---

## Task 3: `InputModal.tsx`

**Files:**
- Modify: `OSPREY-app/src/components/InputModal.tsx` (160 lines, 11 `Colors.` refs)

**Interfaces:**
- Consumes: imports `FieldError`, which is **deliberately unmigrated** (see File Structure). Do not touch `FieldError.tsx`. Its red validation text is expected to sit inside your migrated modal — that is correct, not a mismatch.
- Produces: nothing. Used only by `races.tsx` (Slice B).

- [ ] **Step 1: Read the file and inventory every colour** (same classification discipline as Task 2)

A modal has a scrim/overlay. **A scrim is not a surface** — if you find something like `rgba(0,0,0,0.5)` behind the modal card, it is providing contrast against arbitrary content underneath and must NOT become `Theme.panel`. Re-derive it from `Theme.ink` if you change it at all (`rgba(9,9,11,<same alpha>)`), or leave it. This exact mistake was caught by review in the previous slice.

- [ ] **Step 2: Apply the migration** — same mapping as Task 2 Step 2.

If the modal's confirm/cancel buttons sit side by side in a row, they must be hand-rolled `TouchableOpacity` (see the `<Button>` CANNOT FLEX constraint), using the recipe in Global Constraints.

- [ ] **Step 3: Verify**

```bash
cd OSPREY-app && npm run typecheck && TZ=Asia/Kolkata npx jest
```

Expected: typecheck clean, 244/244, 30/30.

- [ ] **Step 4: Commit**

```bash
git add OSPREY-app/src/components/InputModal.tsx
git commit -m "feat(mobile): re-skin InputModal"
```

---

## Task 4: `routes.tsx`

**Files:**
- Modify: `OSPREY-app/app/routes.tsx` (366 lines, 36 `Colors.` refs)

**Interfaces:**
- Consumes: nothing. Imports `ScreenHeader` (already migrated — do not touch) and `FieldError` (deliberately unmigrated — do not touch).

Recon found **no functional colour** in this file: route tags are uniformly teal chips, and there is no map or polyline. It is the most mechanical file in the slice. Still run the Step 1 inventory — "recon said it's mechanical" is not the same as having looked.

- [ ] **Step 1: Inventory every colour and confirm none is functional**

If you find a colour that contradicts the "fully mechanical" expectation, report it rather than assuming recon was right.

- [ ] **Step 2: Apply the migration** — mapping per Task 2 Step 2.

- [ ] **Step 3: Hand-roll the Save button**

`routes.tsx:207-220` is a Save button hosting an `<ActivityIndicator>`. It must stay a `TouchableOpacity` — use the recipe in Global Constraints, with the spinner as `<ActivityIndicator color={Theme.ink} />` and a `saving && styles.saveBtnDisabled` (`{ opacity: 0.5 }`) entry. **This mirrors the `Button` primitive deliberately; it is not an invented cue.**

- [ ] **Step 4: Verify**

```bash
cd OSPREY-app && npm run typecheck && TZ=Asia/Kolkata npx jest
```

Expected: typecheck clean, 244/244, 30/30.

- [ ] **Step 5: Commit**

```bash
git add OSPREY-app/app/routes.tsx
git commit -m "feat(mobile): re-skin routes screen"
```

---

## Task 5: `calendar.tsx`

**Files:**
- Modify: `OSPREY-app/app/calendar.tsx` (354 lines, 23 `Colors.` refs)

**Interfaces:**
- Consumes: nothing. Imports `ScreenHeader` (already migrated — do not touch).

### The functional colours in this file — preserve all of them

This screen encodes day state three different ways. **Keep the 3-way distinction** (user decision 4).

**(a) The bottom-sheet card label is a 3-state semantic signal.** `styles.sheetCardLabel` defaults to `Colors.teal` (`calendar.tsx:341`) and is overridden inline:

```tsx
// calendar.tsx:213
<Text style={[styles.sheetCardLabel, { color: Colors.gold }]}>RACE DAY</Text>
// calendar.tsx:226 — no override, uses the teal default
<Text style={styles.sheetCardLabel}>PLANNED</Text>
// calendar.tsx:241
<Text style={[styles.sheetCardLabel, { color: Colors.green }]}>COMPLETED</Text>
```

Migrate to: **PLANNED → `Theme.accent`** (the default in `sheetCardLabel`), **RACE DAY → keeps gold `Colors.gold`**, **COMPLETED → keeps green `Colors.green`**. Do NOT collapse these into one accent — that would erase the distinction the user explicitly chose to keep. These are uppercase eyebrow labels, so all three also get `fontFamily: 'SpaceGrotesk_700Bold'`.

**(b) The planned-vs-completed grid cue is OPACITY, not colour** (`calendar.tsx:297-298`):

```ts
cellIcon: { fontSize: 14, opacity: 0.45 },   // planned
cellIconDone: { opacity: 1 },                // completed
```

The legend at `calendar.tsx:177` literally reads "Faded = planned · Solid = completed". **Leave both opacity values exactly as they are** and do not add a colour to either. There is no "missed" state in this UI — do not invent one.

**(c) Today's cell** (`calendar.tsx:291-296`): `cellToday` `Colors.surfaceTeal` → an accent-tinted surface (`Theme.accent + '1A'`, ≈10% — verify the hex-alpha suffix), `cellDayToday` `Colors.teal` → `Theme.accent`. `cellToday.borderRadius: 10` → `Radius.card`.

**(d) The bottom sheet background is a bespoke hex** — `#0D1424` at `calendar.tsx:305`, not from `Colors` at all. It's decorative → `Theme.panel`.

- [ ] **Step 1: Inventory every colour**, then re-read (a)-(d) above and locate each site in the current file (line numbers may have shifted).

- [ ] **Step 2: Apply the migration** — mapping per Task 2 Step 2, plus (a)-(d).

- [ ] **Step 3: Self-check the three-way distinction**

Confirm by reading your own diff: after your change, are RACE DAY / PLANNED / COMPLETED still three *different* colours? If any two now resolve to the same value, you have collapsed the signal — fix it before committing.

- [ ] **Step 4: Verify**

```bash
cd OSPREY-app && npm run typecheck && TZ=Asia/Kolkata npx jest
```

Expected: typecheck clean, 244/244, 30/30.

- [ ] **Step 5: Commit**

```bash
git add OSPREY-app/app/calendar.tsx
git commit -m "feat(mobile): re-skin calendar (keep race/completed/planned signals)"
```

---

## Task 6: `challenges.tsx`

**Files:**
- Modify: `OSPREY-app/app/challenges.tsx` (651 lines, 51 `Colors.` refs)

**Interfaces:**
- Consumes: `DateField` (Task 2). If Task 2 has landed, `DateField` will already look migrated inside your screen — that's expected, don't re-style it. Imports `ScreenHeader` (already migrated) and `FieldError` (deliberately unmigrated) — touch neither.

### Functional colour — keep

**`activePip` is a status indicator, not decoration** (`challenges.tsx:596-602`):

```ts
activePip: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.green, marginTop: 5, marginLeft: 8 },
```

It renders **only** when `c.status === 'active'` (`challenges.tsx:473-475`) — its absence is itself the signal for "not active". **Keep `Colors.green`.** Its `borderRadius: 4` is a dot radius (≤4) → KEEP as-is, do not "migrate" it to `Radius.card` even though the numbers coincide.

### Decorative — migrate

- Leaderboard "you"-row highlight (`lbRowMe`, ~`:641-645`), teal → accent-tinted surface. It marks *which row is yours*, but has no differently-coloured sibling state — it's a self-highlight, not a semantic scale.
- Challenge-type chips and invite chips: teal-active vs neutral-inactive is the generic selected/unselected pattern used across the app → `Theme.accent` border/text for active, `Theme.line` for inactive.

### Hand-rolled buttons — two of them

Both host an `<ActivityIndicator>` and must stay `TouchableOpacity` (recipe in Global Constraints):
- `challenges.tsx:335-348` — "Create Challenge" save button
- `challenges.tsx:81-94` — leaderboard refresh, which swaps an `<ActivityIndicator>` in for a `Text` glyph

- [ ] **Step 1: Inventory every colour** and locate the sites above in the current file.

- [ ] **Step 2: Apply the migration** — mapping per Task 2 Step 2, keeping `activePip` green.

- [ ] **Step 3: Verify**

```bash
cd OSPREY-app && npm run typecheck && TZ=Asia/Kolkata npx jest
```

Expected: typecheck clean, 244/244, 30/30.

- [ ] **Step 4: Commit**

```bash
git add OSPREY-app/app/challenges.tsx
git commit -m "feat(mobile): re-skin challenges (keep active-status pip)"
```

---

## Task 7: `stats.tsx` — charts, sport palette, and the severity banner

**Files:**
- Modify: `OSPREY-app/app/(tabs)/stats.tsx` (851 lines) — **this task owns the chart components, `SPORT_COLOR`, the `FitnessMetric` colour props, and the injury-risk banner styles ONLY.** Task 8 owns the rest of the file.

**Interfaces:**
- Consumes: `ChartPalette` from `@/constants/theme` (Task 1) — keys `run | bike | swim | rowing | lift | hyrox | cross | race | neutral`.
- Produces: a migrated `SPORT_COLOR` that Task 8's legend rendering continues to read. **Do not rename `SPORT_COLOR`** — Task 8 depends on the name.

**Task 8 works in this same file and must run AFTER this task.** Do not attempt them in parallel.

### 7a. `SPORT_COLOR` → `ChartPalette`

Current (`stats.tsx:41-50`):

```ts
const SPORT_COLOR: Record<SportType, string> = {
  run: Colors.teal,
  bike: Colors.blue,
  swim: Colors.green,
  lift: Colors.gold,
  cross: Colors.pink,
  race: Colors.amber,
  rowing: Colors.indigo,
  hyrox: Colors.red,
};
```

Replace with:

```ts
const SPORT_COLOR: Record<SportType, string> = {
  run: ChartPalette.run,
  bike: ChartPalette.bike,
  swim: ChartPalette.swim,
  lift: ChartPalette.lift,
  cross: ChartPalette.cross,
  race: ChartPalette.race,
  rowing: ChartPalette.rowing,
  hyrox: ChartPalette.hyrox,
};
```

Leave `SPORT_ORDER` (`:40`), `SPORT_LABEL` (`:51-60`), and `SESSION_ICON` (`:27-36`) untouched — order and labels are not colour.

### 7b. `FitnessChart` — CTL/ATL two-series (`stats.tsx:80-125`)

The CTL polyline is `stroke={Colors.teal}` and the ATL polyline is `stroke={Colors.amber}`. **This is a two-series identity chart** — the colour is what tells fitness from fatigue.

- CTL (fitness) stroke → `ChartPalette.run` (= `Theme.accent`)
- ATL (fatigue) stroke → `ChartPalette.neutral`

**Do not change** `strokeWidth` (1.8 / 1.4), `opacity` (0.9 / 0.75), `strokeLinecap`, or `strokeLinejoin` — those are the existing visual hierarchy between the two series and are not colour.

### 7c. `E1rmChart` (`stats.tsx:129-157`)

Single series, `stroke={Colors.gold}` → `ChartPalette.lift`. This chart is always about a lift, so the lift colour is the principled choice and keeps it consistent with that sport's bar segments. Leave `strokeWidth={2}` alone.

### 7d. `FitnessMetric` colour props (`stats.tsx:335-352`)

```tsx
<FitnessMetric label="FITNESS" sublabel="CTL" ... color={Colors.teal} />   // → ChartPalette.run
<FitnessMetric label="FATIGUE" sublabel="ATL" ... color={Colors.amber} />  // → ChartPalette.neutral
<FitnessMetric label="FORM"    sublabel="TSB" ... color={perf.tsb >= 0 ? Colors.green : Colors.red} />
```

**FITNESS and FATIGUE must match their polylines exactly** — they are the chart's legend. **FORM keeps `Colors.green` / `Colors.red` unchanged** (user decision 2 — a good/bad threshold, not brand).

### 7e. Injury-risk banner — 3-tier severity (`stats.tsx:~686-700`)

```ts
riskBannerHigh: { backgroundColor: 'rgba(255,68,68,0.07)', borderColor: 'rgba(255,68,68,0.25)' },
riskBannerMod:  { backgroundColor: Colors.surfaceGold,     borderColor: Colors.borderGold },
riskBannerInfo: { backgroundColor: Colors.surfaceTeal,     borderColor: Colors.borderTeal },
```

This is a **functional severity scale** (user decision 3). Keep three visually distinct tiers:

- `riskBannerHigh` — **leave the red rgba values exactly as they are.** They're off-token but they're the correct semantic red, and `theme.ts` has no red. Add a `// FUNCTIONAL — severity tier, not a surface` comment above it so a future slice doesn't flatten it.
- `riskBannerMod` — the amber tier. Use `Theme.accent + '12'` (≈7% fill) / `Theme.accent + '40'` (25% border), matching the alpha steps of the red tier above it so the three tiers share one visual rhythm. Verify the hex-alpha arithmetic before committing (`0x12` = 18, 18/255 ≈ 0.07; `0x40` = 64, 64/255 = 0.25). This must stay visibly distinct from both the red tier above and the neutral tier below — if it doesn't, report it rather than adjusting the red.
- `riskBannerInfo` — this is the neutral/low tier; migrate it to `Theme.panel` / `Theme.line`.

- [ ] **Step 1: Add the import**

Add `ChartPalette` to the existing `@/constants/theme` import if one exists, otherwise add `import { Theme, Radius, BorderWidth, ChartPalette } from '@/constants/theme';`. **Keep the `Colors` import** — Task 8 still needs it, and 7d/7e keep red/green.

- [ ] **Step 2: Apply 7a through 7e.** Change nothing else in the file — Task 8 owns the rest.

- [ ] **Step 3: Self-check the legend/series agreement**

Read your own diff and confirm: does the FITNESS metric colour equal the CTL polyline stroke? Does FATIGUE equal the ATL stroke? If a legend and its series disagree, the chart is lying.

- [ ] **Step 4: Verify**

```bash
cd OSPREY-app && npm run typecheck && TZ=Asia/Kolkata npx jest
```

Expected: typecheck clean, 244/244, 30/30.

- [ ] **Step 5: Commit**

```bash
git add "OSPREY-app/app/(tabs)/stats.tsx"
git commit -m "feat(mobile): re-skin stats charts onto ChartPalette"
```

---

## Task 8: `stats.tsx` — everything else

**Files:**
- Modify: `OSPREY-app/app/(tabs)/stats.tsx` — **everything Task 7 did not touch.**

**Interfaces:**
- Consumes: Task 7's migrated `SPORT_COLOR` (same name, same shape) and its `ChartPalette` import. **Read the current file first — Task 7's work is already in it.** Do not re-migrate the charts, `SPORT_COLOR`, the `FitnessMetric` colour props, or the risk-banner styles.

**Must run AFTER Task 7** — same file.

### Scope

Screen chrome, the race/triathlon predictor cards, the lift PR list, lift volume, muscle chips, workout rows, empty states, and the paywall CTA.

### Notes on specific sites

- **Predictor cards** (`~:377-431`, styles `~:751-755`): `predictorTime` teal and `predictorTotalValue` gold are decorative emphasis — both are just "a time value", with no differently-meaning sibling. Migrate both to `Theme.accent`.
- **PR list** (`~:453-511`, styles `~:785-819`): `prMedal` uses a 🏆 emoji for #1 and plain `#2`/`#3` text for the rest — **no colour distinction exists, so don't create one.** `prValue` / `liftVolumeValue` / `muscleChipText` gold → `Theme.accent`.
- **Legend dots** for the volume chart read `SPORT_COLOR` — leave those reads alone; Task 7 already changed what they resolve to.
- **The paywall CTA** (`router.push('/paywall')` at `~:438`) — style the button, but do not touch the navigation or `paywall.tsx` itself.
- **Dead imports:** `stats.tsx:12` imports `Line`, `Path`, `Rect` from `react-native-svg` but only `Svg` and `Polyline` are used. **Leave them.** Removing unused imports is not a styling change and is out of scope for this slice; flag it in your report as a follow-up instead.

- [ ] **Step 1: Read the current file** (post-Task-7) and inventory every remaining `Colors.` reference.

- [ ] **Step 2: Apply the migration** — mapping per Task 2 Step 2, plus the notes above.

- [ ] **Step 3: Handle the `Colors` import**

Drop it **only if** no reference survives anywhere in the file. Task 7 kept `Colors.green`/`Colors.red` for the FORM metric and the red severity tier — so the import almost certainly stays. Verify with `grep -n "Colors\." "app/(tabs)/stats.tsx"` before removing anything.

- [ ] **Step 4: Verify**

```bash
cd OSPREY-app && npm run typecheck && TZ=Asia/Kolkata npx jest
```

Expected: typecheck clean, 244/244, 30/30.

- [ ] **Step 5: Commit**

```bash
git add "OSPREY-app/app/(tabs)/stats.tsx"
git commit -m "feat(mobile): re-skin stats screen chrome and cards"
```

---

## Task 9: Visual pass, whole-branch review, merge

**Files:** none (verification only).

- [ ] **Step 1: Visual pass**

Start the Expo dev server (`.claude/launch.json` config name: `OSPREY-app (Expo)`, port 8081) and load `http://localhost:8081`. The web-preview fixtures are already committed (`app.json` `web.output: "single"`, plus the `Platform.OS === 'web'` branch in `secure-session-storage.ts`) — no setup needed.

Load the app and walk: Stats → Calendar → Challenges → Routes.

**Known preview limitation:** react-native-web ignores synthetic `MouseEvent`s, so `computer left_click` may not drive RN `Pressable`s. Navigate by URL (`/calendar`, `/challenges`, `/routes`) rather than by clicking, and expect that states requiring live data or a session may be unreachable — say so plainly rather than reporting an unverified check as passed.

**Check specifically:**
1. **The stacked volume chart with several sports present** — are the eight segments distinguishable? Pay attention to `bike` (#5b7fa6) against `swim` (#5aa06d): they are ADJACENT in `SPORT_ORDER`, so they will touch.
2. **The fitness/fatigue chart** — accent CTL vs neutral ATL, and confirm the FITNESS/FATIGUE metric values match their lines.
3. **The injury-risk banner's three tiers** — visibly distinct from each other.
4. **Calendar** — RACE DAY / PLANNED / COMPLETED still read as three different states, and the faded-vs-solid icon cue still works.
5. **Challenges** — the green active pip still reads as a status dot.

**Known preview limits, do not read into them:** teal `Switch` thumbs are a react-native-web artifact (the code sets `thumbColor` correctly); charts need real data to render, so an account with no history will show empty states rather than charts.

**Do NOT press any destructive or write action** (delete a workout, create a challenge, save a route) — those write real data to the user's account.

- [ ] **Step 2: Whole-branch review**

Dispatch a final review over `git merge-base main HEAD`..`HEAD` on the most capable model. Point it at this plan, the progress ledger, and the design decisions above. Ask specifically for the cross-file view the per-task reviews cannot give: consistency across the four screens, whether any functional colour was lost in aggregate, and any behavior change that slipped through nine "styling only" tasks.

- [ ] **Step 3: Fix any Critical/Important findings**, then re-verify.

- [ ] **Step 4: Merge and push**

```bash
git checkout main && git merge --no-ff mobile-stats-core-reskin
cd OSPREY-app && npm run typecheck && TZ=Asia/Kolkata npx jest
git push origin main
```

---

## Execution notes

**Parallelism.** Tasks 2, 3, 4, 5, 6 touch five different files and can run concurrently — **but only if each implementer stages only its own path** (see the Global Constraints staging rule). Task 3 should land after Task 2 only in the weak sense that `InputModal` imports `FieldError` (unmigrated either way), so there's no real ordering constraint. Task 1 must precede Task 7. **Task 7 must precede Task 8** — same file, hard constraint.

**Suggested wave 1:** Task 1, then Tasks 2/4/5/6 in parallel.
**Wave 2:** Task 3, Task 7.
**Wave 3:** Task 8, then Task 9.

**Test-count bookkeeping:** the suite goes 241 → **244** after Task 1. Every later task expects 244/244, 30/30. A task reporting 241 after Task 1 has landed is a signal that something is wrong.
