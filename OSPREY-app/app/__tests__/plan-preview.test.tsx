import React from 'react';
import { renderWithProviders as render, screen, fireEvent } from '@/test-utils/render';
import PlanPreview from '@/../app/plan-preview';
import { EffortPalette, IntensityPalette, Theme } from '@/constants/theme';
import { Colors } from '@/constants/colors';
import { kmToMiles } from '@/services/units';

/**
 * plan-preview renders BOTH colour scales this project reworked:
 * EffortPalette (interval segments) and IntensityPalette (session chips).
 * Neither had ever been rendered — the effort ramp was fixed after a grep
 * found plan-preview keeping its own drifted copy, and IntensityPalette was
 * derived from it in the same pass. These are the first assertions that they
 * resolve correctly on screen.
 *
 * Sessions arrive through route params as JSON (the post-generation flow), so
 * the whole screen is drivable without touching the network path.
 */

const mockSessions = [
  {
    session_date: '2026-07-20',
    session_type: 'run',
    intensity: 'easy',
    planned_minutes: 45,
    planned_distance_km: 8,
    description: 'Easy aerobic run',
    interval_prescription: {
      segments: [
        { label: '400m', reps: 4, effort: 'easy', restS: 60 },
        { label: '400m', reps: 4, effort: 'moderate', restS: 60 },
        { label: '400m', reps: 4, effort: 'threshold', restS: 60 },
        { label: '400m', reps: 4, effort: 'hard', restS: 60 },
        { label: '400m', reps: 4, effort: 'max', restS: 60 },
      ],
    },
  },
  {
    session_date: '2026-07-21',
    session_type: 'run',
    intensity: 'threshold',
    planned_minutes: 60,
    planned_distance_km: 12,
    description: 'Threshold session',
  },
  {
    session_date: '2026-07-22',
    session_type: 'rest',
    intensity: 'rest',
    planned_minutes: null,
    planned_distance_km: null,
    description: 'Rest day',
  },
  {
    session_date: '2026-07-23',
    session_type: 'hyrox',
    intensity: 'threshold',
    planned_minutes: 40,
    planned_distance_km: 6,
    description: 'Compromised-Running Intervals',
  },
  {
    session_date: '2026-07-24',
    session_type: 'rowing',
    intensity: 'moderate',
    planned_minutes: 30,
    planned_distance_km: 6,
    description: 'Steady Row',
  },
];

// 8 (interval run) + 12 (threshold run) + 6 (hyrox) = 26km of "real mileage".
// Rowing's 6km is erg distance, not comparable to road mileage, and stays excluded.
const EXPECTED_TOTAL_DISTANCE_KM = 26;

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ sessions: JSON.stringify(mockSessions) }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissAll: jest.fn() }),
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ user: { id: 'test-user' } }),
}));

jest.mock('@/hooks/useUnitPreference', () => ({
  useUnitPreference: () => ({ units: 'imperial', isLoading: false, setUnits: jest.fn() }),
}));

jest.mock('@/hooks/useNutritionCoaching', () => ({
  useNutritionCoaching: () => ({ data: null, isLoading: false }),
}));

jest.mock('@/hooks/useHydration', () => ({
  useHydration: () => ({ data: null, isLoading: false, add: jest.fn() }),
}));

jest.mock('@/hooks/useWeatherCoach', () => ({
  useWeatherCoach: () => ({ data: null, isLoading: false }),
}));

/** All colour-ish style values in the rendered tree. */
function collectColors(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out;
  const n = node as { props?: Record<string, unknown>; children?: unknown[] };
  const styles = [n.props?.style].flat(Infinity).filter(Boolean) as Record<string, unknown>[];
  for (const s of styles) {
    for (const [k, v] of Object.entries(s ?? {})) {
      if (typeof v === 'string' && /color/i.test(k)) out.push(v.toLowerCase());
    }
  }
  for (const child of n.children ?? []) collectColors(child, out);
  return out;
}

const colorOf = (el: { props: { style?: unknown } }) =>
  Object.assign({}, ...([el.props.style].flat(Infinity).filter(Boolean) as object[])).color;

const renderedColors = () => {
  const root = screen.toJSON();
  return collectColors(Array.isArray(root) ? root[0] : root);
};

/**
 * Session rows are collapsed by default — the detail panel (where both palettes
 * render) only mounts once a row is expanded. Tap the first session's row.
 */
function renderExpanded() {
  const utils = render(<PlanPreview />);
  // Three sessions render three matching labels — the interval session is first.
  fireEvent.press(screen.getAllByLabelText(/Show details for/)[0]);
  return utils;
}

describe('plan-preview — renders', () => {
  it('renders the session list from route params', () => {
    render(<PlanPreview />);
    expect(screen.getByText('Easy aerobic run')).toBeTruthy();
    expect(screen.getByText('Threshold session')).toBeTruthy();
  });
});

