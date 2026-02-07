'use client'

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  type CheckinScale,
  type UpsertCheckinRequest,
  type AdaptiveState,
  CHECKIN_METRICS,
} from '@/lib/types/daily-checkin'

interface DailyCheckinModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (adaptiveState: AdaptiveState) => void
  initialValues?: {
    overwhelm?: CheckinScale
    anxiety?: CheckinScale
    energy?: CheckinScale
    clarity?: CheckinScale
    note?: string
  }
}

export default function DailyCheckinModal({
  isOpen,
  onClose,
  onComplete,
  initialValues,
}: DailyCheckinModalProps) {
  const [values, setValues] = useState({
    overwhelm: initialValues?.overwhelm ?? (3 as CheckinScale),
    anxiety: initialValues?.anxiety ?? (3 as CheckinScale),
    energy: initialValues?.energy ?? (3 as CheckinScale),
    clarity: initialValues?.clarity ?? (3 as CheckinScale),
  })
  const [note, setNote] = useState(initialValues?.note ?? '')
  const [showNote, setShowNote] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset when modal opens
  useEffect(() => {
    if (isOpen && initialValues) {
      setValues({
        overwhelm: initialValues.overwhelm ?? 3,
        anxiety: initialValues.anxiety ?? 3,
        energy: initialValues.energy ?? 3,
        clarity: initialValues.clarity ?? 3,
      })
      setNote(initialValues.note ?? '')
    }
  }, [isOpen, initialValues])

  const handleSliderChange = useCallback((
    metric: keyof typeof values,
    value: number
  ) => {
    setValues((prev) => ({
      ...prev,
      [metric]: Math.min(5, Math.max(1, value)) as CheckinScale,
    }))
  }, [])

  const handleSubmit = useCallback(async () => {
    setSaving(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Please log in to save your check-in')
        return
      }

      const body: UpsertCheckinRequest = {
        ...values,
        note: note.trim() || null,
      }

      const res = await fetch('/api/daily-checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save check-in')
      }

      const data = await res.json()
      onComplete(data.adaptive_state)
    } catch (err) {
      console.error('Check-in error:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }, [values, note, onComplete])

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleSubmit()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, handleSubmit])

  if (!isOpen) return null

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkin-title"
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="checkin-title">How are you today?</h2>
          <p className="subtitle">Quick check-in to personalize your experience</p>
        </div>

        <div className="metrics-grid">
          {CHECKIN_METRICS.map((metric) => (
            <div key={metric.key} className="metric-row">
              <div className="metric-header">
                <span className="metric-icon">{metric.icon}</span>
                <span className="metric-label">{metric.label}</span>
              </div>

              <div className="slider-container">
                <span className="scale-label low">{metric.lowLabel}</span>
                <div className="slider-track">
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={values[metric.key]}
                    onChange={(e) => handleSliderChange(metric.key, parseInt(e.target.value))}
                    className="slider"
                    aria-label={`${metric.label} level`}
                    style={{
                      '--slider-color': metric.color,
                      '--slider-value': `${((values[metric.key] - 1) / 4) * 100}%`,
                    } as React.CSSProperties}
                  />
                  <div className="slider-dots">
                    {[1, 2, 3, 4, 5].map((dot) => (
                      <button
                        key={dot}
                        className={`dot ${values[metric.key] === dot ? 'active' : ''}`}
                        onClick={() => handleSliderChange(metric.key, dot)}
                        aria-label={`Set ${metric.label} to ${dot}`}
                        style={{ '--dot-color': metric.color } as React.CSSProperties}
                      />
                    ))}
                  </div>
                </div>
                <span className="scale-label high">{metric.highLabel}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Collapsible note section */}
        <div className="note-section">
          {!showNote ? (
            <button
              className="add-note-btn"
              onClick={() => setShowNote(true)}
            >
              + Add a note (optional)
            </button>
          ) : (
            <div className="note-input-container">
              <textarea
                className="note-input"
                placeholder="Anything on your mind?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
              />
              <span className="char-count">{note.length}/500</span>
            </div>
          )}
        </div>

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Skip for now
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <p className="shortcut-hint">
          Press <kbd>⌘</kbd>+<kbd>Enter</kbd> to save
        </p>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 400;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal-content {
          background: #1a1a2e;
          border-radius: 24px;
          width: 100%;
          max-width: 480px;
          padding: 32px;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .modal-header {
          text-align: center;
          margin-bottom: 28px;
        }

        .modal-header h2 {
          font-size: 24px;
          font-weight: 600;
          color: #e4e4f0;
          margin: 0 0 8px;
        }

        .subtitle {
          color: #8b8ba7;
          font-size: 14px;
          margin: 0;
        }

        .metrics-grid {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .metric-row {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .metric-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .metric-icon {
          font-size: 18px;
        }

        .metric-label {
          font-size: 14px;
          font-weight: 500;
          color: #e4e4f0;
        }

        .slider-container {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .scale-label {
          font-size: 11px;
          color: #6b6b8e;
          min-width: 70px;
        }

        .scale-label.low {
          text-align: right;
        }

        .scale-label.high {
          text-align: left;
        }

        .slider-track {
          flex: 1;
          position: relative;
          height: 32px;
          display: flex;
          align-items: center;
        }

        .slider {
          width: 100%;
          height: 4px;
          -webkit-appearance: none;
          appearance: none;
          background: linear-gradient(
            to right,
            var(--slider-color) 0%,
            var(--slider-color) var(--slider-value),
            #3a3a5e var(--slider-value),
            #3a3a5e 100%
          );
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }

        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--slider-color);
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          transition: transform 0.15s ease;
        }

        .slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }

        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--slider-color);
          cursor: pointer;
          border: none;
        }

        .slider-dots {
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          justify-content: space-between;
          pointer-events: none;
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #3a3a5e;
          border: none;
          cursor: pointer;
          pointer-events: auto;
          transition: all 0.15s ease;
        }

        .dot.active {
          background: var(--dot-color);
          transform: scale(1.2);
        }

        .note-section {
          margin-top: 24px;
        }

        .add-note-btn {
          width: 100%;
          padding: 12px;
          background: transparent;
          border: 1px dashed #3a3a5e;
          border-radius: 12px;
          color: #8b8ba7;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .add-note-btn:hover {
          border-color: #5a5a7e;
          color: #a0a0be;
        }

        .note-input-container {
          position: relative;
        }

        .note-input {
          width: 100%;
          padding: 12px;
          background: #12121f;
          border: 1px solid #3a3a5e;
          border-radius: 12px;
          color: #e4e4f0;
          font-size: 14px;
          resize: none;
          font-family: inherit;
        }

        .note-input::placeholder {
          color: #6b6b8e;
        }

        .note-input:focus {
          outline: none;
          border-color: #1D9BF0;
        }

        .char-count {
          position: absolute;
          bottom: 8px;
          right: 12px;
          font-size: 11px;
          color: #6b6b8e;
        }

        .error-message {
          margin-top: 16px;
          padding: 12px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid #ef4444;
          border-radius: 8px;
          color: #ef4444;
          font-size: 13px;
          text-align: center;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .btn-primary,
        .btn-secondary {
          flex: 1;
          padding: 14px 24px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-primary {
          background: linear-gradient(135deg, #1D9BF0, #0d8ae0);
          color: white;
          border: none;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(29, 155, 240, 0.3);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: transparent;
          color: #8b8ba7;
          border: 1px solid #3a3a5e;
        }

        .btn-secondary:hover:not(:disabled) {
          border-color: #5a5a7e;
          color: #a0a0be;
        }

        .shortcut-hint {
          text-align: center;
          margin-top: 16px;
          font-size: 12px;
          color: #6b6b8e;
        }

        .shortcut-hint kbd {
          background: #2a2a4e;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 11px;
        }

        @media (max-width: 480px) {
          .modal-content {
            padding: 24px;
          }

          .slider-container {
            flex-direction: column;
            gap: 8px;
          }

          .scale-label {
            text-align: center !important;
            min-width: auto;
          }
        }
      `}</style>
    </div>
  )
}
