# OSPREY Nightly Audit — 2026-07-02

Branch: `fable-audit-2026-07-02` (off `main` @ `67cab51`)
Run: fully autonomous, no human present.

## Context brief

Repo history is a single squashed `Initial commit: OSPREY AI fitness coach app` — this is effectively a greenfield snapshot with no prior commit-by-commit history to mine for "recent changes." Stack: Expo SDK 52 / React Native 0.76 / React 18.2, expo-router, Supabase (Postgres + edge functions), Zustand, TanStack Query, RevenueCat.

Critical paths reviewed: auth (`authStore.ts` + `supabase.ts` — solid, no issues found), TSB/training-load math (`services/performance.ts` — the ATL/CTL/TSB exponentially-weighted-average implementation and Riegel race predictor are both correct), GPS run tracking (`useRunTracking.ts` — found and fixed a real distance-undercounting bug, see Category 1), and Watch sync (`watch-connectivity.ts` / `useWatchSync.ts` — this is an intentional, fully-stubbed placeholder; no real `WCSession` bridge exists yet, `NativeModules`/`NativeEventEmitter` are imported but unused, and `useWatchSync` has no caller anywhere in the app. Treated as a known gap, not a bug — see Category 13).

**Baseline before any fixes:** `npm run typecheck` — 0 errors. `npm run lint` — **failed outright**, no ESLint config file existed despite `eslint-config-expo` and `@typescript-eslint/*` being installed as devDependencies. Fixing that was necessarily the first move since it blocks the lint-based validation gate required after every subsequent fix (rule 5).

## Environment note (read before running this again)

Two environment-level blockers showed up this run, neither of which are repo bugs:

1. **`.git/index.lock` on the mounted working copy could not be deleted** — `rm`/`unlink` return `Operation not permitted` for *any* file on the `/OSPREY-1.0` mount, not just this one (confirmed with a throwaway test file). This appears to be a property of the sandbox's FUSE mount, not something in the repo. Once a git operation leaves a stray lock file, that mounted repo is permanently stuck until the lock is cleared from the host side (outside the sandbox) or the mount changes.
   - **Workaround used this run:** copied the whole repo (git history + working tree, excluding `node_modules`/`.expo`) to `/tmp` inside the sandbox, symlinked `node_modules` back to the original mount (read-only access is fine, no delete needed), and did all branch/commit work there. `npm run lint`/`typecheck` ran identically in both locations. See "Branch delivery" below for how this gets back to you.
2. **No network access to `github.com` or `registry.npmjs.org`** from this sandbox (`403 Forbidden - ... from proxy` / `Connection blocked by network allowlist`) — even though `origin` is now configured and you said you'd pushed/committed. This blocked `git fetch`, `git push`, `npm audit`, and `npm outdated`. Category 10 findings below are based on manual/web-search inspection instead of live registry data.

## Branch delivery

Because of blocker #1, the 8 commits below exist on `fable-audit-2026-07-02` in the `/tmp` working copy, not (yet) in the mounted repo at `/Users/gusjohnson/Documents/AppDevelopment/OSPREY-1.0/OSPREY`. Since the new branch doesn't exist yet on the mounted repo, transplanting it only requires *creating* new objects/refs (no deletes), which the mount does allow — that transplant is being attempted separately from this report. If it didn't take, the fix is to run this from a normal terminal (outside the sandbox) pointed at the real folder:

```
cd ~/Documents/AppDevelopment/OSPREY-1.0/OSPREY
rm -f .git/index.lock   # clears the stray lock from this session
git fetch <path-to-tmp-copy-if-still-present> fable-audit-2026-07-02:fable-audit-2026-07-02
git push origin fable-audit-2026-07-02
gh pr create --title "[FABLE-AUDIT-SONNET] Nightly audit 2026-07-02" --body-file OSPREY-app/audit-reports/2026-07-02-fable-audit.md
```

(`gh` CLI is not installed in the sandbox either — install it, or open the PR by hand from the pushed branch on GitHub.)

## Fixes implemented (8 commits, 9 files, +68/-11 lines)

