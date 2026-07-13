# DESIGN.md: Runna (runna.com/v1)

## Source
- URL: https://www.runna.com/v1 (redirects to runna.com)
- Capture date: 2026-07-12
- Evidence: live browser session — hero screenshot, computed CSS (getComputedStyle), `:root` CSS custom properties, full heading outline. Firecrawl branding scrape unavailable (invalid API token), so all values below are **observed live**, not inferred, unless marked.
- Note: site is Webflow-built; below-the-fold sections use scroll-triggered reveal animations.

## Design Summary
Dark, premium, athletic. A near-black canvas with one warm coral/salmon accent used surgically — one accent-colored phrase inside a giant tight-tracked headline, and the primary CTA. Product-first hero: a phone mockup on a dark map with a mint route line and floating glassy stat cards. Sections alternate near-black and cool off-white. Rounded but restrained (8–20px radii, one 80px pill for the social-proof chip). Feels like: confidence, data, motion.

## Design Tokens

### Colors (from `:root` custom properties)
| Role | Token | Value |
|---|---|---|
| Background dark (primary) | `--black` / `cod-black` | `#161616` |
| Background dark alt / overlay | `overlay-black` | `#21272C` |
| Background light sections | `--white-smoke` | `#F2F5F7` |
| Text dark-on-light | `--grey` | `#333333` |
| **Brand accent (CTA + headline highlight)** | `--salmon` (aka sienna) | `#F07561` |
| Data/route accent | `--teal` / `neptune` | `#72BAAF` / `#35CCB6` |
| Warm accent (sparing) | `yellow` | `#F4D35F` (also pale `#FFF7AF`) |
| Muted text on dark | `echo-grey` | `#AEB4BF` |
| Cool greys (borders, secondary) | | `#4E565D`, `#586169`, `#8993A5`, `#A9ACAF`, `#C7C9CB`, `#E1E6EA` |
| Borders on dark | `--_theme---border` | white @ 10% opacity, 1px |
| Text on dark / on accent | | `#FFFFFF` / `#161616` (dark text on salmon buttons) |

### Typography (computed, desktop)
- **Headings: Manrope** 700. Body/UI: **Inter** 400–500. (Newer theme vars reference Strava's `Boathouse` — post-acquisition token creep; rendered page uses Manrope + Inter.)
- H1: 72px / 1.05 line-height / **letter-spacing −4.8px (−6.7%)** / 700 / white
- H2: 56px / 1.1 / −2.52px (−4.5%) / 700 / `#333` on light sections
- Body: 16px / 24px / `#333` (light) or `#AEB4BF`–white (dark)
- Headline device: one phrase of the H1 wrapped in the accent color (class `text-color-sienna`) — "Take your running to the **next level**"

### Spacing and Layout
- Section vertical rhythm token: `6rem` (scale: small 4rem / medium 6rem / large 8rem)
- Main horizontal padding: `2.5rem`; block gap `2rem`
- Radii: small `.5rem`, medium `.75rem` (buttons), large `1.25rem` (cards); social-proof chip is an 80px pill
- Borders: 1px, white @10% on dark; focus ring `.125rem`
- Lightbox/overlay: `#00000080` + 4px blur

## Components
- **Primary button:** salmon `#F07561` bg, **near-black `#161616` text** (not white — distinctive), 8–12px radius, 12px×24px padding, Inter 500 16px, sentence case. Outline variant: 2px salmon border.
- **Social-proof chip (hero):** 80px pill, `rgba(249,249,249,0.05)` glass bg, laurel icon + "App of the Year Finalist" + ★4.9 from 93,000+ runners — sits directly above the H1.
- **Phone mockup hero:** device on dark map, mint `#35CCB6` route line, floating rounded cards (plan progress "2/16 weeks", distance "48/520 mi", coach-message bubble, race badge). Stat cards: dark `#21272C`-ish bg, ~16px radius, white text, small muted labels.
- **Nav:** thin utility bar (locale) above a dark nav — logo left, 7 text links center-right, salmon "Join Us" button. Sticky.
- **Plan cards:** catalog grid of H3 cards (5k, 10k, Half, Marathon, Run Faster, Custom…).
- **Coach cards:** photo grid with names.
- Chat/live-support floating bubble bottom-right (salmon).

## Page Patterns — full measured flow (desktop, 12,995px total)
| # | Section | Height | Background | Layout |
|---|---|---|---|---|
| 1 | Hero: proof chip → H1 → CTA → phone mockup | 1,426px | `#161616` dark | asymmetric 2-col |
| 2 | Logo marquee (press/partners) | 296px | dark | auto-scrolling carousel |
| 3 | "Run your personal best" value props | 948px | white | 3-col grid |
| 4 | User reviews | 1,012px | white | carousel |
| 5 | "Why use Runna?" — 4 features | 1,028px | white | 10-col editorial grid |
| 6 | Plan finder card catalog | 1,204px | white | 4-col grid |
| 7 | "Join millions" stat band | 166px | white | short break band |
| 8 | Photo gallery | 279px | white | 4-col |
| 9 | "Become a Runna" community | 973px | white | 10-col grid |
| 10 | Coaches | 894px | white | 2-col + carousel |
| 11 | Partners | 272px | white | carousel |
| 12 | FAQ accordion | 1,270px | `#F2F5F7` grey | 1-col |
| 13 | Blog articles | 946px | white | 2-col |
| 14 | Newsletter capture | 503px | white | 1-col |
| 15 | Closing CTA — hero headline reprised | 814px | `#161616` dark | 2-col |

## UX Feel
- **Fixed nav** (`position: fixed`) with a persistent salmon "Join Us" — a CTA is always on screen; 6 more CTA instances are spaced down the page (roughly one every two screens).
- **Dark bookends**: dark hero + dark closing CTA (which reprises the hero headline verbatim) wrap an all-white body; one grey act-break at the FAQ. The alternation is bookend-shaped, not zebra-striped.
- **Proof alternates with product** down the page: logos → value props → reviews → features → plans → "millions" → coaches → partners.
- **Carousel-heavy**: logos, reviews, coaches, and partners all auto-scroll or swipe — the page feels busy and kinetic.
- Scroll-triggered reveal animations on every section (Webflow ix2); Intercom chat bubble fixed bottom-right.
- Grid vocabulary varies per section (3-col, 4-col, 10-col editorial, 2-col) — variety keeps the long page from feeling repetitive.

## Content Style
- CTAs: short, energetic, 2–4 words, sentence case: "Join Us", "Start Free Trial", "Hit Your PB", "Get Started"
- Headings: second-person, benefit-led, no periods on H1/H2 fragments
- Risk-reversal copy near CTAs ("Your first week is on us.")
- Numbers everywhere: ★4.9, 93,000+ runners, millions training

## Agent Build Instructions
To build in this style: near-black `#161616` canvas; Manrope 700 headlines at 64–72px with −5% to −7% tracking; wrap exactly one headline phrase in the accent color; one warm accent (their `#F07561`) reserved for CTAs + that phrase; dark text on accent buttons; glassy 5%-white pill for social proof above the H1; product mockup with floating stat cards to the right; mint/teal reserved for data visualization only; alternate `#161616` and `#F2F5F7` sections at 6rem rhythm; 8–20px radii; 1px white/10 borders on dark.

## Rerun Inputs
workflow: firecrawl-website-design-clone
source_url: https://www.runna.com/v1
target_stack: Astro (Osprey website)
output: DESIGN-runna.md
