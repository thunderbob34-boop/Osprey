function initVideoModal(): void {
  const modal = document.querySelector<HTMLDivElement>('#video-modal');
  const player = document.querySelector<HTMLVideoElement>('#video-modal-player');
  if (!modal || !player) return;

  function openModal(src: string): void {
    player!.src = src;
    modal!.hidden = false;
    document.body.style.overflow = 'hidden';
    player!.play().catch(() => {});
  }

  function closeModal(): void {
    modal!.hidden = true;
    player!.pause();
    player!.removeAttribute('src');
    player!.load();
    document.body.style.overflow = '';
  }

  document.querySelectorAll<HTMLElement>('[data-video-src]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const src = el.getAttribute('data-video-src');
      if (src) openModal(src);
    });
  });

  modal.querySelectorAll<HTMLElement>('[data-close]').forEach((el) => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal!.hidden) closeModal();
  });

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll<HTMLVideoElement>('.ath-video').forEach((v) => v.pause());
  }
}

initVideoModal();
