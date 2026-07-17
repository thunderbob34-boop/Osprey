# Mobile Design Unification — Foundation + Home Screen Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `OSPREY-app` a shared ink/amber design-token and component foundation, then re-skin the Home screen onto it — proving the foundation without touching information architecture.

**Architecture:** A new, additive token module (`src/constants/theme.ts`) and a new component directory (`src/components/ui/`) sit alongside the existing `colors.ts`/screen-local styling, which stays untouched everywhere except the Home screen. Home (`src/screens/DailySummary.tsx`) migrates four specific regions onto the new primitives; every other screen is unaffected and keeps using `Colors` directly until its own future slice.

**Tech Stack:** Expo/React Native (SDK 52), TypeScript, Jest (`jest-expo` preset, `TZ=Asia/Kolkata`), `@expo-google-fonts/space-grotesk` (new dependency).

## Global Constraints

- **Never modify or remove a key in `src/constants/colors.ts`.** Every screen but Home still reads it. Add new tokens only in the new `theme.ts`.
- **`Colors.amber` (`#f5a623`, a status color) and the new `Theme.accent` (`#c8793a`, brand) are unrelated names on purpose** — do not rename or merge them.
- **Radius is 4px everywhere** (`Radius.card`), not zero — the "adapted for touch" style the user picked over the webapp's literal zero-radius brutalism.
- **No component render-test harness exists in this codebase** (confirmed: zero `.tsx` test files anywhere, no `@testing-library/react-native`/`react-test-renderer` installed — every one of the 28 existing tests covers a pure `.ts` module). Adding one is out of scope per the spec's own constraint ("no new logic tests are expected"). Component tasks are verified by `npm run typecheck` plus the visual pass in Task 5, matching this codebase's existing convention — not a shortcut around TDD, but consistency with how this app has always tested (or not tested) its view layer.
- **Pure-value modules (`theme.ts`) DO get a test** — that's this codebase's established pattern for constants (`src/constants/__tests__/sports.test.ts`, and the "value-pinned" idiom in `webapp/tests/strength-loads.test.ts:10-12`).
- Test commands: `cd OSPREY-app && npm test` (Jest, `TZ=Asia/Kolkata`), `npm run typecheck`. Run both after every task.
- Spec reference: `docs/superpowers/specs/2026-07-17-mobile-design-foundation-home-pilot-design.md`.

---

### Task 1: Design tokens (`theme.ts`)

**Files:**
- Create: `OSPREY-app/src/constants/theme.ts`
- Test: `OSPREY-app/src/constants/__tests__/theme.test.ts`

**Interfaces:**
- Produces: `Theme` (`ink`, `panel`, `line`, `accent`, `accentBright`, `text`, `textSoft`, `textMut`), `Radius` (`card`), `BorderWidth` (`card`), `Spacing` (`xs`–`xxl`), `Shadow` (`emphasis`) — all imported by Tasks 3 and 5 as `import { Theme, Radius, BorderWidth, Spacing, Shadow } from '@/constants/theme';`.

- [ ] **Step 1: Write the failing test**

```ts
// OSPREY-app/src/constants/__tests__/theme.test.ts
import { Theme, Radius, BorderWidth, Spacing, Shadow } from '@/constants/theme';

describe('Theme tokens — pinned to the design spec (2026-07-17)', () => {
  it('matches the color values in design.md §1', () => {
    expect(Theme).toEqual({
      ink: '#09090B',
      panel: '#101014',
      line: '#3F3F46',
      accent: '#c8793a',
      accentBright: '#d98b4a',
      text: '#FAFAFA',
      textSoft: '#c9cbd1',
      textMut: '#A1A1AA',
    });
  });

  it('uses a 4px radius, not the webapp\'s zero-radius', () => {
    expect(Radius).toEqual({ card: 4 });
  });

  it('matches the border width and spacing scale in design.md §1', () => {
    expect(BorderWidth).toEqual({ card: 2 });
    expect(Spacing).toEqual({ xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 });
  });

  it('defines a softened offset shadow for emphasized surfaces', () => {
    expect(Shadow.emphasis).toEqual({
      shadowColor: '#000',
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    });
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `cd OSPREY-app && npx jest src/constants/__tests__/theme.test.ts`
Expected: FAIL — `Cannot find module '@/constants/theme'`

- [ ] **Step 3: Write the implementation**

```ts
// OSPREY-app/src/constants/theme.ts
//
// The webapp's ink/amber design language, ported to mobile with one
// deliberate change: 4px radius instead of the webapp's zero-radius —
// "adapted for touch" per the visual-companion decision in
// docs/superpowers/specs/2026-07-17-mobile-design-foundation-home-pilot-design.md.
// Additive only — src/constants/colors.ts is untouched and still owns
// every screen this slice doesn't migrate.

