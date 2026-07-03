# OSPREY Roadmap — Every Tab to 9/10

Goal: one app that replaces Hevy + MacroFactor/MFP + Runna/NRC + Strava + Bodybuilding.com + SensAI + AllTrails for a hybrid athlete — with a coach that feels human and reacts to the athlete's *world* (weather, schedule, life), not just their body.

Work each numbered list top-down. Items marked ✅ shipped on Jul 2, 2026.

---

## 🏠 Home (Today) — 7/10 → 9/10

1. ✅ **Weather Coach engine** — Open-Meteo forecast + heat lead-up hydration alerts (48h early), best outdoor window today, indoor/shade swap advice, rain/cold guidance. Card on Home; forecast summary feeds the Ozzie daily brief prompt.
2. ✅ **Heat-aware plan actions** — WeatherCoachCard shows "Move today's session indoors" whenever `suggestIndoor` is true; marks the session description (Treadmill/Trainer/Indoor) without changing the training stimulus, and the card shows a "Moved indoors ✓" state once done.
3. ✅ **Hydration tracker** — `hydration_log` table + `log_hydration()` RPC (atomic increment, no read-then-write race), quick-add chips (+8/+16/+24 oz) on Home (emphasized during heat alerts) and in Log.
4. **Schedule assistant v2** — read tomorrow's calendar events (permission already granted for blocking); if the usual training window collides with a meeting, Ozzie suggests a new window in the evening brief.
5. **Streak/consistency reframing** — Ozzie comments on week-over-week consistency in the brief (data already in quickStats).

## 🏋️ Workout — 5/10 → 9/10

