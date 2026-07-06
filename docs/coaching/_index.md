# OSPREY Coaching Blueprints — Index

This folder holds the athlete-facing coaching logic for every OSPREY sport. Each blueprint is the source of truth for how the "Expert Coach" engine turns onboarding answers into a personalized, periodized training plan. Use these when implementing plan-generation, zone math, fueling calculators, and taper logic in the app.

## The shared engine (every sport)

All sports use the **same 4-input onboarding → plan** engine:

1. **Experience & current load** → starting volume, progression rate, technique-vs-fitness emphasis
2. **Goal event & demands** → energy-system mix, race-specific sessions, taper length
3. **Timeline to peak** → macrocycle structure (Base / Build / Peak / Taper)
4. **Constraints & injury history** → weekly session count, strength design, load caps & red flags

Shared principles across all blueprints:

- **Polarized/pyramidal intensity** (~80% easy / ~20% hard), polarizing toward the event.
- **3:1 loading** — three build weeks, one recovery week; progress load ≤ ~10%/week.
- **A per-sport threshold anchor** that sets all training zones and is re-tested every 4–8 weeks.
- **Taper** — cut volume while keeping intensity/sharpness.
- **Fueling** — daily carbs periodized 3–12 g/kg/day by load; protein ~1.6–2.2 g/kg/day; hydration to thirst with sodium; hyponatremia guard <135 mmol/L.
- **Red flags** — stop/modify on bone, tendon, joint or systemic warning signs.

## Per-sport files & their training anchor

| File | Sport | Threshold anchor (drives zones) | Key calculator |
|---|---|---|---|
| [ultra.md](ultra.md) | Ultramarathon (50k–100mi+) | Effort/RPE + HR (terrain scrambles pace) | Fuel & hydration (60–120 g/hr) |
| [running.md](running.md) | Road running (5K/10K/Half/Marathon) | Daniels threshold (T) pace ≈ 1-hr race pace | Pace zones (E/M/T/I/R offsets from T) + fuel |
| [cycling.md](cycling.md) | Road / criterium | FTP (functional threshold power) | Coggan 7 power zones + fuel |
| [swimming.md](swimming.md) | Pool racing (50–1650 + IM) | CSS = (400 TT s − 200 TT s) ÷ 2 | CSS/pace calculator + fuel |
| [rowing.md](rowing.md) | 2K on-water (single/crew) | 2k split /500m | Split→watts zones + fuel |
| [triathlon.md](triathlon.md) | Sprint → Ironman | 3 anchors: swim CSS, bike FTP, run threshold | Per-sport zones + "fuel the bike" |
| [powerlifting.md](powerlifting.md) | Squat/Bench/Deadlift | %1RM + RPE/RIR (autoregulated) | Prilepin volume + attempt selector (opener ~89–91%) |
| [hyrox.md](hyrox.md) | 8 run + 8 station race | Run threshold pace (+15–30 s/km compromised) | Compromised-split pacing predictor |
| [crossfit.md](crossfit.md) | Constantly varied HIFT | %1RM/RPE + benchmark WOD times | Energy-system zones by time domain |

## Calculator formulas worth coding directly

- **Swim CSS (per 100):** `(t400_sec − t200_sec) / 2`
- **Triathlon:** same CSS for swim; FTP = ~95% of 20-min max power; run LTHR = avg HR of last 20 min of a 30-min TT.
- **Running (Daniels offsets from T):** M = T + 15–30 s/mi; HMP = T + 5–15 s/mi; 10K = T − 5 to −15 s/mi; 5K = T − 20 to −30 s/mi; I ≈ T − 10 to −20 s/mi.
- **Powerlifting attempts (from goal 3rd):** opener ≈ 89–91%, second ≈ 95–96%, third ≈ 100–102%; jumps squat/DL 5–7.5%, bench 3–5%.
- **Fuel (endurance):** carbs/hr scale with duration/intensity (30 → 120 g/hr); sodium ~800 mg per litre of sweat; fluid ~500–1000 mL/hr by heat/size.

## Notes for implementation

- Sample plans in the blueprints are **illustrative intermediate athletes**; the app should generate the actual plan from the user's real onboarding numbers.
- Voice is athlete-facing and plain-language. Keep that tone in any user-visible strings generated from this logic.
- Each blueprint has the same 10-section structure, so a single plan-generation schema can be shared across sports with per-sport zone/fuel parameters swapped in.
