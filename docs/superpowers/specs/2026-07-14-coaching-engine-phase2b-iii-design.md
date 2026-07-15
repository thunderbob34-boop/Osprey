# Coaching-Engine Phase 2b-iii — HR-Fallback Zones — Design Spec

> Created 2026-07-14. Adds a universal, HR-based zone system to the coaching envelope so cross-training cardio (for
> pace-sport athletes) and primary cardio (for weight_loss / general_fitness athletes, who today get NO zone
> guidance) are structured by heart-rate. Read the Phase 2 spec (§2–§6) and the 2b-ii/2a specs alongside.

## 1. Why this exists

After 2a/2b-i/2b-ii, `computeEnvelope` produces pace `zones` only when `blueprintSport(primary_goal)` resolves to
run/swim/rowing. For **weight_loss** and **general_fitness** it returns `null` — yet those goals default to
run-primary in the edge-fn day-split (2b-i), so their plans DO contain cardio sessions, generated with zero zone
guidance. And even a runner's **cross-training** cardio (bike/swim days that aren't their primary sport) has no
structure. Heart rate is the one anchor we always have (every session logs `max_heart_rate`), so it's the natural
universal fallback.

**Decisions locked in brainstorming:**
- **Universal secondary, not a primary fallback.** HR zones are a **separate envelope field that coexists with
  `zones`** — a runner keeps run pace zones AND gets HR zones for cross-training; a weight_loss/general athlete has
  `zones = null` and HR zones carry their primary cardio. (This is a deliberate divergence from Phase 2 spec §5,
  which modeled `hr` as a `ZoneSet` *variant*; the coexisting-field model is cleaner — see §2.)
- **Max HR = observed, sanity-bounded, with a conservative default.** Not a percentile.
- **Prompt-only.** HR is measured after a session, so it never clamps a prescription.

## 2. The model: a separate `hrZones` field (why not a `ZoneSet` variant)

`CoachingEnvelope` gains a field parallel to `zones`:

```ts
export interface CoachingEnvelope {
  // …existing…
  zones: ZoneSet | null;          // primary-sport PACE anchor (run/swim/rowing), pace-clamped. null for non-pace goals.
  hrZones: HrZoneInfo | null;     // NEW — universal HR bands for cross-training / non-pace cardio, prompt-only.
}

export interface HrZoneInfo {
  maxHR: number;
  source: 'observed' | 'estimated';   // 'estimated' = the conservative default fired (low confidence)
  bands: HRZones;                      // = UltraHRZones (see §6)
}
```

Why a separate field rather than `{ kind: 'hr' }` in the `ZoneSet` union:
- The two systems **coexist** (pace for the primary sport, HR for everything else) — a discriminated union can only
  be one kind at a time.
- **`validate.ts` stays completely unchanged.** The pace-clamp dispatches on `zones.kind` (run/swim/rowing) and only
  ever clamps sessions whose `session_type` is in `KIND_TYPE`; `bike`/`cross` cardio was never clamped. Because
  `hrZones` is not a `zones.kind`, the clamp can't see it, so HR guidance can never accidentally clamp a session.
  (A `ZoneSet` variant would have forced a no-clamp guard into `validate.ts`.)

## 3. Max-HR resolution

`computeEnvelope` resolves a working max HR:
1. **Observed** — `input.maxHR` = the max `max_heart_rate` across the athlete's recent `workout_logs` (any session
   type). Accepted only if **physiologically plausible (120–220 bpm)** — this rejects a single spurious sensor
   spike or a zero.
2. **Estimated** — otherwise a conservative default (**190 bpm**), flagged `source: 'estimated'`. There is no DOB in
   the schema, so no `220 − age`; the flat default is the honest last resort (Phase 2 spec §4).

`hrZones` is populated **universally** (we always have at least the default). The prompt applies it only to
cardio/cross-training sessions, so a pure-strength (`lift`) plan simply never references it — no special-casing.

## 4. App wiring (`computeEnvelope` + `build-envelope`)

- **`EnvelopeInput`** gains `maxHR: number | null`.
- **`computeEnvelope`** always sets `hrZones = { maxHR: resolved, source, bands: ultraHRZones(resolved) }` (§3), on
  top of its existing `zones` logic (unchanged). Regression guard: existing `zones` output is byte-identical; `hrZones` is
  purely additive.
