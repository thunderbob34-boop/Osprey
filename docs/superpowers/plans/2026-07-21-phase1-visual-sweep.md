# Phase 1 Visual Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate every remaining old-brand pixel, fix the worst first-run trap, and put the athlete's own numbers on the Home session card — so the app reads as one coherent ink/amber product on first open.

**Architecture:** Six independent, small changes to the mobile app plus one edge-function CORS fix. Each is self-contained; the only shared dependency is the ink/amber token set already in `src/constants/theme.ts`. Pure logic (the session pace band) goes in a new testable service module rather than inline in the screen, matching how `race-display.ts` was extracted for the mobile F3/F4 work.

**Tech Stack:** React Native / Expo, `react-native-svg`, Jest + `@testing-library/react-native`, Deno (edge function).

## Global Constraints

- Source audit: `OSPREY-app/audit-reports/2026-07-21-experience-audit.md`. Roadmap + binding decisions: `docs/superpowers/plans/2026-07-21-experience-revamp-roadmap.md`.
- **User decision (binding):** Log's gold chips migrate to a **neutral** tone (`EffortPalette.rest`, which is `Theme.textMut`). This deliberately reverses the earlier "gold is functional" call — the code comment asserting that reasoning must be removed, not left contradicting the code.
- Ink/amber tokens only, from `@/constants/theme`: `Theme.ink #09090B`, `Theme.panel`, `Theme.line`, `Theme.accent #c8793a`, `Theme.accentBright`, `Theme.text`, `Theme.textSoft`, `Theme.textMut`, `Radius.card` (4), `BorderWidth.card` (2).
- **Functional color stays functional.** Do NOT touch: danger red, validation red, `EffortPalette`/`IntensityPalette` ramps, zone dots, `ChartPalette`. Only brand-decorative color moves.
- **Tasks 1-6 (mobile app)** end with `npx tsc --noEmit` clean and `TZ=Asia/Kolkata npx jest` fully green from `OSPREY-app/`. **Task 7 (edge function)** has no Jest suite — it ends with `deno check` (count unchanged vs. the pre-existing baseline) and `deno test --allow-all` green from its own function directory, per its own steps.
- Commit messages: short, imperative, `fix(mobile):` or `feat(mobile):` prefix. Edge-function task uses `fix(edge):`.
- Do not touch `webapp/`, and do not modify any file already modified-and-uncommitted outside this plan's scope. Run `git status` first; if unexpected files are dirty, report rather than committing them.
- **Do not deploy anything.** Task 7 changes edge-function source only; deployment needs separate explicit user permission.

---

### Task 1: Restroke the Ozzie mascot in amber

The mascot renders hardcoded old-brand teal `#00c8c8` brows on welcome (first-run, 120px), Home, paywall, and ask-ozzie — old-brand color on the very first screens anyone opens. Both SVG components carry an identical pair of `<Path>` brow strokes.

**Files:**
- Modify: `OSPREY-app/src/components/OzzieMascot.tsx:44-46`
- Modify: `OSPREY-app/src/components/OzzieAvatar.tsx:38-40`

**Interfaces:**
- Consumes: `Theme` from `@/constants/theme` (new import in both files).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Read both files to confirm the exact current lines**

Run: `cd "OSPREY-app" && grep -n "00c8c8\|Teal brand" src/components/OzzieMascot.tsx src/components/OzzieAvatar.tsx`

Expected: 3 hits per file — one comment line, two `<Path>` lines with `stroke="#00c8c8"`.

- [ ] **Step 2: Add the Theme import to `OzzieMascot.tsx`**

The file currently starts:

```tsx
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
```

Add a fourth import line directly beneath:

```tsx
import { Theme } from '@/constants/theme';
```

- [ ] **Step 3: Restroke the brows in `OzzieMascot.tsx`**

Replace lines 44-46:

```tsx
      {/* ── Teal brand accent along the stripe brow ── */}
      <Path d="M45 41 Q33 36 20 38" stroke="#00c8c8" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />
      <Path d="M55 41 Q67 36 80 38" stroke="#00c8c8" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />
```

with:

```tsx
      {/* ── Brand accent along the stripe brow ── */}
      <Path d="M45 41 Q33 36 20 38" stroke={Theme.accent} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />
      <Path d="M55 41 Q67 36 80 38" stroke={Theme.accent} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />
```

- [ ] **Step 4: Add the Theme import to `OzzieAvatar.tsx`**

The file currently starts:

```tsx
import React from 'react';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
```

Add a third import line directly beneath:

```tsx
import { Theme } from '@/constants/theme';
```

- [ ] **Step 5: Restroke the brows in `OzzieAvatar.tsx`**

Replace lines 38-40:

```tsx
      {/* ── Teal brand accent along the stripe brow ── */}
      <Path d="M45 41 Q33 36 20 38" stroke="#00c8c8" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />
      <Path d="M55 41 Q67 36 80 38" stroke="#00c8c8" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />
```

with:

```tsx
      {/* ── Brand accent along the stripe brow ── */}
      <Path d="M45 41 Q33 36 20 38" stroke={Theme.accent} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />
      <Path d="M55 41 Q67 36 80 38" stroke={Theme.accent} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />
```

- [ ] **Step 6: Verify no teal remains in the mascot components**

Run: `cd "OSPREY-app" && grep -rn "00c8c8" src/components/ || echo "CLEAN — no teal in components/"`

Expected: `CLEAN — no teal in components/`

Two teal hits remain elsewhere in the app and are **expected at this step** — do not "fix" them here:
- `src/constants/colors.ts:6` — the old palette's own definition. It legitimately holds teal and stays until every screen is off `colors.ts`.
- `src/services/calendar-blocking.ts:60` — handled by Task 3, Step 4.

- [ ] **Step 7: Typecheck and test**

