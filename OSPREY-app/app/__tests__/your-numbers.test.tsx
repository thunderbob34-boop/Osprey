jest.mock('@/hooks/useDisplayEnvelope', () => ({ useDisplayEnvelope: jest.fn() }));
jest.mock('@/hooks/useTrainingGoal', () => ({ useTrainingGoal: jest.fn() }));
jest.mock('@/hooks/useUnitPreference', () => ({ useUnitPreference: () => ({ units: 'imperial' }) }));

import { renderWithProviders as render, screen } from '@/test-utils/render';
import YourNumbersScreen from '@/../app/your-numbers';
import { useDisplayEnvelope, type DisplayEnvelope } from '@/hooks/useDisplayEnvelope';
import { useTrainingGoal } from '@/hooks/useTrainingGoal';

const mockDisplay = useDisplayEnvelope as jest.Mock;
const mockGoal = useTrainingGoal as jest.Mock;

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

beforeEach(() => {
  mockGoal.mockReturnValue({ data: { primaryGoal: 'run' } });
});

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

describe('YourNumbersScreen — Strength section', () => {
  it('shows an empty state for a paramless lifter', () => {
    mockGoal.mockReturnValue({ data: { primaryGoal: 'lift' } });
    mockDisplay.mockReturnValue(envelope({ sport: 'lift', strength: null }));
    render(<YourNumbersScreen />);
    expect(screen.getByText(/enter your squat, bench, and deadlift 1RMs/)).toBeTruthy();
  });

  it('shows working loads, zone, Prilepin, and fat target for a real lifter', () => {
    mockGoal.mockReturnValue({ data: { primaryGoal: 'lift' } });
    mockDisplay.mockReturnValue(envelope({
      sport: 'lift',
      strength: {
        oneRepMaxKg: { squat: 140, bench: 100, deadlift: 180 },
        workingPercent1RM: 80,
        zone: { name: 'Strength-Volume', percent1RM: [75, 85], reps: [3, 6], rpe: [7, 8], rir: [2, 3] },
        prilepin: { repsPerSet: [2, 4], totalReps: [10, 20] },
        fatG: { min: 56, max: 105 },
        attempts: null,
      },
    }));
    render(<YourNumbersScreen />);
    expect(screen.getByText('Strength-Volume · 80% 1RM')).toBeTruthy();
    // Working load = round(140 * 80 / 100) = 112kg. Imperial units, so the
    // screen shows formatWeightKg(112, 'imperial') = `${kgToLb(112)} lbs`.
    // kgToLb(112) = round(112 * 2.2046226218 * 10) / 10 = 246.9.
    expect(screen.getByText('246.9 lbs')).toBeTruthy();
  });

  it('shows attempt plans for every lift that has a real goal-third', () => {
    mockGoal.mockReturnValue({ data: { primaryGoal: 'lift' } });
    mockDisplay.mockReturnValue(envelope({
      sport: 'lift',
      strength: {
        oneRepMaxKg: { squat: 140, bench: 100, deadlift: 180 },
        workingPercent1RM: 95,
        zone: { name: 'Peak / Test', percent1RM: [93, 100], reps: [1, 1], rpe: [9, 10], rir: [0, 1] },
        prilepin: { repsPerSet: [1, 2], totalReps: [4, 10] },
        fatG: { min: 56, max: 105 },
        attempts: {
          squat: { opener: { min: 160.2, max: 163.8 }, second: { min: 171, max: 172.8 }, third: { min: 180, max: 183.6 } },
          bench: { opener: { min: 106.8, max: 109.2 }, second: { min: 114, max: 115.2 }, third: { min: 120, max: 122.4 } },
          deadlift: { opener: { min: 195.8, max: 200.2 }, second: { min: 209, max: 211.2 }, third: { min: 220, max: 224.4 } },
        },
      },
    }));
    render(<YourNumbersScreen />);
    expect(screen.getByText('ATTEMPT PLAN')).toBeTruthy();
    // 3 lifts each render an attempt row plus a working-load row -> "Squat"/"Bench"/"Deadlift" each appear twice
    expect(screen.getAllByText('Squat').length).toBe(2);
    expect(screen.getAllByText('Bench').length).toBe(2);
    expect(screen.getAllByText('Deadlift').length).toBe(2);
  });

  it('omits the attempt row for a lift with no 1RM and no goal-third, even though other lifts have real attempts', () => {
    mockGoal.mockReturnValue({ data: { primaryGoal: 'lift' } });
    mockDisplay.mockReturnValue(envelope({
      sport: 'lift',
      strength: {
        oneRepMaxKg: { squat: 140, bench: 0, deadlift: 180 },
        workingPercent1RM: 95,
        zone: { name: 'Peak / Test', percent1RM: [93, 100], reps: [1, 1], rpe: [9, 10], rir: [0, 1] },
        prilepin: { repsPerSet: [1, 2], totalReps: [4, 10] },
        fatG: { min: 56, max: 105 },
        attempts: {
          squat: { opener: { min: 160.2, max: 163.8 }, second: { min: 171, max: 172.8 }, third: { min: 180, max: 183.6 } },
          bench: { opener: { min: 0, max: 0 }, second: { min: 0, max: 0 }, third: { min: 0, max: 0 } },
          deadlift: { opener: { min: 195.8, max: 200.2 }, second: { min: 209, max: 211.2 }, third: { min: 220, max: 224.4 } },
        },
      },
    }));
    render(<YourNumbersScreen />);
    expect(screen.getByText('ATTEMPT PLAN')).toBeTruthy();
    // Squat and Deadlift each render twice (working-load row + attempt row); Bench renders only
    // once (working-load row says "Not set" — no 1RM), since its attempt plan is all zeros.
    expect(screen.getAllByText('Squat').length).toBe(2);
    expect(screen.getAllByText('Deadlift').length).toBe(2);
    expect(screen.getAllByText('Bench').length).toBe(1);
  });
});

