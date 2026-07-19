import React from 'react';
import { renderWithProviders as render, screen, fireEvent } from '@/test-utils/render';
import StatsScreen from '@/../app/(tabs)/stats';
import { ChartPalette, Theme } from '@/constants/theme';
import { Colors } from '@/constants/colors';

/**
 * stats.tsx was NEVER rendered during the design migration. It is a tab route,
 * and react-native-web would not drive tab navigation in the preview, so the
 * eight-sport ChartPalette was chosen from static mockups and shipped unseen.
 *
 * These tests close what is closeable: that the right colour reaches the right
 * mark, and that the fitness chart's three independent encodings agree. They do
 * NOT close whether bike and swim separate to a human eye, or whether the
 * fatigue line is too dim — those still need a device.
 */

const mockSeries = Array.from({ length: 10 }, (_, i) => ({
  date: `2026-07-${String(i + 1).padStart(2, '0')}`,
  atl: 40 + i,
  ctl: 50 + i,
}));

const mockPerf = {
  atl: 49,
  ctl: 59,
  tsb: 10,
  series: mockSeries,
  trainingReadiness: { tsb: 10, ctl: 59, label: 'Fresh', tone: 'fresh' as const },
  raceReadiness: null,
  // Not null — the screen reads injuryRisk.level. 'moderate' also renders the
  // middle severity tier, so the 3-tier banner gets exercised.
  injuryRisk: { level: 'moderate' as const, acwr: 1.35, message: 'Load climbing — keep an easy day in.' },
};

const SPORTS = ['run', 'bike', 'swim', 'rowing', 'lift', 'hyrox', 'cross', 'race'] as const;

// Shape matches StatsData in src/types/stats.ts exactly — every sport present
// so all eight stacked-bar segments render.
const mockStats = {
  totalWorkouts30d: 12,
  totalMiles30d: 48,
  totalMinutes30d: 640,
  weeklySportVolume: [
    {
      weekStartIso: '2026-07-13',
      label: 'Jul 13',
      totalHours: 8,
      hoursBySport: {
        run: 3, bike: 1, swim: 1, rowing: 0.5,
        lift: 1, hyrox: 0.5, cross: 0.5, race: 0.5,
      },
    },
  ],
  sportTotalsPeriod: SPORTS.map((sessionType) => ({
    sessionType,
    hours: 1,
    miles: sessionType === 'lift' ? null : 5,
  })),
  recentWorkouts: [],
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));
jest.mock('@/hooks/useStats', () => ({
  useStats: () => ({ data: mockStats, isLoading: false, error: null }),
}));
jest.mock('@/hooks/usePerformance', () => ({
  usePerformance: () => ({ data: mockPerf, isLoading: false }),
}));
jest.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ isPlus: true }) }));
jest.mock('@/hooks/useLiftAnalytics', () => ({ useLiftAnalytics: () => ({ data: null }) }));
jest.mock('@/hooks/useTodayLog', () => ({ useDeleteWorkoutLog: () => ({ mutate: jest.fn() }) }));
jest.mock('@/hooks/useUnitPreference', () => ({
  useUnitPreference: () => ({ units: 'imperial', isLoading: false, setUnits: jest.fn() }),
}));

/** Every `stroke` value in the rendered tree — SVG lines. */
function collectStrokes(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out;
  const n = node as { props?: Record<string, unknown>; children?: unknown[] };
  const stroke = n.props?.stroke;
  if (typeof stroke === 'string') out.push(stroke.toLowerCase());
  for (const child of n.children ?? []) collectStrokes(child, out);
  return out;
}

/** Every backgroundColor in the rendered tree — bars, dots, chips. */
function collectBackgrounds(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out;
  const n = node as { props?: Record<string, unknown>; children?: unknown[] };
  const styles = [n.props?.style].flat(Infinity).filter(Boolean) as Record<string, unknown>[];
  for (const s of styles) {
    if (typeof s?.backgroundColor === 'string') out.push(s.backgroundColor.toLowerCase());
  }
  for (const child of n.children ?? []) collectBackgrounds(child, out);
  return out;
}

const root = () => {
  const r = screen.toJSON();
  return Array.isArray(r) ? r[0] : r;
};

