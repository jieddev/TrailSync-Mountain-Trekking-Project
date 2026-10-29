import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/firebase-admin.js", () => ({ firebaseAuth: { verifyIdToken: vi.fn() } }));
vi.mock("./lib/prisma.js", () => ({ prisma: {} }));

import { app } from "./app.js";
import { dailyFrom, resetWeatherCache } from "./lib/weather.js";

// 2026-10-28 08:00 in Manila.
const NOW = new Date("2026-10-28T00:00:00Z");
const at = (iso: string) => Date.parse(iso) / 1000;
const condition = (id: number, main: string, description = main.toLowerCase()) => [{ id, main, description, icon: "10d" }];

const current = {
  dt: at("2026-10-27T23:50:00Z"),
  weather: condition(803, "Clouds", "broken clouds"),
  main: { temp: 21.36, feels_like: 21.9, humidity: 90 },
  wind: { speed: 1.14, gust: 2.07 },
};
const slot = (iso: string, overrides: Record<string, unknown> = {}) => ({
  dt: at(iso),
  weather: condition(800, "Clear"),
  main: { temp_min: 20, temp_max: 24 },
  wind: { speed: 2 },
  pop: 0,
  ...overrides,
});
const forecast = {
  list: [
    // Still the previous Manila day (07:00): dropped from the response.
    slot("2026-10-27T23:00:00Z"),
    // 2026-10-28 in Manila.
    slot("2026-10-28T03:00:00Z", { main: { temp_min: 25, temp_max: 27.06 }, rain: { "3h": 1.2 }, pop: 0.4, weather: condition(500, "Rain", "light rain") }),
    slot("2026-10-28T06:00:00Z", { rain: { "3h": 2.55 }, pop: 0.81, wind: { speed: 5.4, gust: 9.18 }, weather: condition(211, "Thunderstorm") }),
    slot("2026-10-28T15:00:00Z", { main: { temp_min: 18.94, temp_max: 19 } }),
    // 2026-10-29 in Manila starts at 16:00 UTC.
    slot("2026-10-28T18:00:00Z", { weather: condition(802, "Clouds", "scattered clouds") }),
  ],
};

let fetchMock: ReturnType<typeof vi.fn>;

function respond(...bodies: (object | number | Error)[]) {
  for (const body of bodies) {
    if (body instanceof Error) fetchMock.mockRejectedValueOnce(body);
    else if (typeof body === "number") fetchMock.mockResolvedValueOnce(new Response("{}", { status: body }));
    else fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }));
  }
}

beforeEach(() => {
  resetWeatherCache();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("OPENWEATHER_API_KEY", "test-key");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const getWeather = () => request(app).get("/api/v1/weather");

describe("GET /api/v1/weather", () => {
  it("returns current conditions and a daily Manila forecast for the provisional trail point", async () => {
    respond(current, forecast);
    const response = await getWeather();
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      location: { name: "Cabintan jump-off", latitude: 11.080324, longitude: 124.722855, provisional: true },
      current: {
        observedAt: "2026-10-27T23:50:00.000Z", temperatureC: 21.4, feelsLikeC: 21.9, humidityPercent: 90,
        windSpeedMs: 1.1, windGustMs: 2.1, rainLastHourMm: 0,
        condition: { code: 803, main: "Clouds", description: "broken clouds", icon: "10d" },
      },
      daily: [
        {
          date: "2026-10-28", minTemperatureC: 18.9, maxTemperatureC: 27.1, rainMm: 3.8, rainChancePercent: 81,
          maxWindSpeedMs: 5.4, maxWindGustMs: 9.2, thunderstorm: true,
          condition: { code: 211, main: "Thunderstorm", description: "thunderstorm", icon: "10d" },
        },
        {
          date: "2026-10-29", minTemperatureC: 20, maxTemperatureC: 24, rainMm: 0, rainChancePercent: 0,
          maxWindSpeedMs: 2, maxWindGustMs: null, thunderstorm: false,
          condition: { code: 802, main: "Clouds", description: "scattered clouds", icon: "10d" },
        },
      ],
      fetchedAt: NOW.toISOString(),
      stale: false,
    });
  });

  it("asks OpenWeather for metric units at the configured point within a timeout", async () => {
    vi.stubEnv("WEATHER_LAT", "11.1");
    vi.stubEnv("WEATHER_LNG", "124.7");
    respond(current, forecast);
    await getWeather();
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toEqual([
      "https://api.openweathermap.org/data/2.5/weather?lat=11.1&lon=124.7&units=metric&appid=test-key",
      "https://api.openweathermap.org/data/2.5/forecast?lat=11.1&lon=124.7&units=metric&appid=test-key",
    ]);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("serves cached weather for ten minutes", async () => {
    respond(current, forecast);
    await getWeather();
    vi.setSystemTime(new Date(NOW.getTime() + 9 * 60_000));
    const cached = await getWeather();
    expect(cached.body).toMatchObject({ stale: false, fetchedAt: NOW.toISOString() });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.setSystemTime(new Date(NOW.getTime() + 11 * 60_000));
    respond(current, forecast);
    expect((await getWeather()).body.stale).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("falls back to the last good weather marked stale, and waits a minute before retrying", async () => {
    respond(current, forecast);
    await getWeather();
    vi.setSystemTime(new Date(NOW.getTime() + 11 * 60_000));
    respond(new Error("timeout"), forecast);
    const stale = await getWeather();
    expect(stale.status).toBe(200);
    expect(stale.body).toMatchObject({ stale: true, fetchedAt: NOW.toISOString() });

    const callsAfterFailure = fetchMock.mock.calls.length;
    vi.setSystemTime(new Date(NOW.getTime() + 11.5 * 60_000));
    expect((await getWeather()).body.stale).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(callsAfterFailure);
  });

  it("answers 503 when the provider fails with nothing cached", async () => {
    respond(500, forecast);
    const response = await getWeather();
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("WEATHER_UNAVAILABLE");
    expect(JSON.stringify(response.body)).not.toContain("test-key");
  });

  it("answers 503 without calling the provider when no API key is set", async () => {
    vi.stubEnv("OPENWEATHER_API_KEY", "");
    const response = await getWeather();
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("WEATHER_UNAVAILABLE");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("dailyFrom", () => {
  it("summarises the most significant condition of the day", () => {
    const [day] = dailyFrom([
      slot("2026-10-28T00:00:00Z", { weather: condition(804, "Clouds") }),
      slot("2026-10-28T03:00:00Z", { weather: condition(300, "Drizzle") }),
      slot("2026-10-28T06:00:00Z", { weather: condition(800, "Clear") }),
    ] as never);
    expect(day.condition.main).toBe("Drizzle");
    expect(day.thunderstorm).toBe(false);
  });
});
