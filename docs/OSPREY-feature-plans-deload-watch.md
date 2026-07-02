# OSPREY Feature Plans: Trend-Based De-Load & Apple Watch Bridge

*Written 2026-07-02, following the nightly audit on branch `fable-audit-2026-07-02`. Both features are recommendations only — nothing here is implemented yet.*

---

## 1. Trend-Based Proactive De-Load

### Problem

`usePlanAdaptation.ts` only looks at *today's* TSB snapshot. It fires a message like "you're carrying heavy load" only after the athlete is already fatigued (`tsb < -20` or `< -10`). But `computeInjuryRisk()` in `services/performance.ts` already computes a rolling 7-day/28-day ACWR (acute:chronic workload ratio) and classifies risk as `high` (ACWR > 1.5), `moderate` (> 1.3), or `undertrained` (< 0.8). That trend data exists today but nothing acts on it *before* TSB tips negative — the app is purely reactive.

### Current state (what already exists)

- `src/services/performance.ts`
  - `computeAtlCtlTsb(dailyLoads)` — ATL/CTL/TSB exponentially-weighted series.
  - `computeInjuryRisk(dailyLoads)` — ACWR + risk level, already trend-aware.
  - `fetchPerformanceData(userId, days)` — pulls `workout_logs` and buckets TSS by day.
- `src/hooks/usePerformance.ts` — wraps the above in a `useQuery` (`staleTime: 300_000`).
- `src/hooks/usePlanAdaptation.ts` — single-point-in-time TSB alert, no ACWR trend, no plan mutation.
- `src/services/plan.ts` — `compressTodaySession()` / `swapTodaySession()` already do the actual plan-editing work (Supabase update + `plan_adjustments` audit row), just triggered by user action today, not by the system.

### Proposed design