1. ✅ **Ozzie writes the lifts** — plan generator now emits structured `lift_prescription` (exercise/sets/reps/coach cues, constrained to the exercise library); lift screen preloads the prescribed workout with "OZZIE'S PLAN" header and per-exercise cues.
2. ✅ **Expand the exercise library seed** — grew from 12 to ~100 movements across every muscle group and equipment type (barbell/dumbbell/machine/cable/bodyweight/kettlebell). Plan-generator allow-list expanded to explicit Push/Pull/Lower splits (7 exercises each) instead of 9 generic names.
3. ✅ **Structured swim/bike sessions** — plan generator emits `interval_prescription` for swim/bike days ("8×50m hard / 20s rest", "4×5min @ threshold"); endurance screen renders a live interval ladder — countdown for duration-based work/rest, "Mark Complete" for distance-based reps — with an Ozzie voice cue at every transition, and auto-fills total distance when the set finishes.
4. ✅ **Triathlon & multisport plans** — new "🏊 Triathlon / Multisport" goal in Preferences with a race-distance picker (Sprint/Olympic/Half/Full); plan generator now balances swim/bike/run/lift day counts as hard targets (not hybrid's default split), schedules brick sessions every 1-2 weeks, scales session length to distance, and treats sprint+beginner as "intro to multisport" (completion-over-pace coaching). New `triathlon` value on `primary_goal_enum`. Also fixed a pre-existing bug where the Include Swim/Bike toggles in Preferences did nothing server-side.
5. **In-run structured guidance** — surface today's interval targets during GPS runs (current pace vs. target band), with Ozzie cueing splits.
6. **Plate calculator + PR detection in lift logger** — tap a weight to see plate math; celebrate volume/e1RM PRs at Finish (recap already computes `isPr` — surface it mid-session).

## 📝 Log — 6/10 → 9/10

1. ✅ **Adaptive nutrition loop (the MacroFactor killer)** — turned out `ozzie-nutrition-coach` already did the hard part (28-day weight trend, goal-aware calorie adjustment, daily recompute, Ozzie explaining *why* in the tip) but **Home's macro card was 100% hardcoded** (240P/265C/80F/2740cal every day, ignoring goal/trend entirely) while Log showed the real adaptive numbers — the two tabs disagreed. Fixed: `MacroTargetCard` now calls `useNutritionCoaching()` (same cached query as Log) and shows the real target + Ozzie's tip everywhere.
2. ✅ *(prereq shipped earlier)* Inline validation, barcode scanner with manual fallback/torch/haptics.
3. ✅ **Hydration logging** — shared HydrationCard shown at the top of Log, same table/RPC as Home.
4. **Meal templates & recents** — one-tap re-log of frequent meals; "copy yesterday."
5. **Training-day macro periodization surfaced in Log** — show today's target type (training vs. rest day) at the top of the food section, not just on Home.

## 📊 Stats (+ Races / Challenges / Calendar) — 6/10 → 9/10

1. ✅ **Lift analytics** — this-week volume (lbs) + top muscle groups worked, an e1RM trend sparkline for the athlete's most-logged lift (Epley formula), and a top-5 PR list by estimated 1RM. All client-side aggregation over existing `exercise_sets` data.
2. **Per-sport volume breakdown** — weekly hours/miles split across run/bike/swim/lift (stacked bars) instead of run-only mileage.
3. ✅ **HealthKit workout import** — reads Apple Watch/Garmin (via HealthKit) workouts into `workout_logs` using `getAnchoredWorkouts`, mapping activity names to session types, filtering out OSPREY's own written-back workouts by bundle id, and upserting on a new `(user_id, external_id)` unique index so repeat syncs never duplicate. Runs whenever the user taps "Sync Now" / connects Health in Settings.
4. **Race predictor across distances for tri** — once tri plans exist, extend predictor to swim/bike splits.
5. **Saved routes with tags** — user saves favorite routes ("shaded", "trail", "indoor track"); WeatherCoach recommends from *their own* routes on hot/rainy days. This is the pragmatic AllTrails substitute.
6. **Challenges: more types** — lift-volume and streak challenges, not just mileage/duration/count.

## ⚙️ Settings — 7/10 → 9/10 *(post today's fixes)*

1. ✅ Delete Account (compliance), Health persistence, paywall routing, native switches, version footer.
2. **Privacy Policy + Support links** in-app (URLs already live).
3. **Units toggle** (imperial/metric — schema already has `units` column, UI doesn't expose it).
4. **Notification preferences granularity** — separate toggles for nudge / supplement / race-week reminders.
5. **Data export** — email me my data as CSV (pairs with account deletion for trust).

## 🤝 Cross-cutting "feels human" work

1. ✅ Weather context in the daily brief (coach checked the sky before you woke up).
2. **Coach memory** — persist notable events (missed week, PR, race result, injury flag) into a `coach_memory` table the brief prompt reads ("Last month you PR'd this lift — let's see where it is today").
3. **Evening look-ahead brief** — optional 8pm notification: tomorrow's session + weather window + fueling note.
4. **Post-workout voice debrief** — Ozzie reacts to the session you just logged (recap text already exists; add voice + reference to plan intent).

---

## Ops checklist (do these for today's features to go live)

1. `supabase db push --linked` → applies migrations **016**-**022**: delete account, lift prescriptions, hydration log, expanded exercise library, interval prescriptions, `triathlon` goal enum value, workout-import source/external_id columns.
2. `supabase functions deploy ozzie-daily-brief` → weather-aware briefs.
3. `supabase functions deploy ozzie-generate-plan` → lift/interval prescriptions and triathlon plans in new plans (existing plans keep working; new fields appear on next plan generation).
4. Supabase dashboard → Auth → enable Apple + Google providers; add `osprey://auth-callback` redirect.
5. App Store Connect → add subscription metadata (blocks production review).
6. Note: Open-Meteo is keyless and free for non-commercial use; before charging users at scale, swap `src/services/weather.ts` to Apple WeatherKit REST (free 500k calls/day with the dev account) — it's a one-file change.
7. HealthKit workout import needs the `Workout` **read** permission (added to `PERMISSIONS` in `healthkit.ts`) — existing users who already granted Health access will be re-prompted for this scope the next time `requestHealthKitAuthorization()` runs.
