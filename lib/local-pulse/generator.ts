// Local Pulse post generator
// Converts an open-data snapshot into a short, human-voiced post using Claude.
//
// Voice: casual local — like a neighbour leaning over the fence, not a news ticker.
// Posts are ≤ 260 chars so there's room for Claude to breathe within the 280-char limit.

import Anthropic from '@anthropic-ai/sdk'
import {
  type ZoneDataSnapshot,
  describeWeather,
} from './dataFetcher'

const client = new Anthropic()  // uses ANTHROPIC_API_KEY env var

// System prompt is stable → cache it with prompt caching
const SYSTEM_PROMPT = `You are the Local Pulse for a neighbourhood social network called ADHDer.io.
Your job is to write a single short post (max 260 characters) that sounds like a curious, friendly local sharing something genuinely useful or interesting about their area.

Rules:
- Maximum 260 characters. Count carefully.
- Sound casual and human. Not a news headline, not a weather app alert, not a chatbot.
- Reference the specific neighbourhood name naturally.
- Be mildly opinionated or add a light personal touch ("might want to...", "anyone else notice...", "looks like...").
- Never invent facts. Only use information from the data you're given.
- If the data isn't interesting enough to post, say SKIP and nothing else.
- No hashtags. No emojis unless they genuinely add something.
- Do not mention AI, data sources, or that this is auto-generated.`

export interface GeneratedPost {
  content: string
  sourceUrl: string
  topic: 'weather' | 'new_place' | 'general'
}

function buildUserPrompt(snapshot: ZoneDataSnapshot): string {
  const parts: string[] = [`Neighbourhood: ${snapshot.zoneLabel}`]

  if (snapshot.weather) {
    const w = snapshot.weather
    parts.push(
      `Current weather: ${describeWeather(w.weatherCode)}, ${w.temperatureCelsius}°C, ` +
      `wind ${w.windspeedKmh} km/h, ${w.precipitationProbability}% chance of rain`
    )
  }

  if (snapshot.newAmenities.length > 0) {
    const amenityLines = snapshot.newAmenities.map((a) => {
      const name = a.name ? `"${a.name}"` : `a ${a.type}`
      return `- ${name} (type: ${a.type}, added ~${a.addedDaysAgo} days ago on OpenStreetMap)`
    })
    parts.push(`Recently added to OpenStreetMap (may be new businesses):\n${amenityLines.join('\n')}`)
  }

  parts.push('\nWrite ONE post about the most interesting or useful thing above. Keep it under 260 characters.')
  return parts.join('\n')
}

function pickSourceUrl(snapshot: ZoneDataSnapshot, topic: 'weather' | 'new_place' | 'general'): string {
  if (topic === 'weather' && snapshot.weather) return snapshot.weather.sourceUrl
  return `https://www.openstreetmap.org/#map=16/${snapshot.lat.toFixed(4)}/${snapshot.lng.toFixed(4)}`
}

export async function generateLocalPulsePost(
  snapshot: ZoneDataSnapshot,
): Promise<GeneratedPost | null> {
  const userPrompt = buildUserPrompt(snapshot)

  const hasNewPlaces = snapshot.newAmenities.length > 0
  const topic: 'weather' | 'new_place' | 'general' =
    hasNewPlaces ? 'new_place' : snapshot.weather ? 'weather' : 'general'

  // Nothing interesting to post
  if (!snapshot.weather && snapshot.newAmenities.length === 0) return null

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 300,
      thinking: { type: 'adaptive' },
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },  // stable → cache across calls
        },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return null

    const content = textBlock.text.trim()

    // Claude may decide the data isn't interesting enough
    if (content === 'SKIP' || content.length === 0) return null
    // Enforce hard length limit — Claude sometimes goes over
    if (content.length > 280) return null

    return {
      content,
      sourceUrl: pickSourceUrl(snapshot, topic),
      topic,
    }
  } catch (err) {
    console.error('[LocalPulse] Claude API error:', err)
    return null
  }
}
