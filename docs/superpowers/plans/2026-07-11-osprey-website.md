# Osprey Marketing Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Osprey marketing website — a flagship homepage plus Pricing/Blog/Legal sub-pages — in Astro, matching the approved warmed-Kinetic-Brutalism design.

**Architecture:** A standalone Astro project in `website/` (sibling to the existing `OSPREY-app/` Expo app). Static output, one small client-side island (the coaching-showcase tab switcher). Shared layout + components (Nav, Footer, Button, Marquee, DeviceFrame) reused across all pages. The only JavaScript logic — the showcase screen data and its HTML rendering — is extracted into a pure, unit-tested module. Deployment is a GitHub Actions workflow that builds `website/` and publishes to GitHub Pages, replacing the current `docs/`-folder Pages serving.

**Tech Stack:** Astro 4.x, TypeScript, vanilla CSS (no framework), Vitest + jsdom (for the one logic module), Space Grotesk via `@fontsource/space-grotesk` (self-hosted, avoids a render-blocking Google Fonts request), Node ≥20.

## Global Constraints

- **Design language:** warmed Kinetic Brutalism — hard edges, exposed 2px `--line` borders, zero `border-radius`, flat solid fills, no shadows/gradients/blur (flat dark gradient allowed only on athlete image placeholders).
- **Color tokens (exact, semantic, never raw hex in components):** `--ink #09090B`, `--panel #101014`, `--line #3F3F46`, `--amber #c8793a`, `--amber-bright #d98b4a`, `--text #FAFAFA`, `--text-soft #c9cbd1`, `--mut #A1A1AA`. Dark-only, no light mode.
- **Type:** Space Grotesk, weights 500 + 700 only. Display = 700 uppercase, `line-height 0.9–0.95`, negative letter-spacing, `clamp()` sizing. Body = 500 sentence case, `line-height 1.5–1.55`. Labels/nav/buttons = 700 uppercase, positive letter-spacing at small sizes. Device metrics use `font-variant-numeric: tabular-nums`.
- **Voice architecture:** display copy shouts (uppercase, aggressive-adjacent); Ozzie's lines inside device frames stay warm/specific. Never swap registers.
- **Accessibility:** all text pairs meet WCAG AA (verified in spec §4); `:focus-visible` = 3px amber outline / 3px offset; interactive targets ≥44px; semantic HTML (`<nav>/<header>/<section>/<footer>`, `<button>` for tabs, single `<h1>`, sequential headings); no color-only meaning (active tab uses fill + `aria-selected`).
- **Motion:** mechanical — transitions 100–150ms; button press `translate(2px,2px)`; no springs/parallax/scroll-reveal. Marquee is the only ambient motion. `prefers-reduced-motion`: freeze marquee, disable smooth-scroll, remove transitions.
- **Performance:** self-hosted fonts with `font-display: swap`; images WebP/AVIF with explicit dimensions / `aspect-ratio`; below-fold images `loading="lazy"`; showcase device-body height fixed across tabs (no CLS); Lighthouse ≥90 on performance/accessibility/best-practices for the homepage.
- **Source of truth for markup/CSS:** `website-mockups/osprey-brutalist-amber.html` (approved). Port from it verbatim unless a step says otherwise.

---

## File Structure

```
website/
  package.json
  astro.config.mjs
  tsconfig.json
  vitest.config.ts
  src/
    styles/
      tokens.css          # :root custom properties (color, and shared)
      global.css          # reset, base body/type, focus, reduced-motion, imports tokens
    layouts/
      Base.astro          # <html><head> (meta, fonts, title/description slots) + <body><slot/>
    components/
      Button.astro        # primary / ghost / small variants
      Nav.astro           # sticky top nav
      Marquee.astro       # amber ticker, aria-hidden
      Footer.astro        # download buttons + wordmark + link columns + legal
      DeviceFrame.astro   # bordered panel shell with top bar + body slot
      StatStrip.astro     # 3-cell stat band
      AthleteCard.astro   # single athlete cell
      DualCta.astro       # two-panel athlete/coach CTA
      Showcase.astro      # tabbed coaching showcase (imports the island script)
    scripts/
      showcase.ts         # SCREENS data + renderScreen(key) — PURE, unit-tested
      showcase.island.ts  # client-side wiring: tab clicks -> renderScreen
    pages/
      index.astro         # homepage (composes all sections)
      pricing.astro
      privacy.astro
      terms.astro
      blog/
        index.astro       # blog listing
        [...slug].astro   # blog post pages
    content/
      config.ts           # blog collection schema
      blog/
        introducing-osprey.md   # one seed post
  tests/
    showcase.test.ts
.github/
  workflows/
    deploy-website.yml
```

**Decision — build output location:** The Astro build output is a CI artifact deployed to GitHub Pages via Actions; it is **not** committed and does **not** go into `docs/`. This avoids clobbering the project markdown and `superpowers/` folders that live in `docs/`. The existing `docs/privacy.html` is superseded by the Astro `/privacy` route (Task 8 carries its content over). Switching Pages to the Actions source is a one-time repo setting noted in Task 10.

---

### Task 1: Scaffold Astro project and design tokens

**Files:**
- Create: `website/package.json`
- Create: `website/astro.config.mjs`
- Create: `website/tsconfig.json`
- Create: `website/src/styles/tokens.css`
- Create: `website/src/styles/global.css`
- Create: `website/src/layouts/Base.astro`
- Create: `website/src/pages/index.astro` (temporary placeholder, replaced in Task 7)

**Interfaces:**
- Produces: `Base.astro` — an Astro layout accepting props `{ title: string; description: string }` and rendering a default `<slot/>`. All pages wrap their content in it.
- Produces: CSS custom properties (all Global-Constraints color tokens) available globally via `global.css`.

- [ ] **Step 1: Create the Astro project files**

`website/package.json`:
```json
{
  "name": "osprey-website",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test": "vitest run"
  },
  "dependencies": {
    "astro": "^4.16.0",
    "@fontsource/space-grotesk": "^5.1.0"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "jsdom": "^25.0.0"
  }
}
```

`website/astro.config.mjs`:
```js
import { defineConfig } from 'astro/config';

// site is the production URL; base is '/' because Pages via Actions serves at the domain root.
export default defineConfig({
  site: 'https://osprey.app',
  build: { format: 'directory' },
});
```

`website/tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro", "src", "tests"],
  "exclude": ["dist"]
}
```

- [ ] **Step 2: Create the design tokens**

`website/src/styles/tokens.css`:
```css
:root {
  --ink: #09090B;
  --panel: #101014;
  --line: #3F3F46;
  --amber: #c8793a;
  --amber-bright: #d98b4a;
  --text: #FAFAFA;
  --text-soft: #c9cbd1;
  --mut: #A1A1AA;

  --border-w: 2px;
  --tap: 44px;
}
```

- [ ] **Step 3: Create global styles**

`website/src/styles/global.css`:
```css
@import './tokens.css';
@import '@fontsource/space-grotesk/500.css';
@import '@fontsource/space-grotesk/700.css';

* { margin: 0; padding: 0; box-sizing: border-box; }

html { scroll-behavior: smooth; }

body {
  background: var(--ink);
  color: var(--text);
  font-family: 'Space Grotesk', system-ui, sans-serif;
  font-weight: 500;
  -webkit-font-smoothing: antialiased;
}

a { color: inherit; text-decoration: none; }

:focus-visible { outline: 3px solid var(--amber); outline-offset: 3px; }

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
}
```

