/**
 * Crash Reporting Service
 *
 * Thin wrapper around Sentry for React Native. Follows the same
 * skip-when-unconfigured pattern as other optional third-party services in
 * this codebase (see ozzie-audio.ts's EXPO_PUBLIC_ELEVENLABS_API_KEY and
 * subscriptions.ts's EXPO_PUBLIC_REVENUECAT_IOS_KEY): no-op unless a real
 * DSN is provided via env var, so the app behaves identically in
 * environments (like CI or this sandbox) where no Sentry project exists.
 */

import * as Sentry from '@sentry/react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

let initialized = false;

/**
 * Initialize Sentry crash reporting. Safe to call once, early in app
 * startup (see app/_layout.tsx). No-ops if EXPO_PUBLIC_SENTRY_DSN isn't
 * configured, matching the pattern used for ElevenLabs/RevenueCat.
 */
export function initCrashReporting(): void {
  if (!SENTRY_DSN || initialized) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    debug: __DEV__,
    // Don't spam a real Sentry project with events generated during local
    // development — only report from non-dev (TestFlight/production) builds.
    enabled: !__DEV__,
    tracesSampleRate: 0.2,
    enableAutoSessionTracking: true,
  });

  initialized = true;
}

/**
 * Report a caught exception to Sentry, if configured. Safe to call even
 * when initCrashReporting() was never called or the DSN is unset — the
 * underlying SDK no-ops when uninitialized, and this wrapper adds its own
 * guard on top so callers never need to check configuration state first.
 */
export function reportError(err: unknown): void {
  if (!SENTRY_DSN) return;
  Sentry.captureException(err);
}
