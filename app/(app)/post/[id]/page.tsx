import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PostCard } from '@/components/PostCard'
import { ThreadReplies } from '@/components/ThreadReplies'
import type { PostWithAuthor } from '@/lib/types'

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: post } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!post) notFound()

  const { data: replies } = await supabase
    .from('posts')
    .select('*')
    .eq('parent_id', id)
    .order('created_at', { ascending: true })

  // Batch-fetch all authors in one query
  const allPosts = [post, ...(replies ?? [])]
  const authorIds = [...new Set(allPosts.map((p) => p.author_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, handle, display_name')
    .in('id', authorIds)
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

  // Fetch reply/repost counts for all posts in the thread
  const postIds = allPosts.map((p) => p.id)
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function toPostWithAuthor(p: Record<string, any>): PostWithAuthor {
    return {
      ...p,
      author: profileMap[p.author_id] ?? null,
      reply_count: replyCounts[p.id] ?? 0,
      repost_count: repostCounts[p.id] ?? 0,
    } as PostWithAuthor
  }

  const postWithAuthor = toPostWithAuthor(post)
  const repliesWithAuthor = (replies ?? []).map(toPostWithAuthor)

  return (
    <div style={{ maxWidth: 'var(--content-max-width)', margin: '0 auto' }}>
      {/* Back nav */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
        <Link
          href="/local"
          style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', textDecoration: 'none' }}
        >
          ← Back
        </Link>
      </div>

      {/* Original post */}
      <PostCard post={postWithAuthor} currentUserId={user?.id ?? null} />

      {/* Replies + compose — client component handles Realtime and state */}
      <ThreadReplies
        initialReplies={repliesWithAuthor}
        postId={id}
        postZoneId={post.zone_id}
        postZoneLabel={post.zone_label}
        currentUserId={user?.id ?? null}
      />
    </div>
  )
}
