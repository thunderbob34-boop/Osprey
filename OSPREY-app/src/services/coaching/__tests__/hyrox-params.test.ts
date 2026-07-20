import { toHyroxParams, parseHyroxParams, HYROX_DIVISIONS } from '@/services/coaching/hyrox-params';

describe('HYROX_DIVISIONS', () => {
  it('lists all seven divisions, including doubles', () => {
    expect(HYROX_DIVISIONS).toEqual([
      'open_men', 'open_women', 'pro_men', 'pro_women',
      'doubles_men', 'doubles_women', 'doubles_mixed',
    ]);
  });
});

describe('toHyroxParams', () => {
  it('reads a stored division blob', () => {
    expect(toHyroxParams({ division: 'open_men', targetTimeMinutes: 85 })).toEqual({ division: 'open_men', targetTimeMinutes: 85 });
  });
  it('accepts a doubles division', () => {
    expect(toHyroxParams({ division: 'doubles_mixed', targetTimeMinutes: 90 })).toEqual({ division: 'doubles_mixed', targetTimeMinutes: 90 });
  });
  it('returns null when there is no valid division (paramless hyrox → graceful fallback)', () => {
    expect(toHyroxParams(null)).toBeNull();
    expect(toHyroxParams({})).toBeNull();
    expect(toHyroxParams({ division: 'nonsense' })).toBeNull();
  });
  it('drops an implausible target time to null', () => {
    expect(toHyroxParams({ division: 'pro_women', targetTimeMinutes: -5 })).toEqual({ division: 'pro_women', targetTimeMinutes: null });
  });
});

describe('parseHyroxParams', () => {
  it('accepts a valid division with a blank target time', () => {
    expect(parseHyroxParams({ division: 'open_women', targetTimeMinutes: '' })).toEqual({ ok: true, value: { division: 'open_women', targetTimeMinutes: null } });
  });
  it('accepts a doubles division', () => {
    expect(parseHyroxParams({ division: 'doubles_men', targetTimeMinutes: '' })).toEqual({ ok: true, value: { division: 'doubles_men', targetTimeMinutes: null } });
  });
  it('rejects a missing/invalid division', () => {
    expect(parseHyroxParams({ division: '', targetTimeMinutes: '' }).ok).toBe(false);
  });
  it('rejects a non-numeric target time', () => {
    expect(parseHyroxParams({ division: 'open_men', targetTimeMinutes: 'soon' }).ok).toBe(false);
  });
});
