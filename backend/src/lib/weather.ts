import { manilaToday } from "./manila-date.js";

// Weather is advisory only: it is shown to hikers, guides and coordinators but
// never restricts a trail. A coordinator restricts a trail by hand.
//
// One point for both trails: the Cabintan jump-off, the first point of the
// provisional Wikiloc KML. Override it with WEATHER_LAT / WEATHER_LNG.
const DEFAULT_POINT = { name: "Cabintan jump-off", latitude: 11.080324, longitude: 124.722855 };
const PROVIDER_URL = "https://api.openweathermap.org/data/2.5";
const TIMEOUT_MS = 5_000;
const FRESH_MS = 10 * 60_000;
// After a failed request, wait this long before asking the provider again.
const RETRY_MS = 60_000;
// After this the last good forecast is too old to show, even as stale.
const STALE_LIMIT_MS = 6 * 60 * 60_000;

export type WeatherCondition = { code: number; main: string; description: string; icon: string };

export type CurrentWeather = {
  observedAt: string;
  temperatureC: number;
  feelsLikeC: number;
  humidityPercent: number;
  windSpeedMs: number;
  windGustMs: number | null;
  rainLastHourMm: number;
  condition: WeatherCondition;
};

// One Asia/Manila calendar day from the 3-hourly forecast. Today and the last
// day only cover the hours still in the forecast.
export type DailyWeather = {
  date: string;
  minTemperatureC: number;
  maxTemperatureC: number;
  rainMm: number;
  rainChancePercent: number;
  maxWindSpeedMs: number;
  maxWindGustMs: number | null;
  thunderstorm: boolean;
  condition: WeatherCondition;
};

export type Weather = {
  location: { name: string; latitude: number; longitude: number; provisional: boolean };
  current: CurrentWeather;
  daily: DailyWeather[];
  fetchedAt: string;
  stale: boolean;
};

// The service has no API key, or the provider failed with nothing cached.
export class WeatherUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "WeatherUnavailableError";
  }
}

type OwCondition = { id: number; main: string; description: string; icon: string };
type OwCurrent = {
  dt: number;
  weather: OwCondition[];
  main: { temp: number; feels_like: number; humidity: number };
  wind: { speed: number; gust?: number };
  rain?: { "1h"?: number };
};
type OwForecastEntry = {
  dt: number;
  weather: OwCondition[];
  main: { temp_min: number; temp_max: number };
  wind: { speed: number; gust?: number };
  pop?: number;
  rain?: { "3h"?: number };
};
type OwForecast = { list: OwForecastEntry[] };

function config() {
  const latitude = Number(process.env.WEATHER_LAT ?? DEFAULT_POINT.latitude);
  const longitude = Number(process.env.WEATHER_LNG ?? DEFAULT_POINT.longitude);
  return {
    apiKey: process.env.OPENWEATHER_API_KEY?.trim() || null,
    location: {
      name: process.env.WEATHER_LOCATION_NAME?.trim() || DEFAULT_POINT.name,
      latitude,
      longitude,
      // The point comes from the provisional KML until the route is surveyed.
      provisional: true,
    },
  };
}

