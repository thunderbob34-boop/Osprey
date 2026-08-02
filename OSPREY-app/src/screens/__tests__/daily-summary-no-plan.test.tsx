import React from 'react';
import { renderWithProviders as render, screen } from '@/test-utils/render';
import DailySummaryScreen from '../DailySummary';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() }),
}));

// A brand-new account has no generated plan. Before this fix the CTA stayed
// enabled and handleStartSession's switch default routed to /workout/run —
// so the very first tap started a GPS run for a session that did not exist.
describe('DailySummary with no planned session', () => {
  it('offers to build a plan instead of starting a session', () => {
    render(<DailySummaryScreen userName="Test" />);
    expect(screen.getByText(/Build My Plan/i)).toBeTruthy();
    expect(screen.queryByText(/Start Session/i)).toBeNull();
  });

  it('does not promise a plan that was never built', () => {
    render(<DailySummaryScreen userName="Test" />);
    expect(screen.queryByText(/still crunching/i)).toBeNull();
  });
});

// An empty day is not the same as an empty account. An athlete mid-block hits
// this on a rest day, or on a Monday before the generator has written the new
// week — telling them to "Build My Plan" read as though their training block
// had vanished, and pointed at a builder that would start them over.
describe('DailySummary with a plan but nothing scheduled today', () => {
  const emptyDay = {
    type: 'Nothing Scheduled',
    duration: 'Open day',
    ozzieNote: 'Nothing on the calendar today.',
    sessionId: null,
    sessionType: null,
  };

  it('sends an established athlete to their week, not the plan builder', () => {
    render(<DailySummaryScreen userName="Test" session={emptyDay} hasEverPlanned />);
    expect(screen.getByText(/View This Week/i)).toBeTruthy();
    expect(screen.queryByText(/Build My Plan/i)).toBeNull();
  });

  it('still offers the builder to an athlete who has never had a plan', () => {
    render(<DailySummaryScreen userName="Test" session={emptyDay} hasEverPlanned={false} />);
    expect(screen.getByText(/Build My Plan/i)).toBeTruthy();
    expect(screen.queryByText(/View This Week/i)).toBeNull();
  });
});
