import { estimateDayMacros, sessionCalorieBump } from '@/services/nutrition-estimate';

describe('sessionCalorieBump', () => {
  it('returns 0 for rest and for null sessionType', () => {
    expect(sessionCalorieBump('rest', 60)).toBe(0);
    expect(sessionCalorieBump(null, 60)).toBe(0);
  });

  it('matches minutes * SESSION_CAL_PER_MIN for known types', () => {
    expect(sessionCalorieBump('run', 30)).toBe(210); // 30 * 7
    expect(sessionCalorieBump('swim', 40)).toBe(320); // 40 * 8
    expect(sessionCalorieBump('bike', 50)).toBe(300); // 50 * 6
    expect(sessionCalorieBump('lift', 60)).toBe(240); // 60 * 4
    expect(sessionCalorieBump('cross', 30)).toBe(150); // 30 * 5
    expect(sessionCalorieBump('race', 20)).toBe(180); // 20 * 9
  });

  it('falls back to rate 5 for an unknown session type', () => {
    expect(sessionCalorieBump('triathlon', 60)).toBe(300); // 60 * 5
  });

  it('defaults to 45 minutes when plannedMinutes is null', () => {
    expect(sessionCalorieBump('bike', null)).toBe(270); // 45 * 6
  });
});

describe('estimateDayMacros', () => {
  const todayTarget = { calories: 2740, proteinG: 240 };

  it('round-trips to the exact same calories when the target day matches today', () => {
    const result = estimateDayMacros(todayTarget, 'lift', 60, 'lift', 60);
    expect(result.calories).toBe(2740);
    expect(result.isExact).toBe(true);
  });

  it("changes calories by exactly the target day's bump minus today's bump", () => {
    const result = estimateDayMacros(todayTarget, 'lift', 60, 'run', 30);
    // today bump = 60*4=240, target bump = 30*7=210, delta = -30
    expect(result.calories).toBe(2710);
    expect(result.isExact).toBe(false);
  });

  it('clamps to the 1600 calorie floor', () => {
    const lowTarget = { calories: 1650, proteinG: 200 };
    // today bump = 100*4=400 -> implied baseline = 1250; target (rest) bump = 0 -> raw 1250, floored to 1600
    const result = estimateDayMacros(lowTarget, 'lift', 100, 'rest', null);
    expect(result.calories).toBe(1600);
  });

  it('always carries proteinG over from today unchanged', () => {
    const restDay = estimateDayMacros(todayTarget, 'lift', 60, 'rest', null);
    const runDay = estimateDayMacros(todayTarget, 'lift', 60, 'run', 45);
    expect(restDay.proteinG).toBe(240);
    expect(runDay.proteinG).toBe(240);
  });

  it('derives fatG/carbsG using the 26%-fat / remainder-carbs split', () => {
    const result = estimateDayMacros(todayTarget, 'lift', 60, 'lift', 60);
    // calories=2740, proteinG=240 -> proteinCals=960
    // fatG = round(2740*0.26/9) = 79 -> fatCals=711
    // carbsG = round((2740-960-711)/4) = round(1069/4) = 267
    expect(result.fatG).toBe(79);
    expect(result.carbsG).toBe(267);
  });

  it('isExact is false when only plannedMinutes differs', () => {
    const result = estimateDayMacros(todayTarget, 'lift', 60, 'lift', 45);
    expect(result.isExact).toBe(false);
  });
});
