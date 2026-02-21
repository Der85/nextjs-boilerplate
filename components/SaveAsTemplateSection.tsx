'use client'

import { useState } from 'react'

interface SaveAsTemplateSectionProps {
  taskId: string
}

export default function SaveAsTemplateSection({ taskId }: SaveAsTemplateSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSave = async () => {
    if (!templateName.trim()) {
      setError('Please enter a template name.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/templates/from-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId,
          template_name: templateName.trim(),
        }),
      })

      if (res.ok) {
        setSuccess(true)
        setTimeout(() => {
          setExpanded(false)
          setTemplateName('')
          setSuccess(false)
        }, 1500)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save template.')
      }
    } catch {
      setError('Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          width: '100%',
          padding: '10px',
          border: 'none',
          borderTop: '1px solid var(--color-border)',
          background: 'transparent',
          color: 'var(--color-text-tertiary)',
          fontSize: 'var(--text-small)',
          cursor: 'pointer',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
        Save as Template
      </button>
    )
  }

  return (
    <div style={{
      padding: '16px 20px',
      borderTop: '1px solid var(--color-border)',
      background: 'var(--color-surface)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '12px',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
        <span style={{
          fontSize: 'var(--text-small)',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
        }}>
          Save as Template
        </span>
      </div>

      {success ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 12px',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--color-success-subtle, rgba(34, 197, 94, 0.1))',
          color: 'var(--color-success)',
          fontSize: 'var(--text-small)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Template saved!
        </div>
      ) : (
        <>
          {error && (
            <div style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-danger-light, #fef2f2)',
              color: 'var(--color-danger)',
              fontSize: 'var(--text-small)',
              marginBottom: '8px',
            }}>
              {error}
            </div>
          )}
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Template name (e.g., Weekly Report)"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-body)',
              color: 'var(--color-text-primary)',
              background: 'var(--color-bg)',
              marginBottom: '8px',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') setExpanded(false)
            }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                setExpanded(false)
                setTemplateName('')
                setError('')
              }}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--text-small)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !templateName.trim()}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'var(--color-accent)',
                color: '#fff',
                fontSize: 'var(--text-small)',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving || !templateName.trim() ? 0.7 : 1,
              }}
            >
              {saving ? 'Saving...' : 'Create Template'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