Note: `@fontsource` `.css` files use `font-display: swap` by default and self-host the WOFF2 — this satisfies the font-loading constraint without a Google Fonts network request.

- [ ] **Step 4: Create the Base layout**

`website/src/layouts/Base.astro`:
```astro
---
import '../styles/global.css';
interface Props { title: string; description: string; }
const { title, description } = Astro.props;
---
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content={description} />
  <title>{title}</title>
</head>
<body>
  <slot />
</body>
</html>
```

- [ ] **Step 5: Create a temporary homepage placeholder**

`website/src/pages/index.astro`:
```astro
---
import Base from '../layouts/Base.astro';
---
<Base title="Osprey — Hunt Your Limits" description="One coach across every run, every lift, every meal.">
  <main style="padding:64px 28px"><h1 style="text-transform:uppercase">Osprey</h1></main>
</Base>
```

- [ ] **Step 6: Install and verify the build**

Run (from `website/`): `npm install && npm run build`
Expected: install completes; build prints "Complete!" and writes `website/dist/index.html` with no errors.

- [ ] **Step 7: Verify type-check passes**

Run (from `website/`): `npm run check`
Expected: `0 errors, 0 warnings` (hints are acceptable).

- [ ] **Step 8: Commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
printf '\n# Website build artifacts\nwebsite/dist/\nwebsite/node_modules/\nwebsite/.astro/\n' >> .gitignore
git add .gitignore website/package.json website/package-lock.json website/astro.config.mjs website/tsconfig.json website/src
git commit -m "chore(website): scaffold Astro project with design tokens and base layout"
```

---

### Task 2: Button, Marquee, and Nav components

**Files:**
- Create: `website/src/components/Button.astro`
- Create: `website/src/components/Marquee.astro`
- Create: `website/src/components/Nav.astro`

**Interfaces:**
- Produces: `Button.astro` — props `{ href: string; variant?: 'primary' | 'ghost'; size?: 'default' | 'small' }`, renders an `<a class="btn ...">` with an uppercase `<slot/>` label. Default variant `primary`, default size `default`.
- Produces: `Marquee.astro` — no props; renders an `aria-hidden` amber ticker that loops and freezes under reduced-motion.
- Produces: `Nav.astro` — no props; sticky top nav with logo, link list, and a small primary Button "Download".

- [ ] **Step 1: Create the Button component**

`website/src/components/Button.astro`:
```astro
---
interface Props { href: string; variant?: 'primary' | 'ghost'; size?: 'default' | 'small'; }
const { href, variant = 'primary', size = 'default' } = Astro.props;
---
<a class:list={['btn', variant, size === 'small' && 'small']} href={href}><slot /></a>

<style>
  .btn {
    display: inline-block; cursor: pointer;
    font-family: inherit; font-weight: 700; font-size: 14px;
    padding: 14px 28px; border: var(--border-w) solid var(--amber);
    background: var(--amber); color: #000;
    text-transform: uppercase; letter-spacing: 0.04em;
    transition: background 150ms ease, border-color 150ms ease, transform 100ms ease;
  }
  .btn:hover { background: var(--amber-bright); border-color: var(--amber-bright); }
  .btn:active { transform: translate(2px, 2px); }
  .btn.ghost { background: transparent; color: var(--text); border-color: var(--line); }
  .btn.ghost:hover { background: rgba(255,255,255,0.06); border-color: var(--mut); }
  .btn.small { font-size: 12px; padding: 10px 18px; }
</style>
```

- [ ] **Step 2: Create the Marquee component**

`website/src/components/Marquee.astro`:
```astro
---
const phrase = 'Run harder · Lift heavier · Fuel smarter · ';
const repeated = phrase.repeat(4);
---
<div class="marquee" aria-hidden="true">
  <span class="marquee-inner">{repeated}</span>
</div>

<style>
  .marquee { overflow: hidden; white-space: nowrap; border-bottom: var(--border-w) solid var(--line); padding: 12px 0; }
  .marquee-inner {
    display: inline-block; animation: slide 18s linear infinite;
    font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 3px;
    color: var(--amber);
  }
  @keyframes slide { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  @media (prefers-reduced-motion: reduce) { .marquee-inner { animation: none; } }
</style>
```
Note: the phrase is repeated so the `-50%` keyframe produces a seamless loop (two full copies of content across the animated element).

- [ ] **Step 3: Create the Nav component**

`website/src/components/Nav.astro`:
```astro
---
import Button from './Button.astro';
---
<nav class="nav">
  <a class="logo" href="/">Osprey</a>
  <div class="navlinks">
    <a href="/#coaching">Coaching</a>
    <a href="/#coaches">For Coaches</a>
    <a href="/pricing">Pricing</a>
    <a href="/blog">Blog</a>
  </div>
  <Button href="/#download" size="small">Download</Button>
</nav>

<style>
  .nav {
    position: sticky; top: 0; z-index: 50;
    display: flex; justify-content: space-between; align-items: center;
    padding: 18px 28px; background: var(--ink);
    border-bottom: var(--border-w) solid var(--line);
  }
  .logo { font-weight: 700; font-size: 20px; text-transform: uppercase; letter-spacing: 0.02em; }
  .navlinks { display: flex; gap: 28px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--mut); font-weight: 700; }
  .navlinks a { padding: 8px 4px; transition: color 150ms ease; }
  .navlinks a:hover { color: var(--text); }
  @media (max-width: 760px) { .navlinks { display: none; } }
</style>
```

- [ ] **Step 4: Verify the build still passes**

Run (from `website/`): `npm run build`
Expected: build completes with no errors (components compile even though not yet imported by a page).

- [ ] **Step 5: Commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add website/src/components/Button.astro website/src/components/Marquee.astro website/src/components/Nav.astro
git commit -m "feat(website): add Button, Marquee, and Nav components"
```

---

### Task 3: Footer component

**Files:**
- Create: `website/src/components/Footer.astro`

**Interfaces:**
- Consumes: `Button.astro` from Task 2.
- Produces: `Footer.astro` — no props; renders download buttons, the giant amber wordmark, two link columns, and a legal line.

- [ ] **Step 1: Create the Footer component**

`website/src/components/Footer.astro`:
```astro
---
import Button from './Button.astro';
---
<footer class="footer" id="download">
  <div class="btnrow">
    <Button href="/#download">Download for iOS</Button>
    <Button href="/#download" variant="ghost">Download for Android</Button>
  </div>
  <div class="foot-word">Osprey</div>
  <div class="footlinks">
    <div>
      <a href="/#coaching">Coaching</a>
      <a href="/#coaches">For Coaches</a>
      <a href="/pricing">Pricing</a>
    </div>
    <div>
      <a href="/blog">Blog</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
    </div>
  </div>
  <div class="legal">© 2026 Osprey</div>
</footer>

<style>
  .footer { padding: clamp(48px, 7vw, 88px) 28px 40px; }
  .btnrow { display: flex; gap: 12px; flex-wrap: wrap; }
  .foot-word {
    font-weight: 700; font-size: clamp(72px, 18vw, 240px); line-height: 0.85;
    text-transform: uppercase; letter-spacing: -0.04em; color: var(--amber);
    margin: 48px 0 56px;
  }
  .footlinks { display: flex; gap: 64px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--mut); }
  .footlinks a { display: block; margin-bottom: 12px; transition: color 150ms ease; }
  .footlinks a:hover { color: var(--text); }
  .legal { margin-top: 48px; font-size: 11px; color: #55575e; letter-spacing: 0.06em; text-transform: uppercase; }
  @media (max-width: 760px) { .footlinks { gap: 40px; } }
</style>
```

