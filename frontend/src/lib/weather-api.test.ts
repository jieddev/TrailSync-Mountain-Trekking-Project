import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from './api'
import {
  describeDay,
  forecastOn,
  getWeather,
  windKph,
  type DailyWeather,
  type Weather,
} from './weather-api'

const day: DailyWeather = {
  date: '2026-10-29',
  minTemperatureC: 18.5,
  maxTemperatureC: 26,
  rainMm: 5.2,
  rainChancePercent: 100,
  maxWindSpeedMs: 1.5,
  maxWindGustMs: 3,
  thunderstorm: false,
  condition: {
    code: 500,
    main: 'Rain',
    description: 'light rain',
    icon: '10d',
  },
}

const weather: Weather = {
  location: {
    name: 'Cabintan jump-off',
    latitude: 11.080324,
    longitude: 124.722855,
    provisional: true,
  },
  current: {
    observedAt: '2026-10-28T13:21:39.000Z',
    temperatureC: 19.4,
    feelsLikeC: 19.9,
    humidityPercent: 97,
    windSpeedMs: 1.1,
    windGustMs: 2.1,
    rainLastHourMm: 0,
    condition: {
      code: 800,
      main: 'Clear',
      description: 'clear sky',
      icon: '01n',
    },
  },
  daily: [day],
  fetchedAt: '2026-10-28T13:23:42.687Z',
  stale: false,
}

function stubFetch(body: unknown, status = 200) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('weather API', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('loads the weather without a token', async () => {
    const fetchMock = stubFetch(weather)
    await expect(getWeather()).resolves.toEqual(weather)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/weather',
      { method: 'GET', headers: {} },
    )
  })

  it('reports unavailable weather as an ApiError', async () => {
    stubFetch(
      { error: { code: 'WEATHER_UNAVAILABLE', message: 'Unavailable' } },
      503,
    )
    await expect(getWeather()).rejects.toMatchObject({
      constructor: ApiError,
      status: 503,
      code: 'WEATHER_UNAVAILABLE',
    })
  })
})

describe('weather helpers', () => {
  it('finds the forecast for a date', () => {
    expect(forecastOn(weather, '2026-10-29')).toBe(day)
    expect(forecastOn(weather, '2026-11-10')).toBeNull()
  })

  it('converts wind to km/h and summarises a day', () => {
    expect(windKph(1.5)).toBe(5)
    expect(describeDay(day)).toBe(
      'Light rain, 19–26°C, 100% chance of rain (5.2 mm), wind up to 11 km/h',
    )
  })
})
