import React from 'react';
import { renderWithProviders as render, screen } from '@/test-utils/render';
import SummaryScreen from '@/../app/(onboarding)/summary';
import { useOnboardingStore } from '@/store/onboardingStore';
import { DEFAULT_ONBOARDING_DRAFT } from '@/types/onboarding';

/**
 * Echo-back summary (docs/design-references/RUNNA-app-teardown.md's highest-
 * trust-payoff pattern): every collected value listed as a plain bullet
 * before generation, each labeled with where it came from. The teardown
 * specifically calls out "TRAINING VOLUME: Custom" as a database value
 * leaking into the UI — this test guards against that regression as much as
 * it guards the happy path.
 */

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

describe('SummaryScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    useOnboardingStore.setState({
      ...DEFAULT_ONBOARDING_DRAFT,
      displayName: 'Jordan',
      primaryGoal: 'run',
      experienceTier: 'intermediate',
      weeklyRunDays: 4,
      weeklyLiftDays: 1,
      healthConnected: true,
      raceGoal: { name: 'Charlotte Marathon', date: '2026-11-14', distanceKm: 42.2 },
      thresholdAnchor: { run: { thresholdSecPerMile: 480, source: 'derived', confidence: 'moderate' } },
      bodyWeightKg: 70,
      availableDays: ['monday', 'wednesday', 'friday', 'saturday'],
      longSessionDay: 'saturday',
      equipment: [],
    });
  });

  it('renders every collected value with a provenance label, never a bare "Custom"', () => {
    render(<SummaryScreen />);

    expect(screen.getByText('Jordan')).toBeTruthy();
    expect(screen.getByText('Charlotte Marathon — 2026-11-14')).toBeTruthy();
    expect(screen.getByText('intermediate')).toBeTruthy();
    expect(screen.getByText('5/week')).toBeTruthy();
    expect(screen.getByText('Sat')).toBeTruthy(); // long session day

    // Provenance notes are present and specific — not a bare "Custom" leak.
    expect(screen.getAllByText(/from Apple Health/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Custom$/)).toBeNull();
    expect(screen.queryByText(/Custom/)).toBeNull();
  });

  it('shows "Not racing yet" rather than a blank row when no race was chosen', () => {
    useOnboardingStore.setState({ raceGoal: null });
    render(<SummaryScreen />);
    expect(screen.getByText('Not racing yet')).toBeTruthy();
  });

  it('names the low-confidence provisional adjustment explicitly instead of a generic label', () => {
    useOnboardingStore.setState({
      thresholdAnchor: { run: { thresholdSecPerMile: 480, source: 'derived', confidence: 'low' } },
    });
    render(<SummaryScreen />);
    expect(screen.getByText(/provisional, I'll re-check in \d+ days/)).toBeTruthy();
  });
});
