import { primaryDayLabel } from '@/constants/sports';

describe('primaryDayLabel', () => {
  it('labels the primary discipline by sport', () => {
    expect(primaryDayLabel('swim')).toBe('Swim days per week');
    expect(primaryDayLabel('rowing')).toBe('Row days per week');
  });

  it('defaults to run days for run-based and non-endurance goals', () => {
    expect(primaryDayLabel('run')).toBe('Run days per week');
    expect(primaryDayLabel('hybrid')).toBe('Run days per week');
    expect(primaryDayLabel('hyrox')).toBe('Run days per week');
    expect(primaryDayLabel(null)).toBe('Run days per week');
  });

  it('labels lift as lift days per week', () => {
    expect(primaryDayLabel('lift')).toBe('Lift days per week');
  });

  it('labels cycling as ride days', () => {
    expect(primaryDayLabel('cycling')).toBe('Ride days per week');
  });
});
