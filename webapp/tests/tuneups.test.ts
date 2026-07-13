import { describe, it, expect } from 'vitest';
import { parseGoalDistanceFromText, matchTuneUpWeeks, LADDER, type SessionInput } from '../src/lib/tuneups';

describe('parseGoalDistanceFromText', () => {
  it('matches half marathon before unqualified marathon', () => {
    expect(parseGoalDistanceFromText('Novant Health Charlotte Marathon (Half Marathon)')).toBeCloseTo(21.0975, 4);
  });
  it('matches hyphenated half-marathon', () => {
    expect(parseGoalDistanceFromText('City Half-Marathon')).toBeCloseTo(21.0975, 4);
  });
  it('matches 13.1 as half marathon', () => {
    expect(parseGoalDistanceFromText('Riverside 13.1')).toBeCloseTo(21.0975, 4);
  });
  it('matches 10K', () => {
    expect(parseGoalDistanceFromText('Turkey Trot 10K')).toBe(10.0);
  });
  it('matches 5K', () => {
    expect(parseGoalDistanceFromText('Fun Run 5K')).toBe(5.0);
  });
  it('matches unqualified marathon', () => {
    expect(parseGoalDistanceFromText('Boston Marathon')).toBeCloseTo(42.195, 4);
  });
  it('returns null with no recognizable distance', () => {
    expect(parseGoalDistanceFromText('Get Fit Challenge')).toBeNull();
  });
});

describe('matchTuneUpWeeks', () => {
  it('returns empty when goalDistanceKm is null', () => {
    const sessions: SessionInput[] = [{ id: '1', weekId: 'w1', sessionDate: '2026-08-01', sessionType: 'run', plannedDistanceKm: 10 }];
    expect(matchTuneUpWeeks(sessions, null)).toEqual([]);
  });

  it('returns empty for a 5K goal (nothing shorter on the ladder)', () => {
    const sessions: SessionInput[] = [{ id: '1', weekId: 'w1', sessionDate: '2026-08-01', sessionType: 'run', plannedDistanceKm: 5 }];
    expect(matchTuneUpWeeks(sessions, 5.0)).toEqual([]);
  });

  it('flags a week within +/-20% of a ladder distance', () => {
    // 10K goal offers only 5K (10.0 excluded, not shorter than goal). 5K * 1.19 = 5.95 -> within 20%.
    const sessions: SessionInput[] = [{ id: '1', weekId: 'w1', sessionDate: '2026-08-01', sessionType: 'run', plannedDistanceKm: 5.95 }];
    const result = matchTuneUpWeeks(sessions, 10.0);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ sessionId: '1', label: '5K', ladderKm: 5.0 });
  });

  it('does not flag a week outside the +/-20% tolerance', () => {
    const sessions: SessionInput[] = [{ id: '1', weekId: 'w1', sessionDate: '2026-08-01', sessionType: 'run', plannedDistanceKm: 6.5 }]; // 30% over 5K
    expect(matchTuneUpWeeks(sessions, 10.0)).toEqual([]);
  });

  it('picks the longest run per week, ignoring shorter same-week runs', () => {
    const sessions: SessionInput[] = [
      { id: '1', weekId: 'w1', sessionDate: '2026-08-03', sessionType: 'run', plannedDistanceKm: 4 },
      { id: '2', weekId: 'w1', sessionDate: '2026-08-01', sessionType: 'run', plannedDistanceKm: 10.5 }, // this is the long run
    ];
    // Half goal (21.0975) offers 5K and 10K; 10.5 is closest to 10K.
    const result = matchTuneUpWeeks(sessions, 21.0975);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ sessionId: '2', label: '10K' });
  });

  it('ignores non-run session types', () => {
    const sessions: SessionInput[] = [{ id: '1', weekId: 'w1', sessionDate: '2026-08-01', sessionType: 'lift', plannedDistanceKm: 5 }];
    expect(matchTuneUpWeeks(sessions, 10.0)).toEqual([]);
  });

  it('flags multiple opportunities across different weeks', () => {
    const sessions: SessionInput[] = [
      { id: '1', weekId: 'w1', sessionDate: '2026-08-01', sessionType: 'run', plannedDistanceKm: 5.0 },  // -> 5K
      { id: '2', weekId: 'w5', sessionDate: '2026-09-01', sessionType: 'run', plannedDistanceKm: 10.2 }, // -> 10K
    ];
    // Half goal offers both 5K and 10K.
    const result = matchTuneUpWeeks(sessions, 21.0975);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.label).sort()).toEqual(['10K', '5K']);
  });

  it('sorts results by session date', () => {
    const sessions: SessionInput[] = [
      { id: '2', weekId: 'w5', sessionDate: '2026-09-01', sessionType: 'run', plannedDistanceKm: 10.2 },
      { id: '1', weekId: 'w1', sessionDate: '2026-08-01', sessionType: 'run', plannedDistanceKm: 5.0 },
    ];
    const result = matchTuneUpWeeks(sessions, 21.0975);
    expect(result.map((r) => r.sessionId)).toEqual(['1', '2']);
  });

  it('LADDER is ordered 5K, 10K, Half, Marathon', () => {
    expect(LADDER.map((r) => r.label)).toEqual(['5K', '10K', 'Half', 'Marathon']);
  });
});
