import { Theme, Radius, BorderWidth, Spacing, Shadow, ChartPalette } from '@/constants/theme';

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
