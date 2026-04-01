'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api-client'
import PostFeed from '@/components/PostFeed'
import type { PostWithAuthor, LocationFollow } from '@/lib/types'

export default function FollowingPage() {
  const [posts, setPosts] = useState<PostWithAuthor[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadFeed = useCallback(async () => {
    setIsLoading(true)
    try {
      // Get user's followed zones
      const followsRes = await apiFetch('/api/follows')
      if (!followsRes.ok) return

      const { follows } = await followsRes.json() as { follows: LocationFollow[] }
      if (follows.length === 0) {
        setPosts([])
        return
      }

      // Fetch posts from each followed zone and merge
      const allPosts: PostWithAuthor[] = []
      await Promise.all(
        follows.map(async (f) => {
          const res = await apiFetch(`/api/posts?zone_id=${f.zone_id}&limit=10`)
          if (res.ok) {
            const data = await res.json()
            allPosts.push(...data.data)
          }
        })
      )

      // Sort by newest first
      allPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setPosts(allPosts.slice(0, 50))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFeed()
  }, [loadFeed])

  return (
    <PostFeed
      posts={posts}
      isLoading={isLoading}
      emptyMessage="Follow some locations to see posts here."
    />
  )
}
