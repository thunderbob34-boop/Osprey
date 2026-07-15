import { toUltraParams, parseUltraParams, ULTRA_DISTANCE_FACTOR } from '@/services/coaching/ultra-params';

describe('toUltraParams', () => {
  it('defaults a null/empty blob to a base 50k plan', () => {
    expect(toUltraParams(null)).toEqual({ raceDistance: '50k', vertGainM: null, gutTrained: false });
  });
  it('passes through valid stored params', () => {
    expect(toUltraParams({ raceDistance: '100mi', vertGainM: 6000, gutTrained: true }))
      .toEqual({ raceDistance: '100mi', vertGainM: 6000, gutTrained: true });
  });
  it('coerces an unknown distance to 50k and a bad vert to null', () => {
    expect(toUltraParams({ raceDistance: 'marathon', vertGainM: -5, gutTrained: 'yes' }))
      .toEqual({ raceDistance: '50k', vertGainM: null, gutTrained: false });
  });
});
describe('ULTRA_DISTANCE_FACTOR', () => {
  it('scales volume up with distance', () => {
    expect(ULTRA_DISTANCE_FACTOR['50k']).toBe(1.0);
    expect(ULTRA_DISTANCE_FACTOR['100mi']).toBeGreaterThan(ULTRA_DISTANCE_FACTOR['50k']);
  });
});
describe('parseUltraParams', () => {
  it('accepts a valid form and rejects a blank distance', () => {
    expect(parseUltraParams({ raceDistance: '50mi', vertGainM: '1500', gutTrained: true }).ok).toBe(true);
    expect(parseUltraParams({ raceDistance: '', vertGainM: '', gutTrained: false }).ok).toBe(false);
  });
});