describe('plan-preview — EffortPalette reaches interval segments', () => {
  // The ramp lived as local constants in endurance.tsx and plan-preview grew a
  // drifted copy: moderate was teal, and hard/max were BOTH red — six levels in
  // four colours. Now shared. These prove it renders correctly here.
  it.each([
    ['easy', EffortPalette.easy],
    ['moderate', EffortPalette.moderate],
    ['threshold', EffortPalette.threshold],
    ['hard', EffortPalette.hard],
    ['max', EffortPalette.max],
  ])('renders the %s segment in its ramp colour', (effort, expected) => {
    renderExpanded();
    // "easy" appears twice (intensity chip + interval segment). Both must be
    // this colour — asserted directly in the cross-scale test below — so taking
    // the last match is safe and keeps this parametrised case simple.
    const matches = screen.getAllByText(effort);
    expect(colorOf(matches[matches.length - 1])).toBe(expected);
  });

  it('gives hard and max DIFFERENT colours — they were both red before', () => {
    renderExpanded();
    expect(colorOf(screen.getByText('hard'))).not.toBe(colorOf(screen.getByText('max')));
  });

  it('gives moderate a colour of its own, not teal and not easy\'s', () => {
    renderExpanded();
    const moderate = colorOf(screen.getByText('moderate'));
    expect(moderate).not.toBe(EffortPalette.easy);
    expect(String(moderate).toLowerCase()).not.toBe(String(Colors.teal).toLowerCase());
  });
});

describe('plan-preview — IntensityPalette reaches session chips', () => {
  it('renders the intensity chip in its palette colour', () => {
    renderExpanded();
    // The chip shows the session's intensity; capitalized via textTransform,
    // so the underlying text node is still the raw value.
    const chip = screen.getAllByText('easy')[0];
    expect(colorOf(chip)).toBe(IntensityPalette.easy.fg);
  });

  it('THE CROSS-SCALE BUG, proven on screen: both "easy" labels render the same colour', () => {
    // The expanded session shows "easy" TWICE — once as the intensity chip and
    // once as an interval segment. Before IntensityPalette was derived from
    // EffortPalette these were unrelated hand-written maps that merely shared
    // key names, so the same word could render two different colours in one
    // view. This asserts on the actual rendered elements, not the constants.
    renderExpanded();
    const easies = screen.getAllByText('easy');
    expect(easies.length).toBeGreaterThanOrEqual(2);
    const colors = new Set(easies.map(colorOf));
    expect(colors.size).toBe(1);
    expect([...colors][0]).toBe(EffortPalette.easy);
  });
});

describe('plan-preview — session-type icons and mileage rollup', () => {
  // SESSION_ICONS was missing both 'rowing' and 'hyrox' (added to the DB enum
  // and the AI plan-generator's own type list in the same pass) — it silently
  // fell back to a bare circle for both instead of crashing, which is exactly
  // the kind of gap that's easy to miss without a direct assertion.
  // Asserts on the icon's `name` prop rather than a glyph: these were emoji
  // until the vector-icon sweep, and pinning literal characters made the test
  // fail on a pure presentation change while still not proving the mapping.
  // The fallback is 'circle-small', so naming it keeps the original intent.
  const iconNames = () =>
    screen.UNSAFE_getAllByProps({}).reduce<string[]>((names, node) => {
      const name = (node.props as { name?: unknown }).name;
      return typeof name === 'string' ? [...names, name] : names;
    }, []);

  it('renders a real icon for a hyrox session, not the "unknown type" fallback', () => {
    render(<PlanPreview />);
    expect(iconNames()).toContain('arm-flex');
  });

  it('renders a real icon for a rowing session, not the "unknown type" fallback', () => {
    render(<PlanPreview />);
    expect(iconNames()).toContain('rowing');
    expect(iconNames()).not.toContain('circle-small');
  });

  it('counts a hyrox session\'s planned_distance_km toward the week\'s mileage total (real running distance), but not rowing\'s (erg distance)', () => {
    render(<PlanPreview />);
    const expectedMiles = kmToMiles(EXPECTED_TOTAL_DISTANCE_KM).toFixed(1);
    expect(screen.getByText(expectedMiles)).toBeTruthy();
  });
});

describe('plan-preview — no old-system colours reach the screen', () => {
  it('renders no old teal, bg, bgCard or textPrimary anywhere', () => {
    renderExpanded();
    const oldSystem = [Colors.teal, Colors.bg, Colors.bgCard, Colors.textPrimary].map((c) =>
      String(c).toLowerCase(),
    );
    expect(renderedColors().filter((c) => oldSystem.includes(c))).toEqual([]);
  });

  it('does render the new accent, so the check above is not vacuous', () => {
    renderExpanded();
    expect(renderedColors()).toContain(Theme.accent.toLowerCase());
  });
});
