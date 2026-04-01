import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'
import { feedRateLimiter, postsRateLimiter } from '@/lib/rateLimiter'

const POST_SELECT = `
  *,
  author:user_profiles!posts_user_id_fkey(id, handle, display_name, avatar_url),
  zone:zones!posts_zone_id_fkey(id, label)
`

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }
    if (feedRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const { data: post, error } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .eq('id', id)
      .single()

    if (error || !post) {
      return apiError('Post not found.', 404, 'NOT_FOUND')
    }

    return NextResponse.json({ post })
  } catch (error) {
    console.error('Post GET error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }
    if (postsRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // RLS + application-level check

    if (error) {
      console.error('Post delete error:', error)
      return apiError('Failed to delete post.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error('Post DELETE error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
