'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

// ============================================
// Types
// ============================================
export interface InsightData {
  id: string
  type: string
  title: string
  message: string
  icon: string
}

interface InsightCardProps {
  insight: InsightData
  onDismiss: () => void
}

// ============================================
// InsightCard — "A-Ha!" Card
// Horizontal layout: Icon | Title+Message | Dismiss(X)
// Footer: "Was this helpful?" Thumbs Up / Down
// ============================================
export default function InsightCard({ insight, onDismiss }: InsightCardProps) {
  const [helpful, setHelpful] = useState<boolean | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const handleHelpful = async (value: boolean) => {
    setHelpful(value)
    await supabase
      .from('user_insights')
      .update({ is_helpful: value })
      .eq('id', insight.id)
  }

  const handleDismiss = async () => {
    setDismissed(true)
    await supabase
      .from('user_insights')
      .update({ is_dismissed: true })
      .eq('id', insight.id)
    setTimeout(() => onDismiss(), 300)
  }

  if (dismissed) {
    return (
      <div className="insight-card dismissed">
        <style jsx>{cardStyles}</style>
      </div>
    )
  }

  return (
    <div className="insight-card">
      <div className="insight-card-inner">
        {/* Top row: Icon | Content | X */}
        <div className="insight-row">
          <div className="insight-icon-wrap">
            <span className="insight-icon">{insight.icon}</span>
          </div>

          <div className="insight-body">
            <span className="insight-badge">Pattern Engine</span>
            <h3 className="insight-title">{insight.title}</h3>
            <p className="insight-message">{insight.message}</p>
          </div>

          <button
            onClick={handleDismiss}
            className="insight-dismiss"
            aria-label="Dismiss insight"
          >
            ✕
          </button>
        </div>

        {/* Footer: Was this helpful? */}
        <div className="insight-feedback">
          {helpful === null ? (
            <>
              <span className="feedback-label">Was this helpful?</span>
              <button
                onClick={() => handleHelpful(true)}
                className="feedback-btn"
                aria-label="Yes, helpful"
              >
                👍
              </button>
              <button
                onClick={() => handleHelpful(false)}
                className="feedback-btn"
                aria-label="Not helpful"
              >
                👎
              </button>
            </>
          ) : (
            <span className="feedback-thanks">
              {helpful ? '👍 Thanks for the feedback!' : '👎 Got it — I\'ll do better.'}
            </span>
          )}
        </div>
      </div>

      <style jsx>{cardStyles}</style>
    </div>
  )
}

// ============================================
// Styles
// ============================================
const cardStyles = `
  .insight-card {
    --purple: #7c3aed;
    --purple-light: rgba(124, 58, 237, 0.08);
    --purple-border: rgba(124, 58, 237, 0.25);

    background: linear-gradient(135deg, var(--purple-border), rgba(59, 130, 246, 0.25), var(--purple-border));
    border-radius: clamp(16px, 4.5vw, 24px);
    padding: 2px;
    margin-bottom: clamp(12px, 4vw, 18px);
    animation: insightSlideIn 0.4s ease-out;
    transition: opacity 0.3s ease, transform 0.3s ease;
  }

  .insight-card.dismissed {
    opacity: 0;
    transform: translateY(-12px) scale(0.96);
    height: 0;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  @keyframes insightSlideIn {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .insight-card-inner {
    background: #f5f3ff;
    border-radius: clamp(14px, 4vw, 22px);
    padding: clamp(18px, 5vw, 26px);
  }

  /* ---- Top Row: Icon | Content | X ---- */
  .insight-row {
    display: flex;
    align-items: flex-start;
    gap: clamp(12px, 3.5vw, 18px);
  }

  .insight-icon-wrap {
    flex-shrink: 0;
    width: clamp(48px, 13vw, 64px);
    height: clamp(48px, 13vw, 64px);
    background: var(--purple-light);
    border-radius: clamp(14px, 4vw, 20px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .insight-icon {
    font-size: clamp(26px, 7vw, 34px);
  }

  .insight-body {
    flex: 1;
    min-width: 0;
  }

  .insight-badge {
    display: inline-block;
    font-size: clamp(10px, 2.8vw, 12px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--purple);
    background: rgba(124, 58, 237, 0.12);
    padding: clamp(3px, 0.8vw, 5px) clamp(8px, 2vw, 12px);
    border-radius: 100px;
    margin-bottom: clamp(6px, 1.5vw, 10px);
  }

  .insight-title {
    font-size: clamp(17px, 4.8vw, 22px);
    font-weight: 700;
    color: #0f1419;
    margin: 0 0 clamp(4px, 1vw, 8px) 0;
    line-height: 1.3;
  }

  .insight-message {
    font-size: clamp(14px, 3.8vw, 16px);
    color: #536471;
    line-height: 1.6;
    margin: 0;
  }

  .insight-dismiss {
    flex-shrink: 0;
    width: clamp(32px, 9vw, 38px);
    height: clamp(32px, 9vw, 38px);
    border-radius: 50%;
    border: none;
    background: rgba(124, 58, 237, 0.08);
    color: #7c3aed;
    font-size: clamp(14px, 4vw, 18px);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease;
    font-family: inherit;
    line-height: 1;
  }

  .insight-dismiss:hover {
    background: rgba(124, 58, 237, 0.18);
  }

  /* ---- Feedback Footer ---- */
  .insight-feedback {
    display: flex;
    align-items: center;
    gap: clamp(8px, 2.5vw, 12px);
    margin-top: clamp(14px, 4vw, 20px);
    padding-top: clamp(12px, 3.5vw, 16px);
    border-top: 1px solid rgba(124, 58, 237, 0.12);
  }

  .feedback-label {
    font-size: clamp(12px, 3.3vw, 14px);
    color: #7c3aed;
    font-weight: 600;
  }

  .feedback-btn {
    width: clamp(34px, 9vw, 40px);
    height: clamp(34px, 9vw, 40px);
    border-radius: 50%;
    border: 1px solid rgba(124, 58, 237, 0.2);
    background: white;
    font-size: clamp(16px, 4.5vw, 20px);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
  }

  .feedback-btn:hover {
    background: rgba(124, 58, 237, 0.1);
    border-color: var(--purple);
    transform: scale(1.1);
  }

  .feedback-thanks {
    font-size: clamp(12px, 3.3vw, 14px);
    color: #536471;
    font-weight: 500;
  }

  @media (min-width: 768px) {
    .insight-card-inner {
      padding: 28px;
    }
  }
`