Run: `cd "OSPREY-app" && npx tsc --noEmit && TZ=Asia/Kolkata npx jest`
Expected: typecheck silent (exit 0); Jest reports 355 passed (no new tests added by this task).

- [ ] **Step 8: Commit**

```bash
cd "OSPREY-app"
git add src/components/OzzieMascot.tsx src/components/OzzieAvatar.tsx
git commit -m "fix(mobile): restroke Ozzie's brows in amber, not old-brand teal"
```

---

### Task 2: Migrate Log's gold chips to neutral

Gold `#c89a00` was originally kept because it contrasted against **teal** training-day chips. Those chips are now **amber** `#c8793a`, so gold-beside-amber reads as an off-shade mistake rather than a distinction. Per the user's binding decision, gold migrates to neutral.

Three gold sites: the rest-day chip (background + text), the copy-yesterday chip (background + text + spinner), and a stale code comment asserting the now-reversed "gold is functional" rationale.

**Files:**
- Modify: `OSPREY-app/app/(tabs)/log.tsx:805-824` (comment + spinner + label)
- Modify: `OSPREY-app/app/(tabs)/log.tsx:1110-1112` (rest-day chip styles)
- Modify: `OSPREY-app/app/(tabs)/log.tsx:1184-1185` (copy-yesterday chip styles)

**Interfaces:**
- Consumes: `EffortPalette` from `@/constants/theme` (new import) — `EffortPalette.rest` is `Theme.textMut`, the project's existing semantic token for a non-training day.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Confirm the current gold sites**

Run: `cd "OSPREY-app" && grep -n "gold\|rgba(200,154,0" "app/(tabs)/log.tsx"`

Expected: hits at 805-810 (comment), 820 (spinner), 823 (label), 1110, 1112, 1184, 1185.

- [ ] **Step 2: Add the EffortPalette import**

Find the existing theme import line in `app/(tabs)/log.tsx` (it imports from `@/constants/theme`) and add `EffortPalette` to its named imports. For example, if the line reads:

```tsx
import { Theme, Radius, BorderWidth } from '@/constants/theme';
```

change it to:

```tsx
import { Theme, Radius, BorderWidth, EffortPalette } from '@/constants/theme';
```

If `EffortPalette` is already imported, leave the line alone.

- [ ] **Step 3: Replace the stale comment and the two gold usages in the copy-yesterday chip**

Replace lines 805-824:

```tsx
                    {/* NOT converted to <Button>: gold here is functional (distinguishes
                        this action from the accent-colored recent-meal chips beside it),
                        and the primitive only offers ink/accent spinner+text colors — a
                        gold treatment isn't expressible without overriding both the fill
                        and the label, at which point it's not really using the primitive.
                        Left hand-rolled to preserve the gold semantics. */}
                    <TouchableOpacity
                      style={[styles.recentChip, styles.copyYesterdayChip]}
                      onPress={handleCopyYesterday}
                      disabled={copyYesterday.isPending}
                      accessibilityRole="button"
                      accessibilityLabel="Copy all meals from yesterday"
                      accessibilityState={{ disabled: copyYesterday.isPending, busy: copyYesterday.isPending }}
                    >
                      {copyYesterday.isPending ? (
                        <ActivityIndicator color={Colors.gold} size="small" />
                      ) : (
                        <>
                          <Text style={[styles.recentChipName, { color: Colors.gold }]}>
                            ⧉ Copy yesterday
                          </Text>
```

with:

```tsx
                    {/* NOT converted to <Button>: this is a secondary utility action, so
                        it reads neutral against the amber recent-meal chips beside it —
                        the Button primitive only offers ink/accent treatments, and a
                        neutral one isn't expressible without overriding both the fill and
                        the label. (Was gold when the neighbouring chips were teal; once
                        those migrated to amber, warm-on-warm stopped reading as a
                        distinction — see the 2026-07-21 experience audit.) */}
                    <TouchableOpacity
                      style={[styles.recentChip, styles.copyYesterdayChip]}
                      onPress={handleCopyYesterday}
                      disabled={copyYesterday.isPending}
                      accessibilityRole="button"
                      accessibilityLabel="Copy all meals from yesterday"
                      accessibilityState={{ disabled: copyYesterday.isPending, busy: copyYesterday.isPending }}
                    >
                      {copyYesterday.isPending ? (
                        <ActivityIndicator color={EffortPalette.rest} size="small" />
                      ) : (
                        <>
                          <Text style={[styles.recentChipName, { color: EffortPalette.rest }]}>
                            ⧉ Copy yesterday
                          </Text>
```

- [ ] **Step 4: Replace the rest-day chip styles**

Replace lines 1110-1112:

```tsx
  dayTypeChipRest: { backgroundColor: Colors.goldDim, borderColor: 'rgba(200,154,0,0.3)' },
```
```tsx
  dayTypeChipTextRest: { color: Colors.gold },
```

with (keeping any intervening line between them exactly as it is):

```tsx
  dayTypeChipRest: { backgroundColor: 'transparent', borderColor: Theme.line },
```
```tsx
  dayTypeChipTextRest: { color: EffortPalette.rest },
```

A rest day now reads as an outlined neutral chip; a training day keeps its filled amber treatment, so the two remain clearly distinct without two warm hues competing.

- [ ] **Step 5: Replace the copy-yesterday chip styles**

Replace lines 1184-1185:

```tsx
    borderColor: 'rgba(200,154,0,0.3)',
    backgroundColor: Colors.goldDim,
```

with:

```tsx
    borderColor: Theme.line,
    backgroundColor: 'transparent',
```

- [ ] **Step 6: Verify no gold remains in log.tsx**

Run: `cd "OSPREY-app" && grep -n "gold\|rgba(200,154,0" "app/(tabs)/log.tsx" || echo "CLEAN — no gold remains in log.tsx"`

Expected: `CLEAN — no gold remains in log.tsx`

