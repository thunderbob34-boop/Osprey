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
3. **Structured swim/bike sessions** — plan generator emits `interval_prescription` for swim/bike days ("8×50m hard / 20s rest", "4×5min @ threshold"); endurance screen renders the interval ladder with per-interval countdown and Ozzie audio cues (audio pipeline already exists).
4. **Triathlon & multisport plans** — plan-generator prompt already schedules run/lift/swim/bike in one week; add goal options "Sprint Tri / Olympic Tri / First Multisport" in preferences + race-target flow, brick-session support (bike→run same session), and open-water swim notes.
5. **In-run structured guidance** — surface today's interval targets during GPS runs (current pace vs. target band), with Ozzie cueing splits.
6. **Plate calculator + PR detection in lift logger** — tap a weight to see plate math; celebrate volume/e1RM PRs at Finish (recap already computes `isPr` — surface it mid-session).

## 📝 Log — 6/10 → 9/10

1. **Adaptive nutrition loop (the MacroFactor killer)** — weekly job: compare 14-day weight trend + logged intake vs. goal, adjust calorie/macro targets, and have Ozzie *announce* the change in plain English ("You're down 1.4 lb this week — faster than we planned. Adding 120 cal to rest days."). New edge function + `nutrition_target_adjustments` table.
2. ✅ *(prereq shipped earlier)* Inline validation, barcode scanner with manual fallback/torch/haptics.
3. ✅ **Hydration logging** — shared HydrationCard shown at the top of Log, same table/RPC as Home.
4. **Meal templates & recents** — one-tap re-log of frequent meals; "copy yesterday."
5. **Training-day macro periodization surfaced in Log** — show today's target type (training vs. rest day) at the top of the food section, not just on Home.

## 📊 Stats (+ Races / Challenges / Calendar) — 6/10 → 9/10

1. **Lift analytics** — volume per muscle group per week, e1RM trend per lift, PR history. Data already exists in `exercise_sets`; this is pure client work. Closes the Hevy-analytics gap.
2. **Per-sport volume breakdown** — weekly hours/miles split across run/bike/swim/lift (stacked bars) instead of run-only mileage.
3. **HealthKit workout import** — read workouts recorded on Apple Watch/Garmin (they all sync to HealthKit) into `workout_logs` with dedup; fixes the load/recovery math for anyone who records on their wrist. *Biggest data-integrity item in the app.*
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

1. `supabase db push --linked` → applies migrations **016** (delete account), **017** (lift prescriptions), **018** (hydration log), **019** (expanded exercise library).
2. `supabase functions deploy ozzie-daily-brief` → weather-aware briefs.
3. `supabase functions deploy ozzie-generate-plan` → lift prescriptions in new plans (existing plans keep working; prescriptions appear on next plan generation).
4. Supabase dashboard → Auth → enable Apple + Google providers; add `osprey://auth-callback` redirect.
5. App Store Connect → add subscription metadata (blocks production review).
6. Note: Open-Meteo is keyless and free for non-commercial use; before charging users at scale, swap `src/services/weather.ts` to Apple WeatherKit REST (free 500k calls/day with the dev account) — it's a one-file change.
