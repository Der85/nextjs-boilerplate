'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocation } from '@/lib/contexts/LocationContext'
import { apiFetch } from '@/lib/api-client'
import ComposeBox from '@/components/ComposeBox'
import PostFeed from '@/components/PostFeed'
import LocationGate from '@/components/LocationGate'
import type { PostWithAuthor } from '@/lib/types'

export default function LocalPage() {
  const { currentZone } = useLocation()
  const [posts, setPosts] = useState<PostWithAuthor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const fetchPosts = useCallback(async (zoneId: string, after?: string) => {
    const params = new URLSearchParams({ zone_id: zoneId, limit: '20' })
    if (after) params.set('cursor', after)

    const res = await apiFetch(`/api/posts?${params}`)
    if (res.ok) {
      const data = await res.json()
      return data
    }
    return null
  }, [])

  const loadPosts = useCallback(async () => {
    if (!currentZone) return
    setIsLoading(true)
    const data = await fetchPosts(currentZone.id)
    if (data) {
      setPosts(data.data)
      setCursor(data.next_cursor)
      setHasMore(data.has_more)
    }
    setIsLoading(false)
  }, [currentZone, fetchPosts])

  const loadMore = useCallback(async () => {
    if (!currentZone || !cursor) return
    setIsLoading(true)
    const data = await fetchPosts(currentZone.id, cursor)
    if (data) {
      setPosts(prev => [...prev, ...data.data])
      setCursor(data.next_cursor)
      setHasMore(data.has_more)
    }
    setIsLoading(false)
  }, [currentZone, cursor, fetchPosts])

  useEffect(() => {
    loadPosts()
  }, [loadPosts])

  return (
    <LocationGate>
      <ComposeBox onPostCreated={loadPosts} />
      <PostFeed
        posts={posts}
        isLoading={isLoading}
        emptyMessage="No posts in this area yet. Be the first!"
        onLoadMore={loadMore}
        hasMore={hasMore}
      />
    </LocationGate>
  )
}
