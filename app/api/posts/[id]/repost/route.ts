import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'
import { apiRateLimiter } from '@/lib/rateLimiter'
import type { PostWithAuthor } from '@/lib/types'

const RepostSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  zoneId: z.string().min(1),
  zoneLabel: z.string().min(1),
  h3_index: z.string().min(1),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401, 'UNAUTHORIZED')

  if (apiRateLimiter.isLimited(user.id)) {
    return apiError('Too many requests', 429, 'RATE_LIMITED')
  }

  const { data: original } = await supabase.from('posts').select('*').eq('id', id).maybeSingle()
  if (!original) return apiError('Post not found', 404, 'NOT_FOUND')

  // Don't allow reposting a repost
  if (original.repost_of) return apiError('Cannot repost a repost', 400, 'INVALID_ACTION')

  let body: unknown
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400, 'BAD_REQUEST') }

  const parsed = RepostSchema.safeParse(body)
  if (!parsed.success) return apiError('Invalid request', 400, 'VALIDATION_ERROR')

  const { latitude, longitude, zoneId, zoneLabel, h3_index } = parsed.data

  // Application-layer location gate
  if (zoneId !== original.zone_id) {
    return apiError(
      `You must be in ${original.zone_label} to repost this`,
      403,
      'LOCATION_GATED'
    )
  }

  const { data: repost, error } = await supabase
    .from('posts')
    .insert({
      content: original.content,
      latitude,
      longitude,
      h3_index,
      zone_label: zoneLabel,
      zone_id: zoneId,
      author_id: user.id,
      repost_of: id,
      parent_id: null,
    })
    .select('*')
    .single()

  if (error) return apiError('Failed to repost', 500, 'DB_ERROR')

  const { data: author } = await supabase
    .from('profiles')
    .select('handle, display_name')
    .eq('id', user.id)
    .maybeSingle()

  const result: PostWithAuthor = { ...repost, author, reply_count: 0, repost_count: 0 }
  return NextResponse.json({ post: result }, { status: 201 })
}