- [ ] **Step 2: Verify the build**

Run (from `website/`): `npm run build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add website/src/components/Footer.astro
git commit -m "feat(website): add Footer component"
```

---

### Task 4: Showcase logic module (pure, unit-tested)

This is the only real logic in the site, so it gets a genuine TDD cycle. `renderScreen` is pure (string in → HTML string out); the Astro island (Task 6) imports it.

**Files:**
- Create: `website/vitest.config.ts`
- Create: `website/tests/showcase.test.ts`
- Create: `website/src/scripts/showcase.ts`

**Interfaces:**
- Produces: `showcase.ts` exports:
  - `type ScreenKey = 'run' | 'strength' | 'nutrition' | 'coach'`
  - `interface Screen { mode: string; label: string; metric: string; viz: string; coach: string }`
  - `const SCREENS: Record<ScreenKey, Screen>`
  - `function renderScreen(key: ScreenKey): string` — returns the inner HTML for the device body (label + metric + viz + coach line).
- Consumed by: `showcase.island.ts` and `Showcase.astro` in Task 6.

- [ ] **Step 1: Create the Vitest config**

`website/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'jsdom', include: ['tests/**/*.test.ts'] },
});
```

- [ ] **Step 2: Write the failing test**

`website/tests/showcase.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { SCREENS, renderScreen } from '../src/scripts/showcase';

describe('showcase screens', () => {
  it('defines all four tab screens', () => {
    expect(Object.keys(SCREENS).sort()).toEqual(['coach', 'nutrition', 'run', 'strength']);
  });

  it('renderScreen includes the metric and coach line for strength', () => {
    const html = renderScreen('strength');
    expect(html).toContain('185 LB × 8');
    expect(html).toContain('Ozzie');
    expect(html).toContain('rest 90s');
  });

  it('renderScreen output parses to a DOM with a .viz block', () => {
    const el = document.createElement('div');
    el.innerHTML = renderScreen('run');
    expect(el.querySelector('.viz')).not.toBeNull();
    expect(el.querySelector('.dev-metric')?.textContent).toBe('7:42 /MI');
  });

  it('every screen renders label, metric, viz, and coach', () => {
    (['run', 'strength', 'nutrition', 'coach'] as const).forEach((k) => {
      const el = document.createElement('div');
      el.innerHTML = renderScreen(k);
      expect(el.querySelector('.dev-label')).not.toBeNull();
      expect(el.querySelector('.dev-metric')).not.toBeNull();
      expect(el.querySelector('.viz')).not.toBeNull();
      expect(el.querySelector('.coach')).not.toBeNull();
    });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run (from `website/`): `npm test`
Expected: FAIL — cannot resolve `../src/scripts/showcase` (module does not exist yet).

- [ ] **Step 4: Write the implementation**

`website/src/scripts/showcase.ts` (viz strings ported verbatim from the approved mockup):
```ts
export type ScreenKey = 'run' | 'strength' | 'nutrition' | 'coach';

export interface Screen {
  mode: string;
  label: string;
  metric: string;
  viz: string;
  coach: string;
}

export const SCREENS: Record<ScreenKey, Screen> = {
  run: {
    mode: 'Live run',
    label: 'Tempo run · Mile 4 of 6',
    metric: '7:42 /MI',
    viz:
      '<div class="viz"><div class="viz-title">Mile splits</div>' +
      '<div class="splits">' +
      '<div class="split"><div class="fill" style="height:62%"></div><div class="t">8:04</div></div>' +
      '<div class="split"><div class="fill" style="height:70%"></div><div class="t">7:55</div></div>' +
      '<div class="split"><div class="fill" style="height:78%"></div><div class="t">7:48</div></div>' +
      '<div class="split cur"><div class="fill" style="height:84%"></div><div class="t">7:42</div></div>' +
      '<div class="split"><div class="fill" style="height:12%"></div><div class="t">—</div></div>' +
      '<div class="split"><div class="fill" style="height:12%"></div><div class="t">—</div></div>' +
      '</div></div>',
    coach: '<b>Ozzie —</b> Pace is drifting 6s hot on this hill. Ease off, hold effort steady.',
  },
  strength: {
    mode: 'Live session',
    label: 'Upper body · Set 3 of 4',
    metric: '185 LB × 8',
    viz:
      '<div class="viz"><div class="viz-title">Bench press · Working sets</div>' +
      '<div class="sets">' +
      '<div class="set-row"><span class="n">Set 1</span><span class="blocks"><span class="blk done"></span><span class="blk done"></span><span class="blk done"></span><span class="blk done"></span></span><span class="v">185 × 8 ✓</span></div>' +
      '<div class="set-row"><span class="n">Set 2</span><span class="blocks"><span class="blk done"></span><span class="blk done"></span><span class="blk done"></span><span class="blk done"></span></span><span class="v">185 × 8 ✓</span></div>' +
      '<div class="set-row cur"><span class="n">Set 3</span><span class="blocks"><span class="blk done"></span><span class="blk done"></span><span class="blk"></span><span class="blk"></span></span><span class="v">185 × 8</span></div>' +
      '<div class="set-row"><span class="n">Set 4</span><span class="blocks"><span class="blk"></span><span class="blk"></span><span class="blk"></span><span class="blk"></span></span><span class="v">—</span></div>' +
      '</div></div>',
    coach: '<b>Ozzie —</b> Last week you hit 6 at this weight. Good progression, rest 90s.',
  },
  nutrition: {
    mode: 'Fuel log',
    label: 'Today · Post-workout',
    metric: '142G PROTEIN',
    viz:
      '<div class="viz"><div class="viz-title">Daily targets</div>' +
      '<div class="macros">' +
      '<div class="macro"><div class="m-head"><span>Protein</span><span><b>142</b> / 180g</span></div><div class="track"><div class="fill" style="width:79%"></div><div class="target" style="left:100%"></div></div></div>' +
      '<div class="macro"><div class="m-head"><span>Carbs</span><span><b>226</b> / 310g</span></div><div class="track"><div class="fill" style="width:73%"></div><div class="target" style="left:100%"></div></div></div>' +
      '<div class="macro"><div class="m-head"><span>Fat</span><span><b>58</b> / 75g</span></div><div class="track"><div class="fill" style="width:77%"></div><div class="target" style="left:100%"></div></div></div>' +
      '</div></div>',
    coach: '<b>Ozzie —</b> 38g to target. A recovery shake now beats chasing it at dinner.',
  },
  coach: {
    mode: 'Daily brief',
    label: 'Thursday · Race week -10',
    metric: 'DELOAD DAY',
    viz:
      '<div class="viz"><div class="viz-title">This week · 31 of 34 mi</div>' +
      '<div class="week">' +
      '<div class="day done"><div class="box"></div><div class="d">M</div></div>' +
      '<div class="day done"><div class="box"></div><div class="d">T</div></div>' +
      '<div class="day done"><div class="box"></div><div class="d">W</div></div>' +
      '<div class="day today"><div class="box"></div><div class="d">T</div></div>' +
      '<div class="day"><div class="box"></div><div class="d">F</div></div>' +
      '<div class="day"><div class="box"></div><div class="d">S</div></div>' +
      '<div class="day"><div class="box"></div><div class="d">S</div></div>' +
      '</div></div>',
    coach: '<b>Ozzie —</b> Legs logged 31 miles this week. Today we bank recovery — trust the plan.',
  },
};