1. **Bug Detection & Fix** — `src/hooks/useRunTracking.ts`: the GPS noise filter reset its reference point on every location fix regardless of whether the fix cleared the 1m noise threshold. During slow/steady movement, a run of sub-meter GPS jitter would keep resetting the anchor before real cumulative movement ever crossed 1m from a *stable* reference — silently under-counting distance, which feeds directly into `tss`/training-load. Anchor now only advances on accepted (≥1m) fixes.

2. **Code & File Cleanliness** — `.eslintrc.js`: added the missing ESLint config (`extends: ['expo']`). Also disabled `import/no-unresolved`/`import/namespace`, which were both broken by an environment-level native-binding failure in `eslint-import-resolver-typescript` (auto-detected, not explicitly configured) trying to resolve the `@/*` → `src/*` tsconfig path alias — `tsc` already catches genuinely broken imports. **Baseline established: 0 lint errors, 20 warnings** (all pre-existing `no-unused-vars` and `@typescript-eslint/array-type` style warnings — full list in the diff, none touched tonight beyond what auto-fix would trivially resolve).

3. **UX Flow, Layout & Creative Feel** — `src/components/onboarding/OnboardingShell.tsx`: the onboarding continue button and `OptionCard` (used across the goals/mode/health onboarding steps) had no `accessibilityRole`/`State`/`Label`. VoiceOver users got an unlabeled, unstateful touch target with no indication of which option was selected or whether continue was disabled/loading. Added all three.

4. **Ease of Use** — `src/screens/SignIn.tsx`: email/password inputs had no `returnKeyType`/`onSubmitEditing`, so the keyboard's return key did nothing — users had to manually tap into the password field and then tap Submit. Wired email→password focus advance and password→submit. Also added `textContentType`/`autoComplete` so iOS/Android offer password-manager autofill and strong-password suggestions on signup.

5. **Performance & Battery** — `src/hooks/useDailySummary.ts`: the home-tab query (most-visited screen) had no `staleTime`, unlike sibling hooks (`useFuelStatus`, `useWeightLog`, `useActivity`, all at 60s) — meaning a fresh Supabase round trip on every mount/tab focus. Brought it in line with the existing 60s convention; mutations still invalidate immediately on swap/compress so edits stay live.

6. **App Store Readiness** — `app.json`: top-level `"icon"` pointed at `assets/images/icon.png`, which is only **192×192**. Apple/EAS requires a 1024×1024 source to generate the full icon set; anything smaller either fails EAS build validation or gets upscaled into a blurry App Store icon. A correctly-sized `icon-1024.png` (1024×1024, confirmed via `file`) already existed in the repo, untracked and unwired — pointed `"icon"` at it. Left the `expo-notifications` plugin's separate `icon` field alone (that's meant to be a small monochrome notification icon, a different asset by design).

7. **Edge Case & Crash Handling** — `src/services/food-lookup.ts`: `fetchFromOpenFoodFacts` (barcode scanner backend) had no request timeout, unlike the equivalent third-party fetches in `race-search.ts` (which already use an `AbortController` + 8–10s timeout). A slow/unresponsive Open Food Facts response left the scanner's loading spinner stuck indefinitely with no recovery short of force-quitting. Brought it in line with the existing pattern (8s timeout).

8. **Documentation & Handoff** — `LAUNCH_CHECKLIST.md` + `OSPREY_External_TODO.md`: both docs still described problems already fixed in the live codebase (verified against the actual files, not assumed):
   - `ascAppId` in `eas.json` was flagged as a placeholder (`REPLACE_WITH_APP_STORE_CONNECT_APP_ID`) in both docs; it's actually already set to `6785572381`.
   - `LAUNCH_CHECKLIST.md` flagged duplicate `UIBackgroundModes`/`associatedDomains` entries in `app.json`; neither has duplicates as of this run.
   - `OSPREY_External_TODO.md` described `icon.png` as "~60KB, looks replaced"; it's actually 192×192/1.8KB — the wrong size for an App Store icon source (see item 6 above).
   - **New finding surfaced and logged in both docs:** `splash.png` is a literal **1×1 pixel placeholder** (confirmed via `file`). This will ship a blank splash screen if not replaced before submission. `LAUNCH_CHECKLIST.md` already had an open item for this; strengthened it with the confirmed finding rather than leaving it as a vague "double check."

