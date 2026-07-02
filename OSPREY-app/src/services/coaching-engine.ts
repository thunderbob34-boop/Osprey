export interface CoachingState {
  lastAnnouncedMileMark: number;
  lastHRCueMs: number;
  lastPaceDriftMs: number;
  lastEncouragementMs: number;
}

export function makeCoachingState(): CoachingState {
  return {
    lastAnnouncedMileMark: 0,
    lastHRCueMs: 0,
    lastPaceDriftMs: 0,
    lastEncouragementMs: 0,
  };
}

const HR_ZONE5_BPM = 170;
const HR_ZONE4_BPM = 155;
const PACE_DRIFT_THRESHOLD = 0.15; // 15% slower than goal
const HR_CUE_COOLDOWN_MS = 120_000; // 2 minutes
const PACE_CUE_COOLDOWN_MS = 180_000; // 3 minutes
const ENCOURAGEMENT_INTERVAL_MS = 300_000; // 5 minutes

const MILE_SPLIT_CUES: Record<number, string[]> = {
  1:  ['One mile in. You\'re rolling — settle into your rhythm.'],
  2:  ['Two miles. Nice. Keep the effort controlled.'],
  3:  ['Three miles done. Check your form — relax those shoulders.'],
  4:  ['Four miles. You\'re in the grind now. Stay patient.'],
  5:  ['Five miles. Halfway there if this is a 10K. Stay steady.'],
  6:  ['Six miles. You\'ve got this — keep that pace honest.'],
  8:  ['Eight miles. This is where it gets earned. Drive through.'],
  10: ['Ten miles. You\'re doing what most people won\'t. Keep going.'],
  13: ['Half marathon. Big effort — now let\'s bring it home.'],
  20: ['Twenty miles. The race starts now. Everything you\'ve trained for.'],
};

const ENCOURAGEMENT_CUES = [
  'Looking strong. One step at a time.',
  'Consistent effort wins races. Stay locked in.',
  'Nice work staying on it. Keep that arm drive.',
  'You\'re doing great. Trust your training.',
  'Relax through the hips, drive the knees. Good rhythm.',
];

export interface CoachCue {
  text: string;
  nextState: CoachingState;
}

export function checkCues(
  state: CoachingState,
  miles: number,
  elapsedS: number,
  heartRate: number | null,
  goalPaceSecPerMile: number | null,
  nowMs: number,
): CoachCue | null {
  const next = { ...state };

  // 1. Mile split cues
  const completedMile = Math.floor(miles);
  if (completedMile >= 1 && completedMile > state.lastAnnouncedMileMark) {
    const cueOptions = MILE_SPLIT_CUES[completedMile];
    const text = cueOptions
      ? cueOptions[0]
      : `Mile ${completedMile}. Keep it up.`;
    next.lastAnnouncedMileMark = completedMile;
    return { text, nextState: next };
  }

  // 2. HR zone 5 warning (throttled)
  if (
    heartRate != null &&
    heartRate >= HR_ZONE5_BPM &&
    nowMs - state.lastHRCueMs > HR_CUE_COOLDOWN_MS
  ) {
    next.lastHRCueMs = nowMs;
    return {
      text: `Heart rate at ${heartRate}. Pull back — you\'re burning matches. Ease up.`,
      nextState: next,
    };
  }

  // 3. HR zone 4 nudge (less urgent, longer cooldown)
  if (
    heartRate != null &&
    heartRate >= HR_ZONE4_BPM &&
    heartRate < HR_ZONE5_BPM &&
    nowMs - state.lastHRCueMs > HR_CUE_COOLDOWN_MS * 1.5
  ) {
    next.lastHRCueMs = nowMs;
    return {
      text: `You\'re running hot at ${heartRate} BPM. Controlled effort from here.`,
      nextState: next,
    };
  }

  // 4. Pace drift warning (only when goal pace is known)
  if (
    goalPaceSecPerMile != null &&
    miles > 0.5 &&
    elapsedS > 0 &&
    nowMs - state.lastPaceDriftMs > PACE_CUE_COOLDOWN_MS
  ) {
    const currentPaceSecPerMile = elapsedS / miles;
    const drift = (currentPaceSecPerMile - goalPaceSecPerMile) / goalPaceSecPerMile;
    if (drift > PACE_DRIFT_THRESHOLD) {
      next.lastPaceDriftMs = nowMs;
      const target = formatPaceSec(goalPaceSecPerMile);
      return {
        text: `You\'re drifting off pace. Goal is ${target}/mi — pick it up a touch.`,
        nextState: next,
      };
    }
  }

  // 5. Periodic encouragement (every 5 minutes, no other cue fired)
  if (
    elapsedS > 300 &&
    nowMs - state.lastEncouragementMs > ENCOURAGEMENT_INTERVAL_MS
  ) {
    const idx = Math.floor(nowMs / ENCOURAGEMENT_INTERVAL_MS) % ENCOURAGEMENT_CUES.length;
    next.lastEncouragementMs = nowMs;
    return { text: ENCOURAGEMENT_CUES[idx], nextState: next };
  }

  return null;
}

function formatPaceSec(secPerMile: number): string {
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
