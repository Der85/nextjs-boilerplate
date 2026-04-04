// Open data fetcher for Local Pulse AI posts
//
// Sources — all free, no API keys required, zero user data collected:
//   Open-Meteo        : weather forecast (hyperlocal, free)
//   Open-Meteo AQ     : air quality / AQI (European index, free)
//   sunrise-sunset.org: accurate sunrise/sunset times (free)
//   Overpass API (OSM): new amenities added to the map recently
//   Wikipedia Geosearch: articles about places near the zone centre

import { cellToLatLng, cellToBoundary } from 'h3-js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeatherSnapshot {
  temperatureCelsius: number
  weatherCode: number
  windspeedKmh: number
  precipitationProbability: number
  sourceUrl: string
}

export interface AirQualitySnapshot {
  europeanAqi: number          // 0–20 good, 20–40 fair, 40–60 moderate, 60–80 poor, >80 very poor
  pm25: number                 // μg/m³
  label: 'good' | 'fair' | 'moderate' | 'poor' | 'very poor'
  sourceUrl: string
}

export interface SunriseSunsetSnapshot {
  sunriseIso: string
  sunsetIso: string
  dayLengthMinutes: number
  minutesUntilSunrise: number  // negative = already passed
  minutesUntilSunset: number
}

export interface OsmAmenity {
  name: string | null
  type: string
  addedDaysAgo: number
}

export interface WikipediaArticle {
  title: string
  distanceMetres: number
  extract: string   // first 2 sentences from Wikipedia
  url: string
}

export interface ZoneDataSnapshot {
  lat: number
  lng: number
  zoneLabel: string
  weather: WeatherSnapshot | null
  airQuality: AirQualitySnapshot | null
  sunriseSunset: SunriseSunsetSnapshot | null
  newAmenities: OsmAmenity[]
  wikipediaArticles: WikipediaArticle[]
  fetchedAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: 'clear skies', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast',
  45: 'foggy', 48: 'icy fog',
  51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
  61: 'light rain', 63: 'rain', 65: 'heavy rain',
  71: 'light snow', 73: 'snow', 75: 'heavy snow',
  80: 'rain showers', 81: 'heavy showers',
  95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'severe thunderstorm',
}

export function describeWeather(code: number): string {
  return WMO_DESCRIPTIONS[code] ?? 'mixed conditions'
}

function aqiLabel(aqi: number): AirQualitySnapshot['label'] {
  if (aqi <= 20) return 'good'
  if (aqi <= 40) return 'fair'
  if (aqi <= 60) return 'moderate'
  if (aqi <= 80) return 'poor'
  return 'very poor'
}

function cellBbox(zoneId: string) {
  const verts = cellToBoundary(zoneId)
  const lats = verts.map((v) => v[0])
  const lngs = verts.map((v) => v[1])
  return { south: Math.min(...lats), west: Math.min(...lngs), north: Math.max(...lats), east: Math.max(...lngs) }
}

// ── Weather (Open-Meteo) ─────────────────────────────────────────────────────

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

    const hourlyTimes: string[] = data.hourly?.time ?? []
    const hourlyProb: number[] = data.hourly?.precipitation_probability ?? []
    const hourIdx = hourlyTimes.findIndex((t: string) => t === current.time)
    const precipProb = hourIdx >= 0 ? (hourlyProb[hourIdx] ?? 0) : 0

    return {
      temperatureCelsius: Math.round(current.temperature as number),
      weatherCode: current.weathercode as number,
      windspeedKmh: Math.round(current.windspeed as number),
      precipitationProbability: precipProb,
      sourceUrl: url.toString(),
    }
  } catch { return null }
}

// ── Air quality (Open-Meteo Air Quality API) ──────────────────────────────────

async function fetchAirQuality(lat: number, lng: number): Promise<AirQualitySnapshot | null> {
  const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality')
  url.searchParams.set('latitude', lat.toFixed(4))
  url.searchParams.set('longitude', lng.toFixed(4))
  url.searchParams.set('current', 'european_aqi,pm2_5')

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'ADHDer.io LocalPulse/1.0' },
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as any
    const current = data.current
    if (!current) return null

    const aqi = Math.round(current.european_aqi ?? 0)
    const pm25 = Math.round((current.pm2_5 ?? 0) * 10) / 10

    return {
      europeanAqi: aqi,
      pm25,
      label: aqiLabel(aqi),
      sourceUrl: url.toString(),
    }
  } catch { return null }
}

// ── Sunrise / sunset (sunrise-sunset.org) ────────────────────────────────────

