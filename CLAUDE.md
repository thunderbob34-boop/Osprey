# OSPREY — Project Context for Claude Code

OSPREY is an endurance & strength coaching app. Its core feature is an "Expert Coach" engine that turns four onboarding answers into a personalized, periodized training + nutrition plan for a chosen sport.

## Coaching logic lives in `docs/coaching/`

**Before implementing or changing any plan-generation, training-zone, fueling, or taper logic, read `docs/coaching/`.** It is the source of truth for the coaching domain — the app's plan output must match these blueprints.

- Start with [`docs/coaching/_index.md`](docs/coaching/_index.md) — the shared 4-input engine, the cross-sport principles, each sport's training anchor, and the calculator formulas worth coding directly.
- Then read the specific sport file(s) relevant to the task: `ultra.md`, `running.md`, `cycling.md`, `swimming.md`, `rowing.md`, `triathlon.md`, `powerlifting.md`, `hyrox.md`, `crossfit.md`.

Every sport blueprint follows the same 10-section structure (onboarding → philosophy/zones → key sessions → technique → strength → nutrition → race prep → taper → red flags → athlete profiles), so a shared plan-generation schema can drive all sports with per-sport zone and fuel parameters swapped in.

## Repo layout

- `OSPREY-app/` — the application code (React Native / Expo).
- `webapp/` — authenticated web companion app (Vite/React, see `webapp/README.md` and `docs/superpowers/specs/2026-07-12-osprey-webapp-phase1-design.md`).
- `website/` — the Astro marketing site.
- `docs/` — project docs, including `docs/coaching/` (this coaching content).

## Key conventions

- Sample plans in the blueprints are illustrative intermediate athletes; the app generates the real plan from the user's actual onboarding numbers.
- User-visible coaching copy should stay athlete-facing and plain-language, matching the blueprint voice.
