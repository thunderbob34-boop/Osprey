import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

export type SessionIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * One icon per session type, shared by every screen that renders a plan.
 *
 * calendar.tsx, plan-preview.tsx and the Stats tab each kept their own copy of
 * this map. They drifted — calendar was missed when rowing/hyrox were added,
 * and again when plan-preview moved off emoji, so the two screens that render
 * the same plan showed it differently. A parity test existed for exactly that
 * invariant but pinned literal glyphs rather than comparing the modules, so it
 * could not see the second drift. One exported map removes the class of bug.
 *
 * Vector glyphs, not emoji: emoji can't take the accent colour, render
 * differently per platform, and — the reason this mattered here — `lift` and
 * `hyrox` were U+1F3CB and the same codepoint plus a ZWJ gender modifier, so
 * they were indistinguishable at calendar size.
 */
export const SESSION_ICON: Record<string, SessionIconName> = {
  run: 'run',
  lift: 'dumbbell',
  swim: 'swim',
  bike: 'bike',
  rowing: 'rowing',
  hyrox: 'arm-flex',
  cross: 'sync',
  race: 'flag-checkered',
  rest: 'sleep',
};

/** Shown when a session type has no mapping — deliberately neutral, not a guess. */
export const SESSION_ICON_FALLBACK: SessionIconName = 'circle-small';
