'use client'

import { useEffect } from 'react'
import { apiFetch } from '@/lib/utils/apiFetch'
import { TimeAgo } from '@/components/TimeAgo'
import type { Notification } from '@/lib/types'

interface NotificationsClientProps {
  notifications: Notification[]
}

const TYPE_ICONS: Record<Notification['type'], string> = {
  reply: '💬',
  repost: '🔁',
  like: '❤️',
  mention: '@',
}

const TYPE_LABELS: Record<Notification['type'], string> = {
  reply: 'replied to your post',
  repost: 'reposted your post',
  like: 'liked your post',
  mention: 'mentioned you',
}

export function NotificationsClient({ notifications }: NotificationsClientProps) {
  // Mark all as read on mount
  useEffect(() => {
    apiFetch('/api/notifications', { method: 'PATCH' }).catch(() => {})
  }, [])

  if (notifications.length === 0) {
    return (
      <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔔</div>
        <p>No notifications yet. When someone likes, replies, or reposts — it'll show up here.</p>
      </div>
    )
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {notifications.map((notif) => (
        <li
          key={notif.id}
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border)',
            background: notif.read ? undefined : 'rgba(var(--color-accent-rgb, 0, 168, 150), 0.04)',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start',
          }}
        >
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{TYPE_ICONS[notif.type]}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
              <strong>@{notif.actor?.handle ?? 'someone'}</strong>{' '}
              <span style={{ color: 'var(--color-text-secondary)' }}>{TYPE_LABELS[notif.type]}</span>
            </p>
            {notif.post && (
              <p style={{
                margin: '0 0 4px 0',
                fontSize: '0.8rem',
                color: 'var(--color-text-tertiary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                &ldquo;{notif.post.content}&rdquo;
              </p>
            )}
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
              <TimeAgo timestamp={notif.created_at} />
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
