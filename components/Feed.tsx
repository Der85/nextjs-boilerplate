'use client'

import { PostCard } from '@/components/PostCard'
import type { PostWithAuthor } from '@/lib/types'

interface FeedProps {
  posts: PostWithAuthor[]
  onLoadMore: () => void
  hasMore: boolean
  loading: boolean
  newPostIds?: Set<string>
}

export function Feed({ posts, onLoadMore, hasMore, loading, newPostIds }: FeedProps) {
  if (loading && posts.length === 0) {
    return (
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
            <div className="skeleton" style={{ height: '14px', width: '140px', marginBottom: '10px' }} />
            <div className="skeleton" style={{ height: '14px', width: '100%', marginBottom: '6px' }} />
            <div className="skeleton" style={{ height: '14px', width: '75%' }} />
          </div>
        ))}
      </div>
    )
  }

  if (!loading && posts.length === 0) {
    return (
      <div style={{ padding: '48px 16px', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem' }}>
          No posts here yet. Be the first.
        </p>
      </div>
    )
  }

  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} isNew={newPostIds?.has(post.id)} />
      ))}

      {hasMore && (
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <button
            onClick={onLoadMore}
            disabled={loading}
            style={{
              fontSize: '0.875rem',
              color: 'var(--color-accent)',
              background: 'none',
              border: 'none',
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}
