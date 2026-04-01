'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { apiFetch } from '@/lib/api-client'
import PostFeed from '@/components/PostFeed'
import type { PostWithAuthor, UserProfile } from '@/lib/types'

export default function ProfilePage() {
  const params = useParams()
  const handle = params.handle as string

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [posts, setPosts] = useState<PostWithAuthor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const loadProfile = useCallback(async () => {
    setIsLoading(true)

    // For now, fetch current user's profile (MVP — will expand to lookup by handle)
    const profileRes = await apiFetch('/api/profile')
    if (profileRes.ok) {
      const data = await profileRes.json()
      if (data.profile.handle === handle) {
        setProfile(data.profile)

        // Fetch their posts
        const postsRes = await apiFetch(`/api/posts?user_id=${data.profile.id}&limit=20`)
        if (postsRes.ok) {
          const postsData = await postsRes.json()
          setPosts(postsData.data)
        }
      } else {
        setNotFound(true)
      }
    }
    setIsLoading(false)
  }, [handle])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  if (isLoading) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <div className="skeleton" style={{ height: '24px', width: '40%', marginBottom: '8px' }} />
        <div className="skeleton" style={{ height: '16px', width: '60%' }} />
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div style={{
        padding: '48px 16px',
        textAlign: 'center',
        color: 'var(--color-text-tertiary)',
        fontSize: 'var(--text-caption)',
      }}>
        User @{handle} not found.
      </div>
    )
  }

  return (
    <div>
      {/* Profile header */}
      <div style={{
        padding: '24px 16px',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <h1 style={{
          fontSize: '1.25rem',
          fontWeight: 'var(--font-heading)',
        }}>
          {profile.display_name || profile.handle}
        </h1>
        <div style={{
          fontSize: 'var(--text-caption)',
          color: 'var(--color-text-secondary)',
          marginTop: '2px',
        }}>
          @{profile.handle}
        </div>
        {profile.bio && (
          <p style={{
            marginTop: '8px',
            fontSize: 'var(--text-caption)',
            color: 'var(--color-text-primary)',
            lineHeight: 1.5,
          }}>
            {profile.bio}
          </p>
        )}
      </div>

      {/* User's posts */}
      <PostFeed
        posts={posts}
        emptyMessage="No posts yet."
      />
    </div>
  )
}