describe('YourNumbersScreen — Hyrox section', () => {
  it('shows an empty state without a division', () => {
    mockGoal.mockReturnValue({ data: { primaryGoal: 'hyrox' } });
    mockDisplay.mockReturnValue(envelope({ sport: 'hyrox', hyrox: null }));
    render(<YourNumbersScreen />);
    expect(screen.getByText(/pick your division/)).toBeTruthy();
  });

  it('shows division, station weights, and compromised pace', () => {
    mockGoal.mockReturnValue({ data: { primaryGoal: 'hyrox' } });
    mockDisplay.mockReturnValue(envelope({
      sport: 'hyrox',
      hyrox: {
        division: 'open_men',
        compromisedRunSplitSecPerKm: { min: 295, max: 310 },
        stationWeights: { sledPushKg: 152, sledPullKg: 103, farmersCarryPerHandKg: 24, sandbagLungesKg: 20, wallBallKg: 6 },
        sodiumMgPerHour: { min: 500, max: 1000 },
        caffeineMg: { min: 210, max: 420 },
      },
    }));
    render(<YourNumbersScreen />);
    expect(screen.getByText('Open Men')).toBeTruthy();
    expect(screen.getByText('Sled push')).toBeTruthy();
    expect(screen.getByText(/4:55.*5:10\/km/)).toBeTruthy();
  });
});

describe('YourNumbersScreen — CrossFit section', () => {
  it('shows an empty state without goal params', () => {
    mockGoal.mockReturnValue({ data: { primaryGoal: 'crossfit' } });
    mockDisplay.mockReturnValue(envelope({ sport: 'crossfit', crossfit: null }));
    render(<YourNumbersScreen />);
    expect(screen.getByText(/enter your CrossFit numbers/)).toBeTruthy();
  });

  it('shows strength loads, energy systems, and Fran tier', () => {
    mockGoal.mockReturnValue({ data: { primaryGoal: 'crossfit' } });
    mockDisplay.mockReturnValue(envelope({
      sport: 'crossfit',
      crossfit: {
        strengthLoadsKg: { backSquat: 109, deadlift: 140, press: 47 },
        workingPercent1RM: 78,
        zoneName: 'Hypertrophy',
        energySystems: [
          { system: 'Phosphagen / alactic', minDurationSec: 0, maxDurationSec: 15, workToRest: '1:5-1:10', purpose: 'Power, speed' },
        ],
        benchmark: { name: 'Fran', timeDomain: 'short', athleteFranSec: 200, franTier: 'intermediate' },
      },
    }));
    render(<YourNumbersScreen />);
    expect(screen.getByText('Phosphagen / alactic')).toBeTruthy();
    expect(screen.getByText('Fran')).toBeTruthy();
    expect(screen.getByText('Intermediate')).toBeTruthy();
  });
});

describe('YourNumbersScreen — endurance sports show no sport-specific section', () => {
  it('renders no Strength/Hyrox/CrossFit heading for a run goal', () => {
    mockGoal.mockReturnValue({ data: { primaryGoal: 'run' } });
    mockDisplay.mockReturnValue(envelope({ sport: 'run' }));
    render(<YourNumbersScreen />);
    expect(screen.queryByText('STRENGTH')).toBeNull();
    expect(screen.queryByText('HYROX')).toBeNull();
    expect(screen.queryByText('CROSSFIT')).toBeNull();
  });
});