const round = (value: number, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

const conditionOf = (weather: OwCondition[]): WeatherCondition => {
  const { id, main, description, icon } = weather[0] ?? { id: 800, main: "Clear", description: "clear sky", icon: "01d" };
  return { code: id, main, description, icon };
};

// Higher is more significant for a hike: thunderstorm, rain, drizzle, snow,
// haze/fog, clouds, clear. Codes: openweathermap.org/weather-conditions.
function severity(code: number) {
  const group = Math.floor(code / 100);
  return { 2: 6, 5: 5, 3: 4, 6: 3, 7: 2 }[group] ?? (code > 800 ? 1 : 0);
}

function currentFrom(data: OwCurrent): CurrentWeather {
  return {
    observedAt: new Date(data.dt * 1000).toISOString(),
    temperatureC: round(data.main.temp),
    feelsLikeC: round(data.main.feels_like),
    humidityPercent: data.main.humidity,
    windSpeedMs: round(data.wind.speed),
    windGustMs: data.wind.gust === undefined ? null : round(data.wind.gust),
    rainLastHourMm: round(data.rain?.["1h"] ?? 0),
    condition: conditionOf(data.weather),
  };
}

export function dailyFrom(entries: OwForecastEntry[]): DailyWeather[] {
  const days = new Map<string, OwForecastEntry[]>();
  for (const entry of entries) {
    const date = manilaToday(new Date(entry.dt * 1000));
    days.set(date, [...(days.get(date) ?? []), entry]);
  }
  return [...days].map(([date, slots]) => {
    const gusts = slots.flatMap((slot) => (slot.wind.gust === undefined ? [] : [slot.wind.gust]));
    const worst = slots.reduce((a, b) => (severity(b.weather[0]?.id ?? 800) > severity(a.weather[0]?.id ?? 800) ? b : a));
    return {
      date,
      minTemperatureC: round(Math.min(...slots.map((slot) => slot.main.temp_min))),
      maxTemperatureC: round(Math.max(...slots.map((slot) => slot.main.temp_max))),
      rainMm: round(slots.reduce((total, slot) => total + (slot.rain?.["3h"] ?? 0), 0)),
      rainChancePercent: Math.round(Math.max(...slots.map((slot) => slot.pop ?? 0)) * 100),
      maxWindSpeedMs: round(Math.max(...slots.map((slot) => slot.wind.speed))),
      maxWindGustMs: gusts.length ? round(Math.max(...gusts)) : null,
      thunderstorm: slots.some((slot) => slot.weather.some((condition) => Math.floor(condition.id / 100) === 2)),
      condition: conditionOf(worst.weather),
    };
  });
}

async function fetchProvider<T>(path: string, apiKey: string, location: { latitude: number; longitude: number }): Promise<T> {
  const url = new URL(`${PROVIDER_URL}/${path}`);
  url.search = new URLSearchParams({ lat: String(location.latitude), lon: String(location.longitude), units: "metric", appid: apiKey }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  // Never include the URL in errors: it carries the API key.
  if (!response.ok) throw new Error(`OpenWeather ${path} responded ${response.status}`);
  return (await response.json()) as T;
}

let cached: { weather: Omit<Weather, "stale">; at: number } | null = null;
let inFlight: Promise<Omit<Weather, "stale">> | null = null;
let failedAt: number | null = null;

async function refresh(apiKey: string, location: Weather["location"], now: Date) {
  const [current, forecast] = await Promise.all([
    fetchProvider<OwCurrent>("weather", apiKey, location),
    fetchProvider<OwForecast>("forecast", apiKey, location),
  ]);
  const today = manilaToday(now);
  return {
    location,
    current: currentFrom(current),
    daily: dailyFrom(forecast.list).filter((day) => day.date >= today),
    fetchedAt: now.toISOString(),
  };
}

// Current conditions and a daily forecast for the trail point. Cached for ten
// minutes and shared by concurrent callers; if the provider fails, the last
// good forecast is returned with stale: true.
export async function getWeather(now = new Date()): Promise<Weather> {
  const { apiKey, location } = config();
  if (!apiKey) throw new WeatherUnavailableError("OPENWEATHER_API_KEY is not set");
  if (cached && now.getTime() - cached.at < FRESH_MS) return { ...cached.weather, stale: false };

  const usable = cached && now.getTime() - cached.at < STALE_LIMIT_MS ? cached.weather : null;
  if (failedAt !== null && now.getTime() - failedAt < RETRY_MS) {
    if (usable) return { ...usable, stale: true };
    throw new WeatherUnavailableError("Weather provider request failed recently");
  }

  try {
    inFlight ??= refresh(apiKey, location, now).finally(() => {
      inFlight = null;
    });
    const weather = await inFlight;
    cached = { weather, at: now.getTime() };
    failedAt = null;
    return { ...weather, stale: false };
  } catch (error) {
    failedAt = now.getTime();
    if (usable) return { ...usable, stale: true };
    throw new WeatherUnavailableError("Weather provider request failed", error);
  }
}

// For tests.
export function resetWeatherCache() {
  cached = null;
  inFlight = null;
  failedAt = null;
}
