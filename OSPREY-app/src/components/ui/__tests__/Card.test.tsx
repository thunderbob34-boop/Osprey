import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Theme, Radius, BorderWidth, Shadow } from '@/constants/theme';

const flatten = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...[style].flat(Infinity).filter(Boolean) as object[]);

const rootStyle = () => {
  const root = screen.toJSON();
  return flatten((Array.isArray(root) ? root[0] : root)?.props.style);
};

describe('Card', () => {
  it('renders its children', () => {
    render(<Card><Text>Body</Text></Card>);
    expect(screen.getByText('Body')).toBeTruthy();
  });

  it('uses panel/line/card tokens by default', () => {
    render(<Card><Text>Body</Text></Card>);
    const s = rootStyle();
    expect(s.backgroundColor).toBe(Theme.panel);
    expect(s.borderColor).toBe(Theme.line);
    expect(s.borderWidth).toBe(BorderWidth.card);
    expect(s.borderRadius).toBe(Radius.card);
  });

  it('switches the border to accent and adds the offset shadow when emphasized', () => {
    render(<Card emphasis><Text>Body</Text></Card>);
    const s = rootStyle();
    expect(s.borderColor).toBe(Theme.accent);
    expect(s.shadowOffset).toEqual(Shadow.emphasis.shadowOffset);
  });

  describe('style prop — widened to StyleProp<ViewStyle>', () => {
    it('accepts a plain object', () => {
      render(<Card style={{ marginTop: 12 }}><Text>Body</Text></Card>);
      expect(rootStyle().marginTop).toBe(12);
    });

    it('accepts an ARRAY — the case the narrow ViewStyle type rejected', () => {
      render(
        <Card style={[{ marginTop: 12 }, { padding: 20 }]}>
          <Text>Body</Text>
        </Card>,
      );
      const s = rootStyle();
      expect(s.marginTop).toBe(12);
      expect(s.padding).toBe(20);
    });

    it('accepts a conditional that resolves falsy, without a spread-merge', () => {
      const emphasized = false;
      render(
        <Card style={[{ marginTop: 8 }, emphasized && { borderColor: Theme.accent }]}>
          <Text>Body</Text>
        </Card>,
      );
      const s = rootStyle();
      expect(s.marginTop).toBe(8);
      expect(s.borderColor).toBe(Theme.line); // default survives
    });

    it('lets a caller override a default — style is composed last', () => {
      render(<Card style={{ padding: 0 }}><Text>Body</Text></Card>);
      // paywall.tsx relies on exactly this to get edge-to-edge feature rows.
      expect(rootStyle().padding).toBe(0);
    });
  });
});

describe('Badge', () => {
  it('renders its label', () => {
    render(<Badge>Estimated</Badge>);
    expect(screen.getByText('Estimated')).toBeTruthy();
  });

  it('is muted by default and accent on request', () => {
    const { unmount } = render(<Badge>Neutral</Badge>);
    expect(flatten(screen.getByText('Neutral').props.style).color).toBe(Theme.textMut);
    unmount();

    render(<Badge tone="accent">Accent</Badge>);
    expect(flatten(screen.getByText('Accent').props.style).color).toBe(Theme.accent);
  });

  it('uses Radius.card, not the ad-hoc 3px it originally shipped with', () => {
    render(<Badge>Label</Badge>);
    expect(rootStyle().borderRadius).toBe(Radius.card);
  });

  it('sets the display font and uppercase treatment', () => {
    render(<Badge>Label</Badge>);
    const s = flatten(screen.getByText('Label').props.style);
    expect(s.fontFamily).toBe('SpaceGrotesk_700Bold');
    expect(s.textTransform).toBe('uppercase');
  });
});
