'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { parseTokens, type CaptureSource } from '@/lib/types/inbox'

interface QuickCaptureProps {
  isOpen: boolean
  onClose: () => void
  onCaptured?: () => void
  source?: CaptureSource
}

export default function QuickCapture({
  isOpen,
  onClose,
  onCaptured,
  source = 'quick_capture',
}: QuickCaptureProps) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setText('')
      setSaving(false)
      setShowSuccess(false)
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()

    const trimmedText = text.trim()
    if (!trimmedText || saving) return

    setSaving(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.error('Not authenticated')
        return
      }

      const response = await fetch('/api/inbox', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          raw_text: trimmedText,
          source,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to capture')
      }

      // Show success briefly
      setShowSuccess(true)
      setText('')

      // Notify parent
      onCaptured?.()

      // Close after brief success animation
      setTimeout(() => {
        onClose()
      }, 500)

    } catch (error) {
      console.error('Capture failed:', error)
    } finally {
      setSaving(false)
    }
  }

  // Parse tokens for preview
  const tokens = parseTokens(text)
  const hasTokens = tokens.due || tokens.priority || tokens.project

  if (!isOpen) return null

  return (
    <div className="quick-capture-overlay" onClick={onClose}>
      <div className="quick-capture-modal" onClick={e => e.stopPropagation()}>
        {showSuccess ? (
          <div className="success-state">
            <span className="success-icon">✓</span>
            <span className="success-text">Captured!</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="input-container">
              <span className="input-icon">📥</span>
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Capture a thought... (@today, #project, !high)"
                className="capture-input"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                disabled={saving}
              />
              <button
                type="submit"
                className="submit-btn"
                disabled={!text.trim() || saving}
              >
                {saving ? '...' : '↵'}
              </button>
            </div>

            {hasTokens && (
              <div className="token-preview">
                {tokens.due && (
                  <span className="token due">📅 {tokens.due}</span>
                )}
                {tokens.priority && (
                  <span className={`token priority ${tokens.priority}`}>
                    {tokens.priority === 'high' ? '🔴' : tokens.priority === 'medium' ? '🟡' : '🟢'} {tokens.priority}
                  </span>
                )}
                {tokens.project && (
                  <span className="token project">#{tokens.project}</span>
                )}
              </div>
            )}

            <div className="shortcuts-hint">
              <span>Press <kbd>Enter</kbd> to capture</span>
              <span>Press <kbd>Esc</kbd> to close</span>
            </div>
          </form>
        )}
      </div>

      <style jsx>{`
        .quick-capture-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 15vh;
          z-index: 9999;
          backdrop-filter: blur(2px);
        }

        .quick-capture-modal {
          background: white;
          border-radius: 16px;
          width: 100%;
          max-width: 560px;
          margin: 0 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
          overflow: hidden;
        }

        .success-state {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 24px;
          color: #10b981;
        }

        .success-icon {
          font-size: 24px;
          font-weight: bold;
        }

        .success-text {
          font-size: 18px;
          font-weight: 600;
        }

        .input-container {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .input-icon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .capture-input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 17px;
          background: transparent;
          color: #1f2937;
        }

        .capture-input::placeholder {
          color: #9ca3af;
        }

        .capture-input:disabled {
          opacity: 0.5;
        }

        .submit-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: none;
          background: #1D9BF0;
          color: white;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .submit-btn:hover:not(:disabled) {
          background: #1a8cd8;
          transform: scale(1.05);
        }

        .submit-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .token-preview {
          display: flex;
          gap: 8px;
          padding: 12px 20px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          flex-wrap: wrap;
        }

        .token {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 500;
        }

        .token.due {
          background: #dbeafe;
          color: #1e40af;
        }

        .token.priority.high {
          background: #fee2e2;
          color: #b91c1c;
        }

        .token.priority.medium {
          background: #fef3c7;
          color: #92400e;
        }

        .token.priority.low {
          background: #dcfce7;
          color: #166534;
        }

        .token.project {
          background: #e5e7eb;
          color: #374151;
        }

        .shortcuts-hint {
          display: flex;
          justify-content: center;
          gap: 16px;
          padding: 10px;
          font-size: 12px;
          color: #9ca3af;
        }

        .shortcuts-hint kbd {
          display: inline-block;
          padding: 2px 6px;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-family: monospace;
          font-size: 11px;
        }
      `}</style>
    </div>
  )
}
