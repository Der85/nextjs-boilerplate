// POST /api/cron/local-pulse
// Called by Vercel Cron every 2 hours.
// Finds zones with no recent activity, fetches open data, generates a Local Pulse post.
//
// Security: protected by CRON_SECRET header — only Vercel's cron runner should call this.
// The bot user (LOCAL_PULSE_BOT_USER_ID) must exist as a row in public.profiles.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cellToLatLng } from 'h3-js'
import { fetchZoneData } from '@/lib/local-pulse/dataFetcher'
import { generateLocalPulsePost } from '@/lib/local-pulse/generator'

// Supabase service-role client — bypasses RLS so the bot can post in any zone
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase service-role env vars')
  return createClient(url, key)
}

// Minimum hours between Local Pulse posts in the same zone
const MIN_HOURS_BETWEEN_POSTS = 6
// Max zones to seed per cron run (keeps the run under 30s Vercel limit)
const MAX_ZONES_PER_RUN = 3

export async function POST(request: NextRequest) {
  // Verify Vercel cron secret
  const secret = request.headers.get('x-cron-secret') ?? request.headers.get('authorization')?.replace('Bearer ', '')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const botUserId = process.env.LOCAL_PULSE_BOT_USER_ID
  if (!botUserId) {
    console.error('[LocalPulse cron] LOCAL_PULSE_BOT_USER_ID not set')
    return NextResponse.json({ error: 'Bot user not configured' }, { status: 500 })
  }

  const supabase = getServiceClient()
  const cutoff = new Date(Date.now() - MIN_HOURS_BETWEEN_POSTS * 60 * 60 * 1000).toISOString()

  // Find active zones that haven't had a Local Pulse post recently.
  // We pick zones that have at least one human post (active zones worth seeding)
  // but no bot post in the last MIN_HOURS_BETWEEN_POSTS hours.
  const { data: activeZones, error: zoneError } = await supabase
    .from('zones')
    .select('zone_id, label')
    .order('updated_at', { ascending: false })
    .limit(20)

  if (zoneError || !activeZones?.length) {
    console.log('[LocalPulse cron] No active zones or error:', zoneError?.message)
    return NextResponse.json({ seeded: 0 })
  }

  // Filter zones: exclude those where bot posted recently
  const zoneIds = activeZones.map((z) => z.zone_id)
  const { data: recentBotPosts } = await supabase
    .from('posts')
    .select('zone_id')
    .eq('author_id', botUserId)
    .eq('is_ai_generated', true)
    .gte('created_at', cutoff)
    .in('zone_id', zoneIds)

  const recentlySeededZones = new Set((recentBotPosts ?? []).map((p) => p.zone_id))
  const candidateZones = activeZones
    .filter((z) => !recentlySeededZones.has(z.zone_id))
    .slice(0, MAX_ZONES_PER_RUN)

  if (candidateZones.length === 0) {
    console.log('[LocalPulse cron] All zones recently seeded, skipping')
    return NextResponse.json({ seeded: 0 })
  }

  const results: Array<{ zoneId: string; status: 'posted' | 'skipped' | 'error' }> = []

  for (const zone of candidateZones) {
    try {
      const snapshot = await fetchZoneData(zone.zone_id, zone.label)
      const generated = await generateLocalPulsePost(snapshot)

      if (!generated) {
        results.push({ zoneId: zone.zone_id, status: 'skipped' })
        continue
      }

      const [lat, lng] = cellToLatLng(zone.zone_id)

      const { error: insertError } = await supabase.from('posts').insert({
        content: generated.content,
        latitude: lat,
        longitude: lng,
        h3_index: zone.zone_id,
        zone_id: zone.zone_id,
        zone_label: zone.label,
        author_id: botUserId,
        parent_id: null,
        repost_of: null,
        is_ai_generated: true,
        source_url: generated.sourceUrl,
      })

      if (insertError) {
        console.error('[LocalPulse cron] Insert error:', insertError.message, insertError.details)
        results.push({ zoneId: zone.zone_id, status: 'error' })
      } else {
        console.log(`[LocalPulse cron] Posted to ${zone.label}: "${generated.content.slice(0, 60)}…"`)
        results.push({ zoneId: zone.zone_id, status: 'posted' })
      }
    } catch (err) {
      console.error('[LocalPulse cron] Unexpected error for zone', zone.zone_id, err)
      results.push({ zoneId: zone.zone_id, status: 'error' })
    }
  }

  const seeded = results.filter((r) => r.status === 'posted').length
  return NextResponse.json({ seeded, results })
}
