import { describe, expect, it } from 'vitest'

import { parseKmlLineStrings, type KmlCoordinate } from './lib/kml'
import {
  MT_MALINGATONG_PREVIEW,
  SULFATARA_PREVIEW,
  TRAIL_PREVIEWS,
} from './trail-previews'
import mtMalingatongKml from '../../../public/trails/mt-malingatong.kml?raw'
import sulfataraKml from '../../../public/trails/sulfatara.kml?raw'

function distanceMeters(a: KmlCoordinate, b: KmlCoordinate): number {
  const dx = (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180)
  const dy = (a.lat - b.lat) * 110_574
  return Math.hypot(dx, dy)
}

function routeLength(route: KmlCoordinate[]): number {
  return route
    .slice(1)
    .reduce((sum, point, i) => sum + distanceMeters(route[i], point), 0)
}

const CABINTAN_JUMP_OFF = { lat: 11.080324, lng: 124.722855 }
const LAKE_JANAGDAN = { lat: 11.0991, lng: 124.71734, altitude: 0 }

describe('TRAIL_PREVIEWS', () => {
  it('lists the active catalog trails by slug', () => {
    expect(TRAIL_PREVIEWS.map((preview) => preview.id)).toEqual([
      'sulfatara',
      'mt-malingatong',
    ])
  })
})

describe.each([
  {
    preview: SULFATARA_PREVIEW,
    kml: sulfataraKml,
    destination: { lat: 11.095961, lng: 124.737134, altitude: 0 },
    maxEndDistance: 300,
    minLength: 4_500,
    maxLength: 5_500,
  },
  {
    preview: MT_MALINGATONG_PREVIEW,
    kml: mtMalingatongKml,
    // The source track's high point on the Malingatong side trail.
    destination: { lat: 11.100223, lng: 124.735773, altitude: 0 },
    maxEndDistance: 1,
    minLength: 5_000,
    maxLength: 5_700,
  },
])(
  '$preview.name route',
  ({ preview, kml, destination, maxEndDistance, minLength, maxLength }) => {
    const lines = parseKmlLineStrings(kml)

    it('is served from the bundled route file', () => {
      expect(preview.kmlUrl).toBe(`/trails/${preview.id}.kml`)
    })

    it('runs from the Cabintan jump-off to its destination', () => {
      expect(lines).toHaveLength(1)
      const route = lines[0]

      expect(route[0]).toMatchObject(CABINTAN_JUMP_OFF)
      expect(distanceMeters(route[route.length - 1], destination)).toBeLessThan(
        maxEndDistance,
      )
    })

    it('has a plausible length and avoids Lake Janagdan', () => {
      const route = lines[0]
      const length = routeLength(route)

      expect(length).toBeGreaterThan(minLength)
      expect(length).toBeLessThan(maxLength)
      expect(
        Math.min(...route.map((point) => distanceMeters(point, LAKE_JANAGDAN))),
      ).toBeGreaterThan(1_000)
    })
  },
)