- [ ] **Step 7: Typecheck and test**

Run: `cd "OSPREY-app" && npx tsc --noEmit && TZ=Asia/Kolkata npx jest`
Expected: typecheck silent; 355 passed.

Note: if `Colors` is now unused in `log.tsx`, `tsc` will NOT flag it (the project does not set `noUnusedLocals` for app code) — but check with `grep -n "Colors\." "app/(tabs)/log.tsx"` and remove the `Colors` import only if it has zero remaining uses.

- [ ] **Step 8: Commit**

```bash
cd "OSPREY-app"
git add "app/(tabs)/log.tsx"
git commit -m "fix(mobile): migrate Log's gold chips to neutral"
```

---

### Task 3: Migrate the Calendar off old-brand colour (gold card + teal device calendar)

Two old-brand leftovers on the calendar surface. The race-day detail sheet renders in gold surface/border/text — the same class of decorative race-gold already migrated on the Settings screen during the design program. Separately, the OSPREY calendar that the app *creates on the user's device* is registered in old-brand teal, so every blocked workout shows up teal in Apple/Google Calendar — arguably the most publicly visible old-brand pixel in the product.

**Files:**
- Modify: `OSPREY-app/app/calendar.tsx:214` (label colour)
- Modify: `OSPREY-app/app/calendar.tsx:343-344` (card surface + border)
- Modify: `OSPREY-app/src/services/calendar-blocking.ts:60` (device-calendar colour)

**Interfaces:**
- Consumes: `Theme` from `@/constants/theme` (verify it is already imported; `calendar.tsx` is a migrated screen so it almost certainly is).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Confirm the gold sites and that Theme is imported**

Run: `cd "OSPREY-app" && grep -n "Colors.gold\|surfaceGold\|borderGold" app/calendar.tsx && grep -n "from '@/constants/theme'" app/calendar.tsx`

Expected: three gold hits (214, 343, 344) and at least one theme import line.

- [ ] **Step 2: Recolour the RACE DAY label**

Replace line 214:

```tsx
                <Text style={[styles.sheetCardLabel, { color: Colors.gold }]}>RACE DAY</Text>
```

with:

```tsx
                <Text style={[styles.sheetCardLabel, { color: Theme.accent }]}>RACE DAY</Text>
```

- [ ] **Step 3: Recolour the card surface and border**

Replace lines 343-344:

```tsx
    backgroundColor: Colors.surfaceGold,
    borderColor: Colors.borderGold,
```

with:

```tsx
    backgroundColor: `${Theme.accent}26`,
    borderColor: Theme.accent,
```

The `${fg}26` hex-alpha derivation is the pattern `theme.ts` already uses for `IntensityPalette` chip surfaces, so this matches the established house style rather than inventing a new tinting approach.

- [ ] **Step 4: Recolour the device calendar OSPREY creates**

`src/services/calendar-blocking.ts` registers a real calendar on the user's device (Apple/Google Calendar) with a colour swatch, currently hardcoded old-brand teal. Every workout OSPREY blocks out shows up in that colour in the user's own calendar app.

Add this import alongside the file's existing imports:

```ts
import { Theme } from '@/constants/theme';
```

Then at line 60, replace:

```ts
    color: '#00c8c8',
```

with:

```ts
    color: Theme.accent,
```

**Note on existing installs:** `createCalendarAsync` only runs when OSPREY's calendar does not yet exist, so an athlete who already enabled calendar blocking keeps their teal calendar until it is removed and recreated. That is acceptable — recolouring an existing device calendar behind the user's back would be a surprising side effect, and the swatch is user-editable in their calendar app. Do not add migration code for it.

- [ ] **Step 5: Verify both**

Run:

```bash
cd "OSPREY-app"
grep -n "Colors.gold\|surfaceGold\|borderGold" app/calendar.tsx || echo "CLEAN — no gold in calendar.tsx"
grep -n "00c8c8" src/services/calendar-blocking.ts || echo "CLEAN — no teal in calendar-blocking.ts"
```

Expected: both `CLEAN` lines.

- [ ] **Step 6: Typecheck and test**

Run: `cd "OSPREY-app" && npx tsc --noEmit && TZ=Asia/Kolkata npx jest`
Expected: typecheck silent; 355 passed.

- [ ] **Step 7: Commit**

```bash
cd "OSPREY-app"
git add app/calendar.tsx src/services/calendar-blocking.ts
git commit -m "fix(mobile): migrate the calendar off old-brand gold and teal"
```

---

### Task 4: Add hyrox and rowing icons to the calendar

`calendar.tsx`'s `SESSION_ICON` map lacks `hyrox` and `rowing` keys, so those sessions render a fallback dot in month cells and in the day sheet. The identical drift was found and fixed in `plan-preview.tsx` during REC-002 (its `SESSION_ICONS` already has both); `calendar.tsx` was missed. **The Phase-3 engine deployed on 2026-07-21 now emits hyrox sessions in production**, so this is live-visible today.

**Files:**
- Modify: `OSPREY-app/app/calendar.tsx:19-27`
- Test: `OSPREY-app/app/__tests__/calendar-icons.test.ts` (new)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `SESSION_ICON` gains `rowing: '🚣'` and `hyrox: '🏋️‍♂️'` — the exact emoji already used in `plan-preview.tsx:323-324`, so the two screens agree.

- [ ] **Step 1: Write the failing test**

Create `OSPREY-app/app/__tests__/calendar-icons.test.ts`:

```ts
import { SESSION_ICON } from '../calendar';

// calendar.tsx and plan-preview.tsx must agree on session iconography — they
// render the same plan. plan-preview gained rowing/hyrox during REC-002 and
// calendar was missed, so hyrox sessions (live in production since the
// 2026-07-21 Phase-3 deploy) rendered as a bare fallback dot.
describe('calendar SESSION_ICON', () => {
  it('covers every session type the plan generator can emit', () => {
    for (const type of ['run', 'lift', 'swim', 'bike', 'rowing', 'hyrox', 'cross', 'race', 'rest']) {
      expect(SESSION_ICON[type]).toBeTruthy();
    }
  });

  it('uses the same rowing and hyrox glyphs as plan-preview', () => {
    expect(SESSION_ICON.rowing).toBe('🚣');
    expect(SESSION_ICON.hyrox).toBe('🏋️‍♂️');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "OSPREY-app" && TZ=Asia/Kolkata npx jest app/__tests__/calendar-icons.test.ts`
Expected: FAIL — either "SESSION_ICON is not exported" or the rowing/hyrox assertions receive `undefined`.

- [ ] **Step 3: Export the map and add the two keys**

In `app/calendar.tsx`, replace lines 19-27:

```tsx
const SESSION_ICON: Record<string, string> = {
  run: '🏃',
  lift: '🏋️',
  swim: '🏊',
  bike: '🚴',
  cross: '🔁',
  race: '🏁',
  rest: '😴',
};
```

with:

```tsx
// Exported for the parity test in app/__tests__/calendar-icons.test.ts. Must
// stay in sync with plan-preview.tsx's SESSION_ICONS — both render the same
// plan, and a missing key renders a bare fallback dot instead of the session.
export const SESSION_ICON: Record<string, string> = {
  run: '🏃',
  lift: '🏋️',
  swim: '🏊',
  bike: '🚴',
  rowing: '🚣',
  hyrox: '🏋️‍♂️',
  cross: '🔁',
  race: '🏁',
  rest: '😴',
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd "OSPREY-app" && TZ=Asia/Kolkata npx jest app/__tests__/calendar-icons.test.ts`
Expected: PASS, 2/2.

- [ ] **Step 5: Check for a legend that also needs the new types**

Run: `cd "OSPREY-app" && grep -n "legend\|Legend" app/calendar.tsx`

If a legend array or component enumerates session types literally, add rowing and hyrox entries there too, matching the existing entries' shape. If there is no legend (the grep returns nothing), skip this step — the icons are read directly from `SESSION_ICON` at lines 145, 147, and 224.

- [ ] **Step 6: Typecheck and full test run**

Run: `cd "OSPREY-app" && npx tsc --noEmit && TZ=Asia/Kolkata npx jest`
Expected: typecheck silent; 357 passed (355 + 2 new).

- [ ] **Step 7: Commit**

```bash
cd "OSPREY-app"
git add app/calendar.tsx app/__tests__/calendar-icons.test.ts
git commit -m "fix(mobile): render hyrox and rowing sessions in the calendar"
```

---

### Task 5: Stop Home's CTA launching a GPS run with no plan

On a fresh account the session card falls back to `type: 'No Session Planned'` with `sessionType` undefined. The button stays **enabled**, and `handleStartSession`'s `switch` hits its `default` branch — which routes to `/workout/run`. So a brand-new user's first tap starts a GPS run for a session that does not exist. The fallback note also promises a plan that was never built.

**Files:**
- Modify: `OSPREY-app/src/screens/DailySummary.tsx:67-71` (the fallback copy)
- Modify: `OSPREY-app/src/screens/DailySummary.tsx:85` (destructured props) and `:322-330` (the CTA)
- Modify: `OSPREY-app/src/types/daily-summary.ts:88` (the `DailySummaryProps` interface — note it lives in the **types** file, not the screen)
- Modify: `OSPREY-app/app/(tabs)/index.tsx:70-73` (the routing default)
- Test: `OSPREY-app/src/screens/__tests__/daily-summary-no-plan.test.tsx` (new)

**Interfaces:**
- Consumes: `SessionData` from `@/types/daily-summary` — `sessionType?: string | null`.
- Produces: a new `onBuildPlan?: () => void` optional prop on `DailySummaryScreen`. `app/(tabs)/index.tsx` passes `() => router.push('/plan-preview')`.

- [ ] **Step 1: Write the failing test**

Create `OSPREY-app/src/screens/__tests__/daily-summary-no-plan.test.tsx`:

```tsx
import React from 'react';
import { renderWithProviders as render, screen } from '@/test-utils/render';
import DailySummaryScreen from '../DailySummary';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() }),
}));

// A brand-new account has no generated plan. Before this fix the CTA stayed
// enabled and handleStartSession's switch default routed to /workout/run —
// so the very first tap started a GPS run for a session that did not exist.
describe('DailySummary with no planned session', () => {
  it('offers to build a plan instead of starting a session', () => {
    render(<DailySummaryScreen userName="Test" />);
    expect(screen.getByText(/Build My Plan/i)).toBeTruthy();
    expect(screen.queryByText(/Start Session/i)).toBeNull();
  });

  it('does not promise a plan that was never built', () => {
    render(<DailySummaryScreen userName="Test" />);
    expect(screen.queryByText(/still crunching/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "OSPREY-app" && TZ=Asia/Kolkata npx jest src/screens/__tests__/daily-summary-no-plan.test.tsx`
Expected: FAIL — "Build My Plan" is not found; the rendered CTA still says "Start Session →".

- [ ] **Step 3: Fix the fallback copy**

In `src/screens/DailySummary.tsx`, replace the default `session` prop value at lines 67-71:

```tsx
  session = {
    type: 'No Session Planned',
    duration: 'Free day',
    ozzieNote: "Ozzie is still crunching today's read.",
  },
```

with:

```tsx
  session = {
    type: 'No Plan Yet',
    duration: 'Ready when you are',
    ozzieNote:
      "Tell me your sport and goal and I'll build your first week — paces, sessions, and fuel included.",
  },
```

- [ ] **Step 4: Add the `onBuildPlan` prop**

Two files — the props **type** lives in `types/daily-summary.ts`, not in the screen.

First, in `OSPREY-app/src/types/daily-summary.ts`, find line 88:

```ts
  onStartSession?: (session: SessionData) => void;
```

and add directly beneath it:

```ts
  onBuildPlan?: () => void;
```

Then, in `OSPREY-app/src/screens/DailySummary.tsx`, find `onStartSession,` in the destructured props at line 85 and add directly beneath it:

```tsx
  onBuildPlan,
```

- [ ] **Step 5: Make the CTA branch on having a plan**

Replace the CTA block at lines 322-330:

```tsx
              onPress={() => onStartSession?.(session)}
              disabled={session.sessionType === 'rest'}
              accessibilityLabel={session.sessionType === 'rest' ? 'Rest day' : 'Start session'}
```

...

```tsx
              {session.sessionType === 'rest' ? 'Rest Day' : 'Start Session →'}
```

with a version that treats "no sessionType at all" as its own state. The full replacement for those lines:

```tsx
              onPress={() => (session.sessionType ? onStartSession?.(session) : onBuildPlan?.())}
              disabled={session.sessionType === 'rest'}
              accessibilityLabel={
                session.sessionType === 'rest'
                  ? 'Rest day'
                  : session.sessionType
                  ? 'Start session'
                  : 'Build my plan'
              }
```

...

```tsx
              {session.sessionType === 'rest'
                ? 'Rest Day'
                : session.sessionType
                ? 'Start Session →'
                : 'Build My Plan →'}
```

Keep every other attribute on that element (styles, `accessibilityRole`, etc.) exactly as it is — only the three shown attributes/expressions change.

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd "OSPREY-app" && TZ=Asia/Kolkata npx jest src/screens/__tests__/daily-summary-no-plan.test.tsx`
Expected: PASS, 2/2.

- [ ] **Step 7: Close the routing hole in `index.tsx`**

Even with the CTA fixed, `handleStartSession`'s `default` branch would still route a null `sessionType` to the GPS run screen if it were ever called. Make that explicit. In `app/(tabs)/index.tsx`, replace lines 70-73:

```tsx
      default:
        router.push({ pathname: '/workout/run', params: { sessionId } });
    }
  }
```

with:

```tsx
      case 'run':
        router.push({ pathname: '/workout/run', params: { sessionId } });
        return;
      default:
        // No sessionType means there is no generated plan — the Home CTA
        // renders "Build My Plan" and calls onBuildPlan instead, so this is
        // only reachable if a future session type is added without routing.
        // Send them to the plan rather than starting an unplanned GPS run.
        router.push('/plan-preview');
    }
  }
```

- [ ] **Step 8: Wire `onBuildPlan` where the screen is rendered**

Still in `app/(tabs)/index.tsx`, find the `<DailySummaryScreen ... />` render (it already passes `onStartSession={handleStartSession}` and `trainingReadiness={...}` at line 139). Add one more prop alongside them:

```tsx
        onBuildPlan={() => router.push('/plan-preview')}
```

- [ ] **Step 9: Typecheck and full test run**

Run: `cd "OSPREY-app" && npx tsc --noEmit && TZ=Asia/Kolkata npx jest`
Expected: typecheck silent; 359 passed (357 + 2 new).

- [ ] **Step 10: Commit**

```bash
cd "OSPREY-app"
git add src/screens/DailySummary.tsx "app/(tabs)/index.tsx" src/screens/__tests__/daily-summary-no-plan.test.tsx
git commit -m "fix(mobile): offer to build a plan instead of starting a phantom GPS run"
```

---

### Task 6: Show the athlete's own pace band on the session card

Home says "Zone 2" but never "Zone 2 · 9:35–10:20/mi", even though `useDisplayZones()` already resolves the athlete's real bands. Per the user's binding free-vs-Plus decision, **this is FREE** — today's own session numbers are the core coaching promise, not a Plus analytics feature. Add no `isPlus` gate.

`ZonesCard.tsx` already contains the pace formatters, privately. Extract them into a shared module so the session card and the card agree by construction rather than by copy-paste.

**Files:**
- Create: `OSPREY-app/src/services/pace-format.ts`
- Create: `OSPREY-app/src/services/session-pace.ts`
- Modify: `OSPREY-app/src/components/ZonesCard.tsx:11-67` (delete the private formatters, import them instead)
- Modify: `OSPREY-app/src/screens/DailySummary.tsx` (render the band beside the zone chip)
- Test: `OSPREY-app/src/services/__tests__/session-pace.test.ts` (new)

**Interfaces:**
- Consumes: `ZoneSet` from `@/services/coaching/zones`, `UnitSystem` from `@/services/units`, `Range` + `formatMinSec` from `@/services/calculators/types`.
- Produces:
  - `pace-format.ts` exports `paceMi(sec: number, units: UnitSystem): string`, `paceRangeMi(range: Range, units: UnitSystem): string`, `swim100(sec: number, units: UnitSystem): string`, `swim100Range(range: Range, units: UnitSystem): string`, `rowing500Range(range: Range): string`, `intRange(range: Range, unit: string): string`, and the constants `MILES_PER_KM` and `YD_PER_100M`.
  - `session-pace.ts` exports `sessionPaceBand(intensity: string | null | undefined, zones: ZoneSet | null, units: UnitSystem): string | null`.

- [ ] **Step 1: Create `pace-format.ts` by moving the formatters verbatim out of `ZonesCard.tsx`**

Create `OSPREY-app/src/services/pace-format.ts` with the exact bodies currently in `ZonesCard.tsx` lines 11-67 — moved, not rewritten, so behaviour cannot drift:

```ts
import { formatMinSec, type Range } from '@/services/calculators/types';
import type { UnitSystem } from '@/services/units';

// Canonical mile↔km ratio (matches useDisplayZones.ts / services/units.ts).
export const MILES_PER_KM = 0.621371;
// 100 yd = 91.44 m — swim pace/100yd is *faster* (fewer seconds) than /100m
// because the pool distance is shorter, so this factor is < 1.
export const YD_PER_100M = 0.9144;

