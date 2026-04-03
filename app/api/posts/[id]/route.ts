import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'
import type { PostWithAuthor } from '@/lib/types'

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

  const result: PostWithAuthor = {
    ...post,
    author,
    reply_count: replyRows?.length ?? 0,
    repost_count: repostRows?.length ?? 0,
  }

  return NextResponse.json({ post: result })
}
