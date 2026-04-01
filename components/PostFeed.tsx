'use client'

import type { PostWithAuthor } from '@/lib/types'
import PostCard from './PostCard'

interface PostFeedProps {
  posts: PostWithAuthor[]
  isLoading?: boolean
  emptyMessage?: string
  onLoadMore?: () => void
  hasMore?: boolean
}

export default function PostFeed({
  posts,
  isLoading = false,
  emptyMessage = 'No posts yet.',
  onLoadMore,
  hasMore = false,
}: PostFeedProps) {
  if (isLoading && posts.length === 0) {
    return (
      <div style={{ padding: '24px 16px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ marginBottom: '16px' }}>
            <div className="skeleton" style={{ height: '14px', width: '40%', marginBottom: '8px' }} />
            <div className="skeleton" style={{ height: '16px', width: '90%', marginBottom: '4px' }} />
            <div className="skeleton" style={{ height: '16px', width: '60%' }} />
          </div>
        ))}
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div style={{
        padding: '48px 16px',
        textAlign: 'center',
        color: 'var(--color-text-tertiary)',
        fontSize: 'var(--text-caption)',
      }}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div>
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
      {hasMore && onLoadMore && (
        <button
          onClick={onLoadMore}
          disabled={isLoading}
          style={{
            display: 'block',
            width: '100%',
            padding: '12px',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-accent)',
            fontSize: 'var(--text-caption)',
            cursor: 'pointer',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          {isLoading ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  )
}