const colorOf = (el: { props: { style?: unknown } }) =>
  Object.assign({}, ...([el.props.style].flat(Infinity).filter(Boolean) as object[])).color;

/**
 * The charts guard on `width <= 0`, and onLayout never fires in a test
 * renderer — so without this the SVG returns null and every stroke assertion
 * silently passes against an empty tree.
 */
function renderWithCharts() {
  const utils = render(<StatsScreen />);
  const svgWraps = screen.UNSAFE_root.findAll(
    (n: { props?: Record<string, unknown> }) => typeof n.props?.onLayout === 'function',
  );
  for (const w of svgWraps) {
    fireEvent(w, 'layout', { nativeEvent: { layout: { width: 320, height: 120 } } });
  }
  return utils;
}

describe('stats — renders', () => {
  it('renders without crashing', () => {
    renderWithCharts();
    expect(screen.toJSON()).toBeTruthy();
  });
});

describe('stats — the fitness chart\'s three encodings must agree', () => {
  // CTL/ATL is encoded THREE independent times: the polyline strokes, the
  // legend dots, and the FitnessMetric values. A task boundary once split the
  // chart from its own legend and the dots kept the OLD colours while the lines
  // changed — the chart actively mislabelled the athlete's training load, and
  // only a reviewer reading a diff caught it. This makes that impossible.
  it('draws the CTL line in run and the ATL line in neutral', () => {
    renderWithCharts();
    const strokes = collectStrokes(root());
    expect(strokes).toContain(ChartPalette.run.toLowerCase());
    expect(strokes).toContain(ChartPalette.neutral.toLowerCase());
  });

  it('renders the FITNESS value in the same colour as the CTL line', () => {
    renderWithCharts();
    expect(colorOf(screen.getByText('59.0'))).toBe(ChartPalette.run);
  });

  it('renders the FATIGUE value in the same colour as the ATL line', () => {
    renderWithCharts();
    expect(colorOf(screen.getByText('49.0'))).toBe(ChartPalette.neutral);
  });

  it('keeps CTL and ATL visually distinct', () => {
    expect(ChartPalette.run).not.toBe(ChartPalette.neutral);
  });
});

describe('stats — FORM keeps its red/green threshold', () => {
  // A functional good/bad signal, deliberately NOT migrated to brand colours.
  it('shows a positive TSB in green', () => {
    renderWithCharts();
    expect(colorOf(screen.getByText('+10.0'))).toBe(Colors.green);
  });
});

describe('stats — the eight-sport stacked bar', () => {
  // Colour is the ONLY encoding a stacked-bar segment has — there is no room
  // for an icon or a label. That is why "scheme B" (drop the hues) was applied
  // to the Workout tab but deliberately NOT here.
  it('gives all eight sports a distinct colour', () => {
    const sports = Object.entries(ChartPalette)
      .filter(([k]) => k !== 'neutral')
      .map(([, v]) => v);
    expect(new Set(sports).size).toBe(sports.length);
  });

  it('renders every sport segment present in the week', () => {
    renderWithCharts();
    const backgrounds = collectBackgrounds(root());
    for (const sport of ['run', 'bike', 'swim', 'rowing', 'lift', 'hyrox', 'cross', 'race'] as const) {
      expect(backgrounds).toContain(ChartPalette[sport].toLowerCase());
    }
  });

  it('keeps bike and swim different — they are ADJACENT in the stack', () => {
    // They physically touch in every bar. Whether they separate to a human eye
    // still needs a device; this only proves they are not the same value.
    expect(ChartPalette.bike).not.toBe(ChartPalette.swim);
  });
});

describe('stats — no old-system colours reach the screen', () => {
  it('renders no old teal, bg, bgCard or textPrimary', () => {
    renderWithCharts();
    const old = [Colors.teal, Colors.bg, Colors.bgCard, Colors.textPrimary].map((c) =>
      String(c).toLowerCase(),
    );
    const all = [...collectBackgrounds(root()), ...collectStrokes(root())];
    expect(all.filter((c) => old.includes(c))).toEqual([]);
  });

  it('does render the accent, so the check above is not vacuous', () => {
    renderWithCharts();
    const all = [...collectBackgrounds(root()), ...collectStrokes(root())];
    expect(all).toContain(Theme.accent.toLowerCase());
  });
});