- **`build-envelope`** adds a query for the max observed `max_heart_rate` across recent `workout_logs` (windowed like
  the existing run/rowing queries, but across all session types), and threads it into `EnvelopeInput.maxHR`. Absent →
  `null` → the default fires.

## 5. Edge-fn wiring (`index.ts` only — `validate.ts` untouched)

- **`Envelope` interface** (`index.ts`) gains the `hrZones` mirror (hand-narrowed copy, like the `zones` mirror).
- **Prompt** — build an `hrGuidance` string from `envelope.hrZones` and append it to `envelopeGuidance`:
  *"HR zones (from your observed max HR ~Xbpm / a conservative estimate): easy/cross-training cardio Z2
  {z2.min}–{z2.max} bpm, one harder Z4 session {z4.min}–{z4.max} bpm."* Add a `PLAN_SYSTEM_PROMPT` rule: apply the
  pace zones to the primary-sport sessions and the HR zones to cross-training / easy-cardio (`bike`/`cross`/`swim`
  cross-days) — and, when there are no pace zones (weight_loss/general), structure the cardio sessions by HR zone.
  When `source: 'estimated'`, phrase the zones as approximate.
- **`validate.ts`: no change** (§2). Polarization + fuel already apply to all sessions regardless of kind.

## 6. `HRZones` type & calculator
Reuse the existing, tested `ultraHRZones(maxHR): UltraHRZones` (`calculators/ultra.ts` — the "ultra" name is
legacy; the math is generic %-max-HR: Z1 ≤70%, Z2 70–80%, Z3 80–87%, Z4 87–92%, Z5 92%+). Add
`export type HRZones = UltraHRZones` (a semantic type alias) and call the existing `ultraHRZones(maxHR)` directly
for the bands — no function re-alias (avoids colliding with the `hrZones` envelope field), no forking the math. The
edge-fn mirror copies the band fields it uses (z2Endurance, z4Threshold).

## 7. Testing (TDD)
- App (Jest): `computeEnvelope` populates `hrZones` from a plausible observed max; falls to the 190 default (source
  `estimated`) when `maxHR` is null / out of 120–220; `zones` output unchanged when `hrZones` is added (regression
  guard) for a run and a weight_loss goal; the `hrZones(maxHR)` alias equals `ultraHRZones(maxHR)`.
- Edge fn (Deno): the prompt's `hrGuidance` string is built from `hrZones` (extract it to a pure helper and pin the
  bpm output); `validate.ts` suite stays **green and unchanged** (proof the HR field doesn't perturb clamping).
- Existing 136 Jest + Deno suites stay green; `no-restricted-syntax` lint clean.

## 8. Deploy
**App + edge fn** (`index.ts`) — this slice changes the envelope contract (new `hrZones` field) and the prompt, so
the app build and `ozzie-generate-plan` deploy together, joining the go-live redeploy coupling already recorded for
2a/2b-i in `docs/DEPLOY-CHECKLIST.md`. `validate.ts` is untouched. No migration.

## 9. Risks & open questions
- **HR-zone precision is inherently coarse** — a flat 190 default (no age) and observed-max noise. Flagged
  `source: 'estimated'`/approximate in the prompt; a real pace/power anchor always beats it. Acceptable — HR is the
  fallback, not the preferred signal.
- **Two zone systems in one prompt** could confuse the LLM into pace-clamping cross-training or HR-guiding the
  primary sport. Mitigate with an explicit prompt rule (§5: pace → primary sport, HR → cross-training/cardio) and
  keep the guidance concise.
- **`hrZones` populated even for pure lifters** — unused (no cardio sessions reference it), harmless, avoids
  special-casing. If it ever adds prompt noise, gate population on "plan has cardio," but not this phase.
- **Open:** should the observed max come from a longer window than the 8-week run/rowing window (HR maxima are
  stabler than recent fitness)? Lean: reuse the existing window for simplicity; revisit if zones read stale.

## 10. Out of scope
Cycling power/FTP + triathlon composite + fuel-per-day-type (2c); per-session HR-zone *analysis* of completed
workouts (a dashboard concern); age/DOB-based max-HR; HRV/recovery integration; a webapp HR-zone display; changing
the LLM.
