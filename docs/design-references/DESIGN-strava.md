# DESIGN.md: Strava (strava.com)

## Source
- URL: https://www.strava.com/
- Capture date: 2026-07-12
- Evidence: live browser session — hero screenshots (~1000px viewport), computed CSS, heading outline. Firecrawl branding scrape unavailable (invalid API token); values are **observed live**. Type sizes reflect the compact/narrow layout and scale up on wide desktop.

## Design Summary
Utilitarian, confident, photography-led. White chrome (nav) around a full-bleed motion-blur action photo hero with a plain white headline and a big solid-orange rectangular CTA block. One color does all the work: Strava orange `#FC5200` on white/black/warm-grey neutrals. Small radii (4px), compact type, dense information. The energy comes from the imagery and the orange, not from decoration. Feels like: a tool loved by athletes.

## Design Tokens

### Colors
| Role | Value |
|---|---|
| **Brand orange (sole accent)** | `#FC5200` (rgb 252, 82, 0) |
| Text primary | `#000000` |
| Text/warm dark grey (secondary text + hero backdrop) | `#43423F` |
| Near-black warm | `#21211F` |
| Off-white (secondary buttons) | `#FAFAFA` |
| Page background | `#FFFFFF` |

Palette discipline: essentially 1 accent + warm greys. No secondary hues on the marketing page.

### Typography
- **Single family: "Boathouse"** (Strava's proprietary grotesque; fallback: Segoe UI / Helvetica Neue / system-ui). One family for everything — headings, body, buttons.
- Weights: 600 for headings/CTAs/nav emphasis, 400 for body. No 700+.
- Observed (compact layout): H1 32px/1.0 600; H2 24px/400; H3 22px/400; body 14px/18px. Letter-spacing normal — no tight tracking; the face carries the character.
- Headline color: white over photography, black on white sections.

### Spacing and Layout
- 4px border-radius on all buttons — deliberately squarer/more utilitarian than consumer-app norms
- Compact paddings: primary nav button 6px×24px; large form CTAs 10px×50px
- Full-bleed hero (edge-to-edge photo), white nav bar kept separate above it
- Content sections on white with generous whitespace, image-and-text alternating rows

## Components
- **Primary button:** orange `#FC5200` bg, **white** 600 text, 4px radius, sentence case ("Sign Up")
- **Hero CTA block:** oversized solid-orange rectangle (not a pill) with chevron ">" + "Join us for free." — reads as a bold graphic element overlapping the photo
- **Secondary buttons:** `#FAFAFA` bg, dark `#21211F` text, 4px radius (Sign Up With Google/Apple); orange variant for "Sign Up With Email"
- **Nav:** white bar — hamburger, orange logotype, orange Sign Up button right. Minimal.
- **Scroll cue:** centered "Explore Strava" + orange chevron at hero bottom
- **Imagery:** full-bleed motion-blur athlete photography (cyclist mid-motion) — energy through blur/motion, warm earthy grading that harmonizes with the orange

## Page Patterns — full measured flow (mobile bundle, 11,898px total)
Strava UA-detects and served its mobile layout to the headless browser; desktop follows the same section order with larger type.

| # | Section | Height | Background |
|---|---|---|---|
| 1 | Hero: photo + H1 + orange CTA block + scroll cue | 400px | photo |
| 2 | Manifesto (text only): "If you're active, Strava was made for you." | 1,139px | white |
| 3 | How it works: "Start by sweating." → "Get better by analysis." → "Dive into details on desktop." | 668px | white |
| 4 | **"Join for the tracking, stay for the community."** — community features, segments, challenges, clubs | **5,798px (~49% of the page)** | white |
| 5 | Dark act: "More features, more fun." — Beacon highlight + subscription upsell | 1,667px | `#21211F` |
| 6 | Device ecosystem + Sign Up (Google / Apple / Email) | 656px | white |

## UX Feel
- **Nav scrolls away** (mobile) — no persistent CTA chrome. Conversion is concentrated at the two ends of the page (hero CTA block, final sign-up trio), not sprinkled through it.
- **Linear storytelling in acts**: manifesto → 3-step how-it-works → community proof → premium upsell → ecosystem reassurance → the ask. Each argument is made once, in order.
- **The thesis is structural**: the community section is ~49% of total page height. "Community-powered" isn't just the headline — it's most of the page.
- **Exactly one dark section** (`#21211F`) as the premium act-break before the final ask — dark = subscription/serious.
- Almost no widgetry: few carousels, no chat bubble, no floating chrome, minimal animation. The pace is calm and editorial; the motion-blur photography supplies all the energy.

## Content Style
- Signature voice: short declarative sentences **with terminal periods** — "Start by sweating.", "Join us for free.", "Explore our features."
- Community-first framing over feature-first
- Sentence case everywhere; no shouting caps
- H2/H3 read as conversational statements, not labels

## Agent Build Instructions
To build in this style: white chrome + full-bleed motion photography; exactly one accent color at high saturation doing 100% of the interactive work; single grotesque family, 600/400 only, normal tracking; 4px radii; oversized flat-color CTA block overlapping the hero image; short punchy sentences ending in periods; alternate photo/text rows on white; keep decoration near zero — imagery and the accent carry the brand.

## Rerun Inputs
workflow: firecrawl-website-design-clone
source_url: https://www.strava.com/
target_stack: Astro (Osprey website)
output: DESIGN-strava.md
