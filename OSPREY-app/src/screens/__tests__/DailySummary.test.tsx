import React from 'react';
import { renderWithProviders as render, screen } from '@/test-utils/render';
import DailySummary from '@/screens/DailySummary';
import { Theme, ReadinessPalette } from '@/constants/theme';
import { Colors } from '@/constants/colors';

/**
 * First SCREEN test in the app (the primitives got the first component tests).
 *
 * DailySummary is the Home screen — the most-seen surface in the product, and
 * the one where old-system teal survived eight slices of migration because a
 * service handed it a raw colour. These tests exist to make that class of
 * regression impossible to reintroduce silently.
 *
 * DailySummary is props-driven, so every state is reachable without a backend.
 * Only `useUnitPreference` needs mocking.
 */

jest.mock('@/hooks/useUnitPreference', () => ({
  useUnitPreference: () => ({ units: 'imperial', isLoading: false, setUnits: jest.fn() }),
}));

/** Walk the rendered host tree and collect every colour-ish style value. */
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

const renderedColors = () => {
  const root = screen.toJSON();
  return collectColors(Array.isArray(root) ? root[0] : root);
};

describe('DailySummary — states', () => {
  it('renders a loading state without crashing', () => {
    render(<DailySummary isLoading />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it('surfaces an error message when one is passed', () => {
    render(<DailySummary error="Could not load your day" />);
    expect(screen.getByText('Could not load your day')).toBeTruthy();
  });

  it('renders the empty/no-plan state with the user name', () => {
    // The greeting itself is computed from the clock inside the screen, so
    // match on the name rather than pinning a time-of-day string.
    render(<DailySummary userName="testrunner" />);
    expect(screen.getByText(/testrunner/)).toBeTruthy();
  });
});

describe('DailySummary — ReadinessCard tone mapping', () => {
  // This is the change that shipped WITHOUT ever being rendered: readinessFromTsb
  // stopped returning a colour and started returning a tone, and the mapping
  // moved here. These assertions are the first proof it resolves correctly.
  const cases = [
    ['detrained', 'Peak Fresh'],
    ['fresh', 'Fresh'],
    ['ready', 'Ready'],
    ['carrying', 'Carrying Load'],
    ['fatigued', 'Fatigued'],
    ['overreached', 'Overreached'],
  ] as const;

  it.each(cases)('maps the %s tone to its palette colour', (tone, label) => {
    render(
      <DailySummary
        trainingReadiness={{ tsb: 0, ctl: 42, label, tone }}
      />,
    );
    const styles = [screen.getByText(label).props.style].flat(Infinity).filter(Boolean);
    const color = Object.assign({}, ...(styles as object[])).color;
    expect(color).toBe(ReadinessPalette[tone]);
  });

  it('gives Ready the brand accent — it is the target state, not the top of a ramp', () => {
    render(<DailySummary trainingReadiness={{ tsb: -2, ctl: 50, label: 'Ready', tone: 'ready' }} />);
    const styles = [screen.getByText('Ready').props.style].flat(Infinity).filter(Boolean);
    expect(Object.assign({}, ...(styles as object[])).color).toBe(Theme.accent);
  });

  it('recedes Peak Fresh to neutral rather than colouring it as a win', () => {
    render(
      <DailySummary trainingReadiness={{ tsb: 20, ctl: 30, label: 'Peak Fresh', tone: 'detrained' }} />,
    );
    const styles = [screen.getByText('Peak Fresh').props.style].flat(Infinity).filter(Boolean);
    expect(Object.assign({}, ...(styles as object[])).color).toBe('#7d8aa5');
  });
});

describe('DailySummary — no old-system colours reach the screen', () => {
  // The regression that survived EIGHT slices: readinessFromTsb returned
  // Colors.teal, and it rendered right here on the migrated home screen because
  // no slice ever scoped services/. A grep found it; this test prevents it.
  const OLD_SYSTEM = [Colors.teal, Colors.bg, Colors.bgCard, Colors.textPrimary].map((c) =>
    String(c).toLowerCase(),
  );

  it.each([
    ['empty', {}],
    ['ready readiness', { trainingReadiness: { tsb: 0, ctl: 40, label: 'Ready', tone: 'ready' as const } }],
    ['detrained readiness', { trainingReadiness: { tsb: 20, ctl: 40, label: 'Peak Fresh', tone: 'detrained' as const } }],
  ])('renders no old-system chrome colour in the %s state', (_name, props) => {
    render(<DailySummary {...props} />);
    const found = renderedColors().filter((c) => OLD_SYSTEM.includes(c));
    expect(found).toEqual([]);
  });

  it('does render the new accent, proving the check above is not vacuous', () => {
    render(<DailySummary trainingReadiness={{ tsb: 0, ctl: 40, label: 'Ready', tone: 'ready' }} />);
    expect(renderedColors()).toContain(Theme.accent.toLowerCase());
  });
});
