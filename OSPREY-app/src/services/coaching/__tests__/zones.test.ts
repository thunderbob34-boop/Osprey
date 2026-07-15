import { blueprintSport } from '@/services/coaching/zones';

describe('blueprintSport', () => {
  it('maps run and hybrid to run zones', () => {
    expect(blueprintSport('run')).toBe('run');
    expect(blueprintSport('hybrid')).toBe('run');
  });
  it('maps hyrox to run (its anchor is compromised run pace)', () => {
    expect(blueprintSport('hyrox')).toBe('run');
  });
  it('maps swim, rowing, and cycling to themselves', () => {
    expect(blueprintSport('swim')).toBe('swim');
    expect(blueprintSport('rowing')).toBe('rowing');
    expect(blueprintSport('cycling')).toBe('cycling');
  });
  it('returns null for sports without endurance zones this phase', () => {
    expect(blueprintSport('lift')).toBeNull();
    expect(blueprintSport('triathlon')).toBeNull();
  });
});
