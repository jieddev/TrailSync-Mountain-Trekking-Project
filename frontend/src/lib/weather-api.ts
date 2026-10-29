import { requestJson } from './api'

export type WeatherCondition = {
  code: number
  main: string
  description: string
  icon: string
}

export type CurrentWeather = {
  observedAt: string
  temperatureC: number
  feelsLikeC: number
  humidityPercent: number
  windSpeedMs: number
  windGustMs: number | null
  rainLastHourMm: number
  condition: WeatherCondition
}

// One Asia/Manila day. Today only covers the hours still ahead.
export type DailyWeather = {
  date: string
  minTemperatureC: number
  maxTemperatureC: number
  rainMm: number
  rainChancePercent: number
  maxWindSpeedMs: number
  maxWindGustMs: number | null
  thunderstorm: boolean
  condition: WeatherCondition
}

// Advisory only: weather never closes a trail. Coordinators do that by hand.
export type Weather = {
  location: {
    name: string
    latitude: number
    longitude: number
    provisional: boolean
  }
  current: CurrentWeather
  daily: DailyWeather[]
  fetchedAt: string
  stale: boolean
}

// Current conditions and about five days of forecast at the trail point. No
// sign-in needed. Fails with 503 WEATHER_UNAVAILABLE when the server has no
// weather to give.
export function getWeather() {
  return requestJson<Weather>(
    '/api/v1/weather',
    {},
    'Could not load the weather.',
  )
}

export function forecastOn(weather: Weather, date: string) {
  return weather.daily.find((day) => day.date === date) ?? null
}

// Hikers think in km/h, OpenWeather reports m/s.
export function windKph(metresPerSecond: number) {
  return Math.round(metresPerSecond * 3.6)
}

export function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function conditionIconUrl(condition: WeatherCondition) {
  return `https://openweathermap.org/img/wn/${encodeURIComponent(condition.icon)}@2x.png`
}

// A one-line summary of a day, for the booking form and notices.
export function describeDay(day: DailyWeather) {
  const wind = windKph(day.maxWindGustMs ?? day.maxWindSpeedMs)
  return `${capitalize(day.condition.description)}, ${Math.round(day.minTemperatureC)}–${Math.round(day.maxTemperatureC)}°C, ${day.rainChancePercent}% chance of rain (${day.rainMm} mm), wind up to ${wind} km/h`
}
