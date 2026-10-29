import { useEffect, useState } from 'react'

import { getWeather, type Weather } from '../../../lib/weather-api'

export type WeatherState =
  | { status: 'loading' }
  | { status: 'loaded'; weather: Weather }
  | { status: 'unavailable' }

// Weather is advisory, so a failed load only hides it; the page still works.
export function useWeather() {
  const [state, setState] = useState<WeatherState>({ status: 'loading' })

  useEffect(() => {
    let isCurrent = true
    getWeather()
      .then((weather) => {
        if (isCurrent) setState({ status: 'loaded', weather })
      })
      .catch(() => {
        if (isCurrent) setState({ status: 'unavailable' })
      })
    return () => {
      isCurrent = false
    }
  }, [])

  return state
}
