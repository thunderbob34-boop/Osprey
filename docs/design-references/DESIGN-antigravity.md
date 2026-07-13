# DESIGN.md: Google Antigravity (antigravity.google)

## Source
- URL: https://antigravity.google
- Capture date: 2026-07-11
- Evidence: live browser walkthrough (full-page scroll capture across 8 sections, desktop 800px + mobile 375px viewports), computed-style extraction via injected JS (colors, type scale, spacing, radii, button/nav states). Firecrawl scrape/screenshot tools were unavailable in this session (unauthorized token), so evidence is direct DOM/CSS inspection rather than a saved screenshot asset — treat pixel values below as observed facts, not files on disk.
- Purpose: reference blueprint to inform a new marketing website for **Osprey**, a running/endurance workout app, that takes this visual language further rather than copying it.

## Design Summary
Antigravity reads as a premium Google developer-tool site: a huge amount of white space, a single confident sans-serif type family carried at every scale, near-black (not pure black) ink, and one restrained brand-gradient accent (blue → orange → green) used sparingly on the logomark and a few illustration moments. The page's entire visual interest comes from **contrast staging**: long white sections punctuated by full-bleed black "device" panels (macOS-style app/terminal/IDE mockups) with soft rainbow glows or star-field particles. Corners are aggressively rounded (pill buttons, 16–45px card radii), shadows are almost nonexistent (flat color + radius does the work), and motion is subtle scroll-triggered fades rather than flashy transitions. Voice is short, confident, aspirational ("Experience liftoff," "Achieve new heights") — flight/space metaphor threaded through copy, iconography, and the dark starfield hero.

## Design Tokens

### Colors
| Role | Value | Notes |
|---|---|---|
| Primary ink / text | `rgb(18, 19, 23)` — near-black | body text, headings, primary button fill |
| Secondary text | `rgb(69, 71, 77)` — warm dark grey | nav links, muted copy |
| Surface white | `rgb(255, 255, 255)` | page background, header |
| Cool tint surface | `rgb(248, 249, 252)` | light grey-blue card/slider backgrounds |
| Neutral overlay (secondary buttons) | `rgba(183, 191, 217, 0.1)` fill, `rgba(33, 34, 38, 0.06)` border | ghost/secondary pill buttons — a cool slate-blue at very low opacity, not plain grey |
| Neutral overlay, inverse | `rgba(183, 191, 217, 0.2)` | secondary button on dark panels |
| True black panels | `rgb(0,0,0)` / near-black gradients | full-bleed hero + CLI + download sections |
| Brand gradient (logomark/accents) | blue → orange/amber → green (Google 4-color family, reordered) | used only on the "Λ" peak logomark, CLI splash art, and blog thumbnail illustrations — never as a UI background |
| Accent glow (SDK panel) | deep navy → bright blue radial (`~#0a1128` to `~#3b6fe0`) | radial glow behind dark feature cards |
| Star particles | small blue/white dots, low density | scattered across black hero + download panel |

**Pattern:** the palette is almost monochrome (near-black ink on white) with color reserved entirely for the logo/illustration layer and one blue radial glow. This restraint is what makes the brand-gradient moments feel premium instead of decorative.

### Typography
- **Family:** "Google Sans Flex" (variable font) → falls back to "Google Sans" → `sans-serif`. One family for everything, no serif or mono pairing (code blocks use a separate monospace, seen only inside terminal/IDE mockups).
- **Variable weight axis** is used like a design tool: observed weights `300, 400, 430, 450, 500` — headings and buttons sit at `450` (not 700/bold), giving a soft, rounded confidence rather than shouty boldness.
- **Type scale (desktop):**
  - H1 (hero): `48px / 52.8px line-height` (1.1), weight 450, normal letter-spacing
  - H2 (section title): `28px / 29.6px`, weight 450, letter-spacing `-0.28px`
  - Body/lede: `24px / 25.92px`, weight 450, letter-spacing `-0.14px`
  - Nav / buttons: `15px`, weight 450
