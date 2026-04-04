// POST /api/cron/local-pulse
// Called by Vercel Cron once daily (08:00 UTC on Hobby plan).
// For each active zone: fetches open data from 5 sources, generates up to 3
// topic-specific posts via Claude, inserts them under the Local Pulse bot account.
//
// Security: protected by CRON_SECRET header — only Vercel's cron runner should call this.
// The bot user (LOCAL_PULSE_BOT_USER_ID) must exist as a row in public.profiles.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cellToLatLng } from 'h3-js'
import { fetchZoneData } from '@/lib/local-pulse/dataFetcher'
import { generateLocalPulsePosts } from '@/lib/local-pulse/generator'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service-role env vars')
  return createClient(url, key)
}

// How many zones to seed per cron run (Vercel functions have a 30s max on Hobby)
const MAX_ZONES_PER_RUN = 5

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret')
    ?? request.headers.get('authorization')?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const botUserId = process.env.LOCAL_PULSE_BOT_USER_ID
  if (!botUserId) {
    console.error('[LocalPulse cron] LOCAL_PULSE_BOT_USER_ID not set')
    return NextResponse.json({ error: 'Bot user not configured' }, { status: 500 })
  }

  const supabase = getServiceClient()

  // Find the most recently active zones (have at least one post)
  const { data: activeZones, error: zoneError } = await supabase
    .from('zones')
    .select('zone_id, label')
    .order('updated_at', { ascending: false })
    .limit(20)

  if (zoneError || !activeZones?.length) {
    console.log('[LocalPulse cron] No active zones:', zoneError?.message)
    return NextResponse.json({ posted: 0 })
  }

  // Exclude zones that already got a Local Pulse post today
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const zoneIds = activeZones.map((z) => z.zone_id)

  const { data: todaysPosts } = await supabase
    .from('posts')
    .select('zone_id')
    .eq('author_id', botUserId)
    .eq('is_ai_generated', true)
    .gte('created_at', todayStart.toISOString())
    .in('zone_id', zoneIds)

  const alreadySeeded = new Set((todaysPosts ?? []).map((p) => p.zone_id))
  const candidates = activeZones
    .filter((z) => !alreadySeeded.has(z.zone_id))
    .slice(0, MAX_ZONES_PER_RUN)

  if (candidates.length === 0) {
    console.log('[LocalPulse cron] All zones seeded for today')
    return NextResponse.json({ posted: 0 })
  }

  let totalPosted = 0
  const results: Array<{ zone: string; posted: number; topics: string[] }> = []

  for (const zone of candidates) {
    try {
      const snapshot = await fetchZoneData(zone.zone_id, zone.label)
      const posts = await generateLocalPulsePosts(snapshot)

      if (posts.length === 0) {
        results.push({ zone: zone.label, posted: 0, topics: [] })
        continue
      }

      const [lat, lng] = cellToLatLng(zone.zone_id)

      // Insert all generated posts for this zone
      const rows = posts.map((p) => ({
        content: p.content,
        latitude: lat,
        longitude: lng,
        h3_index: zone.zone_id,
        zone_id: zone.zone_id,
        zone_label: zone.label,
        author_id: botUserId,
        parent_id: null,
        repost_of: null,
        is_ai_generated: true,
        source_url: p.sourceUrl,
        pulse_topic: p.topic,
      }))

      const { error: insertError } = await supabase.from('posts').insert(rows)

      if (insertError) {
        console.error(`[LocalPulse cron] Insert error for ${zone.label}:`, insertError.message, insertError.details)
        results.push({ zone: zone.label, posted: 0, topics: [] })
      } else {
        totalPosted += posts.length
        const topics = posts.map((p) => p.topic)
        console.log(`[LocalPulse cron] ${zone.label}: ${posts.length} posts (${topics.join(', ')})`)
        results.push({ zone: zone.label, posted: posts.length, topics })
      }
    } catch (err) {
      console.error(`[LocalPulse cron] Error for zone ${zone.zone_id}:`, err)
      results.push({ zone: zone.label, posted: 0, topics: [] })
    }
  }

  return NextResponse.json({ posted: totalPosted, results })
}
