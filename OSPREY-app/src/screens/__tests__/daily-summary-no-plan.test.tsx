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
