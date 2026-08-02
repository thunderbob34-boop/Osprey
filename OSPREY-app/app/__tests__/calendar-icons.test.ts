import { SESSION_ICON, SESSION_ICON_FALLBACK } from '@/constants/session-icons';
import { WORKOUT_TYPES } from '@/types/log';

/**
 * calendar.tsx, plan-preview.tsx and the Stats tab render the same plan and
 * must show it identically. They each used to keep their own icon map and
 * drifted twice: calendar was missed when rowing/hyrox were added, then again
 * when plan-preview moved off emoji.
 *
 * The previous version of this test pinned literal glyphs
 * (`expect(SESSION_ICON.hyrox).toBe('🏋️‍♂️')`), which could not detect the
 * second drift — plan-preview changed and these assertions still passed. The
 * screens now import one shared map, so agreement is structural, and what is
 * left worth asserting is that the map itself is sound.
 */
describe('SESSION_ICON', () => {
  const EMITTABLE = ['run', 'lift', 'swim', 'bike', 'rowing', 'hyrox', 'cross', 'race', 'rest'];

  it('covers every session type the plan generator can emit', () => {
    for (const type of EMITTABLE) {
      expect(SESSION_ICON[type]).toBeTruthy();
    }
  });

  it('gives every session type a DISTINCT glyph', () => {
    // lift and hyrox were U+1F3CB and the same codepoint plus a ZWJ gender
    // modifier — visually identical at the 14px the calendar renders, so a
    // lift day and a Hyrox day could not be told apart.
    const icons = EMITTABLE.map((t) => SESSION_ICON[t]);
    expect(new Set(icons).size).toBe(EMITTABLE.length);
  });

  it('never resolves a real session type to the unknown-type fallback', () => {
    for (const type of EMITTABLE) {
      expect(SESSION_ICON[type]).not.toBe(SESSION_ICON_FALLBACK);
    }
  });
});

/**
 * The Log tab's manual entry is the other half of the same invariant. It kept
 * a FOURTH private icon map (missing swim/bike/rowing/hyrox, falling back to
 * 'run'), and its type list was still the original four while swim/bike and
 * rowing/hyrox had been added to session_type_enum and given live runners.
 * A pool swim could only be filed as "Cross", and editing an existing swim
 * showed no selected type at all.
 */
describe('manual workout logging covers the session types', () => {
  // Everything an athlete can log by hand — a rest day is not a workout.
  const LOGGABLE = ['run', 'lift', 'swim', 'bike', 'rowing', 'hyrox', 'cross', 'race'];

  it('offers a chip for every loggable session type', () => {
    const values: string[] = WORKOUT_TYPES.map((t) => t.value);
    expect(new Set(values)).toEqual(new Set(LOGGABLE));
  });

  it('can round-trip every loggable type through the edit path', () => {
    // handleEditWorkout seeds the chip state from the stored session_type; a
    // type with no chip leaves the row with nothing selected and no way back.
    for (const type of LOGGABLE) {
      expect(WORKOUT_TYPES.some((t) => t.value === type)).toBe(true);
    }
  });

  it('renders each loggable type with its own shared icon, never a guess', () => {
    for (const type of LOGGABLE) {
      expect(SESSION_ICON[type]).toBeTruthy();
      expect(SESSION_ICON[type]).not.toBe(SESSION_ICON_FALLBACK);
    }
  });
});
