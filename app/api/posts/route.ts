import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'
import { apiRateLimiter } from '@/lib/rateLimiter'
import { verifyZoneCoords, ipGeoMatchesGps } from '@/lib/utils/verifyLocation'
import type { PostWithAuthor } from '@/lib/types'

const CreatePostSchema = z.object({
  content: z.string().min(1).max(280),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  zoneId: z.string().min(1),
  zoneLabel: z.string().min(1),
  h3_index: z.string().min(1),
})

// Fetch reply and repost counts for a list of post IDs.
// Supabase/PostgREST has no GROUP BY, so we fetch raw rows and aggregate in JS.
async function fetchCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  postIds: string[]
): Promise<{ replyCounts: Record<string, number>; repostCounts: Record<string, number> }> {
  if (postIds.length === 0) return { replyCounts: {}, repostCounts: {} }

  const [{ data: replyRows }, { data: repostRows }] = await Promise.all([
    supabase.from('posts').select('parent_id').in('parent_id', postIds),
    supabase.from('posts').select('repost_of').in('repost_of', postIds),
  ])

  const replyCounts: Record<string, number> = {}
  for (const r of replyRows ?? []) {
    if (r.parent_id) replyCounts[r.parent_id] = (replyCounts[r.parent_id] ?? 0) + 1
  }

  const repostCounts: Record<string, number> = {}
  for (const r of repostRows ?? []) {
    if (r.repost_of) repostCounts[r.repost_of] = (repostCounts[r.repost_of] ?? 0) + 1
  }

  return { replyCounts, repostCounts }
}

export async function GET(request: NextRequest) {
  let supabase: Awaited<ReturnType<typeof createClient>>
  try {
    supabase = await createClient()
  } catch (e) {
    console.error('[GET /api/posts] createClient failed:', e)
    return apiError('Server configuration error', 500, 'DB_ERROR')
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) console.error('[GET /api/posts] auth error:', authError.message)
  if (!user) return apiError('Unauthorized', 401, 'UNAUTHORIZED')

  const { searchParams } = request.nextUrl
  const zoneId = searchParams.get('zoneId')
  const cursor = searchParams.get('cursor')
  const feed = searchParams.get('feed')

  // Validate cursor is a real timestamp before using in query
  const cursorDate = cursor ? new Date(cursor) : null
  const validCursor = cursorDate && !isNaN(cursorDate.getTime()) ? cursor : null

  // For the following feed, get the zones the user subscribes to
  if (feed === 'following') {
    const { data: follows } = await supabase
      .from('location_follows')
      .select('zone_id')
      .eq('user_id', user.id)

    const followedZoneIds = (follows ?? []).map((f) => f.zone_id)
    if (followedZoneIds.length === 0) {
      return NextResponse.json({ posts: [], nextCursor: null, noFollows: true })
    }

    let followQuery = supabase
      .from('posts')
      .select('*')
      .is('parent_id', null)
      .in('zone_id', followedZoneIds)
      .order('created_at', { ascending: false })
      .limit(20)

    if (validCursor) followQuery = followQuery.lt('created_at', validCursor)

    const { data: followPosts, error: followError } = await followQuery
    if (followError) {
      console.error('[GET /api/posts] following feed error:', followError.message, followError.details, followError.hint)
      return apiError('Failed to fetch posts', 500, 'DB_ERROR')
    }
    if (!followPosts || followPosts.length === 0) {
      return NextResponse.json({ posts: [], nextCursor: null })
    }

    const fAuthorIds = [...new Set(followPosts.map((p) => p.author_id))]
    const { data: fProfiles } = await supabase
      .from('profiles')
      .select('id, handle, display_name')
      .in('id', fAuthorIds)
    const fProfileMap = Object.fromEntries((fProfiles ?? []).map((p) => [p.id, p]))
    const fPostIds = followPosts.map((p) => p.id)
    const { replyCounts, repostCounts } = await fetchCounts(supabase, fPostIds)

    const fResult: PostWithAuthor[] = followPosts.map((p) => ({
      ...p,
      author: fProfileMap[p.author_id] ?? null,
      reply_count: replyCounts[p.id] ?? 0,
      repost_count: repostCounts[p.id] ?? 0,
    }))
    const fNextCursor = followPosts.length === 20 ? followPosts[followPosts.length - 1].created_at : null
    return NextResponse.json({ posts: fResult, nextCursor: fNextCursor })
  }

  let query = supabase
    .from('posts')
    .select('*')
    .is('parent_id', null)          // top-level posts only in feeds
    .order('created_at', { ascending: false })
    .limit(20)

  if (zoneId) query = query.eq('zone_id', zoneId)
  if (validCursor) query = query.lt('created_at', validCursor)

  const { data: posts, error } = await query
  if (error) {
    console.error('[GET /api/posts] Supabase error:', error.message, error.details, error.hint, { zoneId, cursor })
    return apiError('Failed to fetch posts', 500, 'DB_ERROR')
  }
  if (!posts || posts.length === 0) {
    return NextResponse.json({ posts: [], nextCursor: null })
  }

  // Batch-fetch authors
  const authorIds = [...new Set(posts.map((p) => p.author_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, handle, display_name')
    .in('id', authorIds)
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  // Fetch counts
  const postIds = posts.map((p) => p.id)
  const { replyCounts, repostCounts } = await fetchCounts(supabase, postIds)

  const result: PostWithAuthor[] = posts.map((p) => ({
    ...p,
    author: profileMap[p.author_id] ?? null,
    reply_count: replyCounts[p.id] ?? 0,
    repost_count: repostCounts[p.id] ?? 0,
  }))

  const nextCursor = posts.length === 20 ? posts[posts.length - 1].created_at : null
  return NextResponse.json({ posts: result, nextCursor })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401, 'UNAUTHORIZED')

  const { success: allowed } = await apiRateLimiter.limit(user.id)
  if (!allowed) return apiError('Too many requests', 429, 'RATE_LIMITED')

  let body: unknown
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400, 'BAD_REQUEST') }

  const parsed = CreatePostSchema.safeParse(body)
  if (!parsed.success) return apiError('Invalid request', 400, 'VALIDATION_ERROR')

  const { content, latitude, longitude, zoneId, zoneLabel, h3_index } = parsed.data

  // Hard location check: coords must hash to the claimed zone
  if (!verifyZoneCoords(latitude, longitude, zoneId)) {
    return apiError('Coordinates do not match the claimed zone', 403, 'LOCATION_GATED')
  }

  // Soft IP-geo check: log mismatches but don't reject (VPNs are common)
  if (!ipGeoMatchesGps(request, latitude, longitude)) {
    console.warn('[POST /api/posts] IP geo mismatch', { userId: user.id, zoneId })
  }

  // Verify the zone exists (must have been resolved via /api/geo/resolve first)
  const { data: zone } = await supabase
    .from('zones')
    .select('zone_id')
    .eq('zone_id', zoneId)
    .maybeSingle()

  if (!zone) return apiError('Unknown zone — resolve your location first', 400, 'UNKNOWN_ZONE')

  const { data: post, error } = await supabase
    .from('posts')
    .insert({ content, latitude, longitude, h3_index, zone_label: zoneLabel, zone_id: zoneId, author_id: user.id })
    .select('*')
    .single()

  if (error) return apiError('Failed to create post', 500, 'DB_ERROR')

  const { data: author } = await supabase
    .from('profiles')
    .select('handle, display_name')
    .eq('id', user.id)
    .maybeSingle()

  const result: PostWithAuthor = { ...post, author, reply_count: 0, repost_count: 0 }
  return NextResponse.json({ post: result }, { status: 201 })
}
