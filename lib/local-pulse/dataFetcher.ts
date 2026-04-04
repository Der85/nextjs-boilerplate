// Open data fetcher for Local Pulse AI posts
//
// Pulls publicly available data near an H3 zone with zero user surveillance.
// Sources:
//   - Open-Meteo  : free, no key, hyperlocal weather
//   - Overpass API: OSM changes — new amenities, recent edits

import { cellToLatLng, cellToBoundary } from 'h3-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeatherSnapshot {
  temperatureCelsius: number
  weatherCode: number        // WMO code: 0=clear, 61=rain, 95=thunderstorm, etc.
  windspeedKmh: number
  precipitationProbability: number  // 0–100 %
  sourceUrl: string
}

export interface OsmAmenity {
  name: string | null
  type: string          // 'cafe', 'restaurant', 'pub', 'shop', etc.
  addedDaysAgo: number  // days since added to OSM
}

export interface ZoneDataSnapshot {
  lat: number
  lng: number
  zoneLabel: string
  weather: WeatherSnapshot | null
  newAmenities: OsmAmenity[]   // OSM additions in the last 30 days
  fetchedAt: string            // ISO timestamp
}

// ── Weather (Open-Meteo) ─────────────────────────────────────────────────────

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: 'clear skies',
  1: 'mainly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'foggy',
  48: 'icy fog',
  51: 'light drizzle',
  53: 'drizzle',
  55: 'heavy drizzle',
  61: 'light rain',
  63: 'rain',
  65: 'heavy rain',
  71: 'light snow',
  73: 'snow',
  75: 'heavy snow',
  80: 'rain showers',
  81: 'heavy showers',
  95: 'thunderstorm',
  96: 'thunderstorm with hail',
  99: 'severe thunderstorm',
}

export function describeWeather(code: number): string {
  return WMO_DESCRIPTIONS[code] ?? 'mixed conditions'
}

async function fetchWeather(lat: number, lng: number): Promise<WeatherSnapshot | null> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', lat.toFixed(4))
  url.searchParams.set('longitude', lng.toFixed(4))
  url.searchParams.set('current_weather', 'true')
  url.searchParams.set('hourly', 'precipitation_probability')
  url.searchParams.set('forecast_days', '1')
  url.searchParams.set('timezone', 'auto')

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'ADHDer.io LocalPulse/1.0' },
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as any

    const current = data.current_weather
    if (!current) return null

    // Precipitation probability at the current hour index
    const hourlyTimes: string[] = data.hourly?.time ?? []
    const hourlyProb: number[] = data.hourly?.precipitation_probability ?? []
    const nowIso = current.time as string
    const hourIdx = hourlyTimes.findIndex((t: string) => t === nowIso)
    const precipProb = hourIdx >= 0 ? (hourlyProb[hourIdx] ?? 0) : 0

    return {
      temperatureCelsius: Math.round(current.temperature as number),
      weatherCode: current.weathercode as number,
      windspeedKmh: Math.round(current.windspeed as number),
      precipitationProbability: precipProb,
      sourceUrl: url.toString(),
    }
  } catch {
    return null
  }
}

// ── OSM new amenities (Overpass API) ─────────────────────────────────────────

function cellBbox(zoneId: string): { south: number; west: number; north: number; east: number } {
  const verts = cellToBoundary(zoneId)  // [[lat, lng], ...]
  const lats = verts.map((v) => v[0])
  const lngs = verts.map((v) => v[1])
  return {
    south: Math.min(...lats),
    west: Math.min(...lngs),
    north: Math.max(...lats),
    east: Math.max(...lngs),
  }
}

async function fetchNewAmenities(zoneId: string): Promise<OsmAmenity[]> {
  const { south, west, north, east } = cellBbox(zoneId)
  const bbox = `${south.toFixed(4)},${west.toFixed(4)},${north.toFixed(4)},${east.toFixed(4)}`
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Overpass QL: nodes tagged as amenity or shop added/modified recently
  const query = `
[out:json][timeout:8];
(
  node["amenity"](newer:"${since}T00:00:00Z")(${bbox});
  node["shop"](newer:"${since}T00:00:00Z")(${bbox});
);
out body 10;
`

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'ADHDer.io LocalPulse/1.0',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as { elements?: any[] }
    const elements = data.elements ?? []

    return elements.slice(0, 5).map((el) => {
      const tags = el.tags ?? {}
      const addedDate = el.timestamp ? new Date(el.timestamp as string) : new Date()
      const daysAgo = Math.floor((Date.now() - addedDate.getTime()) / (24 * 60 * 60 * 1000))
      return {
        name: (tags.name as string | undefined) ?? null,
        type: (tags.amenity ?? tags.shop ?? 'place') as string,
        addedDaysAgo: daysAgo,
      }
    })
  } catch {
    return []
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function fetchZoneData(
  zoneId: string,
  zoneLabel: string,
): Promise<ZoneDataSnapshot> {
  const [lat, lng] = cellToLatLng(zoneId)

  const [weather, newAmenities] = await Promise.all([
    fetchWeather(lat, lng),
    fetchNewAmenities(zoneId),
  ])

  return {
    lat,
    lng,
    zoneLabel,
    weather,
    newAmenities,
    fetchedAt: new Date().toISOString(),
  }
}
