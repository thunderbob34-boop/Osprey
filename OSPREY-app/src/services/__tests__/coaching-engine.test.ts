import { checkCues, makeCoachingState } from '@/services/coaching-engine';

// miles stay within (0.5, 1) so the mile-split cue (priority 1) never
// preempts the pace-drift cue (priority 4), and elapsedS stays under 300s so
// the periodic-encouragement cue (priority 5) never preempts it either.

describe('checkCues — pace drift', () => {
  it('stays silent when no goal pace is known', () => {
    const state = makeCoachingState();
    const cue = checkCues(state, 0.75, 200, null, null, 1_000_000);
    expect(cue).toBeNull();
  });

  it('fires when current pace drifts more than 15% slower than goal', () => {
    const state = makeCoachingState();
    // Goal 8:00/mi (480s); running 9:30/mi (570s) at 0.51mi — ~19% slower.
    const cue = checkCues(state, 0.51, 570 * 0.51, null, 480, 1_000_000);
    expect(cue).not.toBeNull();
    expect(cue?.text).toContain('drifting off pace');
    expect(cue?.text).toContain('8:00/mi');
  });

  it('stays silent within the 15% drift threshold', () => {
    const state = makeCoachingState();
    // Goal 8:00/mi (480s); running 8:50/mi (530s) — ~10% slower, under threshold.
    const cue = checkCues(state, 0.51, 530 * 0.51, null, 480, 1_000_000);
    expect(cue).toBeNull();
  });

  it('respects the cooldown after firing once', () => {
    const first = checkCues(makeCoachingState(), 0.51, 570 * 0.51, null, 480, 1_000_000);
    expect(first).not.toBeNull();
    // 60s later — still within the 3-minute cooldown, same drifted pace.
    const second = checkCues(first!.nextState, 0.52, 570 * 0.52, null, 480, 1_060_000);
    expect(second).toBeNull();
  });
});