/**
 * sec/mile (a pace — inverse of distance) → "M:SS/mi", or "M:SS/km" when metric.
 * Converting a *pace* from mile-denominated to km-denominated multiplies by
 * MILES_PER_KM (mirrors kmToMiles's direction, not milesToKm's) — a pace gets
 * FASTER (fewer seconds) per the shorter unit. Sanity check against a real
 * anchor.ts tier value: 450 sec/mi ("intermediate", 7:30/mi) is a 12.875 km/h
 * pace, i.e. 4:40/km — 450 * 0.621371 = 279.6s = 4:40. (450 / 0.621371 would
 * give a nonsensical 12:04/km — more than 2.5× too slow — so this helper
 * multiplies, it does not divide.)
 */
export function paceMi(sec: number, units: UnitSystem): string {
  const value = units === 'metric' ? sec * MILES_PER_KM : sec;
  return `${formatMinSec(value)}/${units === 'metric' ? 'km' : 'mi'}`;
}

export function paceRangeMi(range: Range, units: UnitSystem): string {
  if (range.min == null || range.max == null) return '—';
  const factor = units === 'metric' ? MILES_PER_KM : 1;
  const suffix = units === 'metric' ? '/km' : '/mi';
  return `${formatMinSec(range.min * factor)}–${formatMinSec(range.max * factor)}${suffix}`;
}

/** sec/100m → "M:SS/100m" (metric) or "M:SS/100yd" (imperial, scaled by YD_PER_100M). */
export function swim100(sec: number, units: UnitSystem): string {
  const value = units === 'metric' ? sec : sec * YD_PER_100M;
  return `${formatMinSec(value)}/100${units === 'metric' ? 'm' : 'yd'}`;
}

export function swim100Range(range: Range, units: UnitSystem): string {
  if (range.min == null || range.max == null) return '—';
  const factor = units === 'metric' ? 1 : YD_PER_100M;
  const suffix = units === 'metric' ? '/100m' : '/100yd';
  return `${formatMinSec(range.min * factor)}–${formatMinSec(range.max * factor)}${suffix}`;
}

/** sec/500m — rowing splits are unit-agnostic (Concept2 ergs always read meters). */
export function rowing500Range(range: Range): string {
  if (range.min == null || range.max == null) return '—';
  return `${formatMinSec(range.min)}–${formatMinSec(range.max)}/500m`;
}

/** Integer ranges for watts / bpm — neither needs a unit conversion. */
export function intRange(range: Range, unit: string): string {
  if (range.min == null || range.max == null) return '—';
  return `${Math.round(range.min)}–${Math.round(range.max)} ${unit}`;
}
```

- [ ] **Step 2: Point `ZonesCard.tsx` at the shared module**

In `src/components/ZonesCard.tsx`, delete lines 11-67 (the `MILES_PER_KM` / `YD_PER_100M` constants and all six formatter functions — everything from the `// Canonical mile↔km ratio` comment through the closing brace of `intRange`). Also delete its now-unused imports of `formatMinSec`/`Range`/`UnitSystem` **only if** nothing else in the file uses them (`UnitSystem` is still used in `rowsForZones`'s signature, so keep that one).

Then add this import alongside the file's existing imports:

```tsx
import {
  paceMi,
  paceRangeMi,
  swim100,
  swim100Range,
  rowing500Range,
  intRange,
} from '@/services/pace-format';
```

- [ ] **Step 3: Verify ZonesCard still compiles unchanged in behaviour**

Run: `cd "OSPREY-app" && npx tsc --noEmit`
Expected: silent. If it reports an unused import in `ZonesCard.tsx`, remove that specific import and re-run.

- [ ] **Step 4: Write the failing test for `sessionPaceBand`**

Create `OSPREY-app/src/services/__tests__/session-pace.test.ts`:

```ts
import { sessionPaceBand } from '../session-pace';
import type { ZoneSet } from '@/services/coaching/zones';

const runZones = {
  kind: 'run',
  thresholdSecPerMile: 420,
  bands: { easy: { min: 540, max: 600 } },
} as unknown as ZoneSet;

const swimZones = {
  kind: 'swim',
  cssSecPer100: 94,
  bands: { z2Aerobic: { min: 100, max: 106 }, z3Threshold: { min: 92, max: 96 } },
} as unknown as ZoneSet;

describe('sessionPaceBand', () => {
  it('gives an easy session its easy band', () => {
    expect(sessionPaceBand('easy', runZones, 'imperial')).toBe('9:00–10:00/mi');
  });

  it('gives a threshold session its threshold anchor', () => {
    expect(sessionPaceBand('threshold', runZones, 'imperial')).toBe('~7:00/mi');
  });

  it('converts to metric when the athlete prefers km', () => {
    expect(sessionPaceBand('threshold', runZones, 'metric')).toBe('~4:21/km');
  });

  it('uses per-100 formatting for a swimmer', () => {
    expect(sessionPaceBand('easy', swimZones, 'metric')).toBe('1:40–1:46/100m');
  });

  // Never invent a number: moderate/interval/race have no single clean band in
  // the ZoneSet, and no zones at all means nothing to show.
  it('returns null for intensities with no clean band', () => {
    expect(sessionPaceBand('interval', runZones, 'imperial')).toBeNull();
    expect(sessionPaceBand('moderate', runZones, 'imperial')).toBeNull();
  });

  it('returns null when there are no zones', () => {
    expect(sessionPaceBand('easy', null, 'imperial')).toBeNull();
  });

  it('returns null for a missing intensity', () => {
    expect(sessionPaceBand(null, runZones, 'imperial')).toBeNull();
    expect(sessionPaceBand(undefined, runZones, 'imperial')).toBeNull();
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd "OSPREY-app" && TZ=Asia/Kolkata npx jest src/services/__tests__/session-pace.test.ts`
Expected: FAIL — cannot find module `../session-pace`.

