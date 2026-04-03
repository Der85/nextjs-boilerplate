'use client'

import { useEffect, useState, useCallback } from 'react'
import { useLocation } from '@/lib/contexts/LocationContext'
import { ComposeBox } from '@/components/ComposeBox'
import { Feed } from '@/components/Feed'
import type { PostWithAuthor } from '@/lib/types'

export function LocalFeed() {
  const { currentZoneId, zoneLabel } = useLocation()
  const [posts, setPosts] = useState<PostWithAuthor[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)

  const fetchPosts = useCallback(async (zonId: string, cur: string | null, append: boolean) => {
    setLoading(true)
    try {
      const url = `/api/posts?zoneId=${encodeURIComponent(zonId)}${cur ? `&cursor=${encodeURIComponent(cur)}` : ''}`
      const res = await fetch(url)
      if (!res.ok) return
      const data = await res.json() as { posts: PostWithAuthor[]; nextCursor: string | null }
      setPosts((prev) => append ? [...prev, ...data.posts] : data.posts)
      setHasMore(data.nextCursor !== null)
      setCursor(data.nextCursor)
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }, [])

  // Reset and re-fetch when zone changes
  useEffect(() => {
    if (!currentZoneId) return
    setInitialLoading(true)
    setPosts([])
    setCursor(null)
    fetchPosts(currentZoneId, null, false)
  }, [currentZoneId, fetchPosts])

  function handlePost() {
    if (currentZoneId) fetchPosts(currentZoneId, null, false)
  }

  function loadMore() {
    if (currentZoneId && cursor) fetchPosts(currentZoneId, cursor, true)
  }

  // Zone still resolving
  if (!currentZoneId) {
    return (
      <div style={{ maxWidth: 'var(--content-max-width)', margin: '0 auto', padding: '16px' }}>
        <div className="skeleton" style={{ height: '20px', width: '180px', marginBottom: '16px' }} />
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ marginBottom: '16px' }}>
            <div className="skeleton" style={{ height: '14px', width: '140px', marginBottom: '8px' }} />
            <div className="skeleton" style={{ height: '14px', width: '100%', marginBottom: '4px' }} />
            <div className="skeleton" style={{ height: '14px', width: '70%' }} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 'var(--content-max-width)', margin: '0 auto' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
        <h1 style={{ fontSize: '1rem', fontWeight: 700 }}>📍 {zoneLabel}</h1>
      </div>
      <ComposeBox onPost={handlePost} />
      <Feed
        posts={posts}
        onLoadMore={loadMore}
        hasMore={hasMore}
        loading={loading && initialLoading}
      />
    </div>
  )
}
