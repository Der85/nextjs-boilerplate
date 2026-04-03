'use client'

import { useEffect, useState, useCallback } from 'react'
import { Feed } from '@/components/Feed'
import { createClient } from '@/lib/supabase/client'
import type { PostWithAuthor } from '@/lib/types'

const supabase = createClient()

export function ExploreFeed() {
  const [posts, setPosts] = useState<PostWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))
  }, [])

  const fetchPosts = useCallback(async (cur: string | null, append: boolean) => {
    setLoading(true)
    try {
      const url = `/api/posts${cur ? `?cursor=${encodeURIComponent(cur)}` : ''}`
      const res = await fetch(url)
      if (!res.ok) return
      const data = await res.json() as { posts: PostWithAuthor[]; nextCursor: string | null }
      setPosts((prev) => append ? [...prev, ...data.posts] : data.posts)
      setHasMore(data.nextCursor !== null)
      setCursor(data.nextCursor)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPosts(null, false) }, [fetchPosts])

  return (
    <div style={{ maxWidth: 'var(--content-max-width)', margin: '0 auto' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
        <h1 style={{ fontSize: '1rem', fontWeight: 700 }}>Explore</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
          Browse posts from everywhere
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
