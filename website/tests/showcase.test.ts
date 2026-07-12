import { describe, it, expect } from 'vitest';
import { SCREENS, renderScreen } from '../src/scripts/showcase';

describe('showcase screens', () => {
  it('defines all four tab screens', () => {
    expect(Object.keys(SCREENS).sort()).toEqual(['coach', 'nutrition', 'run', 'strength']);
  });

  it('renderScreen includes the metric and coach line for strength', () => {
    const html = renderScreen('strength');
    expect(html).toContain('185 LB × 8');
    expect(html).toContain('Ozzie');
    expect(html).toContain('rest 90s');
  });

  it('renderScreen output parses to a DOM with a .viz block', () => {
    const el = document.createElement('div');
    el.innerHTML = renderScreen('run');
    expect(el.querySelector('.viz')).not.toBeNull();
    expect(el.querySelector('.dev-metric')?.textContent).toBe('7:42 /MI');
  });

  it('every screen renders label, metric, viz, and coach', () => {
    (['run', 'strength', 'nutrition', 'coach'] as const).forEach((k) => {
      const el = document.createElement('div');
      el.innerHTML = renderScreen(k);
      expect(el.querySelector('.dev-label')).not.toBeNull();
      expect(el.querySelector('.dev-metric')).not.toBeNull();
      expect(el.querySelector('.viz')).not.toBeNull();
      expect(el.querySelector('.coach')).not.toBeNull();
    });
  });

  it('renderScreen embeds the mode label as a data attribute', () => {
    const el = document.createElement('div');
    el.innerHTML = renderScreen('coach');
    expect(el.querySelector('[data-mode]')?.getAttribute('data-mode')).toBe('Daily brief');
  });
});
