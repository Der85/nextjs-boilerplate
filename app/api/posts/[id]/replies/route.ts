import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'
import { apiRateLimiter } from '@/lib/rateLimiter'
import type { PostWithAuthor } from '@/lib/types'

const ReplySchema = z.object({
  content: z.string().min(1).max(280),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  zoneId: z.string().min(1),
  zoneLabel: z.string().min(1),
  h3_index: z.string().min(1),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401, 'UNAUTHORIZED')

  const { data: parent } = await supabase.from('posts').select('id').eq('id', id).maybeSingle()
  if (!parent) return apiError('Post not found', 404, 'NOT_FOUND')

  const { data: replies } = await supabase
    .from('posts')
    .select('*')
    .eq('parent_id', id)
    .order('created_at', { ascending: true })

  if (!replies || replies.length === 0) return NextResponse.json({ replies: [] })

  const authorIds = [...new Set(replies.map((r) => r.author_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, handle, display_name')
    .in('id', authorIds)
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  const result: PostWithAuthor[] = replies.map((r) => ({
    ...r,
    author: profileMap[r.author_id] ?? null,
    reply_count: 0,
    repost_count: 0,
  }))

  return NextResponse.json({ replies: result })
}

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

  const { data: parent } = await supabase.from('posts').select('*').eq('id', id).maybeSingle()
  if (!parent) return apiError('Post not found', 404, 'NOT_FOUND')

  let body: unknown
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400, 'BAD_REQUEST') }

  const parsed = ReplySchema.safeParse(body)
  if (!parsed.success) return apiError('Invalid request', 400, 'VALIDATION_ERROR')

  const { content, latitude, longitude, zoneId, zoneLabel, h3_index } = parsed.data

  // Application-layer location gate: client sends their current zone, server verifies it
  // matches the post's zone. This prevents cross-zone replies without trusting client coords.
  // IP-based geo cross-check can be layered on here in a future phase.
  if (zoneId !== parent.zone_id) {
    return apiError(
      `You must be in ${parent.zone_label} to reply here`,
      403,
      'LOCATION_GATED'
    )
  }

  const { data: reply, error } = await supabase
    .from('posts')
    .insert({
      content,
      latitude,
      longitude,
      h3_index,
      zone_label: zoneLabel,
      zone_id: zoneId,
      author_id: user.id,
      parent_id: id,
    })
    .select('*')
    .single()

  if (error) return apiError('Failed to create reply', 500, 'DB_ERROR')

  const { data: author } = await supabase
    .from('profiles')
    .select('handle, display_name')
    .eq('id', user.id)
    .maybeSingle()

  const result: PostWithAuthor = { ...reply, author, reply_count: 0, repost_count: 0 }
  return NextResponse.json({ reply: result }, { status: 201 })
}