- [ ] **Step 6: Implement `session-pace.ts`**

Create `OSPREY-app/src/services/session-pace.ts`:

```ts
import type { ZoneSet } from '@/services/coaching/zones';
import type { UnitSystem } from '@/services/units';
import { paceMi, paceRangeMi, swim100, swim100Range, rowing500Range, intRange } from '@/services/pace-format';

/**
 * The athlete's OWN pace band for today's session, to render beside the
 * generic zone label ("Zone 2" → "Zone 2 · 9:00–10:00/mi").
 *
 * Only `easy` and `threshold` map to a single clean band in a ZoneSet.
 * `moderate`/`interval`/`race` deliberately return null rather than a guessed
 * range — the app never invents a number it cannot ground (same rule the
 * triathlon predictor follows when a leg has no logged effort).
 */
export function sessionPaceBand(
  intensity: string | null | undefined,
  zones: ZoneSet | null,
  units: UnitSystem,
): string | null {
  if (!zones) return null;
  if (intensity !== 'easy' && intensity !== 'threshold') return null;

  switch (zones.kind) {
    case 'run':
      return intensity === 'easy'
        ? paceRangeMi(zones.bands.easy, units)
        : `~${paceMi(zones.thresholdSecPerMile, units)}`;
    case 'swim':
      return intensity === 'easy'
        ? swim100Range(zones.bands.z2Aerobic, units)
        : swim100Range(zones.bands.z3Threshold, units);
    case 'rowing':
      return intensity === 'easy'
        ? rowing500Range(zones.bands.ut2.splitSecPer500)
        : rowing500Range(zones.bands.at.splitSecPer500);
    case 'cycling':
      return intensity === 'easy'
        ? intRange(zones.bands.z2Endurance, 'w')
        : intRange(zones.bands.z4Threshold, 'w');
    case 'triathlon':
      // A triathlon session's discipline isn't knowable from intensity alone —
      // the run anchor is the useful default, and null when there isn't one.
      return zones.run ? `~${paceMi(zones.run.thresholdSecPerMile, units)}` : null;
    default:
      return null;
  }
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd "OSPREY-app" && TZ=Asia/Kolkata npx jest src/services/__tests__/session-pace.test.ts`
Expected: PASS, 7/7.

If the metric threshold assertion fails, print the actual value and reconcile: `420 * 0.621371 = 260.98s`, which `formatMinSec` renders as `4:21`. Do not change the formatter — fix the expected string only if the real rounding differs.

- [ ] **Step 8: Pass the session's intensity through to the screen**

`SessionData` currently carries the display label (`zone: 'Zone 2'`) but not the raw intensity the band lookup needs. Add it.

In `OSPREY-app/src/types/daily-summary.ts`, add one field to `SessionData` (after `zone?: string;`):

```ts
  intensity?: string | null;
```

In `OSPREY-app/src/services/daily-summary.ts`, in the returned object at lines 313-321, add the raw intensity alongside the existing `zone` line:

```ts
    zone: intensityToZone(session.intensity),
    intensity: session.intensity,
```

- [ ] **Step 9: Render the band beside the zone chip**

In `src/screens/DailySummary.tsx`, add these imports alongside the existing ones:

```tsx
import { useDisplayZones } from '@/hooks/useDisplayZones';
import { sessionPaceBand } from '@/services/session-pace';
```

Inside the component body, near the other hook calls, add:

```tsx
  const displayZones = useDisplayZones();
  const paceBand = sessionPaceBand(session.intensity, displayZones?.zones ?? null, units);
```

(`units` is already in scope — the file uses it for `formatDistanceKm` at line 283.)

Then replace the zone chip block at lines 286-292:

```tsx
            {session.zone ? (
              <View style={[styles.sessionChip, styles.sessionChipAccent]}>
                <Text style={[styles.sessionChipText, styles.sessionChipAccentText]}>
                  {session.zone}
                </Text>
              </View>
            ) : null}
```

with:

```tsx
            {session.zone ? (
              <View style={[styles.sessionChip, styles.sessionChipAccent]}>
                <Text style={[styles.sessionChipText, styles.sessionChipAccentText]}>
                  {paceBand ? `${session.zone} · ${paceBand}` : session.zone}
                </Text>
              </View>
            ) : null}
```

- [ ] **Step 10: Typecheck and full test run**

Run: `cd "OSPREY-app" && npx tsc --noEmit && TZ=Asia/Kolkata npx jest`
Expected: typecheck silent; 366 passed (359 + 7 new).

- [ ] **Step 11: Commit**

```bash
cd "OSPREY-app"
git add src/services/pace-format.ts src/services/session-pace.ts src/services/__tests__/session-pace.test.ts src/components/ZonesCard.tsx src/screens/DailySummary.tsx src/services/daily-summary.ts src/types/daily-summary.ts
git commit -m "feat(mobile): show the athlete's own pace band on the session card"
```

---

### Task 7: Give `ozzie-daily-brief` CORS handling

Found during the 2026-07-21 Phase-3 deploy: `ozzie-daily-brief` has **no** `OPTIONS` handler and sets **no** `Access-Control-Allow-Origin`, yet `OSPREY-app/src/services/daily-summary.ts:149` invokes it. On any browser surface the preflight `405`s and the brief silently never loads. Native iOS/Android is unaffected (React Native does not enforce CORS). This is the **fourth** instance of the same "written mobile-first, later gains a browser caller" pattern, after `ozzie-nutrition-coach` and `ozzie-generate-plan`.

