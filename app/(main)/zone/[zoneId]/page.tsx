'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { apiFetch } from '@/lib/api-client'
import { useLocation } from '@/lib/contexts/LocationContext'
import ComposeBox from '@/components/ComposeBox'
import PostFeed from '@/components/PostFeed'
import ZoneBadge from '@/components/ZoneBadge'
import type { PostWithAuthor, Zone } from '@/lib/types'

export default function ZonePage() {
  const params = useParams()
  const zoneId = params.zoneId as string
  const { currentZone } = useLocation()

  const [zone, setZone] = useState<Zone | null>(null)
  const [posts, setPosts] = useState<PostWithAuthor[]>([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)

  const isLocal = currentZone?.id === zoneId

  const loadZone = useCallback(async () => {
    const res = await apiFetch(`/api/zones/${encodeURIComponent(zoneId)}`)
    if (res.ok) {
      const data = await res.json()
      setZone(data.zone)
      setIsFollowing(data.is_following)
    }
  }, [zoneId])

  const loadPosts = useCallback(async () => {
    setIsLoading(true)
    const res = await apiFetch(`/api/posts?zone_id=${encodeURIComponent(zoneId)}&limit=20`)
    if (res.ok) {
      const data = await res.json()
      setPosts(data.data)
    }
    setIsLoading(false)
  }, [zoneId])

  const toggleFollow = async () => {
    setFollowLoading(true)
    if (isFollowing) {
      await apiFetch('/api/follows', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: zoneId }),
      })
      setIsFollowing(false)
    } else {
      await apiFetch('/api/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: zoneId }),
      })
      setIsFollowing(true)
    }
    setFollowLoading(false)
  }

  useEffect(() => {
    loadZone()
    loadPosts()
  }, [loadZone, loadPosts])

  return (
    <div>
      {/* Zone header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'var(--font-heading)' }}>
            {zone ? (zone.label.length > 20 ? `${zone.label.slice(0, 16)}...` : zone.label) : <span className="skeleton" style={{ display: 'inline-block', width: '120px', height: '24px' }} />}
          </h1>
          {zone && (
            <div style={{
              fontSize: 'var(--text-small)',
              color: 'var(--color-text-tertiary)',
              marginTop: '4px',
            }}>
              {zone.post_count} posts · {zone.follower_count} followers
            </div>
          )}
        </div>
        <button
          onClick={toggleFollow}
          disabled={followLoading}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
            border: isFollowing ? '1px solid var(--color-border)' : 'none',
            background: isFollowing ? 'transparent' : 'var(--color-accent)',
            color: isFollowing ? 'var(--color-text-primary)' : '#fff',
            fontSize: 'var(--text-caption)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      </div>

      {/* Show compose box only if user is in this zone */}
      {isLocal && <ComposeBox onPostCreated={loadPosts} />}
      {!isLocal && currentZone && (
        <div style={{
          padding: '10px 16px',
          fontSize: 'var(--text-small)',
          color: 'var(--color-text-tertiary)',
          textAlign: 'center',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
        }}>
          You need to be in <ZoneBadge label={zone?.label || zoneId} /> to post here
        </div>
      )}

      <PostFeed
        posts={posts}
        isLoading={isLoading}
        emptyMessage="No posts in this zone yet."
      />
    </div>
  )
}
