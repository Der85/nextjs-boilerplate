'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Feed } from '@/components/Feed'
import { createClient } from '@/lib/supabase/client'
import type { PostWithAuthor } from '@/lib/types'

const supabase = createClient()

export function FollowingFeed() {
  const [posts, setPosts] = useState<PostWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [noFollows, setNoFollows] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))
  }, [])

  const fetchPosts = useCallback(async (cur: string | null, append: boolean) => {
    setLoading(true)
    try {
      const url = `/api/posts?feed=following${cur ? `&cursor=${encodeURIComponent(cur)}` : ''}`
      const res = await fetch(url)
      if (!res.ok) return
      const data = await res.json() as { posts: PostWithAuthor[]; nextCursor: string | null; noFollows?: boolean }

      if (data.noFollows) { setNoFollows(true); return }

      setNoFollows(false)
      setPosts((prev) => append ? [...prev, ...data.posts] : data.posts)
      setHasMore(data.nextCursor !== null)
      setCursor(data.nextCursor)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPosts(null, false) }, [fetchPosts])

  if (noFollows) {
    return (
      <div style={{ maxWidth: 'var(--content-max-width)', margin: '0 auto' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <h1 style={{ fontSize: '1rem', fontWeight: 700 }}>Following</h1>
        </div>
        <div style={{ padding: '48px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', marginBottom: '16px' }}>🔔</p>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
            You&apos;re not following any zones yet.
          </p>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: '0.875rem', marginBottom: '24px' }}>
            Follow zones to see their posts here.
          </p>
          <Link
            href="/explore"
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-accent)',
              color: '#fff',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Browse zones →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 'var(--content-max-width)', margin: '0 auto' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
        <h1 style={{ fontSize: '1rem', fontWeight: 700 }}>Following</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
          Posts from zones you follow
        </p>
      </div>
      <Feed
        posts={posts}
        onLoadMore={() => fetchPosts(cursor, true)}
        hasMore={hasMore}
        loading={loading}
        currentUserId={currentUserId}
        onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
      />
    </div>
  )
}
