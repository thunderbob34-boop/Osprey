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
