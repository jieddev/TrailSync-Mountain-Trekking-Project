import { describe, expect, it } from 'vitest'

import { parseKmlLineStrings, type KmlCoordinate } from './lib/kml'
import { SULFATARA_PREVIEW } from './trail-previews'
import sulfataraKml from '../../../public/trails/sulfatara.kml?raw'

function distanceMeters(a: KmlCoordinate, b: KmlCoordinate): number {
  const dx = (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180)
  const dy = (a.lat - b.lat) * 110_574
  return Math.hypot(dx, dy)
}

describe('SULFATARA_PREVIEW', () => {
  const lines = parseKmlLineStrings(sulfataraKml)

  it('points at the bundled route file', () => {
    expect(SULFATARA_PREVIEW.kmlUrl).toBe('/trails/sulfatara.kml')
  })

  it('ships a single route from the Cabintan jump-off up to Sulfatara', () => {
    expect(lines).toHaveLength(1)
    const route = lines[0]
    const sulfatara = { lat: 11.095961, lng: 124.737134, altitude: 0 }

    expect(route[0]).toMatchObject({ lat: 11.080324, lng: 124.722855 })
    expect(distanceMeters(route[route.length - 1], sulfatara)).toBeLessThan(300)
  })

  it('is about the published 5 km one-way walk and avoids Lake Janagdan', () => {
    const route = lines[0]
    const length = route
      .slice(1)
      .reduce((sum, point, i) => sum + distanceMeters(route[i], point), 0)
    const lakeJanagdan = { lat: 11.0991, lng: 124.71734, altitude: 0 }

    expect(length).toBeGreaterThan(4_500)
    expect(length).toBeLessThan(5_500)
    expect(
      Math.min(...route.map((point) => distanceMeters(point, lakeJanagdan))),
    ).toBeGreaterThan(1_000)
  })
})