export function renderScreen(key: ScreenKey): string {
  const s = SCREENS[key];
  return (
    `<div class="dev-label">${s.label}</div>` +
    `<div class="dev-metric">${s.metric}</div>` +
    s.viz +
    `<div class="coach">${s.coach}</div>`
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run (from `website/`): `npm test`
Expected: PASS — all 4 tests green.

- [ ] **Step 6: Commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add website/vitest.config.ts website/tests/showcase.test.ts website/src/scripts/showcase.ts
git commit -m "feat(website): add tested showcase screen data + renderScreen"
```

---

### Task 5: StatStrip, AthleteCard, and DualCta components

**Files:**
- Create: `website/src/components/StatStrip.astro`
- Create: `website/src/components/AthleteCard.astro`
- Create: `website/src/components/DualCta.astro`

**Interfaces:**
- Produces: `StatStrip.astro` — no props; three hard-divided stat cells (values hardcoded per spec §5.4).
- Produces: `AthleteCard.astro` — props `{ tag: string; name: string; blurb: string }`; one bordered athlete cell with a 16:11 placeholder, a 44px play button, and body text.
- Produces: `DualCta.astro` — no props; consumes `Button.astro`; two bordered panels (Free/athletes, Team/coaches).

- [ ] **Step 1: Create the StatStrip component**

`website/src/components/StatStrip.astro`:
```astro
---
const stats = [
  { num: '26.2', lab: 'Miles tracked' },
  { num: '315', lab: 'LB PR logged' },
  { num: '94%', lab: 'Plan adherence' },
];
---
<section class="stats" aria-label="Osprey by the numbers">
  {stats.map((s) => (
    <div class="stat"><div class="num">{s.num}</div><div class="lab">{s.lab}</div></div>
  ))}
</section>

<style>
  .stats { display: flex; border-bottom: var(--border-w) solid var(--line); font-variant-numeric: tabular-nums; }
  .stat { flex: 1; padding: clamp(28px, 4vw, 52px) 28px; border-right: var(--border-w) solid var(--line); }
  .stat:last-child { border-right: none; }
  .num { font-weight: 700; font-size: clamp(40px, 6vw, 72px); color: var(--amber); letter-spacing: -0.03em; line-height: 1; }
  .lab { font-size: 11px; text-transform: uppercase; letter-spacing: 2.5px; color: var(--mut); margin-top: 12px; }
  @media (max-width: 760px) {
    .stats { flex-direction: column; }
    .stat { border-right: none; border-bottom: var(--border-w) solid var(--line); }
    .stat:last-child { border-bottom: none; }
  }
</style>
```

- [ ] **Step 2: Create the AthleteCard component**

`website/src/components/AthleteCard.astro`:
```astro
---
interface Props { tag: string; name: string; blurb: string; }
const { tag, name, blurb } = Astro.props;
---
<div class="ath">
  <div class="ath-img">
    <span>{tag}</span>
    <span class="play" role="button" tabindex="0" aria-label={`Play ${name}'s story`}>▶</span>
  </div>
  <div class="ath-body"><b>{name}</b><p>{blurb}</p></div>
</div>

<style>
  .ath { flex: 1; border-right: var(--border-w) solid var(--line); }
  .ath:last-child { border-right: none; }
  .ath-img {
    aspect-ratio: 16 / 11; background: linear-gradient(150deg, #2c2f36, #101014);
    display: flex; align-items: flex-end; justify-content: space-between; padding: 18px;
    font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  }
  .ath-img .play {
    border: var(--border-w) solid var(--text); width: var(--tap); height: var(--tap);
    display: flex; align-items: center; justify-content: center; font-size: 13px; cursor: pointer;
    transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
  }
  .ath-img .play:hover { background: var(--amber); border-color: var(--amber); color: #000; }
  .ath-body { padding: 20px 18px; border-top: var(--border-w) solid var(--line); }
  .ath-body b { display: block; font-size: 15px; text-transform: uppercase; margin-bottom: 6px; }
  .ath-body p { font-size: 13px; color: var(--mut); line-height: 1.5; }
  @media (max-width: 760px) {
    .ath { border-right: none; border-bottom: var(--border-w) solid var(--line); }
    .ath:last-child { border-bottom: none; }
  }
</style>
```
Note: play buttons are placeholders for future video; they carry an accessible label now and become real triggers when athlete videos are sourced (out of scope per spec).

- [ ] **Step 3: Create the DualCta component**

`website/src/components/DualCta.astro`:
```astro
---
import Button from './Button.astro';
---
<section class="split" id="coaches">
  <div class="splitcard">
    <div class="eyebrow">Free</div>
    <h3>For athletes</h3>
    <p>Full coaching, running, strength &amp; nutrition tracking. No paywall on effort.</p>
    <Button href="/#download">Download</Button>
  </div>
  <div class="splitcard">
    <div class="eyebrow">Team plan</div>
    <h3>For coaches &amp; clubs</h3>
    <p>Every athlete's training, one command view.</p>
    <Button href="/pricing" variant="ghost">Talk to us</Button>
  </div>
</section>

<style>
  .split { display: flex; border-bottom: var(--border-w) solid var(--line); }
  .splitcard { flex: 1; padding: clamp(40px, 6vw, 64px) 32px; border-right: var(--border-w) solid var(--line); }
  .splitcard:last-child { border-right: none; }
  .eyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: 2.5px; color: var(--amber); font-weight: 700; margin-bottom: 14px; }
  h3 { font-size: clamp(24px, 3vw, 34px); text-transform: uppercase; letter-spacing: -0.01em; margin-bottom: 12px; }
  p { font-size: 14px; color: var(--mut); margin-bottom: 28px; line-height: 1.55; max-width: 320px; }
  @media (max-width: 760px) {
    .split { flex-direction: column; }
    .splitcard { border-right: none; border-bottom: var(--border-w) solid var(--line); }
    .splitcard:last-child { border-bottom: none; }
  }
</style>
```

- [ ] **Step 4: Verify the build**

Run (from `website/`): `npm run build`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add website/src/components/StatStrip.astro website/src/components/AthleteCard.astro website/src/components/DualCta.astro
git commit -m "feat(website): add StatStrip, AthleteCard, and DualCta components"
```

---

### Task 6: Showcase component with the tab island

**Files:**
- Create: `website/src/scripts/showcase.island.ts`
- Create: `website/src/components/Showcase.astro`

**Interfaces:**
- Consumes: `SCREENS`, `renderScreen`, `ScreenKey` from `showcase.ts` (Task 4).
- Produces: `Showcase.astro` — no props; the `#coaching` section: h2, 4-button tab bar, and a `DeviceFrame`-style panel whose body is populated/swapped by the island. Initial (SSR) body = `renderScreen('strength')` so there is content before hydration and no CLS.

- [ ] **Step 1: Create the client island script**

`website/src/scripts/showcase.island.ts`:
```ts
import { renderScreen, type ScreenKey } from './showcase';

const KEYS: ScreenKey[] = ['run', 'strength', 'nutrition', 'coach'];

export function initShowcase(root: ParentNode = document): void {
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('.tab'));
  const body = root.querySelector<HTMLElement>('#device-body');
  const mode = root.querySelector<HTMLElement>('#device-mode');
  if (!tabs.length || !body || !mode) return;

  function select(key: ScreenKey): void {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === key)));
    body!.innerHTML = renderScreen(key);
    // update the top-bar mode label from the newly rendered screen's data attribute
    const label = body!.querySelector<HTMLElement>('[data-mode]')?.dataset.mode;
    if (label) mode!.textContent = label;
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const key = tab.dataset.tab as ScreenKey;
      if (KEYS.includes(key)) select(key);
    });
  });
}

initShowcase();
```
Note: `renderScreen` is extended below to embed the `mode` label so the island reads it from the DOM (keeping `renderScreen` the single source of per-screen strings). Add the mode carrier to `renderScreen` in Step 2.

- [ ] **Step 2: Extend `renderScreen` to carry the mode label, and update the test**

In `website/src/scripts/showcase.ts`, change the `renderScreen` return to prepend a hidden mode carrier:
```ts
export function renderScreen(key: ScreenKey): string {
  const s = SCREENS[key];
  return (
    `<span data-mode="${s.mode}" hidden></span>` +
    `<div class="dev-label">${s.label}</div>` +
    `<div class="dev-metric">${s.metric}</div>` +
    s.viz +
    `<div class="coach">${s.coach}</div>`
  );
}
```

Append this test to `website/tests/showcase.test.ts` inside the `describe` block:
```ts
  it('renderScreen embeds the mode label as a data attribute', () => {
    const el = document.createElement('div');
    el.innerHTML = renderScreen('coach');
    expect(el.querySelector('[data-mode]')?.getAttribute('data-mode')).toBe('Daily brief');
  });
```

- [ ] **Step 3: Run tests to verify they pass**

Run (from `website/`): `npm test`
Expected: PASS — all 5 tests green (the existing 4 still pass because the mode carrier is a hidden span that does not affect their assertions).

- [ ] **Step 4: Create the Showcase component**

`website/src/components/Showcase.astro`:
```astro
---
import { renderScreen, SCREENS } from '../scripts/showcase';
const initial = renderScreen('strength');
const initialMode = SCREENS.strength.mode;
---
<section id="coaching">
  <div class="secthead"><h2>One coach.<br /><span class="amber">Every session.</span></h2></div>

  <div class="tabs" role="tablist" aria-label="Coaching surfaces">
    <button class="tab" role="tab" aria-selected="false" data-tab="run">Run</button>
    <button class="tab" role="tab" aria-selected="true" data-tab="strength">Strength</button>
    <button class="tab" role="tab" aria-selected="false" data-tab="nutrition">Nutrition</button>
    <button class="tab" role="tab" aria-selected="false" data-tab="coach">Coach</button>
  </div>

  <div class="device-zone">
    <div class="device">
      <div class="device-bar"><span>Osprey</span><span id="device-mode">{initialMode}</span></div>
      <div class="device-body" id="device-body" set:html={initial}></div>
    </div>
  </div>
</section>

<script>
  import '../scripts/showcase.island.ts';
</script>

<style>
  .secthead { padding: clamp(48px, 7vw, 96px) 28px 0; }
  h2 { font-weight: 700; font-size: clamp(40px, 7vw, 88px); line-height: 0.95; text-transform: uppercase; letter-spacing: -0.015em; }
  .amber { color: var(--amber); }

  .tabs { display: flex; border-top: var(--border-w) solid var(--line); border-bottom: var(--border-w) solid var(--line); margin-top: clamp(28px, 4vw, 48px); }
  .tab {
    flex: 1; text-align: center; cursor: pointer; padding: 18px 8px;
    font-family: inherit; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em;
    color: var(--mut); background: transparent; border: none; border-right: var(--border-w) solid var(--line);
    transition: color 150ms ease, background 150ms ease;
  }
  .tab:last-child { border-right: none; }
  .tab:hover { color: var(--text); }
  .tab[aria-selected='true'] { background: var(--amber); color: #000; }

  .device-zone { padding: clamp(40px, 6vw, 72px) 28px; border-bottom: var(--border-w) solid var(--line); display: flex; justify-content: center; }
  .device { width: 100%; max-width: 560px; border: var(--border-w) solid var(--line); background: var(--panel); font-variant-numeric: tabular-nums; }
  .device-bar { display: flex; justify-content: space-between; padding: 12px 16px; border-bottom: var(--border-w) solid var(--line); font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: var(--mut); }
  .device-body { padding: 32px 24px; min-height: 410px; }

  :global(.dev-label) { font-size: 12px; color: var(--mut); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px; }
  :global(.dev-metric) { font-size: clamp(40px, 6vw, 56px); font-weight: 700; letter-spacing: -0.02em; margin-bottom: 24px; }
  :global(.coach) { border-top: var(--border-w) solid var(--line); padding-top: 20px; font-size: 14.5px; color: var(--text-soft); line-height: 1.55; }
  :global(.coach b) { color: var(--amber); text-transform: uppercase; }

  :global(.viz) { margin-bottom: 24px; }
  :global(.viz-title) { font-size: 10px; text-transform: uppercase; letter-spacing: 2px; color: var(--mut); margin-bottom: 12px; }
  :global(.splits) { display: flex; align-items: flex-end; gap: 6px; height: 96px; }
  :global(.split) { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; height: 100%; }
  :global(.split .fill) { background: #2c2f36; }
  :global(.split.cur .fill) { background: var(--amber); }
  :global(.split .t) { font-size: 9px; color: var(--mut); text-align: center; margin-top: 6px; letter-spacing: 0.5px; }
  :global(.split.cur .t) { color: var(--amber); font-weight: 700; }
  :global(.sets) { display: flex; flex-direction: column; gap: 8px; }
  :global(.set-row) { display: flex; align-items: center; gap: 12px; font-size: 13px; }
  :global(.set-row .n) { width: 44px; color: var(--mut); font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; }
  :global(.set-row .blocks) { display: flex; gap: 3px; flex: 1; }
  :global(.set-row .blk) { height: 14px; flex: 1; background: #2c2f36; }
  :global(.set-row .blk.done) { background: var(--amber); }
  :global(.set-row .v) { width: 86px; text-align: right; color: var(--mut); font-size: 12px; }
  :global(.set-row.cur .v) { color: var(--text); font-weight: 700; }
  :global(.macros) { display: flex; flex-direction: column; gap: 14px; }
  :global(.macro .m-head) { display: flex; justify-content: space-between; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: var(--mut); margin-bottom: 6px; }
  :global(.macro .m-head b) { color: var(--text); }
  :global(.macro .track) { height: 14px; background: #2c2f36; position: relative; }
  :global(.macro .fill) { height: 100%; background: var(--amber); }
  :global(.macro .target) { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--text); }
  :global(.week) { display: flex; gap: 6px; }
  :global(.day) { flex: 1; text-align: center; }
  :global(.day .box) { height: 44px; background: #2c2f36; border: var(--border-w) solid transparent; }
  :global(.day.done .box) { background: var(--amber); }
  :global(.day.today .box) { background: transparent; border-color: var(--amber); }
  :global(.day .d) { font-size: 9px; color: var(--mut); margin-top: 6px; letter-spacing: 1px; }
  :global(.day.today .d) { color: var(--amber); font-weight: 700; }
</style>
```
Note: viz styles are `:global` because `renderScreen` injects that markup at runtime, so Astro's scoped-class hashing would not otherwise reach it. The `min-height: 410px` on `.device-body` is the CLS-safe fixed height verified in the mockup (tallest tab = nutrition at 410px).

- [ ] **Step 5: Verify the build**

Run (from `website/`): `npm run build`
Expected: no errors; `dist/` contains a hashed JS chunk for the island.

- [ ] **Step 6: Commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add website/src/scripts/showcase.ts website/src/scripts/showcase.island.ts website/src/components/Showcase.astro website/tests/showcase.test.ts
git commit -m "feat(website): add coaching showcase with tab island"
```

---

### Task 7: Assemble the homepage

**Files:**
- Modify: `website/src/pages/index.astro` (replace the Task 1 placeholder)

**Interfaces:**
- Consumes: `Base`, `Nav`, `Marquee`, `Footer`, `StatStrip`, `AthleteCard`, `DualCta`, `Showcase` from prior tasks.

- [ ] **Step 1: Write the homepage**

`website/src/pages/index.astro`:
```astro
---
import Base from '../layouts/Base.astro';
import Nav from '../components/Nav.astro';
import Marquee from '../components/Marquee.astro';
import Showcase from '../components/Showcase.astro';
import StatStrip from '../components/StatStrip.astro';
import AthleteCard from '../components/AthleteCard.astro';
import DualCta from '../components/DualCta.astro';
import Footer from '../components/Footer.astro';
import Button from '../components/Button.astro';

const athletes = [
  { tag: 'First marathon', name: 'Dana R.', blurb: 'Training for her first marathon, 14 weeks out.' },
  { tag: 'Comeback season', name: 'Marcus T.', blurb: 'Rebuilding strength after an injury layoff.' },
  { tag: 'Trail season', name: 'Priya K.', blurb: '50K trail race, altitude and nutrition dialed in.' },
];
---
<Base title="Osprey — Hunt Your Limits" description="One coach across every run, every lift, every meal — an eye that never drifts.">
  <Nav />
  <Marquee />

  <header class="hero">
    <h1>Hunt<br />your<br /><span class="amber">Limits</span></h1>
    <p>GPS runs. Heavy lifts. Macros logged. One coach across all of it — an eye that never drifts.</p>
    <div class="btnrow">
      <Button href="/#download">Get the app</Button>
      <Button href="/#coaching" variant="ghost">Watch the film</Button>
    </div>
  </header>

  <StatStrip />
  <Showcase />

  <section>
    <div class="secthead"><h2>Mid-<span class="amber">pursuit</span></h2></div>
    <div class="athletes">
      {athletes.map((a) => <AthleteCard tag={a.tag} name={a.name} blurb={a.blurb} />)}
    </div>
  </section>

  <DualCta />
  <Footer />
</Base>

<style>
  .hero { padding: clamp(64px, 10vw, 128px) 28px clamp(48px, 7vw, 96px); border-bottom: var(--border-w) solid var(--line); }
  h1 { font-weight: 700; font-size: clamp(64px, 13vw, 160px); line-height: 0.9; text-transform: uppercase; letter-spacing: -0.02em; margin-bottom: 32px; }
  .amber { color: var(--amber); }
  .hero p { font-size: clamp(15px, 1.6vw, 19px); color: var(--mut); max-width: 460px; margin-bottom: 40px; line-height: 1.55; }
  .btnrow { display: flex; gap: 12px; flex-wrap: wrap; }
  .secthead { padding: clamp(48px, 7vw, 96px) 28px 0; }
  .secthead h2 { font-weight: 700; font-size: clamp(40px, 7vw, 88px); line-height: 0.95; text-transform: uppercase; letter-spacing: -0.015em; }
  .athletes { display: flex; border-bottom: var(--border-w) solid var(--line); margin-top: clamp(28px, 4vw, 48px); }
  @media (max-width: 760px) { .athletes { flex-direction: column; } }
</style>
```

- [ ] **Step 2: Build and verify the DOM in the browser**

Run (from `website/`): `npm run build && npm run preview`
Then, using the browser tools, load the preview URL (Astro prints it, typically `http://localhost:4321/`) and verify:
- `document.querySelector('h1').textContent` contains `Hunt`, `your`, `Limits`.
- Four `.tab` buttons exist; clicking each swaps `#device-body` content (run → `7:42 /MI`, nutrition → `142G PROTEIN`, etc.).
- Measuring `#device-body` `offsetHeight` after each tab click returns the same value (410) — no layout shift.

Expected: all checks pass.

- [ ] **Step 3: Commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add website/src/pages/index.astro
git commit -m "feat(website): assemble homepage from section components"
```

---

### Task 8: Legal pages (Privacy, Terms) and a shared inner-page layout

**Files:**
- Create: `website/src/layouts/Page.astro`
- Create: `website/src/pages/privacy.astro`
- Create: `website/src/pages/terms.astro`

**Interfaces:**
- Consumes: `Base`, `Nav`, `Footer`.
- Produces: `Page.astro` — props `{ title: string; description: string }`; wraps `Nav` + a narrow-measure `<main class="prose">` `<slot/>` + `Footer`. Reused by legal pages (and available to Pricing/Blog).

- [ ] **Step 1: Create the shared inner-page layout**

`website/src/layouts/Page.astro`:
```astro
---
import Base from './Base.astro';
import Nav from '../components/Nav.astro';
import Footer from '../components/Footer.astro';
interface Props { title: string; description: string; }
const { title, description } = Astro.props;
---
<Base title={title} description={description}>
  <Nav />
  <main class="prose"><slot /></main>
  <Footer />
</Base>

<style>
  .prose { max-width: 68ch; margin: 0 auto; padding: clamp(48px, 8vw, 96px) 28px; }
  .prose :global(h1) { font-weight: 700; font-size: clamp(36px, 6vw, 64px); text-transform: uppercase; letter-spacing: -0.015em; line-height: 0.95; margin-bottom: 32px; }
  .prose :global(h2) { font-weight: 700; font-size: 22px; text-transform: uppercase; letter-spacing: 0.02em; margin: 40px 0 12px; }
  .prose :global(p) { font-size: 16px; line-height: 1.6; color: var(--text-soft); margin-bottom: 16px; }
  .prose :global(a) { color: var(--amber); text-decoration: underline; }
  .prose :global(ul) { margin: 0 0 16px 20px; color: var(--text-soft); line-height: 1.6; }
</style>
```

- [ ] **Step 2: Port the existing privacy content into an Astro page**

First read the current content: `cat "/Users/gusjohnson/App Development/Osprey/docs/privacy.html"` and copy its human-readable body text.

`website/src/pages/privacy.astro`:
```astro
---
import Page from '../layouts/Page.astro';
---
<Page title="Privacy — Osprey" description="How Osprey handles your data.">
  <h1>Privacy</h1>
  <!-- Paste the body copy from docs/privacy.html here as <h2>/<p>/<ul> blocks,
       styled by .prose. Preserve every substantive clause verbatim; only
       re-tag HTML structure to match the prose styles above. -->
</Page>
```
This is the one place where verbatim source text must be carried across rather than invented — do not paraphrase legal copy.

- [ ] **Step 3: Create the Terms page**

`website/src/pages/terms.astro`:
```astro
---
import Page from '../layouts/Page.astro';
---
<Page title="Terms — Osprey" description="Terms of use for Osprey.">
  <h1>Terms</h1>
  <p>These terms govern your use of the Osprey app and website. By downloading or using Osprey, you agree to them.</p>
  <h2>Use of the app</h2>
  <p>Osprey provides training guidance for informational purposes and is not a substitute for professional medical advice. Consult a physician before beginning any exercise program.</p>
  <h2>Accounts</h2>
  <p>You are responsible for activity under your account and for keeping your credentials secure.</p>
  <h2>Contact</h2>
  <p>Questions about these terms? Reach us at <a href="mailto:hello@osprey.app">hello@osprey.app</a>.</p>
</Page>
```
Note: this is placeholder terms copy to ship a complete page; flag to the user that final legal review is needed before launch (tracked as an external-TODO, out of design scope).

- [ ] **Step 4: Build and verify**

Run (from `website/`): `npm run build`
Then confirm `dist/privacy/index.html` and `dist/terms/index.html` exist and contain the nav + footer.
Expected: both pages build; internal links (`/privacy`, `/terms`) resolve from the footer.

- [ ] **Step 5: Commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add website/src/layouts/Page.astro website/src/pages/privacy.astro website/src/pages/terms.astro
git commit -m "feat(website): add Page layout and Privacy/Terms pages"
```

---

### Task 9: Pricing page and Blog collection

**Files:**
- Create: `website/src/pages/pricing.astro`
- Create: `website/src/content/config.ts`
- Create: `website/src/content/blog/introducing-osprey.md`
- Create: `website/src/pages/blog/index.astro`
- Create: `website/src/pages/blog/[...slug].astro`

**Interfaces:**
- Consumes: `Page` layout, `Button`, `Nav`, `Footer`.
- Produces: a blog content collection named `blog` with schema `{ title: string; date: Date; category: string; description: string }`.

- [ ] **Step 1: Create the Pricing page**

`website/src/pages/pricing.astro`:
```astro
---
import Page from '../layouts/Page.astro';
import Button from '../components/Button.astro';
const tiers = [
  { eyebrow: 'Free', name: 'Athletes', price: '$0', line: 'Everything an individual needs.',
    features: ['GPS run tracking + route maps', 'Strength logging with progression', 'Nutrition & macro tracking', 'Ozzie AI coaching'], cta: 'Download', href: '/#download', variant: 'primary' as const },
  { eyebrow: 'Team plan', name: 'Coaches & clubs', price: "Let's talk", line: 'Manage every athlete from one view.',
    features: ['Everything in Free, per athlete', 'Roster & training dashboard', 'Assign plans and races', 'Team challenges & reporting'], cta: 'Talk to us', href: 'mailto:hello@osprey.app', variant: 'ghost' as const },
];
---
<Page title="Pricing — Osprey" description="Free for athletes. A team plan for coaches and clubs.">
  <h1>Pricing</h1>
  <div class="tiers">
    {tiers.map((t) => (
      <div class="tier">
        <div class="eyebrow">{t.eyebrow}</div>
        <div class="name">{t.name}</div>
        <div class="price">{t.price}</div>
        <p class="line">{t.line}</p>
        <ul>{t.features.map((f) => <li>{f}</li>)}</ul>
        <Button href={t.href} variant={t.variant}>{t.cta}</Button>
      </div>
    ))}
  </div>
</Page>

<style>
  .tiers { display: flex; border: var(--border-w) solid var(--line); margin-top: 24px; }
  .tier { flex: 1; padding: 32px 28px; border-right: var(--border-w) solid var(--line); }
  .tier:last-child { border-right: none; }
  .eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 2.5px; color: var(--amber); font-weight: 700; margin-bottom: 12px; }
  .name { font-size: 22px; font-weight: 700; text-transform: uppercase; }
  .price { font-size: clamp(36px, 5vw, 56px); font-weight: 700; color: var(--amber); letter-spacing: -0.02em; margin: 8px 0 12px; }
  .line { color: var(--mut); font-size: 14px; margin-bottom: 20px; }
  ul { list-style: none; margin: 0 0 28px; padding: 0; }
  li { font-size: 14px; color: var(--text-soft); padding: 8px 0; border-top: var(--border-w) solid var(--line); }
  @media (max-width: 760px) {
    .tiers { flex-direction: column; }
    .tier { border-right: none; border-bottom: var(--border-w) solid var(--line); }
    .tier:last-child { border-bottom: none; }
  }
</style>
```
Note: `.prose` `max-width: 68ch` from `Page` constrains the tier grid narrower than the homepage's full-bleed sections — acceptable for a pricing page; if it feels cramped in review, wrap the tiers in a `<div style="max-width:none">` override. Decide during Task 11 visual review.

- [ ] **Step 2: Create the blog collection schema**

`website/src/content/config.ts`:
```ts
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.string(),
    description: z.string(),
  }),
});

export const collections = { blog };
```

- [ ] **Step 3: Create a seed blog post**

`website/src/content/blog/introducing-osprey.md`:
```md
---
title: Introducing Osprey
date: 2026-07-11
category: Product
description: One coach across every run, every lift, every meal.
---

Osprey is a single coach for the whole athlete — running, strength, and nutrition,
read together the way a good coach reads them. No more stitching three apps into one
training plan.

## Why one coach

Effort does not live in silos. A hard track session changes what your lifting day
should look like, and both change what you need to eat. Osprey's coach, Ozzie, sees
all of it and adjusts — so the plan in front of you is always the whole picture.

Download Osprey and hunt your limits.
```

- [ ] **Step 4: Create the blog listing page**

`website/src/pages/blog/index.astro`:
```astro
---
import Page from '../../layouts/Page.astro';
import { getCollection } from 'astro:content';
const posts = (await getCollection('blog')).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
---
<Page title="Blog — Osprey" description="Product news and training thinking from Osprey.">
  <h1>Blog</h1>
  <ul class="posts">
    {posts.map((p) => (
      <li>
        <a href={`/blog/${p.slug}`}>
          <div class="meta">{fmt(p.data.date)} · {p.data.category}</div>
          <div class="title">{p.data.title}</div>
          <p class="desc">{p.data.description}</p>
        </a>
      </li>
    ))}
  </ul>
</Page>

<style>
  .posts { list-style: none; margin: 24px 0 0; padding: 0; border-top: var(--border-w) solid var(--line); }
  .posts li { border-bottom: var(--border-w) solid var(--line); }
  .posts a { display: block; padding: 24px 0; }
  .meta { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: var(--mut); margin-bottom: 8px; }
  .title { font-size: 24px; font-weight: 700; text-transform: uppercase; letter-spacing: -0.01em; }
  .title:hover { color: var(--amber); }
  .desc { font-size: 14px; color: var(--mut); margin-top: 8px; }
</style>
```

- [ ] **Step 5: Create the blog post page**

`website/src/pages/blog/[...slug].astro`:
```astro
---
import Page from '../../layouts/Page.astro';
import { getCollection, type CollectionEntry } from 'astro:content';

export async function getStaticPaths() {
  const posts = await getCollection('blog');
  return posts.map((post) => ({ params: { slug: post.slug }, props: { post } }));
}

type Props = { post: CollectionEntry<'blog'> };
const { post } = Astro.props;
const { Content } = await post.render();
const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
---
<Page title={`${post.data.title} — Osprey`} description={post.data.description}>
  <div class="meta">{fmt(post.data.date)} · {post.data.category}</div>
  <h1>{post.data.title}</h1>
  <Content />
</Page>

<style>
  .meta { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: var(--mut); margin-bottom: 16px; }
</style>
```

- [ ] **Step 6: Build and verify**

Run (from `website/`): `npm run build && npm run check`
Expected: build emits `dist/pricing/index.html`, `dist/blog/index.html`, and `dist/blog/introducing-osprey/index.html`; `check` reports 0 errors.

- [ ] **Step 7: Commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add website/src/pages/pricing.astro website/src/content website/src/pages/blog
git commit -m "feat(website): add Pricing page and Blog content collection"
```

---

### Task 10: Deploy workflow (GitHub Pages via Actions)

**Files:**
- Create: `.github/workflows/deploy-website.yml`

**Interfaces:**
- Produces: a CI workflow that builds `website/` and deploys `website/dist/` to GitHub Pages on push to `main`.

- [ ] **Step 1: Create the deploy workflow**

`.github/workflows/deploy-website.yml`:
```yaml
name: Deploy website

on:
  push:
    branches: [main]
    paths: ['website/**', '.github/workflows/deploy-website.yml']
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: website
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: website/package-lock.json
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: website/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Document the one-time repo setting**

The workflow requires the repository's Pages source to be **GitHub Actions** (Settings → Pages → Build and deployment → Source → "GitHub Actions"), replacing the current "Deploy from a branch → /docs" setting. This is a manual dashboard change the repo owner must make once; the agent cannot do it. Add a note to `website/README.md`:

`website/README.md`:
```md
# Osprey Website

Astro marketing site. Local dev: `npm install && npm run dev`.

## Deployment
Auto-deploys to GitHub Pages via `.github/workflows/deploy-website.yml` on push to `main`.

**One-time setup:** In GitHub → Settings → Pages, set Source to "GitHub Actions"
(this replaces the old "Deploy from a branch /docs" setting). The legacy
`docs/privacy.html` is superseded by the `/privacy` route.
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add .github/workflows/deploy-website.yml website/README.md
git commit -m "ci(website): add GitHub Pages deploy workflow"
```

---

### Task 11: Accessibility, responsive, and Lighthouse verification pass

**Files:**
- Modify: any component file where a check below fails (fixes applied inline).

**Interfaces:** none (verification task).

- [ ] **Step 1: Build and serve**

Run (from `website/`): `npm run build && npm run preview`
Note the preview URL.

- [ ] **Step 2: Verify reduced-motion**

Using the browser tools, load the preview with an emulated `prefers-reduced-motion: reduce` and confirm the marquee is not translating (computed `animation-name` is `none` on `.marquee-inner`).
Expected: marquee frozen. If not, fix the media query in `Marquee.astro`.

- [ ] **Step 3: Verify focus states and keyboard nav**

Tab through the homepage. Confirm every interactive element (nav links, buttons, tabs, athlete play buttons) shows the 3px amber focus outline, and tab order matches visual order.
Expected: all reachable and visibly focused. Fix any element missing `:focus-visible` (should inherit from global, but custom `role="button"` spans must be keyboard-activatable — if the athlete play buttons need Enter/Space handlers to be truly operable, either add them in `AthleteCard.astro` or downgrade to non-interactive until video exists; note the decision).

- [ ] **Step 4: Verify no horizontal scroll at 375px**

Resize the viewport to 375×812 and confirm `document.documentElement.scrollWidth <= 375` and all sections stack single-column.
Expected: no horizontal overflow. Fix any offending fixed width.

- [ ] **Step 5: Verify tab CLS**

At desktop width, click through all four showcase tabs measuring `#device-body` `offsetHeight` each time.
Expected: identical height (410) on every tab.

- [ ] **Step 6: Run Lighthouse**

Run a Lighthouse audit (via the browser devtools tooling or `npx lighthouse <preview-url> --only-categories=performance,accessibility,best-practices --quiet --chrome-flags="--headless"`) against the homepage.
Expected: performance ≥90, accessibility ≥90, best-practices ≥90. Address any failing audit (common: add `width`/`height` to future images, ensure sufficient contrast — already verified in spec, ensure `lang` on `<html>` — already present).

- [ ] **Step 7: Commit any fixes**

```bash
cd "/Users/gusjohnson/App Development/Osprey"
git add -A website
git commit -m "fix(website): accessibility, responsive, and Lighthouse pass" || echo "no fixes needed"
```

---

## Self-Review

**Spec coverage** (spec section → task):
- §3 design language / §4 tokens → Task 1 (tokens/global), applied in every component.
- §5.1 nav → Task 2. §5.2 marquee → Task 2. §5.3 hero → Task 7. §5.4 stat strip → Task 5. §5.5 showcase + data-viz → Tasks 4 + 6. §5.6 athletes → Tasks 5 + 7. §5.7 dual CTA → Task 5. §5.8 footer → Task 3.
- §6 components → Tasks 2, 3, 5, 6 (Button, Nav, Marquee, Footer, DeviceFrame-as-Showcase, StatStrip, AthleteCard, DualCta).
- §7 motion → global.css reduced-motion (Task 1), Marquee (Task 2), button press (Task 2), verified in Task 11.
- §8 a11y/perf → Task 1 (focus, fonts), semantic HTML throughout, verified in Task 11.
- §9 sub-pages → Task 8 (Legal) + Task 9 (Pricing, Blog).
- §10 stack/deploy/docs question → Task 1 (Astro scaffold) + Task 10 (deploy, docs/ resolution).
- §11 rejected alternatives → no build work (documentation only).

No uncovered spec requirements.

**Placeholder scan:** The only intentional "paste content here" is Task 8 Step 2 (privacy legal copy) — deliberate, because legal text must be carried verbatim from `docs/privacy.html`, not invented. Terms copy is flagged as placeholder pending legal review (external-TODO). No other placeholders.

**Type consistency:** `ScreenKey`, `Screen`, `SCREENS`, `renderScreen` are defined in Task 4 and consumed with matching signatures in Task 6 (`showcase.island.ts`, `Showcase.astro`). `renderScreen` is extended in Task 6 Step 2 with the test updated in the same step. `Button` prop names (`href`, `variant`, `size`) are consistent across Tasks 2, 3, 5, 7, 9. `AthleteCard` props (`tag`, `name`, `blurb`) match between Task 5 definition and Task 7 usage. Blog collection name `blog` and schema fields (`title`, `date`, `category`, `description`) match between Task 9 config, the seed post frontmatter, and the listing/post pages.
