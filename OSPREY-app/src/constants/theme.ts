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
