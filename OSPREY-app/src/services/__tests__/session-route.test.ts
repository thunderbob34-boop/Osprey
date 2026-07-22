import { routeForSession } from '@/services/session-route';

// Home and the Workout tab both launch today's prescribed session through this
// helper. If they ever diverge again, an athlete starting from one door loses
// the target pace/zone the engine computed. These pin the contract.
describe('routeForSession', () => {
  it('carries the sessionId so the screen can load the prescription', () => {
    expect(routeForSession('run', 'sess-1')).toEqual({
      pathname: '/workout/run',
      params: { sessionId: 'sess-1' },
    });
    expect(routeForSession('lift', 'sess-2')).toEqual({
      pathname: '/workout/lift',
      params: { sessionId: 'sess-2' },
    });
  });

  it('routes the timer-based sports to the endurance screen with their type', () => {
    for (const type of ['swim', 'bike', 'rowing', 'cross']) {
      expect(routeForSession(type, 'sess-3')).toEqual({
        pathname: '/workout/endurance',
        params: { sessionType: type, sessionId: 'sess-3' },
      });
    }
  });

  it('sends hyrox to its own race runner (which takes no sessionId today)', () => {
    expect(routeForSession('hyrox', 'sess-4')).toEqual({ pathname: '/workout/hyrox' });
  });

  it('never starts an unplanned GPS run when there is no session type', () => {
    for (const missing of [null, undefined, '']) {
      expect(routeForSession(missing, null)).toEqual({ pathname: '/plan-preview' });
    }
    // A future session type added without routing must also not fall into /workout/run.
    expect(routeForSession('some_new_sport', 'sess-5')).toEqual({ pathname: '/plan-preview' });
  });

  it('tolerates a missing sessionId without inventing one', () => {
    expect(routeForSession('run', null)).toEqual({
      pathname: '/workout/run',
      params: { sessionId: undefined },
    });
  });
});
