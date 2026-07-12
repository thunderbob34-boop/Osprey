import { renderScreen, type ScreenKey } from './showcase';

const KEYS: ScreenKey[] = ['run', 'strength', 'nutrition', 'coach'];

export function initShowcase(root: ParentNode = document): void {
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('.tab'));
  const body = root.querySelector<HTMLElement>('#device-body');
  const mode = root.querySelector<HTMLElement>('#device-mode');
  if (!tabs.length || !body || !mode) return;

  function select(key: ScreenKey): void {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === key)));
    body!.innerHTML = renderScreen(key);
    // update the top-bar mode label from the newly rendered screen's data attribute
    const label = body!.querySelector<HTMLElement>('[data-mode]')?.dataset.mode;
    if (label) mode!.textContent = label;
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const key = tab.dataset.tab as ScreenKey;
      if (KEYS.includes(key)) select(key);
    });
  });
}

initShowcase();
