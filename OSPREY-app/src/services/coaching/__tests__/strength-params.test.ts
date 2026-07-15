import { toStrengthParams, parseStrengthParams } from '@/services/coaching/strength-params';

describe('toStrengthParams', () => {
  it('null-safe defaults an empty blob to all-null maxes', () => {
    expect(toStrengthParams(null)).toEqual({ oneRepMaxKg: { squat: null, bench: null, deadlift: null }, goalThirdKg: { squat: null, bench: null, deadlift: null } });
  });
  it('passes through valid maxes + goal thirds and drops non-positive values', () => {
    expect(toStrengthParams({ oneRepMaxKg: { squat: 200, bench: 140, deadlift: 0 }, goalThirdKg: { squat: 210, bench: -5, deadlift: 250 } }))
      .toEqual({ oneRepMaxKg: { squat: 200, bench: 140, deadlift: null }, goalThirdKg: { squat: 210, bench: null, deadlift: 250 } });
  });
});
describe('parseStrengthParams', () => {
  it('accepts at least one max and rejects all-blank', () => {
    expect(parseStrengthParams({ squat: '200', bench: '', deadlift: '', goalSquat: '', goalBench: '', goalDeadlift: '' }).ok).toBe(true);
    expect(parseStrengthParams({ squat: '', bench: '', deadlift: '', goalSquat: '', goalBench: '', goalDeadlift: '' }).ok).toBe(false);
  });
  it('rejects an implausible load', () => {
    expect(parseStrengthParams({ squat: '9000', bench: '', deadlift: '', goalSquat: '', goalBench: '', goalDeadlift: '' }).ok).toBe(false);
  });
});
