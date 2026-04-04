import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'
import { apiRateLimiter } from '@/lib/rateLimiter'
import { fetchLikesForPosts } from '@/lib/utils/likesHelper'
import type { PostWithAuthor } from '@/lib/types'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401, 'UNAUTHORIZED')

  const { success: allowed } = await apiRateLimiter.limit(user.id)
  if (!allowed) return apiError('Too many requests', 429, 'RATE_LIMITED')

  const { searchParams } = request.nextUrl
  const q = searchParams.get('q') ?? ''
  const zoneId = searchParams.get('zoneId') ?? null

  if (!q || q.trim().length < 2) {
    return apiError('Query must be at least 2 characters', 400, 'VALIDATION_ERROR')
  }

  let query = supabase
    .from('posts')
    .select('*')
    .textSearch('content_tsv', q.trim(), { config: 'english' })
    .order('created_at', { ascending: false })
    .limit(20)

  if (zoneId) query = query.eq('zone_id', zoneId)

  const { data: posts, error } = await query
  if (error) {
    console.error('[GET /api/search] error:', error.message, error.details, error.hint)
    return apiError('Search failed', 500, 'DB_ERROR')
  }

  if (!posts || posts.length === 0) {
    return NextResponse.json({ posts: [], query: q })
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

  const { likeCounts, likedPostIds } = await fetchLikesForPosts(supabase, postIds, user.id)

  const result: PostWithAuthor[] = posts.map((p) => ({
    ...p,
    author: profileMap[p.author_id] ?? null,
    reply_count: replyCounts[p.id] ?? 0,
    repost_count: repostCounts[p.id] ?? 0,
    like_count: likeCounts[p.id] ?? 0,
    liked_by_me: likedPostIds.has(p.id),
  }))

  return NextResponse.json({ posts: result, query: q })
}
