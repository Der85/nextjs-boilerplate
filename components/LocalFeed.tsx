'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useLocation } from '@/lib/contexts/LocationContext'
import { ComposeBox } from '@/components/ComposeBox'
import { Feed } from '@/components/Feed'
import { apiFetch } from '@/lib/utils/apiFetch'
import { createClient } from '@/lib/supabase/client'
import type { PostWithAuthor } from '@/lib/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

const supabase = createClient()

export function LocalFeed() {
  const { currentZoneId, zoneLabel } = useLocation()
  const [isFollowed, setIsFollowed] = useState<boolean | null>(null)
  const [followLoading, setFollowLoading] = useState(false)
  const [posts, setPosts] = useState<PostWithAuthor[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [newPostIds, setNewPostIds] = useState<Set<string>>(new Set())
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))
  }, [])

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

  // Realtime subscription — prepend new posts from other users as they arrive
  useEffect(() => {
    if (!currentZoneId) return

    // Clean up any existing channel before subscribing to the new zone
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }

    const channel = supabase
      .channel(`zone-posts:${currentZoneId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
          filter: `zone_id=eq.${currentZoneId}`,
        },
        async (payload) => {
          const newPost = payload.new as Record<string, unknown>
          // Skip replies — they belong in thread view
          if (newPost.parent_id) return

          // Fetch author profile for the new post
          const { data: author } = await supabase
            .from('profiles')
            .select('id, handle, display_name')
            .eq('id', newPost.author_id as string)
            .maybeSingle()

          const postWithAuthor: PostWithAuthor = {
            ...(newPost as Parameters<typeof Object.assign>[0]),
            author: author ?? null,
            reply_count: 0,
            repost_count: 0,
          } as PostWithAuthor

          setPosts((prev) => {
            // Deduplicate: the user's own new post may already be in the list
            if (prev.some((p) => p.id === postWithAuthor.id)) return prev
            setNewPostIds((ids) => new Set([...ids, postWithAuthor.id]))
            return [postWithAuthor, ...prev]
          })
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [currentZoneId])

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

  function handleDelete(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
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
        newPostIds={newPostIds}
        currentUserId={currentUserId}
        onDelete={handleDelete}
      />
    </div>
  )
}
