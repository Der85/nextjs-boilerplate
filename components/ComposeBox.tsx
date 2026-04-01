'use client'

import { useState, useCallback } from 'react'
import { useLocation } from '@/lib/contexts/LocationContext'
import { apiFetch } from '@/lib/api-client'
import ZoneBadge from './ZoneBadge'

interface ComposeBoxProps {
  onPostCreated?: () => void
  parentId?: string
  placeholder?: string
}

export default function ComposeBox({ onPostCreated, parentId, placeholder }: ComposeBoxProps) {
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { currentZone, lat, lng } = useLocation()

  const charCount = body.length
  const canPost = body.trim().length > 0 && charCount <= 280 && currentZone && !loading

  const handleSubmit = useCallback(async () => {
    if (!canPost || !currentZone) return

    setLoading(true)
    setError(null)

    try {
      const res = await apiFetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: body.trim(),
          zone_id: currentZone.id,
          parent_id: parentId,
          lat,
          lng,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to post.')
      }

      setBody('')
      onPostCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }, [body, canPost, currentZone, parentId, lat, lng, onPostCreated])

  if (!currentZone) {
    return (
      <div style={{
        padding: '16px',
        color: 'var(--color-text-tertiary)',
        fontSize: 'var(--text-caption)',
        textAlign: 'center',
        borderBottom: '1px solid var(--color-border)',
      }}>
        Enable location to post
      </div>
    )
  }

  return (
    <div style={{
      padding: '16px',
      borderBottom: '1px solid var(--color-border)',
    }}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder || "What's happening?"}
        rows={3}
        style={{
          width: '100%',
          resize: 'none',
          border: 'none',
          outline: 'none',
          fontSize: 'var(--text-body)',
          lineHeight: 1.5,
          fontFamily: 'inherit',
          color: 'var(--color-text-primary)',
          background: 'transparent',
        }}
      />

      {error && (
        <div style={{
          fontSize: 'var(--text-small)',
          color: 'var(--color-danger)',
          marginBottom: '8px',
        }}>
          {error}
        </div>
      )}

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <ZoneBadge label={currentZone.label} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontSize: 'var(--text-small)',
            color: charCount > 280 ? 'var(--color-danger)' : 'var(--color-text-tertiary)',
          }}>
            {charCount}/280
          </span>

          <button
            onClick={handleSubmit}
            disabled={!canPost}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              background: canPost ? 'var(--color-accent)' : 'var(--color-border)',
              color: canPost ? '#fff' : 'var(--color-text-tertiary)',
              fontSize: 'var(--text-caption)',
              fontWeight: 600,
              cursor: canPost ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  )
}
