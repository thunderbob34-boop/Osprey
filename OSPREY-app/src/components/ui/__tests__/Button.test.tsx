import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from '@/components/ui/Button';
import { Theme, Radius, BorderWidth } from '@/constants/theme';

/**
 * The app's first component tests. Every visual defect in the design migration
 * was caught by a grep, a human reading a diff, or not at all — because nothing
 * rendered a component. These cover the two Button paths that carry real risk:
 * the ReactNode children branch (which was dead on arrival) and wrapperStyle
 * (which exists because `style={{flex:1}}` silently did nothing).
 */

const flatten = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...[style].flat(Infinity).filter(Boolean) as object[]);

describe('Button — string children', () => {
  it('wraps a string in the themed Text', () => {
    render(<Button onPress={() => {}}>Start Run</Button>);
    expect(screen.getByText('Start Run')).toBeTruthy();
  });

  it('uses ink text on the filled primary, accent on the secondary', () => {
    const { unmount } = render(<Button onPress={() => {}}>Save</Button>);
    expect(flatten(screen.getByText('Save').props.style).color).toBe(Theme.ink);
    unmount();

    render(<Button variant="secondary" onPress={() => {}}>Skip</Button>);
    expect(flatten(screen.getByText('Skip').props.style).color).toBe(Theme.accent);
  });
});

describe('Button — ReactNode children (the branch that was unexercised)', () => {
  it('renders a non-string child as-is instead of wrapping it in Text', () => {
    render(
      <Button onPress={() => {}} accessibilityLabel="Saving">
        <ActivityIndicator testID="spinner" color={Theme.ink} />
      </Button>,
    );
    // The spinner survives. Wrapping it in <Text> would throw or swallow it.
    expect(screen.getByTestId('spinner')).toBeTruthy();
  });

  it('renders multi-element children, which a string-typed prop could not express', () => {
    render(
      <Button onPress={() => {}} accessibilityLabel="Save with icon">
        <View>
          <Text>Save</Text>
          <ActivityIndicator testID="inline-spinner" />
        </View>
      </Button>,
    );
    expect(screen.getByText('Save')).toBeTruthy();
    expect(screen.getByTestId('inline-spinner')).toBeTruthy();
  });
});

describe('Button — wrapperStyle vs style', () => {
  it('puts wrapperStyle on the OUTER node, which is what flexes in a row', () => {
    // The bug this prop exists to fix: `style` lands on the inner Pressable,
    // so flex:1 never reached the wrapper that is the row's flex child.
    render(
      <Button onPress={() => {}} wrapperStyle={{ flex: 1 }} accessibilityLabel="Pause">
        Pause
      </Button>,
    );
    // flex must NOT have leaked onto the Pressable — that was the bug.
    expect(flatten(screen.getByLabelText('Pause').props.style).flex).toBeUndefined();

    // The ROOT host node is the Animated.View wrapper, and it must carry flex.
    // (Assert on the rendered host tree: `.parent` walks composite components,
    // not host elements, so it never reaches this node.)
    const root = screen.toJSON();
    const rootNode = Array.isArray(root) ? root[0] : root;
    expect(flatten(rootNode?.props.style).flex).toBe(1);
  });

  it('still applies style to the Pressable, so padding overrides work', () => {
    render(
      <Button onPress={() => {}} style={{ paddingVertical: 14 }} accessibilityLabel="End">
        End
      </Button>,
    );
    expect(flatten(screen.getByLabelText('End').props.style).paddingVertical).toBe(14);
  });
});

describe('Button — accessibility and disabled state', () => {
  it('exposes the button role (RN Pressable does not set it automatically)', () => {
    render(<Button onPress={() => {}} accessibilityLabel="Go">Go</Button>);
    expect(screen.getByLabelText('Go').props.accessibilityRole).toBe('button');
  });

  it('reports disabled to assistive tech and dims to 0.5', () => {
    render(<Button onPress={() => {}} disabled accessibilityLabel="Saving">Saving</Button>);
    const pressable = screen.getByLabelText('Saving');
    expect(pressable.props.accessibilityState.disabled).toBe(true);
    expect(flatten(pressable.props.style).opacity).toBe(0.5);
  });

  it('does not fire onPress while disabled', () => {
    const onPress = jest.fn();
    render(<Button onPress={onPress} disabled accessibilityLabel="Saving">Saving</Button>);
    fireEvent.press(screen.getByLabelText('Saving'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('fires onPress when enabled', () => {
    const onPress = jest.fn();
    render(<Button onPress={onPress} accessibilityLabel="Go">Go</Button>);
    fireEvent.press(screen.getByLabelText('Go'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('Button — design tokens', () => {
  it('uses the card border width and radius, not ad-hoc values', () => {
    render(<Button onPress={() => {}} accessibilityLabel="Go">Go</Button>);
    const style = flatten(screen.getByLabelText('Go').props.style);
    expect(style.borderWidth).toBe(BorderWidth.card);
    expect(style.borderRadius).toBe(Radius.card);
    expect(style.borderColor).toBe(Theme.accent);
  });

  it('fills primary with accent and leaves secondary transparent', () => {
    const { unmount } = render(<Button onPress={() => {}} accessibilityLabel="P">P</Button>);
    expect(flatten(screen.getByLabelText('P').props.style).backgroundColor).toBe(Theme.accent);
    unmount();

    render(<Button variant="secondary" onPress={() => {}} accessibilityLabel="S">S</Button>);
    expect(flatten(screen.getByLabelText('S').props.style).backgroundColor).toBe('transparent');
  });
});
