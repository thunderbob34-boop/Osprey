// Weather coach — turns a raw forecast into Ozzie-style training guidance:
// heat lead-up hydration alerts, best outdoor window today, and
// indoor/shade swap advice. Pure functions; no I/O.

import type { Forecast, HourlyWeather } from '@/services/weather';

export type WeatherSeverity = 'info' | 'caution' | 'alert';

export interface WeatherWindow {
  startHour: number;
  endHour: number;
  tempF: number;
}

export interface WeatherCoachResult {
  /** Headline shown on the Home card, e.g. "96° Thursday — start hydrating now". */
  headline: string;
  /** Supporting sentence(s). */
  detail: string;
  severity: WeatherSeverity;
  /** Best 2-hour outdoor window today, if today has outdoor-usable hours. */
  bestWindowToday: WeatherWindow | null;
  /** True when today's conditions warrant suggesting an indoor or shaded session. */
  suggestIndoor: boolean;
  /** Compact plain-text summary fed to the Ozzie daily-brief prompt. */
  briefSummary: string;
  todayMaxF: number;
}

const HEAT_CAUTION_F = 85;
const HEAT_ALERT_F = 93;
const COLD_F = 25;
const RAIN_PROB = 60;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dayName(isoDate: string, todayIso: string): string {
  if (isoDate === todayIso) return 'today';
  const [y, m, d] = isoDate.split('-').map(Number);
  const [ty, tm, td] = todayIso.split('-').map(Number);
  const diffDays = Math.round(
    (new Date(y, m - 1, d).getTime() - new Date(ty, tm - 1, td).getTime()) / 86400000,
  );
  if (diffDays === 1) return 'tomorrow';
  return DAY_NAMES[new Date(y, m - 1, d).getDay()];
}

function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

export function formatWindow(w: WeatherWindow): string {
  return `${formatHour(w.startHour)}–${formatHour(w.endHour)}`;
}

/** Lower score = better training weather. */
function hourScore(h: HourlyWeather): number {
  // Ideal band ~50–65°F; penalize distance from 58.
  const tempPenalty = Math.abs(h.tempF - 58) * 1.0;
  const rainPenalty = h.precipProbability * 0.6;
  const uvPenalty = Math.max(0, h.uvIndex - 5) * 4;
  const windPenalty = Math.max(0, h.windMph - 15) * 1.5;
  return tempPenalty + rainPenalty + uvPenalty + windPenalty;
}

/** Best 2-hour outdoor window among today's remaining daylight-ish hours (5:00–21:00). */
function bestWindowToday(forecast: Forecast, todayIso: string): WeatherWindow | null {
  const todayHours = forecast.hourly.filter(
    (h) => h.time.slice(0, 10) === todayIso && h.hour >= 5 && h.hour <= 20,
  );
  if (todayHours.length < 2) return null;

  let best: { start: HourlyWeather; score: number } | null = null;
  for (let i = 0; i < todayHours.length - 1; i++) {
    const pairScore = hourScore(todayHours[i]) + hourScore(todayHours[i + 1]);
    if (!best || pairScore < best.score) {
      best = { start: todayHours[i], score: pairScore };
    }
  }
  if (!best) return null;
  return {
    startHour: best.start.hour,
    endHour: best.start.hour + 2,
    tempF: best.start.tempF,
  };
}

export function deriveWeatherCoach(
  forecast: Forecast,
  todaySessionType: string | null,
): WeatherCoachResult | null {
  if (forecast.daily.length === 0) return null;

  const todayIso = forecast.daily[0].date;
  const today = forecast.daily[0];
  const window = bestWindowToday(forecast, todayIso);
  const outdoorSession = todaySessionType == null || ['run', 'bike', 'cross', 'race'].includes(todaySessionType);

  // ── Heat lead-up: scan today + next 3 days for the first hot day ──
  const hotDay = forecast.daily.find((d) => d.tempMaxF >= HEAT_ALERT_F);
  const warmDay = forecast.daily.find((d) => d.tempMaxF >= HEAT_CAUTION_F);

  let headline: string;
  let detail: string;
  let severity: WeatherSeverity = 'info';
  let suggestIndoor = false;

  if (hotDay && hotDay.date === todayIso) {
    severity = 'alert';
    suggestIndoor = outdoorSession;
    headline = `${hotDay.tempMaxF}° today — treat heat like altitude`;
    detail = window
      ? `Get outside ${formatWindow(window)} (~${window.tempF}°), pick shade, and carry fluids — or take today's session indoors. Electrolytes with every bottle.`
      : "Take today's session indoors if you can, and stay on top of fluids and electrolytes all day.";
  } else if (hotDay) {
    // Hot day coming — hydration lead-up starts now.
    severity = 'caution';
    const day = dayName(hotDay.date, todayIso);
    headline = `${hotDay.tempMaxF}° ${day} — start hydrating now`;
    detail = `Heat performance is won 48 hours early: add ~20 oz of fluids and a pinch of salt to today and tomorrow. Plan ${day}'s session early morning, shaded, or indoors.`;
  } else if (today.precipProbabilityMax >= RAIN_PROB && outdoorSession) {
    severity = 'caution';
    headline = `${today.precipProbabilityMax}% chance of rain today`;
    detail = window
      ? `Driest, most comfortable stretch looks like ${formatWindow(window)}. Wet kit beats a missed session — or swap to an indoor option.`
      : 'Wet kit beats a missed session — or swap today to an indoor option.';
  } else if (today.tempMaxF <= COLD_F) {
    severity = 'caution';
    headline = `Cold one — high of ${today.tempMaxF}°`;
    detail = 'Extend your warm-up by 5–10 minutes and layer so you\'re slightly cool at the start, not cozy.';
  } else if (warmDay && warmDay.date !== todayIso) {
    severity = 'info';
    const day = dayName(warmDay.date, todayIso);
    headline = `Warming up to ${warmDay.tempMaxF}° ${day}`;
    detail = `Nothing drastic — just nudge fluids up today so ${day} feels easy.`;
  } else {
    severity = 'info';
    headline = window
      ? `Best training window: ${formatWindow(window)}`
      : `High of ${today.tempMaxF}° today`;
    detail = window
      ? `${window.tempF}° and clear sailing in that stretch. Green light outdoors.`
      : 'No weather excuses today — conditions are on your side.';
  }

  // ── Compact context for the AI daily brief ──
  const next3 = forecast.daily
    .slice(0, 4)
    .map((d) => `${dayName(d.date, todayIso)}: high ${d.tempMaxF}°F, rain ${d.precipProbabilityMax}%`)
    .join('; ');
  const briefSummary =
    `Forecast — ${next3}.` +
    (window ? ` Best outdoor window today ${formatWindow(window)} (~${window.tempF}°F).` : '') +
    (hotDay && hotDay.date !== todayIso
      ? ` Heat spike ${dayName(hotDay.date, todayIso)} (${hotDay.tempMaxF}°F): recommend hydration lead-up starting today.`
      : '');

  return {
    headline,
    detail,
    severity,
    bestWindowToday: window,
    suggestIndoor,
    briefSummary,
    todayMaxF: today.tempMaxF,
  };
}
