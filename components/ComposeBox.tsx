'use client'

import { useState, type FormEvent } from 'react'
import { useLocation } from '@/lib/contexts/LocationContext'
import { apiFetch } from '@/lib/utils/apiFetch'

interface ComposeBoxProps {
  onPost: () => void
}

const MAX = 280

export function ComposeBox({ onPost }: ComposeBoxProps) {
  const { currentZoneId, zoneLabel, latitude, longitude } = useLocation()
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remaining = MAX - content.length
  const disabled = !currentZoneId || submitting || content.trim().length === 0

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (disabled || !latitude || !longitude || !currentZoneId) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await apiFetch('/api/posts', {
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
        onPost()
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string }
        if (res.status === 429) {
          setError('You\'re posting too fast. Wait a moment and try again.')
        } else {
          setError(data.error ?? 'Failed to post. Please try again.')
        }
      }
    } catch {
      setError('Network error. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={
          currentZoneId
            ? `What's happening in ${zoneLabel}?`
            : 'Detecting your location…'
        }
        disabled={!currentZoneId || submitting}
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

      {error && (
        <p style={{ fontSize: '0.8rem', color: 'var(--color-danger)', marginTop: '6px' }}>
          {error}
        </p>
      )}

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
          {submitting ? 'Posting…' : 'Post'}
        </button>
      </div>
    </form>
  )
}
