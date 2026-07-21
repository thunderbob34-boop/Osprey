# Hybrid benchmark (hybrd.com) — what the mobile app still doesn't deliver

Audit dimension: gaps between the hybrid-trainer-experience benchmark findings and OSPREY's shipped mobile surfaces.
Read in full: `~/.claude/skills/hybrid-trainer-experience/` (SKILL.md, benchmark/audit-checklist.md, benchmark/product-recommendations.md, sources/hybrd-app-experience.md, sources/hybrd-blog-and-positioning.md) + `~/.claude/skills/hyrox-trainer-experience/benchmark/structural-gaps.md`.
Code examined: `OSPREY-app/app/(tabs)/index.tsx`, `(tabs)/stats.tsx`, `src/screens/DailySummary.tsx`, `app/ask-ozzie.tsx`, `app/workout/recap.tsx`, `src/services/daily-summary.ts`, `src/services/performance.ts`, `src/services/workouts.ts`, `src/services/healthkit.ts`, `(tabs)/settings.tsx`, `supabase/functions/ozzie-daily-brief/template.ts`, `supabase/functions/ozzie-generate-plan/index.ts` + `validate.ts`, `webapp/src/routes/_authed/index.tsx`.

Standing rule from `structural-gaps.md`: hybrd wins today mostly because it is *shipped* (G1–G5). Everything below is the in-product remainder — what would still be missing even after launch.

---

## F-H1 (Critical) — Ozzie is the app's face, but the coach conversation is a dead surface

**Now:** The Home header's Ask Ozzie avatar is commented out (`app/(tabs)/index.tsx:141-144` — "Ask Ozzie hidden until OpenAI billing is on"). The screen it pointed to, `app/ask-ozzie.tsx`, is now fully orphaned (no other route pushes to it — verified by grep) and its own copy admits the gap: "Two-way conversations with Ozzie aren't live yet" (lines 35-38). Server-side, `audit-checklist.md` row 1 confirms `ozzie-chat` is architecturally **read-only**: it builds prompt context from `users`/`training_sessions`/`workout_logs` but has *no tool-calling layer and no write path to `training_sessions`*.

**Benchmark:** HYBRD Brain is the competitor's single core differentiator — "The AI coach that can take action on your training plan" — with two screenshot-verified examples of natural-language requests producing scoped plan edits plus explicit confirmations ("I updated your lifts to be bodyweight… I left your runs as is"; "Done! Swapped all 4 runs to bike rides") (`sources/hybrd-app-experience.md`). Ozzie's mascot meanwhile appears on Home (session note), recap (debrief), and Ask Ozzie — the brand promises a coach the product can't hold a conversation with.

**Key leverage:** OSPREY *already ships the mutation primitives* HYBRD Brain fronts — `swapSession`, `compressSession`, `moveIndoors` (`useDailySummary`, wired in `index.tsx:76-116`) and deload accept (`usePlanDeload`). REC-001's "narrow, confirm-gated mutation" is mostly intent-parsing plumbing over existing mutations, not new plan logic.

**Target:** Either (a) remove/park the orphaned ask-ozzie screen until chat ships so no dead copy is reachable, or (b) ship REC-001: chat re-enabled with one mutation type (session-type swap over a date range) behind a confirm step, reusing the existing mutation functions, with HYBRD-style "here's exactly what I changed" confirmation. **Effort: M** (blocked on the known OpenAI billing decision; the deterministic fallback could even do keyword-level "swap my runs this week" without an LLM).

## F-H2 (Important) — Heart-rate data is captured everywhere and rendered nowhere

**Now:** The app stores `avg_heart_rate` per workout and `heart_rate` per GPS track point (`src/services/workouts.ts:181,199,336,358,443`), and can read live HR from the Watch mid-workout (`healthkit.ts:130 fetchLatestHeartRateBpm`). Yet no screen renders any of it: the workout recap (`app/workout/recap.tsx`) shows splits/exercises/duration only; Stats' only line chart is CTL/ATL (`stats.tsx:81-126`); zones exist as *static prescriptions* (`ZonesCard`, `useDisplayZones`) never overlaid on actual efforts.

**Benchmark:** hybrd's screenshot-verified dashboard shows a **live HR-over-session line chart with zone gridlines (190/171/129/120 bpm)**, a per-activity "Show Load" toggle, and "Total Intensity" % per workout — on one screen (`sources/hybrd-app-experience.md`, dashboard section). Their content leans on zone training throughout (LTHR-based zone posts).

