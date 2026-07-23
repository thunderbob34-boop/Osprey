jest.mock('@/hooks/useDisplayEnvelope', () => ({ useDisplayEnvelope: jest.fn() }));
jest.mock('@/hooks/useTrainingGoal', () => ({ useTrainingGoal: jest.fn(() => ({ data: { primaryGoal: 'run' } })) }));
jest.mock('@/hooks/useUnitPreference', () => ({ useUnitPreference: () => ({ units: 'imperial' }) }));

import { renderWithProviders as render, screen } from '@/test-utils/render';
import YourNumbersScreen from '@/../app/your-numbers';
import { useDisplayEnvelope, type DisplayEnvelope } from '@/hooks/useDisplayEnvelope';

const mockDisplay = useDisplayEnvelope as jest.Mock;

function envelope(overrides: Partial<DisplayEnvelope>): DisplayEnvelope {
  return {
    sport: 'run',
    phase: 'Build',
    weekNumber: 4,
    totalWeeks: 12,
    targetWeeklyLoad: 320,
    hardSessionShareMax: 0.2,
    zones: null,
    hrZones: { maxHR: 190, source: 'estimated', bands: {} as never },
    fuel: {
      dailyCarbGByDayType: {
        easy: { min: 210, max: 350 },
        moderate: { min: 350, max: 490 },
        high: { min: 560, max: 700 },
        peak: { min: 700, max: 840 },
      },
      proteinG: { min: 112, max: 154 },
      longSessionCarbGPerHour: 60,
    },
    strength: null,
    hyrox: null,
    crossfit: null,
    confidence: 'measured',
    ...overrides,
  };
}

describe('YourNumbersScreen — training context + fuel (every sport)', () => {
  it('renders a loading state when the envelope has not resolved yet', () => {
    mockDisplay.mockReturnValue(null);
    render(<YourNumbersScreen />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it('shows phase, week, and target load', () => {
    mockDisplay.mockReturnValue(envelope({}));
    render(<YourNumbersScreen />);
    expect(screen.getByText('Build')).toBeTruthy();
    expect(screen.getByText('4 of 12')).toBeTruthy();
    expect(screen.getByText('320')).toBeTruthy();
  });

  it('shows fuel targets by day type and protein', () => {
    mockDisplay.mockReturnValue(envelope({}));
    render(<YourNumbersScreen />);
    expect(screen.getByText('210–350 g carbs')).toBeTruthy();
    expect(screen.getByText('700–840 g carbs')).toBeTruthy();
    expect(screen.getByText('112–154 g')).toBeTruthy();
  });

  it('shows the in-session carb rate when the sport has one', () => {
    mockDisplay.mockReturnValue(envelope({ sport: 'run' }));
    render(<YourNumbersScreen />);
    expect(screen.getByText('60 g/hr')).toBeTruthy();
  });

  it('hides the in-session carb row when the sport has none (lift)', () => {
    mockDisplay.mockReturnValue(envelope({ sport: 'lift', fuel: { ...envelope({}).fuel, longSessionCarbGPerHour: 0 } }));
    render(<YourNumbersScreen />);
    expect(screen.queryByText(/g\/hr/)).toBeNull();
  });
});
