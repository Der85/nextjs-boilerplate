import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'
import { apiRateLimiter } from '@/lib/rateLimiter'
import { createNotification } from '@/lib/utils/createNotification'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401, 'UNAUTHORIZED')

  const { success: allowed } = await apiRateLimiter.limit(user.id)
  if (!allowed) return apiError('Too many requests', 429, 'RATE_LIMITED')

  // Verify post exists
  const { data: post } = await supabase
    .from('posts')
    .select('id, author_id')
    .eq('id', id)
    .maybeSingle()

  if (!post) return apiError('Post not found', 404, 'NOT_FOUND')

  // Check if already liked
  const { data: existing } = await supabase
    .from('post_likes')
    .select('id')
    .eq('user_id', user.id)
    .eq('post_id', id)
    .maybeSingle()

  let liked: boolean

  if (existing) {
    // Unlike
    await supabase.from('post_likes').delete().eq('user_id', user.id).eq('post_id', id)
    liked = false
  } else {
    // Like
    await supabase.from('post_likes').insert({ user_id: user.id, post_id: id })
    liked = true

    // Notify post author
    await createNotification(supabase, {
      recipientId: post.author_id,
      actorId: user.id,
      type: 'like',
      postId: id,
    })
  }

  // Count current likes
  const { data: likeRows } = await supabase
    .from('post_likes')
    .select('id')
    .eq('post_id', id)

  const like_count = likeRows?.length ?? 0

  return NextResponse.json({ liked, like_count })
}
