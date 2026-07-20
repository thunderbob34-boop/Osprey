// Never surface raw backend/network error text to users — it can leak Postgres
// constraint names, stack fragments, or other internals. Log the real error for
// debugging and show a generic, actionable fallback instead. Mirrors OSPREY-app's
// src/utils/errorMessage.ts friendlyError().
export function friendlyMessage(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  console.error(error);
  return fallback;
}
