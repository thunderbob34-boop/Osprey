# OSPREY Mobile — Design-System Consistency Classification (2026-07-21)

Method: `grep -rl "from '@/constants/theme'"` vs `"from '@/constants/colors'"` over
`OSPREY-app/app/` + `src/screens/` + `src/components/`, then per-file token counts
(`Theme.*` vs `Colors.*`), exact-token enumeration, and spot-reads of every
brand-token hit. Root: `/Users/gusjohnson/App Development/Osprey/OSPREY-app`.

## Headline

**Zero screens remain fully on the old navy/teal/gold system.** The briefing's
"~49 files still on old Colors, including the entire Workout and Stats tabs" is
stale: commits `1f6cceb` (Workout launcher, scheme B), `0d35ab3`/`85c1297` (lift),
`c7d8058`/`f396382`/`0fceb16` (stats) landed the remaining tabs, and 30 files now
import `Colors` almost exclusively for **functional** tokens (danger `red`,
success `green`, warning `amber`, `recoveryRed`) — which the migration
deliberately preserves. What is left is (a) a handful of true brand-color
leftovers (gold on Log + Calendar, hardcoded teal on the Ozzie mascot, teal
device-calendar blocks), and (b) **component-grammar drift** — chips, headers,
border widths, shadows — which is now the bigger coherence problem than color.

## Per-screen classification (app/)

Legend:
- **MIGRATED** — Theme only (or no styling).
- **MIGRATED-F** — Theme-dominant; residual `Colors.*` all functional (legit per migration rules).
- **DRIFT** — Theme-dominant but real old-brand decoration or old non-functional tokens remain.

| Screen | Theme refs | Colors residue (exact tokens) | Class | Notes |
|---|---|---|---|---|
| `app/_layout.tsx` | 2 | — | MIGRATED | root nav bg |
| `app/index.tsx` | 7 | — | MIGRATED | |
| `app/(auth)/_layout.tsx` | — | — | n/a | logic only |
| `app/(auth)/sign-in.tsx` → `src/screens/SignIn.tsx` | 20 | red x1 | MIGRATED-F | |
| `app/(onboarding)/_layout.tsx` | — | — | n/a | |
| `app/(onboarding)/welcome.tsx` | 2 | — | MIGRATED | but renders OzzieMascot (hardcoded teal, see below) |
| `app/(onboarding)/name.tsx` | 4 | — | MIGRATED | |
| `app/(onboarding)/mode.tsx` | 1 | — | MIGRATED | |
| `app/(onboarding)/goals.tsx` | 9 | — | MIGRATED | |
| `app/(onboarding)/health.tsx` | 3 | — | MIGRATED | documents deliberate 1px "emphasis tier" (L111) |
| `app/(onboarding)/baseline.tsx` | 18 | red x1 | MIGRATED-F | chips: radius 24, borderWidth 1 (L354-360) — chip grammar drift |
| `app/(tabs)/_layout.tsx` | 4 | — | MIGRATED | tab bar |
| `app/(tabs)/index.tsx` → `src/screens/DailySummary.tsx` | 60 | amber x2, green x2, recoveryRed x2, red x1 | MIGRATED-F | Home; one of only 3 `Card emphasis` sites (L296) |
| `app/(tabs)/log.tsx` | 61 | **gold x3, goldDim x2**, red x2, + raw `rgba(200,154,0,0.3)` x2 | **DRIFT** | see finding: gold-vs-amber collapse (L820-825, 1110-1112, 1183-1188) |
| `app/(tabs)/workout.tsx` | 13 | amber x1 | MIGRATED-F | scheme B landed (`1f6cceb`) |
| `app/(tabs)/stats.tsx` | 76 | bgCard (comment only, L669), green x1, red x2 | MIGRATED-F | `Colors.bgCard` hit is a code comment, not usage |
| `app/(tabs)/settings.tsx` | 38 | red x3 | MIGRATED-F | |
| `app/activity.tsx` | 19 | red x1 | MIGRATED-F | ScreenHeader ✓ |
| `app/ask-ozzie.tsx` | 7 | — | MIGRATED | ScreenHeader ✓; renders 96px teal-browed mascot |
| `app/calendar.tsx` | 19 | **gold, surfaceGold, borderGold** (L214, 343-344), green/surfaceGreen/borderGreen (done-state) | **DRIFT** | RACE DAY card is decorative old-brand gold |
| `app/challenges.tsx` | 46 | green x1, red x2 | MIGRATED-F | ScreenHeader ✓ |
| `app/food-scanner.tsx` | 14 | red x1 | MIGRATED-F | no ScreenHeader; literal borderWidth 2 (L212); radius 20 (L192,202) |
| `app/friends.tsx` | 38 | red x1 | MIGRATED-F | ScreenHeader ✓ |
| `app/hyrox-quiz.tsx` | 12 | red x1 | MIGRATED-F | ScreenHeader ✓ (new REC-003) |
| `app/paywall.tsx` | 25 | — | MIGRATED | 72px teal-browed mascot (L174) |
| `app/plan-preview.tsx` | 47 | amber x1, red x1 | MIGRATED-F | hand-rolled back-header (L384, 587) instead of ScreenHeader |
| `app/preferences.tsx` | 23 | amber x1 | MIGRATED-F | no ScreenHeader; chips radius 24 / borderWidth 1 (L756-786) |
| `app/race-event.tsx` | 23 | — | MIGRATED | ScreenHeader ✓; radius 20 (L381) |
| `app/race-search.tsx` | 31 | — | MIGRATED | ScreenHeader ✓; radius 20 (L269) |
| `app/races.tsx` | 107 | amber, green, red x2 | MIGRATED-F | ScreenHeader ✓; borderWidth 1.5 (L1240) |
| `app/reset-password.tsx` | 13 | red x1 | MIGRATED-F | no ScreenHeader (auth flow — arguably fine) |
| `app/routes.tsx` | 35 | red x2 | MIGRATED-F | ScreenHeader ✓ |
| `app/supplements.tsx` | 26 | red x1 | MIGRATED-F | ScreenHeader ✓ |
| `app/workout/_layout.tsx` | — | — | n/a | |
| `app/workout/run.tsx` | 39 | green, amber, **textMuted** (L510) | **DRIFT** (minor) | `Colors.textMuted` should be `Theme.textMut`; radius 20 scrim pill |
| `app/workout/lift.tsx` | 97 | amber, green, red x3 | MIGRATED-F | literal borderWidth 2 (L1136, 1290) + 1.5 (L1101) |
| `app/workout/hyrox.tsx` | 41 | red x7, green x2, **borderGreen** (L362) | **DRIFT** (minor) | stations identity-coded with danger `Colors.red` though `ChartPalette.hyrox` exists; old frosted `borderGreen` on done card |
| `app/workout/endurance.tsx` | 45 | green x1 | MIGRATED-F | radius 24 (L668) |
| `app/workout/recap.tsx` | 31 | green, red | MIGRATED-F | only screen using `Card emphasis` (L124, 140) |