**Target:** Post-workout HR trace with the athlete's own zone bands shaded (data: `workout_track_points`; zones: `useDisplayZones`) + a time-in-zone bar on the recap; later, the same chart on a session detail from Stats' Recent Workouts list. **Effort: M** — pure rendering, all inputs exist.

## F-H3 (Important) — No cardio/strength split; load is a single duration-based axis that flattens lifting

**Now:** Every workout collapses to `tss ?? estimateTss(total_duration_s)` regardless of modality (`src/services/performance.ts:257-260`) — an hour of heavy squats and an hour of easy jogging score identically. Stats' stacked volume chart colors hours by sport (`stats.tsx:162-190`) but nothing anywhere expresses the *cardio-vs-strength balance* — the identity metric of a hybrid athlete. Lift volume (kg moved, `useLiftAnalytics`) exists but lives in its own card, never fused into load.

**Benchmark:** hybrd's dashboard headline widget is the **Cardio/Strength split bar** (98%/2% observed); their `did-i-even-work-out` post attacks rivals that "score only cardiovascular strain" and claims muscular + neurological load quantification — plausibly the engine behind their "agentic adaptations" claim (`sources/hybrd-blog-and-positioning.md`).

**Target:** (S) A cardio/strength weekly split tile on Home or atop Stats — derivable today by bucketing `session_type` hours (lift/hyrox-strength vs run/bike/swim/row). (M) A muscular-load axis fed by `weekVolumeKg`/sets so ATL/CTL isn't blind to strength stress. **Effort: S then M.**

## F-H4 (Important) — The app's stated wedge (concurrent training) has zero visible interference intelligence

**Now:** `grep -ri interference` across `OSPREY-app/src`, `app/`, `webapp/src` → only hit is a citation line in `docs/coaching/hyrox.md:146`. The entire engine-side treatment is one prompt sentence — "not two hard days back-to-back" (`supabase/functions/ozzie-generate-plan/index.ts:41`, plus beginner guidance line 54); `validate.ts` validates pace bands, never hard-day adjacency. No screen shows weekly cardio hours vs a threshold, day-separation quality, or lift-vs-run sequencing guidance.

**Benchmark:** hybrd *publishes* the ruleset — interference bites above **6h cardio/week**, **one day's separation ≈ negligible**, a full separation ladder (back-to-back = moderate impairment · 2h = low · 6h+ = significant drop · non-consecutive = none), "hardest legs work and hardest cardio never share a day," lift-before-run sequencing — but "never explains how the app implements any of this" (`sources/hybrd-blog-and-positioning.md`). That unclaimed automation is exactly the opening OSPREY's own 2026-07-16 audit scoped as "Interference Radar" (`audit-checklist.md` row 4).

**Target:** Make interference management *visible*: (1) a plan-preview/calendar badge when a hard lift and hard run land same-day or adjacent, with the day-separation rationale in plain copy; (2) a weekly cardio-hours meter against the 6h threshold on Stats; (3) hard-day-adjacency check in `validate.ts` so generated plans provably obey the prompt rule. **Effort: M** — this is OSPREY's clearest chance to out-product the competitor on their own published physiology.

## F-H5 (Important) — Daily brief narrates but never acts; hybrd's exact adaptation scenarios (travel, illness) have no path in the app

**Now:** The brief is a $0 deterministic template (`ozzie-daily-brief/template.ts`) whose voice is genuinely good, but it is prose-only — its weather note is "Sky check: …" with no link to the move-indoors mutation that already exists one card lower. The Adjust sheet's full option space is swap-to run/lift/cross/rest + compress 15/20/30min (`src/screens/DailySummary.tsx:414-486`). There is **no "traveling / no equipment" option** (HYBRD's example 1: lifts → bodyweight for a hotel room) and **no illness flow** (their pillar copy: "Feeling sick? HYBRD Brain automatically adjusts").

**Now (credit where due):** OSPREY already does proactive adjustment cards — DeloadSuggestionCard accept/dismiss and WeatherCoachCard move-indoors (`index.tsx:150-172`) — which `audit-checklist.md` row 3 rates as *exceeding* hybrd's standing-brief story. The gap is coverage (travel/sickness) and connective tissue (brief text ↔ actions).

