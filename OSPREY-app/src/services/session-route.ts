/**
 * Where a planned session opens.
 *
 * Home ("Start Session") and the Workout tab ("Today's session") both launch
 * the same prescribed session, so the per-sport routing lives here once. When
 * this logic was inlined in Home only, the Workout tab had no way to start a
 * planned session at all — an athlete tapping "Workout" got an ad-hoc sport
 * picker and silently lost the target pace/zone the engine computed.
 */

/** The literal route set, kept as a union so expo-router's typed routes accept it. */
export type SessionRoutePath =
  | '/workout/lift'
  | '/workout/hyrox'
  | '/workout/endurance'
  | '/workout/run'
  | '/plan-preview';

export interface SessionRoute {
  pathname: SessionRoutePath;
  params?: { sessionType?: string; sessionId?: string };
}

export function routeForSession(
  sessionType: string | null | undefined,
  sessionId?: string | null,
): SessionRoute {
  const id = sessionId ?? undefined;

  switch (sessionType) {
    case 'lift':
      return { pathname: '/workout/lift', params: { sessionId: id } };
    case 'hyrox':
      // The hyrox runner drives its own 8-run/8-station race flow and takes no
      // sessionId today (see the hyrox targetTimeMinutes follow-up).
      return { pathname: '/workout/hyrox' };
    case 'swim':
    case 'bike':
    case 'rowing':
    case 'cross':
      return { pathname: '/workout/endurance', params: { sessionType, sessionId: id } };
    case 'run':
      return { pathname: '/workout/run', params: { sessionId: id } };
    default:
      // No sessionType means there is no generated plan — send them to the plan
      // rather than starting an unplanned GPS run.
      return { pathname: '/plan-preview' };
  }
}
