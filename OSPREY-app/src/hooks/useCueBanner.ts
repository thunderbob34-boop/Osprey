import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * On-screen fallback for Ozzie's coaching cues while voice is disabled
 * (see OZZIE_VOICE_ENABLED in services/ozzie-audio.ts) — shows the cue
 * text briefly, then auto-clears.
 */
export function useCueBanner(durationMs = 4500) {
  const [cueBannerText, setCueBannerText] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCueBanner = useCallback(
    (text: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setCueBannerText(text);
      timerRef.current = setTimeout(() => setCueBannerText(null), durationMs);
    },
    [durationMs],
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return { cueBannerText, showCueBanner };
}
