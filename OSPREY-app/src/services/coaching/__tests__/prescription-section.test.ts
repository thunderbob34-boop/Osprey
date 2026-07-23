import { prescriptionSectionForSport } from '@/services/coaching/prescription-section';

describe('prescriptionSectionForSport', () => {
  it('maps lift to strength', () => {
    expect(prescriptionSectionForSport('lift')).toBe('strength');
  });
  it('maps hyrox to hyrox', () => {
    expect(prescriptionSectionForSport('hyrox')).toBe('hyrox');
  });
  it('maps crossfit to crossfit', () => {
    expect(prescriptionSectionForSport('crossfit')).toBe('crossfit');
  });
  it.each([
    'run', 'swim', 'rowing', 'cycling', 'triathlon', 'ultra', 'hybrid', 'weight_loss', 'general_fitness',
  ])('maps %s to null (endurance-only — no sport-specific section)', (sport) => {
    expect(prescriptionSectionForSport(sport)).toBeNull();
  });
  it('maps an unset goal to null', () => {
    expect(prescriptionSectionForSport(null)).toBeNull();
  });
});
