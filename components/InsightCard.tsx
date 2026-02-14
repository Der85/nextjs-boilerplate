'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { InsightRow } from '@/lib/types'

interface InsightCardProps {
  insight: InsightRow
  onDismiss: () => void
}

export default function InsightCard({ insight, onDismiss }: InsightCardProps) {
  const supabase = createClient()
  const [helpful, setHelpful] = useState<boolean | null>(insight.is_helpful)
  const [dismissed, setDismissed] = useState(false)

  // Use category color for category/priority_drift insights, otherwise default purple
  const accentColor = (insight.type === 'category' || insight.type === 'priority_drift') && insight.category_color
    ? insight.category_color
    : '#7c3aed'

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

  // Badge text varies by insight type
  const badgeText = insight.type === 'priority_drift'
    ? (insight.priority_rank ? `Priority #${insight.priority_rank}` : 'Priority Balance')
    : insight.type === 'category'
      ? 'Life Balance'
      : 'Pattern Engine'

  if (dismissed) {
    return (
      <div style={{
        opacity: 0,
        transform: 'translateY(-12px) scale(0.96)',
        height: 0,
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        transition: 'opacity 0.3s ease, transform 0.3s ease, height 0.3s ease',
      }} />
    )
  }

  return (
    <div style={{
      background: `linear-gradient(135deg, ${accentColor}40, rgba(59, 130, 246, 0.25), ${accentColor}40)`,
      borderRadius: 'var(--radius-lg)',
      padding: '2px',
      marginBottom: '16px',
      animation: 'insightSlideIn 0.4s ease-out',
    }}>
      <div style={{
        background: 'var(--color-surface)',
        borderRadius: 'calc(var(--radius-lg) - 2px)',
        padding: 'clamp(18px, 5vw, 26px)',
      }}>
        {/* Top row: Icon | Content | X */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'clamp(12px, 3.5vw, 18px)',
        }}>
          {/* Icon */}
          <div style={{
            flexShrink: 0,
            width: 'clamp(48px, 13vw, 64px)',
            height: 'clamp(48px, 13vw, 64px)',
            background: `${accentColor}15`,
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'clamp(26px, 7vw, 34px)',
          }}>
            {insight.icon}
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              display: 'inline-block',
              fontSize: 'var(--text-small)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              color: accentColor,
              background: `${accentColor}18`,
              padding: '3px 10px',
              borderRadius: '100px',
              marginBottom: '8px',
            }}>
              {badgeText}
            </span>
            <h3 style={{
              fontSize: 'var(--text-subheading)',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              margin: '0 0 6px 0',
              lineHeight: 1.3,
            }}>
              {insight.title}
            </h3>
            <p style={{
              fontSize: 'var(--text-body)',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.6,
              margin: 0,
            }}>
              {insight.message}
            </p>
          </div>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            aria-label="Dismiss insight"
            style={{
              flexShrink: 0,
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: 'none',
              background: `${accentColor}12`,
              color: accentColor,
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Feedback Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginTop: '16px',
          paddingTop: '14px',
          borderTop: `1px solid ${accentColor}18`,
        }}>
          {helpful === null ? (
            <>
              <span style={{
                fontSize: 'var(--text-caption)',
                color: accentColor,
                fontWeight: 600,
              }}>
                Was this helpful?
              </span>
              <button
                onClick={() => handleHelpful(true)}
                aria-label="Yes, helpful"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: `1px solid ${accentColor}30`,
                  background: 'var(--color-bg)',
                  fontSize: '18px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <span role="img" aria-label="thumbs up">+1</span>
              </button>
              <button
                onClick={() => handleHelpful(false)}
                aria-label="Not helpful"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: `1px solid ${accentColor}30`,
                  background: 'var(--color-bg)',
                  fontSize: '18px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <span role="img" aria-label="thumbs down">-1</span>
              </button>
            </>
          ) : (
            <span style={{
              fontSize: 'var(--text-caption)',
              color: 'var(--color-text-tertiary)',
              fontWeight: 500,
            }}>
              {helpful ? 'Thanks for the feedback!' : "Got it — I'll do better."}
            </span>
          )}
        </div>
      </div>

      <style>{`
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
      `}</style>
    </div>
  )
}
