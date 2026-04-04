// Local Pulse post generator
//
// One Claude call per zone → up to 3 posts covering different beats:
//   weather      — notable conditions (storm, unusual heat/cold)
//   air_quality  — only when AQI is excellent (<20) or poor (>60)
//   new_place    — named businesses recently added to OpenStreetMap
//   local_knowledge — Wikipedia articles about places nearby
//   daylight     — sunrise within the next 90 minutes
//
// Uses claude-haiku-4-5 (fast, cheap) with a cached system prompt.
// Returns structured JSON — parsed and validated in this module.

import Anthropic from '@anthropic-ai/sdk'
import { type ZoneDataSnapshot, describeWeather } from './dataFetcher'

const client = new Anthropic()

export type PulseTopic = 'weather' | 'air_quality' | 'new_place' | 'local_knowledge' | 'daylight'

export interface GeneratedPost {
  content: string
  sourceUrl: string
  topic: PulseTopic
}

// ── System prompt (stable → cached) ─────────────────────────────────────────

const SYSTEM_PROMPT = `You are Local Pulse — the neighbourhood intelligence feed for ADHDer.io, a hyperlocal social network where posts are anchored to the exact place they were written.

Your job is to generate short, human-voiced posts from publicly available open data about a neighbourhood. These are NOT automated alerts — they should read like a curious, friendly local sharing something genuinely useful or interesting.

Return a JSON array of 1–3 posts. Each post:
{
  "topic": "weather" | "air_quality" | "new_place" | "local_knowledge" | "daylight",
  "content": "< 260 characters",
  "source": "weather" | "osm" | "wikipedia" | "sunrise"
}

Strict rules:
- Include a post ONLY if the data for that topic is genuinely notable right now:
    weather: only if conditions are interesting (thunderstorm, heavy rain, unusual temp, fog)
    air_quality: only if AQI is excellent (≤20) or poor (≥60)
    new_place: only if there's a NAMED new place (skip "a restaurant" with no name)
    local_knowledge: only if the Wikipedia extract reveals something actually interesting
    daylight: only if sunrise is 0–90 minutes away
- Maximum 260 characters per post. Count carefully.
- Reference the neighbourhood name naturally, don't start every post with it.
- Sound casual. Not a news ticker, not a chatbot, not a weather app.
- A light opinion or observation is good: "worth catching", "might want to avoid", "apparently..."
- Never invent facts — only use what's in the data.
- No hashtags. Emojis sparingly only if they genuinely add something.
- Return [] (empty array) if nothing is worth posting today.`

// ── User prompt builder ───────────────────────────────────────────────────────

function buildPrompt(snapshot: ZoneDataSnapshot): string {
  const lines: string[] = [`Neighbourhood: ${snapshot.zoneLabel}`]
  lines.push(`Data fetched at: ${new Date(snapshot.fetchedAt).toUTCString()}`)

  if (snapshot.weather) {
    const w = snapshot.weather
    lines.push(
      `\nWEATHER: ${describeWeather(w.weatherCode)}, ${w.temperatureCelsius}°C, ` +
      `wind ${w.windspeedKmh} km/h, ${w.precipitationProbability}% chance of rain`
    )
  }

  if (snapshot.airQuality) {
    const a = snapshot.airQuality
    lines.push(`\nAIR QUALITY: European AQI ${a.europeanAqi} (${a.label}), PM2.5 ${a.pm25} μg/m³`)
  }

  if (snapshot.sunriseSunset) {
    const s = snapshot.sunriseSunset
    lines.push(
      `\nDAYLIGHT: Sunrise ${s.minutesUntilSunrise > 0 ? `in ${s.minutesUntilSunrise} minutes` : `${Math.abs(s.minutesUntilSunrise)} minutes ago`}, ` +
      `sunset in ${s.minutesUntilSunset} minutes, day length ${Math.round(s.dayLengthMinutes / 60 * 10) / 10}h`
    )
  }

  if (snapshot.newAmenities.length > 0) {
    lines.push('\nNEW ON OPENSTREETMAP (may be newly opened businesses):')
    for (const a of snapshot.newAmenities) {
      const name = a.name ? `"${a.name}"` : `unnamed ${a.type}`
      lines.push(`- ${name} (type: ${a.type}, added ~${a.addedDaysAgo} days ago)`)
    }
  }

  if (snapshot.wikipediaArticles.length > 0) {
    lines.push('\nWIKIPEDIA ARTICLES ABOUT NEARBY PLACES:')
    for (const a of snapshot.wikipediaArticles) {
      lines.push(`- "${a.title}" (${a.distanceMetres}m away): ${a.extract}`)
    }
  }

  lines.push('\nReturn a JSON array of posts. Return [] if nothing is genuinely worth sharing today.')
  return lines.join('\n')
}

// ── Source URL picker ─────────────────────────────────────────────────────────

function sourceUrl(source: string, snapshot: ZoneDataSnapshot): string {
  const osmMap = `https://www.openstreetmap.org/#map=16/${snapshot.lat.toFixed(4)}/${snapshot.lng.toFixed(4)}`
  switch (source) {
    case 'weather':
      return snapshot.weather?.sourceUrl ?? osmMap
    case 'wikipedia':
      return snapshot.wikipediaArticles[0]?.url ?? osmMap
    case 'sunrise':
      return `https://www.timeanddate.com/sun/`
    default:
      return osmMap
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateLocalPulsePosts(
  snapshot: ZoneDataSnapshot,
): Promise<GeneratedPost[]> {
  // Skip if we have no data at all
  const hasData = snapshot.weather || snapshot.airQuality || snapshot.newAmenities.length > 0
    || snapshot.wikipediaArticles.length > 0 || snapshot.sunriseSunset
  if (!hasData) return []

  const userPrompt = buildPrompt(snapshot)

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 700,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },  // stable → cache across all zone calls
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return []

    const raw = textBlock.text.trim()
    if (!raw || raw === '[]') return []

    // Extract JSON array from response (Claude may wrap it in markdown)
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = JSON.parse(jsonMatch[0]) as any[]
    if (!Array.isArray(items)) return []

    const VALID_TOPICS = new Set<string>(['weather', 'air_quality', 'new_place', 'local_knowledge', 'daylight'])

    return items
      .filter((item) =>
        item &&
        typeof item.content === 'string' &&
        typeof item.topic === 'string' &&
        VALID_TOPICS.has(item.topic) &&
        item.content.length > 0 &&
        item.content.length <= 280
      )
      .slice(0, 3)
      .map((item) => ({
        content: item.content as string,
        topic: item.topic as PulseTopic,
        sourceUrl: sourceUrl(item.source as string, snapshot),
      }))
  } catch (err) {
    console.error('[LocalPulse] Claude API error:', err)
    return []
  }
}
