// Weather service — Open-Meteo forecast client.
// Open-Meteo is keyless which keeps secrets out of the client; swap the
// fetch URL for WeatherKit/OpenWeather later without touching consumers.

export interface HourlyWeather {
  /** ISO timestamp for the start of the hour (local to the queried location). */
  time: string;
  hour: number;
  tempF: number;
  precipProbability: number;
  uvIndex: number;
  humidity: number;
  windMph: number;
}

export interface DailyWeather {
  /** ISO date 'YYYY-MM-DD' (local to the queried location). */
  date: string;
  tempMaxF: number;
  tempMinF: number;
  precipProbabilityMax: number;
  uvIndexMax: number;
}

export interface Forecast {
  fetchedAt: string;
  /** Today + next 3 days. */
  daily: DailyWeather[];
  /** Next ~48 hours. */
  hourly: HourlyWeather[];
}

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

export async function fetchForecast(latitude: number, longitude: number): Promise<Forecast> {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(3),
    longitude: longitude.toFixed(3),
    hourly: 'temperature_2m,precipitation_probability,uv_index,relative_humidity_2m,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'auto',
    forecast_days: '4',
  });

  const res = await fetch(`${OPEN_METEO_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`Weather fetch failed (${res.status})`);
  const json = await res.json();

  const hourlyTimes: string[] = json.hourly?.time ?? [];
  const now = Date.now();
  const hourly: HourlyWeather[] = hourlyTimes
    .map((time, i) => ({
      time,
      hour: new Date(time).getHours(),
      tempF: Math.round(json.hourly.temperature_2m?.[i] ?? 0),
      precipProbability: json.hourly.precipitation_probability?.[i] ?? 0,
      uvIndex: json.hourly.uv_index?.[i] ?? 0,
      humidity: json.hourly.relative_humidity_2m?.[i] ?? 0,
      windMph: Math.round(json.hourly.wind_speed_10m?.[i] ?? 0),
    }))
    // Keep the current hour through the next 48h.
    .filter((h) => {
      const t = new Date(h.time).getTime();
      return t >= now - 60 * 60 * 1000 && t <= now + 48 * 60 * 60 * 1000;
    });

  const dailyDates: string[] = json.daily?.time ?? [];
  const daily: DailyWeather[] = dailyDates.map((date, i) => ({
    date,
    tempMaxF: Math.round(json.daily.temperature_2m_max?.[i] ?? 0),
    tempMinF: Math.round(json.daily.temperature_2m_min?.[i] ?? 0),
    precipProbabilityMax: json.daily.precipitation_probability_max?.[i] ?? 0,
    uvIndexMax: json.daily.uv_index_max?.[i] ?? 0,
  }));

  return { fetchedAt: new Date().toISOString(), daily, hourly };
}
