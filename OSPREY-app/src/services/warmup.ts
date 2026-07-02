export interface WarmupDrill {
  name: string;
  durationLabel: string;
}

const RUN_POOL: WarmupDrill[] = [
  { name: 'Leg swings (front/back + side)', durationLabel: '30s each leg' },
  { name: 'Walking lunges', durationLabel: '10 steps' },
  { name: 'High knees', durationLabel: '20 sec' },
  { name: 'Butt kicks', durationLabel: '20 sec' },
  { name: 'Ankle circles', durationLabel: '10 each direction' },
  { name: 'Easy jog to build into pace', durationLabel: '3-5 min' },
  { name: 'A-skips', durationLabel: '15m' },
  { name: 'Hip circles', durationLabel: '10 each direction' },
];

const LIFT_POOL: WarmupDrill[] = [
  { name: 'Band pull-aparts', durationLabel: '15 reps' },
  { name: "World's greatest stretch", durationLabel: '5 each side' },
  { name: 'Bodyweight squats', durationLabel: '10 reps' },
  { name: 'Arm circles', durationLabel: '15 each direction' },
  { name: 'Cat-cow', durationLabel: '8 reps' },
  { name: 'Glute bridges', durationLabel: '12 reps' },
  { name: 'Light empty-bar set of your first lift', durationLabel: '8-10 reps' },
  { name: 'Scapular push-ups', durationLabel: '10 reps' },
];

const CROSS_POOL: WarmupDrill[] = [
  { name: 'Jumping jacks', durationLabel: '30 sec' },
  { name: 'Bodyweight squats', durationLabel: '12 reps' },
  { name: 'Arm circles', durationLabel: '15 each direction' },
  { name: 'Inchworms', durationLabel: '5 reps' },
  { name: 'High knees', durationLabel: '20 sec' },
  { name: 'Hip openers', durationLabel: '10 each side' },
];

const POOLS: Record<string, WarmupDrill[]> = {
  run: RUN_POOL,
  lift: LIFT_POOL,
  cross: CROSS_POOL,
  race: RUN_POOL,
};

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Picks a fresh subset of warm-up drills each time so the routine doesn't
 * feel identical session to session, while staying relevant to the sport.
 */
export function generateWarmup(sessionType: string, count = 4): WarmupDrill[] {
  const pool = POOLS[sessionType] ?? CROSS_POOL;
  return shuffle(pool).slice(0, Math.min(count, pool.length));
}
