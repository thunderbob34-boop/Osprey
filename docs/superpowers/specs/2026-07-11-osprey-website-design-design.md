# Osprey Marketing Website — Design Direction Spec

**Date:** 2026-07-11
**Status:** Approved direction, pending user review of this document
**Reference implementation:** `website-mockups/osprey-brutalist-amber.html` (interactive layout test, approved by user)
**Research artifact:** `docs/ANTIGRAVITY_DESIGN.md` (Antigravity extraction that seeded the project)

## 1. Purpose & Scope

A marketing website for Osprey, the running/endurance workout app (Expo/React Native, Supabase). Primary job: convert individual athletes to a free app download; secondary job: route coaches and run clubs to a paid team tier.

**In scope:** homepage (flagship), lightweight Pricing / Blog / Legal sub-pages reusing the same system.
**Out of scope:** final copywriting (register is set, exact lines are a copy pass), the coach/club dashboard product, athlete photo/video asset sourcing, App Store rating & QR-code conversion adds (post-launch, once a rating exists).

## 2. Decision History (deliberate, do not "correct")

1. Started from an extraction of antigravity.google (restrained, near-monochrome, premium).
2. Explored a "Slate & Amber" softened direction (charcoal/ivory/copper, pill buttons) — built and reviewed.
3. Audited against the ui-ux-pro-max database. Its generic fitness recommendation (energy-orange, Barlow Condensed, "Vibrant & Block-based") was **rejected as template-default**.
4. User chose **Kinetic Brutalism** (from the same database's style set) with the acid yellow replaced by **copper amber #c8793a**, after seeing both directions rendered full-page.
5. The interactive layout test was approved. This supersedes the earlier pill-button/rounded direction; the Antigravity influence survives in section flow, content strategy, and discipline — not in surface styling.

## 3. Design Language

**Style:** Kinetic Brutalism, warmed. Hard edges, exposed 2px grid lines, oversized uppercase display type, zero border-radius, solid color blocks, no shadows, no gradients. The copper amber accent replaces acid yellow to keep energy without going neon.

**Voice architecture (the core brand tension, intentional):** the shell shouts, the coach doesn't. Display-level copy is short, uppercase, aggressive-adjacent ("HUNT YOUR LIMITS", "MID-PURSUIT"). Inside the device frames, Ozzie speaks in his real product voice — warm, specific, encouraging ("Last week you hit 6 at this weight. Good progression, rest 90s."). Marketing shell = intensity; product interior = warmth. Never swap these registers.

## 4. Design Tokens

### Colors (semantic tokens — never raw hex in components)

| Token | Value | Role |
|---|---|---|
| `--ink` | `#09090B` | Page background |
| `--panel` | `#101014` | Device-frame / inset surfaces |
| `--line` | `#3F3F46` | All structural borders (2px) |
| `--amber` | `#c8793a` | Accent: CTAs, stat numbers, accent words, active tab |
| `--amber-bright` | `#d98b4a` | Hover state on amber fills |
| `--text` | `#FAFAFA` | Primary text |
| `--text-soft` | `#c9cbd1` | Coach-line body text inside device frames |
| `--mut` | `#A1A1AA` | Secondary text, labels, nav links |

Contrast (WCAG, computed): text on ink 19.06:1; mut on ink 7.76:1; amber on ink 5.92:1; black text on amber fills 6.25:1; mut on panel 7.41:1; amber on panel 5.65:1; text-soft on panel 11.70:1 — all AA. The site is dark-only — no light mode; there is no light-background context, so no deep-amber variant is needed (the earlier `#96541f` token applies only if a light surface is ever introduced).

### Typography

- **Family:** Space Grotesk (Google Fonts), weights 500 and 700 only. `font-display: swap`.
- **Display (h1/h2/wordmark):** 700, uppercase, `line-height 0.9–0.95`, `letter-spacing -0.015em to -0.04em`, sized with `clamp()` — h1 `clamp(64px, 13vw, 160px)`, h2 `clamp(40px, 7vw, 88px)`, footer wordmark `clamp(72px, 18vw, 240px)`.
- **Body:** 500, sentence case, 14–19px, `line-height 1.5–1.55`, muted color.
- **Labels/nav/buttons:** 700, uppercase, 11–14px, `letter-spacing 0.04em–0.12em` (positive tracking at small sizes only; never tight-track body text).
- **Metrics inside device frames:** 700, `clamp(40px, 6vw, 56px)`.

### Structure

- **Radius:** 0 everywhere. No exceptions.
- **Borders:** 2px solid `--line` — section dividers, cell dividers, device frames, ghost buttons.
- **Shadows/blur/gradients:** none (athlete image placeholders may use a flat dark gradient until real photography lands).
- **Spacing:** section padding `clamp(48px, 7vw, 96px)` vertical, 24–32px horizontal gutters; internal cells 28–52px. Grid cells share borders (no gaps) — the exposed-grid look.

## 5. Page Structure (homepage, in order)

1. **Sticky nav** — logo left; Coaching / For Coaches / Pricing / Blog center; amber DOWNLOAD block right. 2px bottom border. Collapses to logo + Download under 760px (hamburger menu is an implementation-plan decision).
2. **Marquee** — thin amber uppercase ticker ("RUN HARDER · LIFT HEAVIER · FUEL SMARTER"), 18s linear loop, `aria-hidden`, frozen under `prefers-reduced-motion`.
3. **Hero** — left-aligned stacked display type, final word amber ("HUNT / YOUR / LIMITS"); one muted sub-paragraph (≤2 lines, ends on the raptor line "an eye that never drifts"); amber primary + ghost secondary buttons.
4. **Stat strip** — three cells, hard dividers: oversized amber number + small uppercase muted label (26.2 MILES TRACKED / 315 LB PR LOGGED / 94% PLAN ADHERENCE). Numbers must be real product-representative values, not marketing fiction.
5. **Coaching showcase** — h2 "ONE COACH. / EVERY SESSION." Full-width 4-cell tab bar (RUN / STRENGTH / NUTRITION / COACH); active tab is a solid amber block with black text. Below, a hard-bordered device frame (`--panel`, max-width 560px) with a top bar (OSPREY / mode label) and a body: uppercase context label → oversized metric → **data visualization** → Ozzie coach line (amber name, warm voice). Tab click swaps frame content; each tab has its own scene. Content swap is instant or ≤150ms fade — nothing springy; body height is fixed across tabs (no layout shift).
   Visualizations are flat and hard-edged (no gradients, no rounded bars), chart type matched to data per dataviz convention, direct labels instead of legends, `font-variant-numeric: tabular-nums`:
   - RUN: mile-splits vertical bar chart, current mile amber, remaining miles as stubs
   - STRENGTH: working-set rows as filled block sequences (done = amber), current set highlighted
   - NUTRITION: macro bullet bars (protein/carbs/fat) with amber fill and a target tick
   - COACH: 7-day training-week grid, completed days amber-filled, today amber-outlined
6. **Athlete section** — h2 "MID-PURSUIT". Three equal hard-bordered cells (no carousel): 16:11 image area with situation label + 44px square play button, body with name + one situational line ("Training for her first marathon, 14 weeks out"). Situational context, never praise quotes.
7. **Dual CTA** — two bordered panels: FREE / FOR ATHLETES (amber Download) and TEAM PLAN / FOR COACHES & CLUBS (ghost Talk to us).
8. **Footer** — download buttons (iOS primary, Android ghost), giant amber OSPREY wordmark, two uppercase link columns, legal line.

## 6. Components

- **Primary button:** amber fill, black text, 2px amber border, uppercase 700, 14–16px pad-y / 28–32px pad-x. Hover → `--amber-bright`; active → `translate(2px, 2px)` (the mechanical press).
- **Ghost button:** transparent, `--text`, 2px `--line` border. Hover → faint white fill + `--mut` border.
- **Tab cell:** flex-equal, uppercase, muted; `aria-selected` cell = amber block/black text. Buttons with `role="tab"`.
- **Device frame:** `--panel` bg, 2px border, top bar with 2px bottom border, min-height reserved to prevent CLS on tab swap.
- **Stat cell / grid cell:** shared 2px borders, collapse to stacked-with-horizontal-dividers under 760px.

## 7. Motion & Interaction

- Register: **mechanical, instant, precise** — matches brutalism and the "precision" positioning. Transitions 100–150ms ease; button press is a 2px translate; no springs, no bounce, no parallax.
- Marquee is the single ambient motion. Scroll-reveal animations are *not* part of this language — content is simply there.
- `prefers-reduced-motion`: marquee frozen, smooth-scroll off, transitions removed.
- All interactive elements: `cursor: pointer`, visible `:focus-visible` (3px amber outline, 3px offset), ≥44px touch targets.

## 8. Accessibility & Performance Requirements

- All text pairs meet AA at their sizes (see token table). No color-only meaning: active tab uses fill + `aria-selected`; errors (if forms ever appear) get text.
- Semantic HTML: real `<nav>`, `<header>`, `<section>`, `<footer>`, `<button>` for tabs, single h1, sequential headings.
- Body text ≥16px equivalent on mobile; no horizontal scroll at 375px.
- Fonts: preload the two Space Grotesk weights only; `font-display: swap`.
- Images (athlete photos when they arrive): WebP/AVIF, explicit dimensions or `aspect-ratio` (16:11 cells), `loading="lazy"` below fold.
- Lighthouse targets: 90+ performance/accessibility/best-practices on the homepage.

## 9. Sub-pages

Same tokens and components, no new language:
- **Pricing:** single column, borrowing the dual-CTA panel pattern expanded into a two-column comparison grid (hard borders, amber tier eyebrows).
- **Blog:** hard-bordered card grid; post pages are narrow-measure body text (65–75ch) on `--ink`.
- **Legal:** plain narrow-measure text pages.

## 10. Implementation Notes

- **Stack: Astro** (decided). Component reuse of nav/footer/buttons/device-frame across homepage + Pricing/Blog/Legal, a content-collection blog, near-zero shipped JS (the tab switcher is the only interactive island). The approved mockup's HTML/CSS/JS ports directly into Astro components.
- Hosting/domain (osprey.app is already in the app's associated domains) and analytics are external-TODO items, not design decisions.
- The `docs/` folder currently serves GitHub Pages content (`.nojekyll`, `privacy.html`) — the plan must decide where the built site lives relative to that (e.g. Astro `outDir` → `docs/`, or a move to a dedicated deploy).

## 11. Rejected Alternatives (documented so they aren't re-proposed)

- **Antigravity-clone restraint (pill buttons, ivory/charcoal "Slate & Amber"):** fully explored, rendered, and superseded by user choice in favor of brutalism. Its contrast audit work carries forward (token discipline, AA verification).
- **Generic sporty template (energy orange + condensed type):** the database default for "fitness"; rejected — reads like every gym site.
- **Liquid Glass premium:** self-flagged by its own database for performance and contrast; rejected.
- **Hybrid (Slate & Amber + stat strip):** built as `final-preview-v2`; user preferred full brutalism.
- **Acid yellow accent:** the style's canonical color; replaced with copper amber for warmth and brand fit.
