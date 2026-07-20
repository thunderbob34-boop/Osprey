/**
 * Turns any thrown value into copy an athlete can read, instead of the raw
 * Supabase/network internals ("JWT expired", "duplicate key value violates
 * unique constraint…") that were leaking straight into ~47 Alert.alert bodies
 * across the app. The raw error still goes to the console for debugging —
 * this only changes what the athlete sees, not what gets logged.
 */
export function friendlyError(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  console.error(err);
  return fallback;
}
