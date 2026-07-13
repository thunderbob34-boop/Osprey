import { Easing, FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

// One shared "voice" for how surfaces arrive on screen, so the Home, Exercise,
// and Nutrition tabs all animate in with the same rhythm rather than each
// inventing its own timing. Reanimated automatically skips these entrances when
// the OS "Reduce Motion" accessibility setting is on (ReduceMotion.System is
// the builder default), so no extra guard is needed for accessibility.

const ENTER_MS = 380;
const STAGGER_MS = 65;
const EASE = Easing.out(Easing.cubic);

/**
 * Rise-and-fade entrance for a card at position `index` in a vertical stack.
 * Later cards start slightly later, producing a gentle cascade as the screen
 * settles.
 */
export function cardEntering(index: number) {
  return FadeInDown.duration(ENTER_MS)
    .delay(index * STAGGER_MS)
    .easing(EASE);
}

/** Quick fade-in for content that expands in place (e.g. an accordion body). */
export const sectionEntering = FadeIn.duration(200).easing(EASE);

/** Matching fade-out so expanded content doesn't pop away when collapsed. */
export const sectionExiting = FadeOut.duration(140);
