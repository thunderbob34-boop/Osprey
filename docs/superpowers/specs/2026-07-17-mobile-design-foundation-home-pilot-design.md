# Mobile Design Unification — Foundation + Home Screen Pilot — Design

**Date:** 2026-07-17
**Status:** Approved (design) — ready for implementation plan
**Origin:** User request — "make the mobile app feel like the webapp." Scoped down via brainstorming + a visual-companion comparison session (see decisions below). First sub-project of a larger "unify mobile with the webapp's visual language" program; every other screen is a future, separately-scoped slice.

OSPREY-app (`OSPREY-app/`, Expo/React Native) and `webapp/` (Vite/React) evolved as two visually unrelated products — navy/teal/rounded/frosted-glass on mobile vs. ink/amber/hard-edged brutalism on the webapp, with no shared tokens and no design-language doc linking them. This slice builds a shared token + component foundation for mobile and proves it on one screen (Home/Dashboard). It does **not** touch information architecture — a live A/B comparison in the visual companion showed the user preferring mobile's current spacious, one-card-at-a-time structure over the webapp's denser stat-band layout, so this is a re-skin, not a restructure.

---

## Global Constraints

- **Do not modify or remove any existing key in `OSPREY-app/src/constants/colors.ts`.** Every screen other than Home still depends on those tokens (`teal`, `navy`, `bg`, `bgCard`, `border`, `textPrimary`, etc.) until its own future migration slice. This slice is strictly additive at the token level — new tokens live in a new file, old ones stay untouched and in use.
- **`Colors.amber` (`#f5a623`, a status/warning color) is unrelated to the new brand accent** (`#c8793a`) and must not be renamed, removed, or reused for the new accent — that would silently recolor every existing warning/alert use site. The new accent gets its own name (`accent`) in the new token file.
- **Keep all existing functional/status colors as-is**: `green`, `amber`, `red`, `pink`, `recoveryGreen/Amber/Red`, and every per-sport surface/border pair (blue, indigo, sport tints). These carry real semantic meaning (HR zones, PRs, alerts, sport differentiation) and the webapp has no equivalent tokens to reconcile them against.
- **Visual style, locked via the visual-companion session:** ink `#09090B` background / `#101014` card surface / `#3F3F46` border, accent `#c8793a` / bright `#d98b4a`, **4px border radius** (not the webapp's zero-radius — the user picked "adapted for touch" over the literal brutalist port), 2px borders, offset shadow `3px 3px 0 0 #000` on emphasized surfaces only.
- **Layout stays as-is.** Home screen keeps its current section order and one-focal-card-at-a-time structure (recovery card → session/Ozzie-note card → quick stats → habit tip). No new stat-band, no removed sections, no new information — purely a token/component re-skin.
- **Existing Jest suite stays green** (`cd OSPREY-app && npm test`, `TZ=Asia/Kolkata`), plus `npm run typecheck`. This is a styling change with no business-logic change, so no new logic tests are expected — the suite passing unchanged is the regression gate.
- **Visual verification uses the Expo web preview** (see §5) — a real, working tool as of this session, not a hypothetical.

---

## 1. Design tokens — new `OSPREY-app/src/constants/theme.ts`

```ts
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

// iOS renders this as a crisp offset shadow; Android's `elevation` does not
// reproduce a hard offset the same way — verify on both platforms during
// implementation and fall back to a layered-View technique on Android only
// if `elevation` looks wrong (soft/blurred) rather than pre-solving it here.
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

`colors.ts` is untouched by this slice (see Global Constraints). `theme.ts` is a new, separate module — screens migrate onto it one at a time as their own future slices, starting with Home in this one.

## 2. Typography — Space Grotesk via `@expo-google-fonts/space-grotesk`

Add the dependency and load it with `useFonts` in `app/_layout.tsx`. The app already gates its first paint on a branded loading screen rather than the native splash (`app/_layout.tsx:34-37` hides the native splash immediately; `app/_layout.tsx:59-60` renders `<AppLoadingScreen />` while `!initialized`). Font loading extends that same existing gate — it does not introduce new splash-timing logic:

```ts
// app/_layout.tsx
import { useFonts, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';

// inside RootLayout():
const [fontsLoaded] = useFonts({ SpaceGrotesk_500Medium, SpaceGrotesk_700Bold });
// ...
if (!initialized || !fontsLoaded) {
  return <AppLoadingScreen />;
}
```

Headers on the Home screen adopt the webapp's voice: uppercase, wide letter-spacing, `SpaceGrotesk_700Bold` for titles / `SpaceGrotesk_500Medium` for body-weight emphasis. Body copy can stay on the system font where line-length/readability matters more than brand voice (e.g. the Ozzie note's paragraph text) — the plan should use judgment per element rather than force every string onto the display face.

## 3. Component system — new `OSPREY-app/src/components/ui/`

No shared Card/Button/Badge exists on mobile today — every screen styles itself inline via `StyleSheet.create` (confirmed: only `src/components/onboarding/` exists under `src/components/`). Three primitives, each a thin `View`/`Pressable`/`Text` wrapper over the tokens in §1:

**`Card.tsx`** — `ink`/`panel` background, `line` border, `Radius.card`. An `emphasis` boolean prop swaps the border to `accent` and applies `Shadow.emphasis` (the treatment the Ozzie-note card gets; plain cards don't).

```ts
type CardProps = { emphasis?: boolean; children: React.ReactNode; style?: ViewStyle };
```

**`Button.tsx`** — `variant: 'primary' | 'secondary'`. Primary is solid `accent` background with `ink` text; secondary is `accent`-bordered/transparent. Press feedback adapts the webapp's `.btn` `translate(2px,2px)` effect to native via `onPressIn`/`onPressOut` driving a small `Animated.Value` translation (2px), not a new visual language — same interaction idea, native mechanism.

```ts
type ButtonProps = { variant?: 'primary' | 'secondary'; onPress: () => void; children: React.ReactNode; disabled?: boolean };
```

**`Badge.tsx`** — small uppercase, letter-spaced, 1px `line`-bordered tag. Used for things like the "HABIT TIP" label.

```ts
type BadgeProps = { children: React.ReactNode; tone?: 'accent' | 'neutral' };
```

All three live under `src/components/ui/` (new directory) and export from an `index.ts` barrel. No prop drives raw color values — only the tokens in `theme.ts`, so a future palette change stays a one-file edit.

## 4. Home screen pilot — `OSPREY-app/src/screens/DailySummary.tsx`

Re-skin only — same sections, same order, same data, same props (`ozzieNote`/`whyReasoning`/`habitTip`/`quickStats`/etc. from `app/(tabs)/index.tsx:118-173` are untouched). Concretely:

- Recovery card, session/Ozzie-note card (`emphasis` Card), quick-stats row, habit-tip card → become `<Card>`/`<Badge>` instances instead of the current per-element `StyleSheet.create` blocks (`DailySummary.tsx:590-885` today has a dozen ad hoc `borderRadius` values from 3–20px; those all collapse to `Radius.card`).
- Screen headers/labels move to Space Grotesk per §2.
- The "why this session" expand-on-tap interaction (`DailySummary.tsx:291-309`) keeps its exact current behavior — only its visual container changes to `<Card emphasis>`.
- No change to `app/(tabs)/index.tsx` — it passes the same props into the screen; the screen just renders them differently.

## 5. Verification

Pure visual change, so the primary check is the existing Jest suite staying green plus a live visual pass using the Expo web preview set up earlier this session. Two of that session's temporary workarounds become **permanent, dev-only fixtures** as part of this slice (approved by the user):

- `OSPREY-app/app.json` → `web.output: "single"` (was `"static"`; `"static"` triggers Metro's SSR path, which throws `Cannot find module 'react'` — a real, reproducible Expo/Metro bug unrelated to this project's code, root-caused this session). `"single"` is standard Expo Router SPA mode and is what a preview-only web target should use anyway, since the product's real web surface is `webapp/`, not this one.
- `OSPREY-app/src/services/secure-session-storage.ts` → keep the `Platform.OS === 'web'` branch (AsyncStorage-backed encryption-key storage on web only) added this session, since `expo-secure-store`'s web shim is permanently empty (`export default {}`, confirmed by reading the package source) and native iOS/Android behavior is provably untouched by the branch.
- `.env.local` (already gitignored, already documented in `.env.example`) needs no repo change — it's the standard local-dev pattern already established for this app.

The plan should re-verify both fixtures still work after these token/component changes land, and use the preview to screenshot before/after the Home screen restyle.

## 6. Explicitly deferred

Everything beyond tokens + components + Home screen: Workout (lift/hyrox/endurance/run), Log, Stats, Settings, onboarding, and the hidden Ask Ozzie screen. Order and pacing for those get decided after this pilot ships and the user has lived with it — same pattern as every other multi-slice feature in this project (ultra → powerlifting → hyrox → polish → crossfit, each its own brainstorm/spec/plan cycle).