**Target:** (a) Add a "No equipment (traveling)" swap that converts today's/this week's lifts to bodyweight variants, and a "Feeling sick" action that downgrades to rest/easy + reschedules — both are new options over the existing swap machinery; (b) let the brief's contextual note carry the matching action chip (weather note → Move indoors; fatigue trend → Accept deload). **Effort: M.**

## F-H6 (Important) — Recovery scores HRV on absolute population cutoffs; benchmark rule is baseline-relative modulation

**Now:** `src/services/healthkit.ts:101-107` — self-described "v1 scoring": +10 if HRV > 60ms, −15 if < 30ms, sleep adders, then a coarse train/easy/rest cut at 65/40. No personal baseline, no trend, despite `recovery_scores` storing `hrv_ms` daily (so a rolling baseline is already computable from data on hand).

**Benchmark:** hybrd's `why-is-my-hrv-so-high` is explicitly against universal numbers: baseline + 7-14 day trend beat daily readings; **10-20% below baseline → cut volume 20-30% while holding intensity; 20%+ below → easy only**; "data informs decisions; it does not make them for you" (`sources/hybrd-blog-and-positioning.md`). Their modulation is *graded* (volume vs intensity), OSPREY's is a 3-way gate.

**Target:** Baseline-relative HRV (rolling 14d median from `recovery_scores`), and a fourth recommendation tier ("reduce volume, hold intensity") the brief and session card can act on — which also feeds F-H5's adaptation copy. **Effort: M.**

## F-H7 (Important, mostly S) — Integrations: the story is "17+ platforms" vs an unlabeled Apple Health toggle

**Now:** The only integration surface is the Apple Health connect/sync row in `(tabs)/settings.tsx` (HealthKit-only; grep for strava/garmin/whoop across both apps hits only code comments). The comments themselves note the real capability — imports cover "Apple Watch, Garmin, any HealthKit-writing app" (`healthkit-import.ts:4,39`) — but the UI never says so; Android has nothing.

**Benchmark:** Integrations are hybrd's #1 comparison row against Runna ("survey + real performance data from 17+ platforms"; devices row: Garmin, WHOOP, Strava, Apple Health, Wahoo, 17+), and open data is a strategic plank ("Terra API as the Plaid of fitness") (`sources/hybrd-blog-and-positioning.md`; SKILL.md line 10 flags this as the axis hybrd is "further ahead" on).

**Target:** Near-term (S): market the capability that already exists — label the Health connection "Works with Apple Watch, Garmin, WHOOP, and any app that writes to Apple Health," and show the workout's original source app on imported activities. Long-term (L): a Terra-style aggregator or direct Strava/Garmin OAuth for Android parity and richer streams — a launch-scale decision, not a screen fix.

## F-H8 (Idea) — Nine publishable sport blueprints sit internal while the competitor's content IS its coaching credibility

**Now:** In-app education is limited to per-session "Why this session?" reasoning (`DailySummary.tsx:295-318`). The 9-sport blueprint corpus (`docs/coaching/`, per-CLAUDE.md the copy-voice source of truth) reaches users only as generated session notes. `structural-gaps.md` G3: public athlete-facing pages — hybrd 26, OSPREY 1.

**Benchmark:** hybrd's active, founder-bylined blog doubles as their programming documentation (frequency ladders, 3/4/5-day splits, Z2 and LTHR guides) and directly feeds their credibility loop (`sources/hybrd-app-experience.md` blog section — explicitly contrasted with hyroxlab's stale blog).

**Target:** An in-app "Coaching guide" surface per sport rendering condensed blueprint sections (philosophy/zones/key sessions/red flags) — same corpus, athlete-facing; also the raw material for the website's G3 fix. **Effort: M.**

---

## What OSPREY already matches or beats (so the revamp doesn't rebuild it)

- **One-screen load fusion, different metrics** — Home fuses Body Battery, TSB/CTL readiness, session, nutrition, hydration, week volume (`audit-checklist.md` row 2: "Matches conceptually"); webapp adds the 12-week CTL/ATL trend (REC-002, shipped).
- **Proactive daily brief** — architecture *exceeds* hybrd's reactive-only story (row 3); it's the content personalization that's cost-parked.
- **Deload discipline** — hybrd publishes **no deload frequency at all**; `docs/coaching/_index.md`'s 3:1 rule + the shipped DeloadSuggestionCard beat their model outright.
- **Weather-aware coaching** — WeatherCoachCard + move-indoors + evening look-ahead notification has no equivalent in any hybrd source captured.
