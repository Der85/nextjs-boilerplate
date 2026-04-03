'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useLocation } from '@/lib/contexts/LocationContext'
import { apiFetch } from '@/lib/utils/apiFetch'
import { TimeAgo } from '@/components/TimeAgo'
import type { PostWithAuthor } from '@/lib/types'

interface PostCardProps {
  post: PostWithAuthor
  isNew?: boolean
}

export function PostCard({ post, isNew }: PostCardProps) {
  const { currentZoneId, zoneLabel, latitude, longitude } = useLocation()
  const [repostCount, setRepostCount] = useState(post.repost_count)
  const [reposted, setReposted] = useState(false)

  // User can interact only if they are physically in the same zone as the post
  const canInteract = Boolean(currentZoneId && currentZoneId === post.zone_id)

  async function handleRepost() {
    if (!canInteract || !latitude || !longitude || !currentZoneId || reposted) return
    setReposted(true)
    setRepostCount((n) => n + 1)

    const res = await apiFetch(`/api/posts/${post.id}/repost`, {
      method: 'POST',
      body: JSON.stringify({
        latitude,
        longitude,
        zoneId: currentZoneId,
        zoneLabel,
        h3_index: currentZoneId,
      }),
    })

    if (!res.ok) {
      setReposted(false)
      setRepostCount((n) => n - 1)
    }
  }

  const interactTitle = canInteract
    ? undefined
    : `You need to be in ${post.zone_label} to interact`

  return (
    <article
      className={isNew ? 'post-enter' : undefined}
      style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}
    >
      {/* Repost badge */}
      {post.repost_of && (
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginBottom: '6px' }}>
          🔁 Repost
        </div>
      )}

      {/* Header: handle · zone · time */}
      <div style={{
        display: 'flex',
        gap: '6px',
        fontSize: '0.875rem',
        color: 'var(--color-text-secondary)',
        marginBottom: '6px',
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        {post.author?.handle ? (
          <Link
            href={`/profile/${post.author.handle}`}
            style={{ fontWeight: 600, color: 'var(--color-text-primary)', textDecoration: 'none' }}
          >
            @{post.author.handle}
          </Link>
        ) : (
          <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>@unknown</span>
        )}
        <span>·</span>
        <span>{post.zone_label}</span>
        <span>·</span>
        <TimeAgo timestamp={post.created_at} />
      </div>

      {/* Content */}
      <p style={{
        fontSize: '1rem',
        lineHeight: 1.5,
        color: 'var(--color-text-primary)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        marginBottom: '10px',
      }}>
        {post.content}
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
        {/* Reply — navigates to thread */}
        <Link
          href={`/post/${post.id}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.875rem',
            color: canInteract ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)',
            textDecoration: 'none',
          }}
          title={interactTitle}
        >
          <span>💬</span>
          <span>{post.reply_count}</span>
        </Link>

        {/* Repost */}
        <button
          onClick={handleRepost}
          disabled={!canInteract || reposted}
          title={interactTitle}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.875rem',
            color: reposted
              ? 'var(--color-accent)'
              : canInteract
              ? 'var(--color-text-secondary)'
              : 'var(--color-text-tertiary)',
            background: 'none',
            border: 'none',
            cursor: canInteract && !reposted ? 'pointer' : 'default',
            padding: 0,
          }}
        >
          <span>🔁</span>
          <span>{repostCount}</span>
        </button>
      </div>
    </article>
  )
}