**Files:**
- Modify: `supabase/functions/ozzie-daily-brief/index.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing consumed by later tasks. **Source-only — do NOT deploy.**

- [ ] **Step 1: Confirm the gap and read the reference implementation**

Run: `cd "/Users/gusjohnson/App Development/Osprey" && grep -c "Access-Control" supabase/functions/ozzie-daily-brief/index.ts; sed -n '74,90p' supabase/functions/ozzie-race-briefing/index.ts`

Expected: the count is `0`; the reference shows `ozzie-race-briefing`'s `OPTIONS` block returning `'ok'` with the two allow headers.

- [ ] **Step 2: Locate the request handler entry point**

Run: `cd "/Users/gusjohnson/App Development/Osprey" && grep -n "serve(\|Deno.serve(" supabase/functions/ozzie-daily-brief/index.ts`

Note the line number and whether it uses `serve(` or `Deno.serve(` — the next step inserts immediately inside that callback.

- [ ] **Step 3: Add a shared CORS constant**

In `supabase/functions/ozzie-daily-brief/index.ts`, directly after the `SUPABASE_SERVICE_ROLE_KEY` constant (around line 18), add:

```ts
// This function is invoked from the app's daily-summary service, which also
// runs on web (Expo web preview / any browser surface). functions.invoke sends
// non-safelisted headers, so the browser issues a CORS preflight — without an
// OPTIONS handler it 405s and the brief silently never loads. Mirrors
// ozzie-race-briefing:75-82. (Native RN does not enforce CORS, which is why
// this went unnoticed.)
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

- [ ] **Step 4: Answer the preflight**

As the very first statement inside the request handler callback identified in Step 2, add:

```ts
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
```

- [ ] **Step 5: Add the ACAO header to every response**

Every `new Response(...)` in the file must carry the allow-origin header, or a browser blocks the real POST even after a successful preflight. For each `new Response(` in the file, merge `...CORS_HEADERS` into its `headers` object. For example:

```ts
      headers: { 'Content-Type': 'application/json' },
```

becomes:

```ts
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
```

Run `grep -n "new Response(" supabase/functions/ozzie-daily-brief/index.ts` first and work through every hit — missing one leaves a failure path that still blocks in the browser.

- [ ] **Step 6: Verify every response is covered**

Run:

```bash
cd "/Users/gusjohnson/App Development/Osprey"
echo "Responses: $(grep -c 'new Response(' supabase/functions/ozzie-daily-brief/index.ts)"
echo "CORS spreads + OPTIONS return: $(grep -c 'CORS_HEADERS' supabase/functions/ozzie-daily-brief/index.ts)"
```

Expected: the `CORS_HEADERS` count is at least the response count (each response has one spread, plus the constant declaration and the OPTIONS return).

- [ ] **Step 7: Typecheck the function**

Run: `cd "/Users/gusjohnson/App Development/Osprey/supabase/functions/ozzie-daily-brief" && deno check index.ts 2>&1 | tail -5`

Expected: this function reports ~18 pre-existing `supabase-js` generic-typing errors (`TS2339` on PostgrestClient). That is **known, pre-existing noise, not a regression** — the currently-deployed known-good build shows the same. Confirm the count did not grow and that no error references `CORS_HEADERS` or the `OPTIONS` block.

- [ ] **Step 8: Run the function's unit tests**

Run: `cd "/Users/gusjohnson/App Development/Osprey/supabase/functions/ozzie-daily-brief" && deno test --allow-all 2>&1 | tail -5`

Expected: all tests pass (this function has `template.ts` tests). CORS changes touch no template logic.

- [ ] **Step 9: Commit — source only, no deploy**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add supabase/functions/ozzie-daily-brief/index.ts
git commit -m "fix(edge): add CORS handling to ozzie-daily-brief"
```

**Do not run `supabase functions deploy`.** Deployment requires separate explicit user permission; report at the end that this function is committed-but-undeployed so it can ride the next approved deploy.

---

## Verification (run after all seven tasks)

- [ ] **Full suite and typecheck**

```bash
cd "OSPREY-app" && npx tsc --noEmit && TZ=Asia/Kolkata npx jest
```
Expected: typecheck silent; 366 passed.

- [ ] **No old-brand pixels remain**

```bash
cd "OSPREY-app"
grep -rn "00c8c8" src/ app/ | grep -v "src/constants/colors.ts" || echo "no teal outside the old palette"
grep -rn "Colors.gold\|goldDim\|surfaceGold\|borderGold\|rgba(200,154,0" src/ app/ | grep -v "src/constants/colors.ts" || echo "no gold outside the old palette"
```
Expected: `no teal outside the old palette` and `no gold outside the old palette`.

`src/constants/colors.ts` is excluded on purpose — it is the old palette's own definition file and legitimately still declares `teal`/`gold`. It stays until every screen is off it, which is beyond this phase.

- [ ] **Visual check in the Expo web preview**

Start the preview (`preview_start` with `OSPREY-app (Expo)`), set the viewport to mobile (375×812), and confirm on the live app:
1. Home's Ozzie note avatar shows **amber** brows, not teal.
2. Today's session chip reads `Zone N · <pace>` when the account has zones (e.g. "Zone 2 · 9:00–10:00/mi").
3. The Log tab's rest-day and copy-yesterday chips are neutral outlines, visibly distinct from the amber recent-meal chips beside them.
4. A calendar month containing a hyrox or rowing session shows its emoji, not a bare dot.

Note the app icon and splash are **out of scope here** — they are the separately-approved vector rebuild that follows this phase.

---

## Notes for the executor

- Tasks 1-4 and 7 are independent and could run in any order. Task 6 depends on nothing but touches `DailySummary.tsx`, which Task 5 also edits — **run Task 5 before Task 6** to avoid a conflict on that file.
- Expected test counts assume a 355 baseline (verified 2026-07-21 on `main` at `f003c50`). If the baseline differs, adjust arithmetic rather than assuming a regression.
- If any task's `grep` in its first step does not match the line numbers cited here, **stop and report** — the file moved under the plan, and blind edits would corrupt it.
