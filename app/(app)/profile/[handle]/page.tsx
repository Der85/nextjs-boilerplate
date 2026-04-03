import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PostCard } from '@/components/PostCard'
import type { PostWithAuthor } from '@/lib/types'

interface Props {
  params: Promise<{ handle: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params
  return { title: `@${handle}` }
}

export default async function ProfilePage({ params }: Props) {
  const { handle } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, handle, display_name, created_at')
    .eq('handle', handle)
    .maybeSingle()

  if (!profile) notFound()

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .eq('author_id', profile.id)
    .is('parent_id', null)
    .order('created_at', { ascending: false })
    .limit(50)

  const postList = posts ?? []

  // Fetch reply/repost counts
  const postIds = postList.map((p) => p.id)
  let replyCounts: Record<string, number> = {}
  let repostCounts: Record<string, number> = {}

  if (postIds.length > 0) {
    const [{ data: replyRows }, { data: repostRows }] = await Promise.all([
      supabase.from('posts').select('parent_id').in('parent_id', postIds),
      supabase.from('posts').select('repost_of').in('repost_of', postIds),
    ])

    for (const r of replyRows ?? []) {
      if (r.parent_id) replyCounts[r.parent_id] = (replyCounts[r.parent_id] ?? 0) + 1
    }
    for (const r of repostRows ?? []) {
      if (r.repost_of) repostCounts[r.repost_of] = (repostCounts[r.repost_of] ?? 0) + 1
    }
  }

  const postsWithAuthor: PostWithAuthor[] = postList.map((p) => ({
    ...p,
    author: { handle: profile.handle, display_name: profile.display_name },
    reply_count: replyCounts[p.id] ?? 0,
    repost_count: repostCounts[p.id] ?? 0,
  }))

  const joinedYear = new Date(profile.created_at).getFullYear()

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

      {/* Profile header */}
      <div style={{ padding: '20px 16px', borderBottom: '2px solid var(--color-border)' }}>
        <div style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          marginBottom: '12px',
        }}>
          🧠
        </div>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{profile.display_name}</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
          @{profile.handle}
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', marginTop: '8px' }}>
          Joined {joinedYear} · {postList.length} post{postList.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Posts */}
      {postsWithAuthor.length === 0 ? (
        <div style={{ padding: '48px 16px', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
            No posts yet.
          </p>
        </div>
      ) : (
        <div>
          {postsWithAuthor.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