- Letter-spacing tightens slightly (negative) as size increases — a common large-type-legibility trick.
- Mobile hero scales down proportionally but keeps the same weight/line-height ratio; hero stays center-aligned rather than left-aligned on small screens.
- A signature quirk: the footer wordmark "**Antigravity**" is set gigantic (viewport-width scale) with the lowercase "t" rendered with a raised/ascending stroke — a subtle custom flourish rather than a plain lowercase t, worth noting if licensing a similar variable font.

### Spacing And Layout
- **Radius scale:** `4px` (tiny labels/pills), `16px`, `24px`, `36px`, `45px` (large feature cards), `9999px` (pill buttons, avatar/circle elements), `50%` (perfect circles).
- **No drop shadows** on cards/buttons (`box-shadow: none` almost everywhere) — depth comes from color contrast (black panel on white page) and radius, not elevation.
- **Section rhythm:** page is a strict vertical stack of full-width sections, generous vertical padding (hundreds of px between major sections), each section title centered with a one-sentence subhead directly below it.
- **Feature cards** (Antigravity 2.0 / CLI / SDK / IDE) are the tallest, richest blocks on the page — each ~1200px tall, alternating light and dark treatments, each containing one large product screenshot/mockup framed in a rounded "device" card.
- Buttons pair as **primary (solid near-black pill) + secondary (pale slate-tint ghost pill)**, always rounded-full, consistently `10px 24px` padding (compact nav variant uses `6px 16px`/`6px 8px 6px 16px` with a leading icon).
- Header: `position: fixed`, white background, toggles a `scrolled`/`hidden` class pair — implies hide-on-scroll-down, reveal-on-scroll-up behavior typical of premium marketing sites.

## Components
- **Nav bar:** logo (colorful "Λ" mark + wordmark) left, pill text links with chevron dropdowns center/right ("Products", "Use Cases", "Pricing", "Blog", "Resources"), hamburger icon on mobile. Transparent until scrolled, then solid white + fixed.
- **Primary CTA button:** solid `rgb(18,19,23)` fill, white text, full pill radius, optional leading icon (Apple logo for "Download").
- **Secondary CTA button:** near-transparent cool-grey fill (`rgba(183,191,217,0.1)`), hairline border, same pill radius — reads as "quiet" next to the solid primary.
- **Dark device-mockup card:** rounded-corner (36–45px) black/near-black panel containing a realistic macOS-chrome window (red/yellow/green traffic-light dots) with terminal or code content, syntax-highlighted diffs, sometimes a scattered star-particle background behind the window.
- **Light device-mockup card:** rounded pale-grey (`rgb(248,249,252)`-family) panel containing a light-mode app screenshot (chat input, file tree, code editor) — mirrors the dark card structurally but inverted palette, used for the "friendlier"/product-manager-facing features.
- **Radial glow card:** near-black card with a centered soft blue radial gradient and large centered wordmark text glowing at the center — used for the more abstract/technical product (SDK).
- **Video testimonial carousel:** large rounded-corner (36px+) video thumbnail, centered play button (translucent white circle), name label overlay bottom-left, caption + "View case" link below, prev/next pill arrow controls centered beneath.
- **Split CTA panel:** one large rounded rectangle with a fine dot-matrix/noise texture background, containing two centered stacked CTAs ("For developers" / "For organizations") each with eyebrow label, heading, subheading, and a pill button.
- **Blog card grid:** 3-up grid of black rounded cards, vibrant gradient/illustration artwork filling the top ~60%, title/date/category/"Read blog" link below in plain black-on-white outside the card.
- **Footer:** two-column simple link lists, giant brand wordmark as a graphic/logotype element, small "Google" sub-lockup and legal links at the very bottom.

## Page Patterns
Section order (top → bottom): Fixed nav → full-bleed dark starfield hero with center-aligned H1 + dual CTA + "Play intro" → intro statement line → 4-part alternating feature showcase (2.0 → CLI → SDK → IDE, light/dark/light/dark rhythm, each is title + subhead + huge product mockup) → "Built for developers" persona video carousel → dot-texture dual-CTA panel (individual vs. org) → "Latest Blogs" 3-up grid with carousel arrows → full-bleed black download panel with platform buttons + starfield → footer with giant wordmark.

