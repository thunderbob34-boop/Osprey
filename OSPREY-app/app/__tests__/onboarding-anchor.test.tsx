import React from 'react';
import { renderWithProviders as render, screen, fireEvent, waitFor } from '@/test-utils/render';
import AnchorScreen from '@/../app/(onboarding)/anchor';
import { useOnboardingStore } from '@/store/onboardingStore';
import { DEFAULT_ONBOARDING_DRAFT } from '@/types/onboarding';
import type { AnchorProposal } from '@/services/coaching/performance-anchor';

/**
 * anchor.tsx is WS1's core trust mechanic: a HealthKit-derived proposal is
 * shown as CONFIRMABLE, not silently applied. This pins the "that's not
 * right" path — editing away from a proposal must record the athlete's own
 * number as source 'self_report', not leave a stale 'derived' provenance
 * pointing at a value the athlete just rejected.
 */

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

const mockProposal: AnchorProposal = {
  key: 'run',
  value: 460,
  confidence: 'moderate',
  qualifyingEffortCount: 4,
  derivedFrom: { externalId: 'hk-1', startedAt: '2026-07-01T08:00:00.000Z', distanceMiles: 5, timeS: 2300 },
};

const mockProposeAnchorFromHealthKit = jest.fn();
jest.mock('@/services/coaching/performance-anchor', () => {
  const actual = jest.requireActual('@/services/coaching/performance-anchor');
  return { ...actual, proposeAnchorFromHealthKit: (...args: unknown[]) => mockProposeAnchorFromHealthKit(...args) };
});

describe('AnchorScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockProposeAnchorFromHealthKit.mockReset();
    useOnboardingStore.setState({
      ...DEFAULT_ONBOARDING_DRAFT,
      primaryGoal: 'run',
      healthConnected: true,
    });
  });

  it('confirming a proposal stores it as source "derived" with the proposal\'s confidence', async () => {
    mockProposeAnchorFromHealthKit.mockResolvedValue(mockProposal);
    render(<AnchorScreen />);

    await waitFor(() => expect(screen.getByText("Here's what I found")).toBeTruthy());
    fireEvent.press(screen.getByText("That's right →"));

    const anchor = useOnboardingStore.getState().thresholdAnchor;
    expect(anchor?.run).toEqual({ thresholdSecPerMile: 460, source: 'derived', confidence: 'moderate' });
    expect(useOnboardingStore.getState().anchorProposal).toEqual(mockProposal);
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/body-weight');
  });

  it('editing away from a proposal records the athlete\'s own number as self_report, not the rejected derived value', async () => {
    mockProposeAnchorFromHealthKit.mockResolvedValue(mockProposal);
    render(<AnchorScreen />);

    await waitFor(() => expect(screen.getByText("Here's what I found")).toBeTruthy());
    fireEvent.press(screen.getByText("That's not right — let me enter it myself"));

    // Now in manual-entry mode: fill in a run distance + time (mirrors the
    // self-report fields baseline.tsx used to collect).
    fireEvent.changeText(screen.getByPlaceholderText('6.2'), '6.2');
    fireEvent.changeText(screen.getByPlaceholderText('min'), '48');
    fireEvent.changeText(screen.getByPlaceholderText('sec'), '0');
    fireEvent.press(screen.getByText('Use these numbers →'));

    const anchor = useOnboardingStore.getState().thresholdAnchor;
    expect(anchor?.run?.source).toBe('self_report');
    // The rejected HealthKit proposal must not linger as provenance for a
    // value the athlete just overrode — this is the regression this test guards.
    expect(useOnboardingStore.getState().anchorProposal).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/body-weight');
  });

  it('skipping records no anchor at all (falls through to the tier estimate later)', async () => {
    mockProposeAnchorFromHealthKit.mockResolvedValue(null);
    render(<AnchorScreen />);

    await waitFor(() => expect(screen.getByText('Skip — estimate for me')).toBeTruthy());
    fireEvent.press(screen.getByText('Skip — estimate for me'));

    expect(useOnboardingStore.getState().thresholdAnchor).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/(onboarding)/body-weight');
  });
});
