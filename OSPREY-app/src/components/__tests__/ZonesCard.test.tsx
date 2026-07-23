jest.mock('@/hooks/useDisplayEnvelope', () => ({ useDisplayEnvelope: jest.fn() }));
jest.mock('@/hooks/useTrainingGoal', () => ({ useTrainingGoal: jest.fn() }));
jest.mock('@/hooks/useUnitPreference', () => ({ useUnitPreference: () => ({ units: 'imperial' }) }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

import { renderWithProviders as render, screen } from '@/test-utils/render';
import { ZonesCard } from '@/components/ZonesCard';
import { useDisplayEnvelope, type DisplayEnvelope } from '@/hooks/useDisplayEnvelope';
import { useTrainingGoal } from '@/hooks/useTrainingGoal';

const mockDisplay = useDisplayEnvelope as jest.Mock;
const mockGoal = useTrainingGoal as jest.Mock;

const HR_ZONES = {
  maxHR: 190,
  source: 'estimated' as const,
  // UltraHRZones' real field names (src/services/calculators/ultra.ts) — only
  // z2Endurance/z4Threshold are actually read by rowsForZones' HR-fallback
  // branch, but all 5 must be present and correctly named for this object to
  // type-check as HrZoneInfo.
  bands: {
    maxHR: 190,
    z1Recovery: { min: null, max: 133 },
    z2Endurance: { min: 133, max: 152 },
    z3SteadyMarathon: { min: 152, max: 162 },
    z4Threshold: { min: 162, max: 171 },
    z5Vo2Hills: { min: 171, max: null },
  },
};

function envelope(overrides: Partial<DisplayEnvelope>): DisplayEnvelope {
  return {
    sport: 'run',
    phase: 'Base',
    weekNumber: 1,
    totalWeeks: 8,
    targetWeeklyLoad: 200,
    hardSessionShareMax: 0.2,
    zones: null,
    hrZones: HR_ZONES,
    fuel: {
      dailyCarbGByDayType: { easy: { min: 0, max: 0 }, moderate: { min: 0, max: 0 }, high: { min: 0, max: 0 }, peak: { min: 0, max: 0 } },
      proteinG: { min: 0, max: 0 },
      longSessionCarbGPerHour: 0,
    },
    strength: null,
    hyrox: null,
    crossfit: null,
    confidence: 'estimated',
    ...overrides,
  };
}

beforeEach(() => {
  mockGoal.mockReturnValue({ data: { primaryGoal: 'run' } });
});

describe('ZonesCard — sport coverage (representative case per distinct rendering path)', () => {
  it('shows real run pace zones for a run goal', () => {
    mockDisplay.mockReturnValue(envelope({
      sport: 'run',
      zones: { kind: 'run', thresholdSecPerMile: 480, bands: { easy: { min: 570, max: 630 } } } as never,
      confidence: 'measured',
    }));
    render(<ZonesCard />);
    expect(screen.getByText('YOUR ZONES')).toBeTruthy();
    expect(screen.getByText('Easy')).toBeTruthy();
    expect(screen.getByText('Threshold')).toBeTruthy();
  });

  it('shows real run pace zones for hyrox (blueprintSport maps hyrox -> run, unchanged from today)', () => {
    mockDisplay.mockReturnValue(envelope({
      sport: 'hyrox',
      zones: { kind: 'run', thresholdSecPerMile: 480, bands: { easy: { min: 570, max: 630 } } } as never,
    }));
    mockGoal.mockReturnValue({ data: { primaryGoal: 'hyrox' } });
    render(<ZonesCard />);
    expect(screen.getByText('YOUR ZONES')).toBeTruthy();
  });

  it('shows the HR-bpm fallback card for crossfit (no pace/power blueprint, unchanged from today)', () => {
    mockDisplay.mockReturnValue(envelope({ sport: 'crossfit', zones: null }));
    mockGoal.mockReturnValue({ data: { primaryGoal: 'crossfit' } });
    render(<ZonesCard />);
    expect(screen.getByText('YOUR ZONES')).toBeTruthy();
    expect(screen.getByText('Easy')).toBeTruthy(); // the HR-fallback row label
  });

  it('shows the HR-bpm fallback card for weight_loss', () => {
    mockDisplay.mockReturnValue(envelope({ sport: 'weight_loss', zones: null }));
    mockGoal.mockReturnValue({ data: { primaryGoal: 'weight_loss' } });
    render(<ZonesCard />);
    expect(screen.getByText('YOUR ZONES')).toBeTruthy();
  });

  it('shows real watts zones for cycling with a self-reported FTP', () => {
    mockDisplay.mockReturnValue(envelope({
      sport: 'cycling',
      zones: { kind: 'cycling', ftpWatts: 220, bands: { z2Endurance: { min: 100, max: 140 }, z4Threshold: { min: 190, max: 220 } } } as never,
      confidence: 'measured',
    }));
    mockGoal.mockReturnValue({ data: { primaryGoal: 'cycling' } });
    render(<ZonesCard />);
    expect(screen.getByText('Endurance')).toBeTruthy();
  });

  it('shows the compact per-discipline card for triathlon', () => {
    mockDisplay.mockReturnValue(envelope({
      sport: 'triathlon',
      zones: {
        kind: 'triathlon',
        run: { kind: 'run', thresholdSecPerMile: 480, bands: {} as never },
        swim: { kind: 'swim', cssSecPer100: 90, bands: {} as never },
        bike: null,
      } as never,
    }));
    mockGoal.mockReturnValue({ data: { primaryGoal: 'triathlon' } });
    render(<ZonesCard />);
    expect(screen.getByText('Run')).toBeTruthy();
    expect(screen.getByText('Swim')).toBeTruthy();
  });

  it('renders nothing for a lift goal — the one sport whose card presence changes', () => {
    mockDisplay.mockReturnValue(envelope({ sport: 'lift', zones: null }));
    mockGoal.mockReturnValue({ data: { primaryGoal: 'lift' } });
    render(<ZonesCard />);
    expect(screen.queryByText('YOUR ZONES')).toBeNull();
  });

  it('renders nothing while the hook is still loading', () => {
    mockDisplay.mockReturnValue(null);
    render(<ZonesCard />);
    expect(screen.queryByText('YOUR ZONES')).toBeNull();
  });
});