## Shared components

| File | Class | Notes |
|---|---|---|
| `src/components/ui/{Button,Card,Badge}.tsx` | MIGRATED | Card carries `Shadow.emphasis` |
| `src/components/ScreenHeader.tsx` | MIGRATED | |
| `src/components/onboarding/OnboardingShell.tsx` | MIGRATED | |
| `src/components/{AppLoadingScreen,BuildPlanBanner,DateField,DeloadSuggestionCard,MuscleDiagram,RunMap,RunMap.web}.tsx` | MIGRATED | |
| `src/components/{HydrationCard,NutritionCard,ZonesCard,WeatherCoachCard,InputModal,FieldError}.tsx` | MIGRATED-F | green/amber/red functional only |
| `src/components/OzzieMascot.tsx` L45-46, `OzzieAvatar.tsx` L39-40 | **DRIFT** | hardcoded `#00c8c8` "Teal brand accent" brow strokes — renders on Home, welcome, paywall, ask-ozzie, run/endurance |
| `src/services/calendar-blocking.ts` L60 | **DRIFT** | OSPREY blocks written to the device calendar colored `#00c8c8` teal |
| `src/constants/colors.ts` | — | still exports the full teal/gold/navy brand set; only red/green/amber/recovery* remain legitimately used |

## Component-level consistency

**ScreenHeader** — adopted by 11 standalone screens (activity, ask-ozzie, calendar,
challenges, friends, hyrox-quiz, race-event, race-search, races, routes,
supplements). NOT adopted: `plan-preview.tsx` (hand-rolled back header, L384/587),
`preferences.tsx`, `food-scanner.tsx` (bare title text), `reset-password.tsx`.
Tab screens use their own in-page titles (consistent among themselves).

**Button primitive** — broad adoption: 20 screens + DailySummary. One documented,
reasoned exception (log.tsx copy-yesterday chip, L804-810 comment).

**Card primitive** — adopted via the `@/components/ui` barrel in 13 files (log,
settings, paywall, plan-preview, supplements, hyrox, lift, recap, BuildPlanBanner,
DeloadSuggestionCard, HydrationCard, NutritionCard, DailySummary). Hand-rolled
panel styles in stats, races, routes, calendar, activity, friends, challenges,
race-event, race-search, preferences, food-scanner, workout.tsx, endurance, run,
and all onboarding screens — mostly matching the recipe (Theme.panel + line +
Radius.card) but re-implemented each time, so they drift on border width.

**Radius** — `Radius.card` (4) in 44 files, but chips/pills hand-roll big radii:
20 (x10: log chips + scanBtn, stats, challenges, race-event, race-search,
food-scanner, run, lift, MuscleDiagram), 24 (x5: baseline, preferences x2,
hyrox, endurance). Two pill grammars coexist — log.tsx itself mixes radius-20
`chip` (L1165) with radius-4 `recentChip` (L1176) in adjacent rows.

**BorderWidth** — 71 uses of `BorderWidth.card` vs 46 literal `1`, 5 literal
`1.5` (races L1240, lift L1101, hyrox L490/512/582), 5 literal `2` bypassing the
token (food-scanner L212, lift L1136/1290, hyrox L519, run L685). The 1px tier is
deliberate in places (health.tsx L111 comment) but has no token, so 1 vs 1.5
drift freely.

**Shadow** — `Shadow.emphasis` (the system's signature hard-offset shadow) is
reachable only through `Card emphasis`, used at exactly 3 sites: recap PR banner
(L124), recap Ozzie card (L140), DailySummary Ozzie brief (L296). Every other
card in the app is flat.

**Typography** — no type tokens in theme.ts; 53 inline
`fontFamily: 'SpaceGrotesk_700Bold'` declarations across 27 files with hand-picked
sizes/letter-spacing. `SpaceGrotesk_500Medium` is loaded at boot
(app/_layout.tsx L7, L34) but referenced by zero styles — dead weight in the
startup font load.
