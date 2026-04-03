// GET /api/zones
// Returns active zones ordered by post volume, with follow status for the current user.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'
import type { ZoneWithMeta } from '@/lib/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401, 'UNAUTHORIZED')

  // Fetch zones that have at least one post
  const { data: zones, error } = await supabase
    .from('zones')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error || !zones) return apiError('Failed to fetch zones', 500, 'DB_ERROR')
  if (zones.length === 0) return NextResponse.json({ zones: [] })

  const zoneIds = zones.map((z) => z.zone_id)

  // Batch-fetch post counts and followed zones in parallel
  const [{ data: postRows }, { data: follows }] = await Promise.all([
    supabase.from('posts').select('zone_id').in('zone_id', zoneIds).is('parent_id', null),
    supabase.from('location_follows').select('zone_id').eq('user_id', user.id),
  ])

  const postCounts: Record<string, number> = {}
  for (const row of postRows ?? []) {
    postCounts[row.zone_id] = (postCounts[row.zone_id] ?? 0) + 1
  }

  const followedSet = new Set((follows ?? []).map((f) => f.zone_id))

  const result: ZoneWithMeta[] = zones
    .map((z) => ({ ...z, post_count: postCounts[z.zone_id] ?? 0, is_followed: followedSet.has(z.zone_id) }))
    .filter((z) => z.post_count > 0)                 // only show zones with posts
    .sort((a, b) => b.post_count - a.post_count)      // most active first

  return NextResponse.json({ zones: result })
}
