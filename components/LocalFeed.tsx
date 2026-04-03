'use client'

import { useEffect, useState, useCallback } from 'react'
import { useLocation } from '@/lib/contexts/LocationContext'
import { ComposeBox } from '@/components/ComposeBox'
import { Feed } from '@/components/Feed'
import { apiFetch } from '@/lib/utils/apiFetch'
import type { PostWithAuthor } from '@/lib/types'

export function LocalFeed() {
  const { currentZoneId, zoneLabel } = useLocation()
  const [isFollowed, setIsFollowed] = useState<boolean | null>(null)
  const [followLoading, setFollowLoading] = useState(false)
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
    setIsFollowed(null)
    fetchPosts(currentZoneId, null, false)

    // Check if user already follows this zone
    fetch('/api/zones')
      .then((r) => r.json())
      .then((d: { zones: { zone_id: string; is_followed: boolean }[] }) => {
        const match = d.zones?.find((z) => z.zone_id === currentZoneId)
        // null means zone has no posts yet — can still follow if they post first
        setIsFollowed(match?.is_followed ?? false)
      })
      .catch(() => {})
  }, [currentZoneId, fetchPosts])

  async function toggleFollow() {
    if (!currentZoneId || !zoneLabel) return
    setFollowLoading(true)
    try {
      if (isFollowed) {
        const res = await apiFetch(`/api/zones/${encodeURIComponent(currentZoneId)}/follow`, { method: 'DELETE' })
        if (res.ok) setIsFollowed(false)
      } else {
        const res = await apiFetch(`/api/zones/${encodeURIComponent(currentZoneId)}/follow`, {
          method: 'POST',
          body: JSON.stringify({ zoneLabel }),
        })
        if (res.ok) setIsFollowed(true)
      }
    } finally {
      setFollowLoading(false)
    }
  }

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
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <h1 style={{ fontSize: '1rem', fontWeight: 700 }}>📍 {zoneLabel}</h1>
        {isFollowed !== null && (
          <button
            onClick={toggleFollow}
            disabled={followLoading}
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              border: isFollowed ? '1px solid var(--color-border)' : 'none',
              background: isFollowed ? 'transparent' : 'var(--color-accent)',
              color: isFollowed ? 'var(--color-text-primary)' : '#fff',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: followLoading ? 'default' : 'pointer',
              opacity: followLoading ? 0.5 : 1,
            }}
          >
            {isFollowed ? 'Following' : 'Follow'}
          </button>
        )}
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