Add a **trend detector** that looks at the ACWR trajectory over the last 3-4 days (not just today's single value) and, when it's climbing toward the danger zone, proactively flags the *upcoming* week's sessions for a de-load rather than waiting for `tsb` to go negative.

**New logic, `services/performance.ts`:**

```ts
export interface AcwrTrend {
  direction: 'climbing' | 'stable' | 'falling';
  daysToHighRisk: number | null; // linear projection, null if not climbing
}

export function computeAcwrTrend(dailyLoads: DailyLoad[]): AcwrTrend {
  // Compute ACWR for each of the last 4 days (via computeInjuryRisk on
  // successively trimmed windows), fit a simple linear trend, and project
  // how many days until ACWR crosses 1.3 (moderate) if the slope holds.
}
```

**New hook, `hooks/usePlanDeload.ts`:**

- Wraps `usePerformance()` + `computeAcwrTrend`.
- When `direction === 'climbing'` and `daysToHighRisk <= 3`, fetch the current week's remaining sessions (`fetchCurrentWeekSessions`, already exists in `plan.ts`) and propose a de-load: downgrade the next hard-intensity session to `compressTodaySession`-style reduced volume, or `swapTodaySession` it to a `cross`/`rest` day.
- Surface this as a dismissible card on the home tab (reuses the existing `BuildPlanBanner`-style component pattern) — **propose, don't silently auto-edit.** The existing `swapTodaySession`/`compressTodaySession` calls already write a `plan_adjustments` row with `triggered_by`; add `triggered_by: 'trend_deload'` so it's distinguishable from user-initiated swaps in the audit trail.

**Why propose-not-auto-edit:** this a training-load safety feature; silently rewriting a user's plan without a visible reason erodes trust in "Ozzie." A confirm step (`"Ozzie noticed your load climbing — de-load Thursday's tempo run?"`) keeps the existing swap/compress consent pattern (`Alert.alert` confirmation already used in `run.tsx`'s `confirmEnd`) instead of introducing a new interaction paradigm.

### Implementation phases

1. **Data layer** (`services/performance.ts`): add `computeAcwrTrend`. Pure function, easy to unit test in isolation once a test runner exists (flagged in the audit as a gap).
2. **Hook** (`hooks/usePlanDeload.ts`): wire trend detection to `fetchCurrentWeekSessions`, pick the next non-rest session as the de-load candidate.
3. **UI**: a home-tab card (new component, e.g. `DeloadSuggestionCard.tsx`, styled to match `BuildPlanBanner.tsx`) with Accept/Dismiss. Accept calls existing `compressTodaySession`/`swapTodaySession` mutations from `useDailySummary` (extend that hook or add a sibling `usePlanDeload` mutation using the same pattern).
4. **Audit trail**: extend `triggered_by` values in `plan_adjustments` inserts (`plan.ts`) to include `'trend_deload'`.
5. **Dismiss memory**: store a "dismissed until" timestamp (local state or a small Supabase column) so a dismissed suggestion doesn't reappear every app open for the same week.

### Edge cases to handle

- Taper/Peak race phases (`computeRacePhase` in `plan.ts`) should probably suppress or soften de-load suggestions — a planned taper already *is* a de-load; don't stack two.
- New users with `chronicAvg < 5` — `computeInjuryRisk` already returns `undertrained` with no meaningful ACWR; trend detector should no-op until there's enough history (mirror the existing guard).
- Multiple climbing days in a row shouldn't queue multiple stacked suggestions — only ever surface one active suggestion at a time.

### Effort estimate

**Medium, ~1-2 weeks.** Most of the hard math (ATL/CTL/ACWR) and the plan-mutation primitives already exist and are correct; this is mostly new glue code (one pure function, one hook, one card component) plus the UX decision-making around confirm/dismiss/re-surface behavior.

### Open questions for Gus

- Should trend de-load be an OSPREY+ (paid) feature, consistent with the existing auto-coaching-cues gate (`isPlus` check in `run.tsx`)?
- Where should the "dismissed" state live — local-only (simplest) or synced (so it doesn't re-nag across devices)?

---

## 2. Real Apple Watch Bridge

### Problem

`src/services/watch-connectivity.ts` is a complete stub today — every native call (`NativeModules.WatchConnectivity...`) is commented out, and the file only `console.log`s in `__DEV__`. `src/hooks/useWatchSync.ts` wraps it but **has no caller anywhere in the app** — the hook, the payload type (`WatchWorkoutPayload`), and the intended message-passing shape are all designed, but nothing is wired end to end. This is the single biggest gap between what the app's pitch implies (live Watch coaching during a run) and what it currently does.

### Current state (what already exists)

- `src/services/watch-connectivity.ts` — defines `sendWorkoutUpdate`, `sendWorkoutEnded`, `onWatchRequestEnd` with the *intended* signatures and inline comments describing the real iOS-side implementation (`WCSession.default.updateApplicationContext(_:)` / `WCSessionDelegate` / `session(_:didReceiveApplicationContext:)`).
- `src/hooks/useWatchSync.ts` — ref-based effect that would call `sendWorkoutUpdate` on payload change and `sendWorkoutEnded` on unmount, if wired into `run.tsx`.
- `package.json` / `app.json` plugins — **`@bacons/apple-targets` is already installed and configured as an Expo config plugin.** This is exactly the tool for adding a watchOS app target (or widget/share extension) to an Expo-managed project without a full native eject — it generates the extra Xcode target from a config file at build time. This strongly suggests a Watch target was planned but never built.
- `app/workout/run.tsx` — has live `elapsed`, `distanceMeters`, `heartRate`, `status` state already, which is exactly the data `WatchWorkoutPayload` expects. Wiring `useWatchSync(payload)` in here is mechanically simple once the native side exists.

### Proposed architecture

**Two halves, both currently missing:**

1. **watchOS app target** (new, via `@bacons/apple-targets`): a minimal SwiftUI watch app showing elapsed time / distance / heart rate / pace, with Start/Pause/End controls that send commands back to the phone.
2. **Native bridge module** (new, custom Expo native module or a thin wrapper around an existing RN WatchConnectivity library): implements `WCSessionDelegate` on the iOS side, exposes `sendApplicationContext`/`sendMessage` to JS via `NativeModules`, and emits watch-originated events (e.g. "end workout" tapped on Watch) via `NativeEventEmitter` — which is exactly what `watch-connectivity.ts`'s comments already describe.

**Message flow (already partially designed in the existing stub):**

- Phone → Watch: `sendWorkoutUpdate(payload)` on every `useRunTracking` tick, using `WCSession.updateApplicationContext` (last-value-wins, ideal for a ticking timer — no need for the guaranteed-delivery `sendMessage` API here).
- Watch → Phone: end-workout button press → `session(_:didReceiveMessage:)` → bridged to JS via `onWatchRequestEnd(callback)`, which `run.tsx` would wire to the same `confirmEnd()` flow it already uses for the in-app End button.

### Implementation phases

1. **Watch app target scaffold** — configure `@bacons/apple-targets` for a watchOS companion target; minimal SwiftUI view with static/mock data first, no bridge yet. Validates the build pipeline (EAS build with a Watch target is its own risk to de-risk early).
2. **Native bridge module (phone side)** — implement the real `WCSessionDelegate`, replace the commented-out lines in `watch-connectivity.ts` with actual `NativeModules` calls. `sendWorkoutUpdate`/`sendWorkoutEnded` signatures don't need to change — the JS-facing API is already correct.
3. **Native bridge (watch side)** — Watch app receives `updateApplicationContext`, renders live data; End button sends a message back.
4. **Wire into `run.tsx`** — add `useWatchSync(watchPayload)` alongside the existing `useRunTracking` call; construct `watchPayload` from the same `status`/`elapsed`/`distanceMeters`/`heartRate` state already in scope. Small, mechanical change once the above exists.
5. **Reachability/connection state UI** — surface "Watch not connected" gracefully (`WCSession.isReachable`) rather than failing silently; the current stub's `onWatchRequestEnd` cleanup-function pattern already anticipates this.
6. **Device testing pass** — this cannot be validated in CI/simulator-only; needs a physical Watch paired to a physical iPhone for the WCSession bridge to actually exercise. Budget real QA time here, not just build-passes-green.

### Edge cases to handle

- App backgrounded mid-run (phone locked) — `UIBackgroundModes: ["location", "audio"]` is already set in `app.json`, which keeps the app alive for GPS; confirm `updateApplicationContext` calls still land while backgrounded (they generally do, it's designed for this).
- Watch app killed/relaunched mid-workout — needs a "resume in-progress workout" state sync on watch launch, not just a fresh blank screen.
- No Watch paired at all — `useWatchSync` should no-op cleanly (it already does, since `sendWorkoutUpdate` is a no-op without the native module wired).
- Watch out of Bluetooth/WiFi range — `updateApplicationContext` queues and delivers on reconnect; don't build any assumption of real-time delivery into the coaching-cue logic.

### Effort estimate

**Large, ~3-4 weeks.** Unlike the de-load feature, this is genuinely new native development (a second app target, a native bridge module, Swift/SwiftUI work) plus mandatory physical-device QA that can't be shortcut. Realistic breakdown: ~1 week Watch app scaffold + build pipeline, ~1-1.5 weeks native bridge (both directions), ~0.5 week wiring into existing RN screens, ~1 week device QA and edge-case hardening.

### Open questions for Gus

- Build the bridge as a custom native module, or adopt an existing RN WatchConnectivity library (faster, less bespoke Swift, but another third-party dependency to vet)?
- Should the Watch app be a "companion display" only (mirrors phone state) or independently start/stop workouts without the phone open? The latter is a materially bigger scope (needs its own HealthKit workout session on watchOS).
- Priority relative to the de-load feature above — the de-load feature ships in roughly a third of the time and touches only JS/TS the audit already validated; the Watch bridge is a bigger, riskier native undertaking. Worth sequencing de-load first unless Watch support is a launch-blocking differentiator.
