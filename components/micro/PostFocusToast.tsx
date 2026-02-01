'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

interface PostFocusToastProps {
  userId: string
  show: boolean
  onDismiss: () => void
}

type FocusQuality = 'laser' | 'foggy' | 'distracted'

const FOCUS_MAP: Record<FocusQuality, { icon: string; label: string; focus_difficulty: number }> = {
  laser:      { icon: '🧠', label: 'Laser',      focus_difficulty: 1 },
  foggy:      { icon: '🌫️', label: 'Foggy',      focus_difficulty: 5 },
  distracted: { icon: '🐿️', label: 'Distracted', focus_difficulty: 8 },
}

export default function PostFocusToast({ userId, show, onDismiss }: PostFocusToastProps) {
  const [saving, setSaving] = useState(false)

  if (!show) return null

  const handleSelect = async (quality: FocusQuality) => {
    if (saving) return
    setSaving(true)

    const { focus_difficulty } = FOCUS_MAP[quality]
    await supabase.from('burnout_logs').insert({
      user_id: userId,
      focus_difficulty,
      source: 'focus_survey',
    })

    setSaving(false)
    onDismiss()
  }

  return (
    <>
      <div className="toast-overlay">
        <div className="toast-card">
          <div className="toast-header">
            <span className="toast-icon">⏱️</span>
            <h3 className="toast-title">How was the focus?</h3>
          </div>

          <div className="toast-buttons">
            {(Object.keys(FOCUS_MAP) as FocusQuality[]).map((key) => {
              const { icon, label } = FOCUS_MAP[key]
              return (
                <button
                  key={key}
                  className={`toast-btn toast-btn--${key}`}
                  onClick={() => handleSelect(key)}
                  disabled={saving}
                >
                  <span className="toast-btn-icon">{icon}</span>
                  <span className="toast-btn-label">{label}</span>
                </button>
              )
            })}
          </div>

          <button className="toast-skip" onClick={onDismiss}>
            Skip
          </button>
        </div>
      </div>

      <style jsx>{`
        .toast-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
          padding: clamp(16px, 4vw, 24px);
          animation: toastFadeIn 0.2s ease;
        }

        .toast-card {
          background: white;
          border-radius: clamp(16px, 4vw, 24px);
          padding: clamp(24px, 6vw, 36px);
          max-width: 380px;
          width: 100%;
          text-align: center;
          animation: toastSlideUp 0.3s ease;
        }

        .toast-header {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: clamp(8px, 2vw, 12px);
          margin-bottom: clamp(18px, 5vw, 26px);
        }

        .toast-icon {
          font-size: clamp(24px, 7vw, 32px);
        }

        .toast-title {
          font-size: clamp(16px, 4.5vw, 20px);
          font-weight: 700;
          margin: 0;
          color: #0f1419;
        }

        .toast-buttons {
          display: flex;
          gap: clamp(10px, 3vw, 14px);
          margin-bottom: clamp(14px, 3.5vw, 18px);
        }

        .toast-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(6px, 1.5vw, 10px);
          padding: clamp(14px, 4vw, 20px) clamp(8px, 2vw, 12px);
          border: 2px solid transparent;
          border-radius: clamp(12px, 3vw, 16px);
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .toast-btn:disabled { opacity: 0.6; cursor: wait; }

        .toast-btn--laser {
          background: rgba(0, 186, 124, 0.08);
          border-color: rgba(0, 186, 124, 0.2);
        }
        .toast-btn--laser:hover:not(:disabled) { border-color: #00ba7c; }

        .toast-btn--foggy {
          background: rgba(99, 102, 241, 0.08);
          border-color: rgba(99, 102, 241, 0.2);
        }
        .toast-btn--foggy:hover:not(:disabled) { border-color: #6366f1; }

        .toast-btn--distracted {
          background: rgba(245, 158, 11, 0.08);
          border-color: rgba(245, 158, 11, 0.2);
        }
        .toast-btn--distracted:hover:not(:disabled) { border-color: #f59e0b; }

        .toast-btn-icon {
          font-size: clamp(28px, 8vw, 36px);
        }

        .toast-btn-label {
          font-size: clamp(12px, 3.2vw, 14px);
          font-weight: 600;
          color: #536471;
        }

        .toast-skip {
          width: 100%;
          padding: clamp(8px, 2vw, 12px);
          background: none;
          border: none;
          font-size: clamp(13px, 3.5vw, 15px);
          color: #8899a6;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        @keyframes toastFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes toastSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
