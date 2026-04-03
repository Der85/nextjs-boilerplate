'use client'

import { useState } from 'react'
import { apiFetch } from '@/lib/utils/apiFetch'
import type { ZoneWithMeta } from '@/lib/types'

interface ZoneCardProps {
  zone: ZoneWithMeta
}

export function ZoneCard({ zone: initial }: ZoneCardProps) {
  const [isFollowed, setIsFollowed] = useState(initial.is_followed)
  const [loading, setLoading] = useState(false)

  async function toggleFollow() {
    setLoading(true)
    try {
      if (isFollowed) {
        const res = await apiFetch(`/api/zones/${encodeURIComponent(initial.zone_id)}/follow`, {
          method: 'DELETE',
        })
        if (res.ok) setIsFollowed(false)
      } else {
        const res = await apiFetch(`/api/zones/${encodeURIComponent(initial.zone_id)}/follow`, {
          method: 'POST',
          body: JSON.stringify({ zoneLabel: initial.label }),
        })
        if (res.ok) setIsFollowed(true)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 16px',
      borderBottom: '1px solid var(--color-border)',
    }}>
      <div>
        <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>📍 {initial.label}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '2px' }}>
          {initial.post_count} {initial.post_count === 1 ? 'post' : 'posts'}
        </div>
      </div>

      <button
        onClick={toggleFollow}
        disabled={loading}
        style={{
          padding: '5px 14px',
          borderRadius: 'var(--radius-full)',
          border: isFollowed ? '1px solid var(--color-border)' : 'none',
          background: isFollowed ? 'transparent' : 'var(--color-accent)',
          color: isFollowed ? 'var(--color-text-primary)' : '#fff',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: loading ? 'default' : 'pointer',
          opacity: loading ? 0.5 : 1,
          transition: 'all 0.15s',
        }}
      >
        {isFollowed ? 'Following' : 'Follow'}
      </button>
    </div>
  )
}
