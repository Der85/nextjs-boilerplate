'use client'

import Link from 'next/link'
import type { PostWithAuthor } from '@/lib/types'
import { relativeTime } from '@/lib/utils/time'
import ZoneBadge from './ZoneBadge'

interface PostCardProps {
  post: PostWithAuthor
}

export default function PostCard({ post }: PostCardProps) {
  const handle = post.author?.handle || 'anonymous'
  const displayName = post.author?.display_name || handle
  const zoneLabel = post.zone?.label || post.zone_id

  return (
    <article className="post-border" style={{
      padding: '12px 16px',
      animation: 'fade-in 0.2s ease',
    }}>
      {/* Post header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '4px',
        fontSize: 'var(--text-caption)',
      }}>
        <Link
          href={`/u/${handle}`}
          style={{
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            textDecoration: 'none',
          }}
        >
          {displayName}
        </Link>
        <span style={{ color: 'var(--color-text-tertiary)' }}>
          @{handle}
        </span>
        <span style={{ color: 'var(--color-text-tertiary)' }}>&middot;</span>
        <ZoneBadge label={zoneLabel} />
        <span style={{ color: 'var(--color-text-tertiary)' }}>&middot;</span>
        <Link
          href={`/post/${post.id}`}
          style={{
            color: 'var(--color-text-tertiary)',
            textDecoration: 'none',
            fontSize: 'var(--text-small)',
          }}
        >
          {relativeTime(post.created_at)}
        </Link>
      </div>

      {/* Post body */}
      <Link
        href={`/post/${post.id}`}
        style={{
          color: 'var(--color-text-primary)',
          textDecoration: 'none',
          display: 'block',
          lineHeight: 1.5,
          wordBreak: 'break-word',
        }}
      >
        {post.body}
      </Link>

      {/* Post actions */}
      <div style={{
        display: 'flex',
        gap: '24px',
        marginTop: '8px',
        fontSize: 'var(--text-small)',
        color: 'var(--color-text-tertiary)',
      }}>
        <Link
          href={`/post/${post.id}`}
          style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <span>&#x1F4AC;</span>
          <span>{post.reply_count || 0}</span>
        </Link>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>&#x1F501;</span>
          <span>{post.repost_count || 0}</span>
        </span>
      </div>
    </article>
  )
}
