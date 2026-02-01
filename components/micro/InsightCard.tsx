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
// Gradient-bordered card displaying AI-generated
// correlations from the Pattern Engine.
// ============================================
export default function InsightCard({ insight, onDismiss }: InsightCardProps) {
  const [helpful, setHelpful] = useState<boolean | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const handleHelpful = async () => {
    setHelpful(true)
    await supabase
      .from('user_insights')
      .update({ helpful: true })
      .eq('id', insight.id)
  }

  const handleDismiss = async () => {
    setDismissed(true)
    await supabase
      .from('user_insights')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', insight.id)
    // Small delay so the exit animation plays
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
        {/* Icon */}
        <div className="insight-icon-wrap">
          <span className="insight-icon">{insight.icon}</span>
        </div>

        {/* Content */}
        <div className="insight-body">
          <span className="insight-badge">Pattern Engine</span>
          <h3 className="insight-title">{insight.title}</h3>
          <p className="insight-message">{insight.message}</p>
        </div>

        {/* Actions */}
        <div className="insight-actions">
          <button
            onClick={handleHelpful}
            className={`insight-btn helpful ${helpful === true ? 'active' : ''}`}
            disabled={helpful === true}
          >
            {helpful ? '👍 Noted!' : '👍 Helpful'}
          </button>
          <button onClick={handleDismiss} className="insight-btn dismiss">
            Dismiss
          </button>
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
    --purple-glow: rgba(124, 58, 237, 0.12);

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
    background: white;
    border-radius: clamp(14px, 4vw, 22px);
    padding: clamp(18px, 5vw, 26px);
  }

  .insight-icon-wrap {
    width: clamp(48px, 13vw, 64px);
    height: clamp(48px, 13vw, 64px);
    background: var(--purple-light);
    border-radius: clamp(14px, 4vw, 20px);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: clamp(14px, 4vw, 18px);
  }

  .insight-icon {
    font-size: clamp(26px, 7vw, 34px);
  }

  .insight-body {
    margin-bottom: clamp(16px, 4.5vw, 22px);
  }

  .insight-badge {
    display: inline-block;
    font-size: clamp(10px, 2.8vw, 12px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--purple);
    background: var(--purple-light);
    padding: clamp(3px, 0.8vw, 5px) clamp(8px, 2vw, 12px);
    border-radius: 100px;
    margin-bottom: clamp(8px, 2vw, 12px);
  }

  .insight-title {
    font-size: clamp(17px, 4.8vw, 22px);
    font-weight: 700;
    color: #0f1419;
    margin: 0 0 clamp(6px, 1.5vw, 10px) 0;
    line-height: 1.3;
  }

  .insight-message {
    font-size: clamp(14px, 3.8vw, 16px);
    color: #536471;
    line-height: 1.6;
    margin: 0;
  }

  .insight-actions {
    display: flex;
    gap: clamp(8px, 2.5vw, 12px);
  }

  .insight-btn {
    padding: clamp(8px, 2.5vw, 12px) clamp(14px, 4vw, 20px);
    border-radius: 100px;
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
  }

  .insight-btn.helpful {
    background: var(--purple-light);
    border: 1px solid var(--purple-border);
    color: var(--purple);
  }

  .insight-btn.helpful:hover {
    background: rgba(124, 58, 237, 0.15);
  }

  .insight-btn.helpful.active {
    background: var(--purple);
    color: white;
    border-color: var(--purple);
    cursor: default;
  }

  .insight-btn.dismiss {
    background: none;
    border: 1px solid #e5e5e5;
    color: #536471;
  }

  .insight-btn.dismiss:hover {
    background: #f7f9fa;
    border-color: #ccc;
  }

  @media (min-width: 768px) {
    .insight-card-inner {
      padding: 28px;
    }
  }
`
