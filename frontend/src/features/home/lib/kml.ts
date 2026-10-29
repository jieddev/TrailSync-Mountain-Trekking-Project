export type KmlCoordinate = { lat: number; lng: number; altitude: number }

const LINE_STRING_PATTERN =
  /<LineString>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/LineString>/g

// KML coordinates are whitespace-separated "lng,lat[,altitude]" tuples.
function parseCoordinatesBlock(block: string): KmlCoordinate[] {
  return block
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((tuple) => {
      const [lng, lat, altitude] = tuple.split(',').map(Number)
      return { lat, lng, altitude: altitude ?? 0 }
    })
}

export function parseKmlLineStrings(kmlText: string): KmlCoordinate[][] {
  return [...kmlText.matchAll(LINE_STRING_PATTERN)].map((match) =>
    parseCoordinatesBlock(match[1]),
  )
}
