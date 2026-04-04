import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'
import { fetchLikesForPosts } from '@/lib/utils/likesHelper'
import type { PostWithAuthor } from '@/lib/types'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401, 'UNAUTHORIZED')

  // Verify ownership before deleting (RLS policy also enforces this)
  const { data: post } = await supabase
    .from('posts')
    .select('author_id')
    .eq('id', id)
    .maybeSingle()

  if (!post) return apiError('Post not found', 404, 'NOT_FOUND')
  if (post.author_id !== user.id) return apiError('Forbidden', 403, 'FORBIDDEN')

  const { error } = await supabase.from('posts').delete().eq('id', id)
  if (error) {
    console.error('[DELETE /api/posts/:id] error:', error.message, error.details)
    return apiError('Failed to delete post', 500, 'DB_ERROR')
  }

  return new NextResponse(null, { status: 204 })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401, 'UNAUTHORIZED')

  const { data: post } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!post) return apiError('Post not found', 404, 'NOT_FOUND')

  const [{ data: author }, { data: replyRows }, { data: repostRows }] = await Promise.all([
    supabase.from('profiles').select('handle, display_name').eq('id', post.author_id).maybeSingle(),
    supabase.from('posts').select('id').eq('parent_id', id),
    supabase.from('posts').select('id').eq('repost_of', id),
  ])

  const { likeCounts, likedPostIds } = await fetchLikesForPosts(supabase, [id], user.id)

  const result: PostWithAuthor = {
    ...post,
    author,
    reply_count: replyRows?.length ?? 0,
    repost_count: repostRows?.length ?? 0,
    like_count: likeCounts[id] ?? 0,
    liked_by_me: likedPostIds.has(id),
  }

  return NextResponse.json({ post: result })
}