export const Theme = {
  ink: '#09090B',
  panel: '#101014',
  line: '#3F3F46',
  accent: '#c8793a',
  accentBright: '#d98b4a',
  text: '#FAFAFA',
  textSoft: '#c9cbd1',
  textMut: '#A1A1AA',
} as const;

export const Radius = { card: 4 } as const;
export const BorderWidth = { card: 2 } as const;
export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;

// iOS renders this as a crisp offset shadow via shadowOffset/shadowOpacity/
// shadowRadius. Android's `elevation` does not reproduce a hard offset the
// same way (it's a soft blur) — verify on both platforms in Task 5's visual
// pass, and only reach for a layered-View fallback on Android if `elevation`
// looks wrong there.
export const Shadow = {
  emphasis: {
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
} as const;
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `cd OSPREY-app && npx jest src/constants/__tests__/theme.test.ts`
Expected: PASS, 4/4

- [ ] **Step 5: Typecheck and commit**

Run: `cd OSPREY-app && npm run typecheck`
Expected: no errors

```bash
git add OSPREY-app/src/constants/theme.ts OSPREY-app/src/constants/__tests__/theme.test.ts
git commit -m "feat(mobile): add ink/amber design tokens (theme.ts)"
```

---

### Task 2: Make the web-preview dev fixtures permanent

**Files:**
- Modify: `OSPREY-app/app.json` (already has `web.output: "single"` uncommitted from this session)
- Modify: `OSPREY-app/src/services/secure-session-storage.ts` (already has the `Platform.OS === 'web'` branch uncommitted from this session; only the comment needs updating since it currently says "should be reverted")

**Interfaces:** None — no new exports. This task only commits and cleans up work already sitting uncommitted in the working tree, so later tasks can be visually verified via the web preview as they land instead of only at the very end.

- [ ] **Step 1: Confirm current state**

Run: `cd "/Users/gusjohnson/App Development/Osprey" && git diff OSPREY-app/app.json OSPREY-app/src/services/secure-session-storage.ts`
Expected: `app.json` shows `"output": "single"` (was `"static"`); `secure-session-storage.ts` shows the `Platform.OS === 'web'` branches in `encrypt`/`decrypt`/`removeItem` plus the `WEB_KEY_SUFFIX` constant and its comment.

If this diff is empty (a fresh checkout with no prior session state), re-apply both edits exactly as shown in Step 2 below before continuing.

- [ ] **Step 2: Update the comment — this fixture is now permanent, not throwaway**

```ts
// OSPREY-app/src/services/secure-session-storage.ts — replace the existing
// comment block above `const WEB_KEY_SUFFIX`:

// DEV-ONLY: expo-secure-store has zero web support (its web shim is
// `export default {}`) since SecureStore wraps the iOS Keychain / Android
// Keystore, which browsers don't have. This branch only ever runs when
// Platform.OS === 'web', which happens exclusively via `npm run start --
// --web` for local design-preview work (see docs/superpowers/specs/
// 2026-07-17-mobile-design-foundation-home-pilot-design.md §5) — real
// iOS/Android builds never take this path, so it's safe to keep committed.
const WEB_KEY_SUFFIX = '_web_preview_only';
```

- [ ] **Step 3: Verify the app still boots on web**

Run: `cd OSPREY-app && npm run start -- --web --clear` (or use the `OSPREY-app (Expo)` launch config)
Expected: bundles clean, login screen renders with no "Cannot find module" or "is not a function" errors (both bugs were root-caused and fixed earlier this session — this step confirms the fix is intact after the comment edit).

Stop the dev server once confirmed (`Ctrl-C`, or the harness's preview-stop equivalent).

- [ ] **Step 4: Typecheck and commit**

Run: `cd OSPREY-app && npm run typecheck`
Expected: no errors

```bash
git add OSPREY-app/app.json OSPREY-app/src/services/secure-session-storage.ts
git commit -m "chore(mobile): commit the dev-only web preview fixtures

app.json's web.output was 'static', which triggers Expo Router's SSR
render path and throws 'Cannot find module react' in Metro's dev
server (a real, reproducible Expo/Metro bug, unrelated to any app
code) — 'single' is standard SPA mode and correct for a preview-only
web target anyway, since the product's real web surface is webapp/.

expo-secure-store has no web implementation at all (its web shim is
a bare 'export default {}', since SecureStore wraps native Keychain/
Keystore) — the Platform.OS==='web' branch in secure-session-storage
only ever executes in that dev-preview context; native iOS/Android
behavior is unchanged."
```

---

### Task 3: UI component library — Card, Button, Badge

**Files:**
- Create: `OSPREY-app/src/components/ui/Card.tsx`
- Create: `OSPREY-app/src/components/ui/Button.tsx`
- Create: `OSPREY-app/src/components/ui/Badge.tsx`
- Create: `OSPREY-app/src/components/ui/index.ts`

**Interfaces:**
- Consumes: `Theme`, `Radius`, `BorderWidth`, `Shadow` from `@/constants/theme` (Task 1).
- Produces: `Card` (props `{ emphasis?: boolean; children: React.ReactNode; style?: ViewStyle }`), `Button` (props `{ variant?: 'primary' | 'secondary'; onPress: () => void; children: string; disabled?: boolean; style?: ViewStyle }`), `Badge` (props `{ children: React.ReactNode; tone?: 'accent' | 'neutral' }`) — all consumed by Task 5.

No render-test harness exists in this codebase (see Global Constraints) — this task is verified by typecheck, and visually in Task 5 once the components are actually mounted on the Home screen.

- [ ] **Step 1: `Card.tsx`**

```tsx
// OSPREY-app/src/components/ui/Card.tsx
import React from 'react';
import { View, ViewStyle } from 'react-native';
import { Theme, Radius, BorderWidth, Shadow } from '@/constants/theme';

type CardProps = {
  emphasis?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
};

export function Card({ emphasis = false, children, style }: CardProps) {
  return (
    <View
      style={[
        {
          backgroundColor: Theme.panel,
          borderWidth: BorderWidth.card,
          borderColor: emphasis ? Theme.accent : Theme.line,
          borderRadius: Radius.card,
          padding: 14,
        },
        emphasis ? Shadow.emphasis : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}
```

- [ ] **Step 2: `Button.tsx`**

```tsx
// OSPREY-app/src/components/ui/Button.tsx
import React, { useRef } from 'react';
import { Animated, Pressable, Text, ViewStyle } from 'react-native';
import { Theme, Radius, BorderWidth } from '@/constants/theme';

type ButtonProps = {
  variant?: 'primary' | 'secondary';
  onPress: () => void;
  children: string;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ variant = 'primary', onPress, children, disabled, style }: ButtonProps) {
  // Mirrors the webapp's .btn translate(2px,2px) press effect
  // (webapp/src/styles/app.css:8-17) via a native Animated translation.
  const translate = useRef(new Animated.Value(0)).current;

  function pressIn() {
    Animated.timing(translate, { toValue: 2, duration: 80, useNativeDriver: true }).start();
  }
  function pressOut() {
    Animated.timing(translate, { toValue: 0, duration: 80, useNativeDriver: true }).start();
  }

  const isPrimary = variant === 'primary';

  return (
    <Animated.View style={{ transform: [{ translateX: translate }, { translateY: translate }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
        style={[
          {
            backgroundColor: isPrimary ? Theme.accent : 'transparent',
            borderWidth: BorderWidth.card,
            borderColor: Theme.accent,
            borderRadius: Radius.card,
            paddingVertical: 12,
            paddingHorizontal: 18,
            alignItems: 'center',
            opacity: disabled ? 0.5 : 1,
          },
          style,
        ]}
      >
        <Text style={{ color: isPrimary ? Theme.ink : Theme.accent, fontWeight: '800', fontSize: 14 }}>
          {children}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
```

- [ ] **Step 3: `Badge.tsx`**

```tsx
// OSPREY-app/src/components/ui/Badge.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { Theme } from '@/constants/theme';

type BadgeProps = {
  children: React.ReactNode;
  tone?: 'accent' | 'neutral';
};

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  const color = tone === 'accent' ? Theme.accent : Theme.textMut;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: color,
        borderRadius: 3,
        paddingVertical: 3,
        paddingHorizontal: 8,
      }}
    >
      <Text
        style={{
          color,
          fontFamily: 'SpaceGrotesk_700Bold',
          fontSize: 10,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        {children}
      </Text>
    </View>
  );
}
```

Note: `Badge` references the `SpaceGrotesk_700Bold` family by name before Task 4 loads it — that's harmless (RN falls back to the system font for an unrecognized family, no error), and by the time `Badge` is actually rendered anywhere (Task 5, after Task 4), the font is loaded app-wide.

- [ ] **Step 4: Barrel export**

```ts
// OSPREY-app/src/components/ui/index.ts
export { Card } from './Card';
export { Button } from './Button';
export { Badge } from './Badge';
```

- [ ] **Step 5: Typecheck, full suite, and commit**

Run: `cd OSPREY-app && npm run typecheck && npm test`
Expected: typecheck clean; all existing tests still pass (no test covers these new files, per Global Constraints)

```bash
git add OSPREY-app/src/components/ui/
git commit -m "feat(mobile): add Card/Button/Badge UI primitives on theme tokens"
```

---

### Task 4: Space Grotesk font loading

**Files:**
- Modify: `OSPREY-app/package.json` (add `@expo-google-fonts/space-grotesk` dependency)
- Modify: `OSPREY-app/app/_layout.tsx:1-61`

**Interfaces:**
- Produces: the font families `SpaceGrotesk_500Medium` and `SpaceGrotesk_700Bold` become usable as `fontFamily` values anywhere in the app once loaded — consumed by Task 5's Home-screen headers.

- [ ] **Step 1: Install the dependency**

Run: `cd OSPREY-app && npx expo install @expo-google-fonts/space-grotesk`
Expected: adds `"@expo-google-fonts/space-grotesk"` to `package.json` dependencies (Expo's install command resolves a version compatible with the installed `expo-font ~13.0.0`, confirmed no conflict during spec research).

- [ ] **Step 2: Load the font, extend the existing loading gate**

`app/_layout.tsx` already gates first paint on `!initialized` (line 59-60), rendering `<AppLoadingScreen />` until auth state resolves — extend that same gate with font-load state rather than introducing new splash-timing logic:

```tsx
// OSPREY-app/app/_layout.tsx — add to the import block (after the SplashScreen import, line 6):
import { useFonts, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
```

```tsx
// OSPREY-app/app/_layout.tsx — inside function RootLayout(), immediately after
// the existing `const userId = useAuthStore((s) => s.user?.id);` (line 32):
const [fontsLoaded] = useFonts({ SpaceGrotesk_500Medium, SpaceGrotesk_700Bold });
```

```tsx
// OSPREY-app/app/_layout.tsx — replace lines 59-61:
if (!initialized || !fontsLoaded) {
  return <AppLoadingScreen />;
}
```

- [ ] **Step 3: Verify on the web preview**

Run: `cd OSPREY-app && npm run start -- --web --clear` (or the `OSPREY-app (Expo)` launch config)
Expected: app boots past the loading screen as before (font load is fast and doesn't visibly extend the wait); no console errors about the font family. This doesn't yet change anything visually — no screen references the new font family until Task 5.

- [ ] **Step 4: Typecheck, full suite, and commit**

Run: `cd OSPREY-app && npm run typecheck && npm test`
Expected: typecheck clean; all existing tests still pass (no test covers `app/_layout.tsx`)

```bash
git add OSPREY-app/package.json OSPREY-app/package-lock.json OSPREY-app/app/_layout.tsx
git commit -m "feat(mobile): load Space Grotesk, gated behind the existing AppLoadingScreen"
```

---

### Task 5: Home screen pilot — re-skin + visual verification

**Files:**
- Modify: `OSPREY-app/src/screens/DailySummary.tsx` — four regions only: the Recovery card (JSX lines 197-243, styles 674-705), the Ozzie-note card (JSX lines 289-311, styles 809-845), the quick-stats row (JSX lines 379-387, `StatChip` at 528-543, styles 924-927 + 948-966), and the habit-tip card (JSX lines 389-394, styles 928-947).

**Interfaces:**
- Consumes: `Card`, `Badge` from `@/components/ui` (Task 3); `Theme` from `@/constants/theme` (Task 1); `SpaceGrotesk_700Bold`/`SpaceGrotesk_500Medium` families (Task 4, already loaded app-wide by this point).
- **Explicitly out of scope, left untouched**: `ReadinessCard` (OSPREY+ gated, not named in the spec), the weather card, `NutritionCard`, the weekly-mileage card, session chips, and the Start/Adjust buttons. `BodyBatteryTank`'s internal fill-color logic (green/amber/red — functional, not brand) is untouched; only its outer card container restyles.

This is a pure visual change — no props, no data flow, no business logic changes. Verified by typecheck + the existing suite staying green (no test covers this screen, confirmed during planning) + a live before/after screenshot via the web preview (Task 2's fixture).

- [ ] **Step 1: Import the new primitives**

```tsx
// OSPREY-app/src/screens/DailySummary.tsx — add to the import block (after
// the `useUnitPreference` import, line 19):
import { Card, Badge } from '@/components/ui';
```

- [ ] **Step 2: Recovery card → `<Card>`**

Replace the two `View style={styles.recoveryCard}` / `TouchableOpacity style={styles.recoveryCard}` wrappers (JSX lines 198-223 and 225-242) so both render inside `<Card>` instead of a raw `View`/`TouchableOpacity` with `styles.recoveryCard`. Keep the inner content (title/label/subtext/`BodyBatteryTank`) exactly as-is — only the outer container changes:

```tsx
// Populated branch (was: <View style={styles.recoveryCard}>...</View>)
<Card>
  <View style={styles.recoveryRow}>
    <View style={styles.recoveryLeft}>
      <Text style={styles.recoveryTitle}>Body Battery</Text>
      <Text
        style={[
          styles.recoveryLabel,
          {
            color:
              recovery.recommendation === 'train'
                ? Colors.green
                : recovery.recommendation === 'easy'
                  ? Colors.amber
                  : Colors.recoveryRed,
          },
        ]}
      >
        {recovery.label}
      </Text>
      <Text style={styles.recoverySubtext}>HRV · Sleep · Load</Text>
    </View>
    <BodyBatteryTank score={recovery.score} recommendation={recovery.recommendation} />
  </View>
</Card>
```

```tsx
// Empty branch (was: <TouchableOpacity style={styles.recoveryCard} ...>...</TouchableOpacity>)
<Card>
  <TouchableOpacity
    style={styles.recoveryRow}
    activeOpacity={onConnectHealthPress ? 0.7 : 1}
    onPress={onConnectHealthPress}
    disabled={!onConnectHealthPress}
    accessibilityRole={onConnectHealthPress ? 'button' : undefined}
    accessibilityLabel={onConnectHealthPress ? 'Connect Apple Health in Settings' : undefined}
  >
    <View style={styles.recoveryLeft}>
      <Text style={styles.recoveryTitle}>Body Battery</Text>
      <Text style={styles.recoveryLabel}>No score yet</Text>
      <Text style={styles.recoverySubtext}>
        {onConnectHealthPress
          ? 'Tap to connect Apple Health, or log a workout to unlock recovery scoring.'
          : 'Connect Apple Health or log a workout to unlock recovery scoring.'}
      </Text>
    </View>
  </TouchableOpacity>
</Card>
```

Update the styles: `recoveryCard` (674-684) is superseded by `<Card>` and can be deleted; add `recoveryRow` (the layout it used to provide) and retint `recoveryTitle` off the old teal brand color:

```ts
// OSPREY-app/src/screens/DailySummary.tsx — replace the `recoveryCard` block
// (lines 674-684) with:
recoveryRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
```

```ts
// replace line 691 (`color: Colors.teal,` inside recoveryTitle) with:
color: Theme.accent,
```

```ts
// replace line 699 (`color: Colors.textPrimary,` inside recoveryLabel) with:
color: Theme.text,
```

```ts
// replace line 704 (`color: Colors.textSecondary,` inside recoverySubtext) with:
color: Theme.textSoft,
```

- [ ] **Step 3: Ozzie-note card → `<Card emphasis>`, including its "why" expand panel**

The `whyPanel` (JSX lines 307-311) is a sibling of the `ozzieNote` `TouchableOpacity` in the original code, not nested inside it — but it's the same interactive unit (tap the note, the panel grows underneath). Nest both inside one `<Card emphasis>` so the expand reads as one card growing, not a second, differently-styled box appearing below it:

```tsx
// OSPREY-app/src/screens/DailySummary.tsx — replace the ozzieNote TouchableOpacity
// AND the following whyPanel conditional (lines 290-311) with:
<Card emphasis style={{ marginBottom: 14 }}>
  <TouchableOpacity
    style={styles.ozzieNote}
    activeOpacity={session.whyReasoning ? 0.7 : 1}
    onPress={() => session.whyReasoning && setWhyExpanded((v) => !v)}
    accessibilityRole={session.whyReasoning ? 'button' : undefined}
    accessibilityLabel={session.whyReasoning ? (whyExpanded ? 'Hide reasoning' : 'Why this session') : undefined}
  >
    <OzzieAvatar size={24} />
    <View style={styles.ozzieNoteBody}>
      <Text style={styles.ozzieNoteText}>{session.ozzieNote}</Text>
      {session.whyReasoning ? (
        <Text style={styles.whyToggleText}>
          {whyExpanded ? 'Hide reasoning ▴' : 'Why this session? ▾'}
        </Text>
      ) : null}
    </View>
  </TouchableOpacity>
  {whyExpanded && session.whyReasoning ? (
    <View style={styles.whyPanel}>
      <Text style={styles.whyPanelText}>{session.whyReasoning}</Text>
    </View>
  ) : null}
</Card>
```

```ts
// OSPREY-app/src/screens/DailySummary.tsx — replace the `ozzieNote` style
// block (lines 809-817): the Card now owns background/border/radius/padding,
// so ozzieNote only needs the inner row layout:
ozzieNote: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  gap: 10,
},
```

```ts
// replace line 824 (`color: Colors.textSecondary,` inside ozzieNoteText) with:
color: Theme.textSoft,
```

```ts
// replace line 830 (`color: Colors.teal,` inside whyToggleText) with:
color: Theme.accent,
```

```ts
// OSPREY-app/src/screens/DailySummary.tsx — replace the `whyPanel` style
// block (lines 833-840): it's now nested inside the same Card, so it drops
// its own background/border and becomes an inset divider instead of a
// second boxed panel:
whyPanel: {
  marginTop: 10,
  paddingTop: 10,
  borderTopWidth: 1,
  borderTopColor: Theme.line,
},
```

```ts
// replace line 843 (`color: Colors.textMuted,` inside whyPanelText) with:
color: Theme.textMut,
```

- [ ] **Step 4: Quick-stats row → `StatChip` becomes a `<Card>` per chip**

```tsx
// OSPREY-app/src/screens/DailySummary.tsx — replace the StatChip function
// (lines 528-543):
function StatChip({ label, value, tone }: { label: string; value: string; tone?: 'accent' | 'neutral' }) {
  return (
    <Card style={styles.statChip}>
      <Text style={[styles.statValue, { color: tone === 'accent' ? Theme.accent : Theme.text }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}
```

```tsx
// OSPREY-app/src/screens/DailySummary.tsx — replace the Quick Stats Row JSX
// (lines 379-387), dropping the old per-chip `Colors.gold`/`Colors.teal`/
// `Colors.amber` brand tints in favor of one consistent accent tone:
<View style={styles.statsRow}>
  <StatChip label="Consistency" value={quickStats.streak} tone="accent" />
  <StatChip label="This Month" value={formatDistanceKm(quickStats.monthDistanceKm, units)} />
  <StatChip label="Load" value={quickStats.load} />
</View>
```

```ts
// OSPREY-app/src/screens/DailySummary.tsx — replace the `statChip` style
// block (lines 948-956): Card now owns background/border/radius, statChip
// keeps only sizing/alignment:
statChip: {
  flex: 1,
  alignItems: 'center',
},
```

```ts
// replace line 964 (`color: Colors.textMuted,` inside statLabel) with:
color: Theme.textMut,
```

- [ ] **Step 5: Habit-tip card → `<Card>` + `<Badge>`**

```tsx
// OSPREY-app/src/screens/DailySummary.tsx — replace the habit-tip JSX
// (lines 389-394):
{habitTip ? (
  <Card style={{ marginTop: 16 }}>
    <Badge tone="accent">Habit Tip</Badge>
    <Text style={[styles.habitTipText, { marginTop: 6 }]}>{habitTip}</Text>
  </Card>
) : null}
```

```ts
// OSPREY-app/src/screens/DailySummary.tsx — delete the `habitTipCard` and
// `habitTipLabel` style entries (lines 928-942, superseded by Card + Badge);
// keep `habitTipText` but retint it off the old teal-tinted secondary color:
habitTipText: {
  fontSize: 13,
  color: Theme.textSoft,
  lineHeight: 19,
},
```

- [ ] **Step 6: Import `Theme` for the retint edits above**

```tsx
// OSPREY-app/src/screens/DailySummary.tsx — add alongside the Card/Badge
// import from Step 1:
import { Theme } from '@/constants/theme';
```

- [ ] **Step 7: Space Grotesk on the section labels touched by this task**

```ts
// OSPREY-app/src/screens/DailySummary.tsx — add `fontFamily: 'SpaceGrotesk_700Bold'`
// to `recoveryTitle` (already retargeted to Theme.accent in Step 2) and to
// `habitTipCard`'s replacement — the Badge component already carries its own
// bold weight via fontWeight, so no separate habitTipLabel style is needed
// (superseded by Badge in Step 5).
recoveryTitle: {
  fontSize: 11,
  fontFamily: 'SpaceGrotesk_700Bold',
  color: Theme.accent,
  letterSpacing: 1,
  textTransform: 'uppercase',
  marginBottom: 6,
},
```

- [ ] **Step 8: Typecheck and run the full suite**

Run: `cd OSPREY-app && npm run typecheck && npm test`
Expected: typecheck clean; all existing tests pass unchanged (no test covers `DailySummary.tsx`, confirmed during planning — this is the "stays green" regression gate per the spec's Global Constraints)

- [ ] **Step 9: Visual verification — before/after screenshot via the web preview**

Run: `cd OSPREY-app && npm run start -- --web --clear` (or the `OSPREY-app (Expo)` launch config), log in, navigate to Home.
Expected: the four restyled regions render with ink/panel backgrounds, amber accents, 4px radii, and the Ozzie-note card's offset shadow; the Recovery/Ozzie-note/Stats/Habit-tip sections keep their exact current order and content — nothing new, nothing missing, nothing rearranged. Capture a screenshot for the record.

If anything looks wrong (e.g. Android's `elevation` rendering the emphasis shadow as a soft blur instead of a crisp offset per Task 1's noted risk), fix it in this step before committing — this is the task's actual acceptance gate, not a formality.

- [ ] **Step 10: Commit**

```bash
git add OSPREY-app/src/screens/DailySummary.tsx
git commit -m "feat(mobile): re-skin Home screen's recovery/ozzie-note/stats/habit-tip cards onto the new theme"
```

---

## After all tasks: final review

Dispatch a whole-branch code review (per `subagent-driven-development`) covering the full diff from the branch base through Task 5, then use `finishing-a-development-branch` to merge — do not push without the user explicitly asking, matching this project's established pattern for every prior slice.
