'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useLocation } from '@/lib/contexts/LocationContext'
import { apiFetch } from '@/lib/utils/apiFetch'

interface ReplyComposeProps {
  postId: string
  postZoneId: string
  postZoneLabel: string
}

const MAX = 280

export function ReplyCompose({ postId, postZoneId, postZoneLabel }: ReplyComposeProps) {
  const router = useRouter()
  const { currentZoneId, zoneLabel, latitude, longitude } = useLocation()
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canReply = Boolean(currentZoneId && currentZoneId === postZoneId)
  const remaining = MAX - content.length
  const disabled = !canReply || submitting || content.trim().length === 0

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (disabled || !latitude || !longitude || !currentZoneId) return
    setSubmitting(true)

    try {
      const res = await apiFetch(`/api/posts/${postId}/replies`, {
        method: 'POST',
        body: JSON.stringify({
          content: content.trim(),
          latitude,
          longitude,
          zoneId: currentZoneId,
          zoneLabel,
          h3_index: currentZoneId,
        }),
      })

      if (res.ok) {
        setContent('')
        router.refresh()
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ borderTop: '2px solid var(--color-border)', padding: '12px 16px' }}>
      {!canReply ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '8px 0' }}>
          You need to be in <strong>{postZoneLabel}</strong> to reply
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Post your reply…"
            disabled={submitting}
            maxLength={MAX}
            rows={3}
            style={{
              width: '100%',
              resize: 'none',
              border: 'none',
              outline: 'none',
              fontSize: '1rem',
              lineHeight: 1.5,
              color: 'var(--color-text-primary)',
              background: 'transparent',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
            <span style={{
              fontSize: '0.75rem',
              color: remaining < 40 ? (remaining < 0 ? 'var(--color-danger)' : '#F59E0B') : 'var(--color-text-tertiary)',
            }}>
              {remaining}
            </span>
            <button
              type="submit"
              disabled={disabled}
              style={{
                padding: '6px 16px',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                background: 'var(--color-accent)',
                color: '#fff',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
              }}
            >
              {submitting ? 'Replying…' : 'Reply'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