Responsive behavior: single column throughout on mobile, buttons stack full-width, hero and section copy stay center-aligned, nav collapses to hamburger, feature-card mockups scale down but keep same rounded-panel treatment.

## Content Style
- Short, confident, metaphor-driven headlines built around flight/space ("liftoff," "Achieve new heights") tied directly to the product name.
- Section titles are just the product/feature name; subheads are one plain-spoken sentence describing the benefit, no jargon stacking.
- CTAs are literal and low-friction: "Download," "Explore use cases," "Explore Product," "Read More," "View case" — never cute or vague.
- Persona-based social proof ("Full stack developer," "Enterprise developer," "Frontend developer") instead of company logos — humanizes a technical product.
- Dates on blog cards use plain "Month D, YYYY" with a one-word category tag.

## Agent Build Instructions
To build Osprey's marketing site *in this language but leveled up* for a running/endurance workout app:

1. **Keep the restraint, change the palette's job.** Antigravity spends 95% of the page in near-monochrome and saves color for one gradient logomark. Osprey should do the same discipline but let its accent color(s) carry energy/heart-rate-zone associations (e.g., a warm sunrise gradient or a single vivid "effort" color) rather than a static brand mark — color should feel earned by motion/pace, not decorative.
2. **Replace static device mockups with *live* data mockups.** Antigravity's biggest visual asset is realistic app-chrome screenshots. Osprey's equivalent should be real running data: pace splits, route maps, heart-rate zone charts, race countdown — rendered inside the same rounded "device card" pattern (16–45px radii, no shadow, color-contrast for depth) but animated (a route line drawing itself, a pace graph ticking) instead of static.
3. **Reuse the type discipline.** One variable/expressive sans family, mid-weight (400–500, not bold) headlines at a large size with tight negative letter-spacing, generous line-height. This reads premium and modern; avoid mixing in a "sporty" display font — let color and motion carry energy instead.
4. **Reuse the button system exactly:** solid near-black pill primary, pale slate-ghost pill secondary, `9999px` radius, no shadow, compact nav variant with leading icon.
5. **Level up the "black panel" motif into a night-run/starfield → sunrise motif.** Antigravity's black starfield hero suits "liftoff"; Osprey can reuse full-bleed dark sections for night-run/trail features but transition them into a warm gradient (dawn) for race-day/achievement moments — same structural technique (full-bleed dark section + soft particle/glow layer + centered content), new metaphor.
6. **Persona carousel → athlete carousel.** Swap "Full stack developer / Enterprise developer" for athlete personas (marathoner, trail runner, first-5K, coach) using the identical card structure (video thumbnail, name overlay, one-line benefit, "View story" link).
7. **Dot-texture dual-CTA panel maps directly** to an Osprey "For individual athletes / For run clubs & coaches" split — reuse structure, keep the fine noise/dot texture as a quiet background detail rather than empty white space.
8. **Motion:** implement scroll-triggered opacity/translate-Y fade-ins per section (Antigravity's pattern), plus a sticky nav that hides on scroll-down and reveals on scroll-up. Keep transitions subtle (200–400ms ease) — nothing bouncy, matching the composed/confident tone.
9. **Voice:** short benefit-first headlines with one clear metaphor (Antigravity = flight; Osprey = flight-of-a-bird-of-prey is already on-brand — lean into "read the terrain," "hold your line," "find your altitude" rather than generic fitness-app copy).
10. **Don't copy 1:1:** Antigravity's audience is enterprise/individual developers, so its tone is measured and low-color. Osprey's audience wants to feel physically activated — it's fair (and recommended) to push slightly more color, a touch more motion energy, and real athlete photography/video where Antigravity uses abstract UI screenshots, while keeping the same spacing, radius, and typographic restraint that makes the source site feel expensive.

## Rerun Inputs
workflow: firecrawl-website-design-clone (executed via live browser inspection due to Firecrawl auth failure)
source_url: https://antigravity.google
target_stack: unspecified (Osprey marketing site — not yet started; app itself is Expo/React Native per `OSPREY-app/`)
output: docs/design-references/DESIGN-antigravity.md
