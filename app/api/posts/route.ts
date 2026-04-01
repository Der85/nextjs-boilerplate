import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'
import { postsRateLimiter, feedRateLimiter } from '@/lib/rateLimiter'
import { postCreateSchema, parseBody } from '@/lib/validations'

const POST_SELECT = `
  *,
  author:user_profiles!posts_user_id_fkey(id, handle, display_name, avatar_url),
  zone:zones!posts_zone_id_fkey(id, label)
`

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }
    if (feedRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const { searchParams } = new URL(request.url)
    const zone_id = searchParams.get('zone_id')
    const user_id = searchParams.get('user_id')
    const parent_id = searchParams.get('parent_id')
    const cursor = searchParams.get('cursor')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    let query = supabase
      .from('posts')
      .select(POST_SELECT)
      .is('repost_of', null) // exclude reposts from main feed by default
      .order('created_at', { ascending: false })
      .limit(limit)

    if (zone_id) query = query.eq('zone_id', zone_id)
    if (user_id) query = query.eq('user_id', user_id)
    if (parent_id) {
      query = query.eq('parent_id', parent_id)
    } else {
      // Top-level posts only (not replies) unless explicitly requesting replies
      query = query.is('parent_id', null)
    }
    if (cursor) query = query.lt('created_at', cursor)

    const { data: posts, error } = await query

    if (error) {
      console.error('Posts fetch error:', error)
      return apiError('Failed to load posts.', 500, 'INTERNAL_ERROR')
    }

    const hasMore = posts.length === limit
    const nextCursor = hasMore ? posts[posts.length - 1].created_at : null

    return NextResponse.json({
      data: posts,
      next_cursor: nextCursor,
      has_more: hasMore,
    })
  } catch (error) {
    console.error('Posts GET error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }
    if (postsRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const body = await request.json()
    const parsed = parseBody(postCreateSchema, body)
    if (!parsed.success) return parsed.response

    const { body: postBody, zone_id, parent_id, repost_of, lat, lng } = parsed.data

    // If replying, validate parent exists
    if (parent_id) {
      const { data: parent } = await supabase
        .from('posts')
        .select('id, zone_id')
        .eq('id', parent_id)
        .single()

      if (!parent) {
        return apiError('Parent post not found.', 404, 'NOT_FOUND')
      }
    }

    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        body: postBody,
        zone_id,
        parent_id: parent_id || null,
        repost_of: repost_of || null,
        lat: lat || null,
        lng: lng || null,
      })
      .select(POST_SELECT)
      .single()

    if (error) {
      console.error('Post create error:', error)
      return apiError('Failed to create post.', 500, 'INTERNAL_ERROR')
    }

    // Increment reply_count on parent if this is a reply
    if (parent_id) {
      await supabase.rpc('increment_reply_count', { post_id: parent_id })
    }

    return NextResponse.json({ post }, { status: 201 })
  } catch (error) {
    console.error('Posts POST error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
