import { renderScreen, type ScreenKey } from './showcase';

const KEYS: ScreenKey[] = ['run', 'strength', 'nutrition', 'coach'];

function initShowcase(): void {
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab'));
  const body = document.querySelector<HTMLElement>('#device-body');
  const mode = document.querySelector<HTMLElement>('#device-mode');
  if (!tabs.length || !body || !mode) return;

  function select(key: ScreenKey, focusTab = false): void {
    tabs.forEach((t) => {
      const active = t.dataset.tab === key;
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1;
      if (active) {
        body!.setAttribute('aria-labelledby', t.id);
        if (focusTab) t.focus();
      }
    });
    body!.innerHTML = renderScreen(key);
    // update the top-bar mode label from the newly rendered screen's data attribute
    const label = body!.querySelector<HTMLElement>('[data-mode]')?.dataset.mode;
    if (label) mode!.textContent = label;
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      const key = tab.dataset.tab as ScreenKey;
      if (KEYS.includes(key)) select(key);
    });

    // Roving arrow-key navigation for the ARIA Tabs pattern.
    tab.addEventListener('keydown', (e) => {
      let next = -1;
      if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;
      if (next < 0) return;
      e.preventDefault();
      const key = tabs[next].dataset.tab as ScreenKey;
      if (KEYS.includes(key)) select(key, true);
    });
  });
}

initShowcase();