## Categories skipped (needs human judgment)

- **Analytics & Error Tracking** — no crash reporting or analytics SDK (Sentry, Bugsnag, Amplitude, etc.) exists anywhere in the app. For a paid-subscription app this means zero production crash visibility. Not implemented tonight: adding one requires a new dependency plus a DSN/API key, which means touching `.env.local` — off-limits per the safety rules, and not something to provision on your behalf anyway. **Recommend:** Sentry for React Native (has an Expo config plugin) before the TestFlight round.
- **Security** — found that `expo-secure-store` is installed as a dependency but **never used anywhere** in `src/`. Supabase's auth session (access token, refresh token, user metadata) currently persists via plain `AsyncStorage` in `services/supabase.ts`, which is not encrypted at rest beyond standard OS file protection — SecureStore (backed by iOS Keychain / Android Keystore) is the intended pattern here and looks like it was set up for exactly this and never wired in. **Not changed tonight, deliberately:** this is the single most sensitive file in the app, I have no device/simulator to test session persistence on, and `expo-secure-store` has a known ~2048-byte per-value size limit on some platforms that a full Supabase session payload can approach or exceed — swapping the storage adapter blind, without on-device verification that login sessions still survive an app relaunch, is exactly the kind of "large, hard-to-reverse-if-wrong" change the safety rules ask me to avoid. Recommend doing this as a reviewed, device-tested change rather than an unattended one.
- **Dependency & Library Health** — `npm audit`/`npm outdated` both failed (no registry access from the sandbox), so live vulnerability data isn't available. Manually confirmed via web search: the app is on **Expo SDK 52 / RN 0.76 / React 18.2**; current stable as of this week is **Expo SDK 56 (RN 0.85, React 19.2)**, with SDK 57 already rolling out. That's 4 major SDK versions behind. An upgrade of that size touches native iOS/Android project files directly and needs full on-device regression testing — explicitly out of scope for a "small, reversible" autonomous fix. Recommend scheduling a dedicated SDK-upgrade pass (likely incremental, one major at a time) before it gets any further behind.
- **Test Coverage & Regression** — confirmed (again) there is no `test` script in `package.json` and no test runner (Jest, Vitest, etc.) installed at all. Per the task spec, not inventing one tonight; flagging that TSB math (`performance.ts`) and the run-tracking distance fix above are exactly the kind of pure functions that would benefit most from a lightweight unit test suite once one exists.

## Feature recommendations (not implemented)

1. **Trend-based proactive de-load, not just same-day alerts.** `usePlanAdaptation.ts` already surfaces a message when *today's* TSB crosses a threshold (e.g. "carrying heavy load"), but it's a single-point-in-time check — it doesn't look at the multi-day ACWR trend that `computeInjuryRisk` in `services/performance.ts` already calculates. A week that's climbing toward the 1.3–1.5 ACWR danger zone could be caught and de-loaded a few days *before* TSB actually tips negative, rather than reacting after the fact. Effort: medium (~1–2 weeks) — mostly wiring existing computed data (`computeInjuryRisk`, `computeAtlCtlTsb`) into a proactive weekly-plan-rebalance call, reusing the existing `compressTodaySession`/`swapTodaySession` mutation pattern for the actual plan edits.

2. **Real Apple Watch bridge.** `watch-connectivity.ts` is currently a full stub — every native call is commented out, and `useWatchSync` has no caller anywhere in the app, meaning the Watch integration is 0% wired up end-to-end despite the plumbing (hook, types, payload shape) already being designed. This is the single biggest gap between "app exists" and "app does what the product pitch implies." Effort: large (3–4 weeks) — requires a native watchOS app target, `WCSessionDelegate` on both sides, background delivery for the always-on face, and testing on physical Watch hardware (none of which is possible in this sandboxed environment).

## Lint/typecheck delta

| | Before any fixes | After all fixes |
|---|---|---|
| `npm run typecheck` | 0 errors (baseline) | 0 errors |
| `npm run lint` | crashed — no config | 0 errors, 20 warnings (pre-existing, untouched) |

No fix introduced a new lint or type error; nothing was reverted.
