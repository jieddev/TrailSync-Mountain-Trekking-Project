import { describe, expect, it } from 'vitest'

import { parseKmlLineStrings } from './kml'

const SAMPLE_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml>
<Document>
  <Placemark>
    <Point>
      <coordinates>124.70963,11.095635,743.5</coordinates>
    </Point>
  </Placemark>
  <Placemark>
    <name>Path</name>
    <MultiGeometry>
      <LineString>
        <coordinates>
          124.70963,11.095635,743.5 124.709698,11.095532,743.568 124.70973,11.095499
        </coordinates>
      </LineString>
    </MultiGeometry>
  </Placemark>
</Document>
</kml>`

describe('parseKmlLineStrings', () => {
  it('extracts coordinates only from LineString blocks, ignoring Point placemarks', () => {
    const result = parseKmlLineStrings(SAMPLE_KML)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual([
      { lat: 11.095635, lng: 124.70963, altitude: 743.5 },
      { lat: 11.095532, lng: 124.709698, altitude: 743.568 },
      { lat: 11.095499, lng: 124.70973, altitude: 0 },
    ])
  })

  it('returns an empty array when there are no LineString elements', () => {
    expect(parseKmlLineStrings('<kml><Document></Document></kml>')).toEqual([])
  })
})
