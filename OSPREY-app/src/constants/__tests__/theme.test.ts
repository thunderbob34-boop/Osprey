import { Theme, Radius, BorderWidth, Spacing, Shadow, ChartPalette, ReadinessPalette, EffortPalette, IntensityPalette } from '@/constants/theme';

describe('Theme tokens — pinned to the design spec (2026-07-17)', () => {
  it('matches the color values in design.md §1', () => {
    expect(Theme).toEqual({
      ink: '#09090B',
      panel: '#101014',
      line: '#3F3F46',
      accent: '#c8793a',
      accentBright: '#d98b4a',
      text: '#FAFAFA',
      textSoft: '#c9cbd1',
      textMut: '#A1A1AA',
    });
  });

  it('uses a 4px radius, not the webapp\'s zero-radius', () => {
    expect(Radius).toEqual({ card: 4 });
  });

  it('matches the border width and spacing scale in design.md §1', () => {
    expect(BorderWidth).toEqual({ card: 2 });
    expect(Spacing).toEqual({ xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 });
  });

  it('defines a softened offset shadow for emphasized surfaces', () => {
    expect(Shadow.emphasis).toEqual({
      shadowColor: '#000',
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    });
  });
});

describe('EffortPalette — pinned effort ramp (2026-07-18)', () => {
  it('matches the design spec', () => {
    expect(EffortPalette).toEqual({
      rest: '#A1A1AA',
      easy: '#4cde80',
      moderate: '#d4c44a',
      threshold: '#c8793a',
      hard: '#e85d32',
      max: '#ff4444',
    });
  });

  it('gives all six levels a distinct colour', () => {
    // The whole point of this ramp. Before it, endurance had easy+moderate both
    // teal and hard+max both red, and plan-preview had hard+max both red — six
    // levels rendered in four colours.
    const values = Object.values(EffortPalette);
    expect(new Set(values).size).toBe(values.length);
  });

  it('uses the live Theme tokens for rest and threshold, not copies that can drift', () => {
    expect(EffortPalette.rest).toBe(Theme.textMut);
    expect(EffortPalette.threshold).toBe(Theme.accent);
  });
});

describe('IntensityPalette — session intensity, derived from the effort ramp', () => {
  it('gives all six intensities a distinct foreground', () => {
    // Was moderate+threshold both amber and interval+race both red — six
    // intensities in four colours, the same collapse EffortPalette fixed.
    const fgs = Object.values(IntensityPalette).map((v) => v.fg);
    expect(new Set(fgs).size).toBe(fgs.length);
  });

  it('shares the effort ramp rather than copying it', () => {
    // The four keys the two scales have in common must resolve identically —
    // an "easy" session and an "easy" interval are the same idea.
    expect(IntensityPalette.rest.fg).toBe(EffortPalette.rest);
    expect(IntensityPalette.easy.fg).toBe(EffortPalette.easy);
    expect(IntensityPalette.moderate.fg).toBe(EffortPalette.moderate);
    expect(IntensityPalette.threshold.fg).toBe(EffortPalette.threshold);
  });

  it('maps the two session-only intensities onto the ramp top end', () => {
    // interval ≈ a hard day, race ≈ maximal. Keeps one ordered ladder.
    expect(IntensityPalette.interval.fg).toBe(EffortPalette.hard);
    expect(IntensityPalette.race.fg).toBe(EffortPalette.max);
  });

  it('derives every chip background from its own foreground', () => {
    // Not hand-picked rgba literals — that is how the fg and bg of a chip
    // drift apart.
    for (const v of Object.values(IntensityPalette)) {
      expect(v.bg).toBe(`${v.fg}26`);
    }
  });
});

describe('ReadinessPalette — pinned readiness scale (2026-07-18)', () => {
  it('marks Ready with the brand accent, since Ready is the target state', () => {
    expect(ReadinessPalette.ready).toBe(Theme.accent);
  });

  it('recedes the detrained end to neutral rather than colouring it as a win', () => {
    // TSB above +15 usually means fitness has been rested off — a signal, not
    // an achievement. It must NOT read as the top of a good-to-bad ramp.
    expect(ReadinessPalette.detrained).toBe('#7d8aa5');
  });

  it('matches the design spec', () => {
    expect(ReadinessPalette).toEqual({
      detrained: '#7d8aa5',
      fresh: '#4cde80',
      ready: '#c8793a',
      carrying: '#d4c44a',
      fatigued: '#e85d32',
      overreached: '#ff4444',
    });
  });

  it('gives every state a distinct colour', () => {
    const values = Object.values(ReadinessPalette);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('ChartPalette — pinned chart series colours (2026-07-18)', () => {
  it('leads with the brand accent for run and keeps seven muted categoricals', () => {
    expect(ChartPalette).toEqual({
      run: '#c8793a',
      bike: '#5b7fa6',
      swim: '#5aa06d',
      rowing: '#6b6fa8',
      lift: '#a8935c',
      hyrox: '#b05f4f',
      cross: '#9c6b8a',
      race: '#d4c44a',
      neutral: '#7d8aa5',
    });
  });

  it('uses the exact Theme.accent value for run, not a copy that can drift', () => {
    expect(ChartPalette.run).toBe(Theme.accent);
  });

  it('gives every sport a distinct colour (a stacked bar has no other encoding)', () => {
    const sports = Object.entries(ChartPalette)
      .filter(([key]) => key !== 'neutral')
      .map(([, value]) => value);
    expect(new Set(sports).size).toBe(sports.length);
  });
});