async function fetchSunriseSunset(lat: number, lng: number): Promise<SunriseSunsetSnapshot | null> {
  const url = `https://api.sunrise-sunset.org/json?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&formatted=0`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ADHDer.io LocalPulse/1.0' },
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as any
    if (data.status !== 'OK') return null

    const sunrise = new Date(data.results.sunrise as string)
    const sunset = new Date(data.results.sunset as string)
    const now = Date.now()
    const dayLengthMs = sunset.getTime() - sunrise.getTime()

    return {
      sunriseIso: sunrise.toISOString(),
      sunsetIso: sunset.toISOString(),
      dayLengthMinutes: Math.round(dayLengthMs / 60_000),
      minutesUntilSunrise: Math.round((sunrise.getTime() - now) / 60_000),
      minutesUntilSunset: Math.round((sunset.getTime() - now) / 60_000),
    }
  } catch { return null }
}

// ── OSM new amenities (Overpass API) ─────────────────────────────────────────

async function fetchNewAmenities(zoneId: string): Promise<OsmAmenity[]> {
  const { south, west, north, east } = cellBbox(zoneId)
  const bbox = `${south.toFixed(4)},${west.toFixed(4)},${north.toFixed(4)},${east.toFixed(4)}`
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'ADHDer.io LocalPulse/1.0' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await res.json() as { elements?: any[] }
    return (data.elements ?? []).slice(0, 5).map((el) => {
      const tags = el.tags ?? {}
      const addedDate = el.timestamp ? new Date(el.timestamp as string) : new Date()
      return {
        name: (tags.name as string | undefined) ?? null,
        type: (tags.amenity ?? tags.shop ?? 'place') as string,
        addedDaysAgo: Math.floor((Date.now() - addedDate.getTime()) / (24 * 60 * 60 * 1000)),
      }
    })
  } catch { return [] }
}

// ── Wikipedia nearby (Geosearch + extract) ────────────────────────────────────

async function fetchWikipediaNearby(lat: number, lng: number): Promise<WikipediaArticle[]> {
  // Step 1: find nearby articles within 1km
  const searchUrl = new URL('https://en.wikipedia.org/w/api.php')
  searchUrl.searchParams.set('action', 'query')
  searchUrl.searchParams.set('list', 'geosearch')
  searchUrl.searchParams.set('gsradius', '1000')
  searchUrl.searchParams.set('gscoord', `${lat}|${lng}`)
  searchUrl.searchParams.set('gslimit', '5')
  searchUrl.searchParams.set('format', 'json')
  searchUrl.searchParams.set('origin', '*')

  try {
    const searchRes = await fetch(searchUrl.toString(), {
      headers: { 'User-Agent': 'ADHDer.io LocalPulse/1.0 (contact@adhder.io)' },
      signal: AbortSignal.timeout(5_000),
    })
    if (!searchRes.ok) return []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const searchData = await searchRes.json() as any
    const hits = (searchData.query?.geosearch ?? []) as Array<{ pageid: number; title: string; dist: number }>
    if (hits.length === 0) return []

    // Step 2: fetch intro extracts for the top 3 results
    const pageIds = hits.slice(0, 3).map((h) => h.pageid).join('|')
    const extractUrl = new URL('https://en.wikipedia.org/w/api.php')
    extractUrl.searchParams.set('action', 'query')
    extractUrl.searchParams.set('pageids', pageIds)
    extractUrl.searchParams.set('prop', 'extracts')
    extractUrl.searchParams.set('exintro', '1')
    extractUrl.searchParams.set('exsentences', '2')
    extractUrl.searchParams.set('explaintext', '1')
    extractUrl.searchParams.set('format', 'json')
    extractUrl.searchParams.set('origin', '*')

    const extractRes = await fetch(extractUrl.toString(), {
      headers: { 'User-Agent': 'ADHDer.io LocalPulse/1.0 (contact@adhder.io)' },
      signal: AbortSignal.timeout(5_000),
    })
    if (!extractRes.ok) return []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extractData = await extractRes.json() as any
    const pages = extractData.query?.pages ?? {}

    return hits.slice(0, 3).map((hit) => ({
      title: hit.title,
      distanceMetres: hit.dist,
      extract: ((pages[hit.pageid]?.extract as string | undefined) ?? '').slice(0, 300),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`,
    })).filter((a) => a.extract.length > 20)  // skip stubs
  } catch { return [] }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function fetchZoneData(
  zoneId: string,
  zoneLabel: string,
): Promise<ZoneDataSnapshot> {
  const [lat, lng] = cellToLatLng(zoneId)

  const [weather, airQuality, sunriseSunset, newAmenities, wikipediaArticles] = await Promise.all([
    fetchWeather(lat, lng),
    fetchAirQuality(lat, lng),
    fetchSunriseSunset(lat, lng),
    fetchNewAmenities(zoneId),
    fetchWikipediaNearby(lat, lng),
  ])

  return {
    lat, lng, zoneLabel,
    weather, airQuality, sunriseSunset,
    newAmenities, wikipediaArticles,
    fetchedAt: new Date().toISOString(),
  }
}
