'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface PriorityPromptProps {
  taskCount: number // Only show after 3+ tasks
  variant?: 'banner' | 'card'
}

const DISMISS_KEY = 'priorities_prompt_dismissed'
const DISMISS_EXPIRY_DAYS = 7

export default function PriorityPrompt({ taskCount, variant = 'banner' }: PriorityPromptProps) {
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [hasPriorities, setHasPriorities] = useState<boolean | null>(null)
  const [isReviewDue, setIsReviewDue] = useState(false)
  const [daysSinceReview, setDaysSinceReview] = useState<number | null>(null)

  useEffect(() => {
    async function checkStatus() {
      // Check dismissal
      const dismissedAt = localStorage.getItem(DISMISS_KEY)
      if (dismissedAt) {
        const dismissedDate = new Date(dismissedAt)
        const now = new Date()
        const daysSinceDismiss = Math.floor(
          (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24)
        )
        if (daysSinceDismiss < DISMISS_EXPIRY_DAYS) {
          // Still within dismiss window
          return
        }
      }

      try {
        const res = await fetch('/api/priorities/review-due')
        if (res.ok) {
          const data = await res.json()
          setHasPriorities(data.hasPriorities)
          setIsReviewDue(data.isDue)
          setDaysSinceReview(data.daysSinceReview)

          // Show prompt if:
          // 1. No priorities set AND 3+ tasks created
          // 2. OR priorities exist but review is due
          if ((!data.hasPriorities && taskCount >= 3) || data.isDue) {
            setVisible(true)
          }
        }
      } catch (err) {
        console.error('Failed to check priority status:', err)
      }
    }

    checkStatus()
  }, [taskCount])

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString())
    setVisible(false)
  }

  const handleAction = () => {
    router.push('/priorities')
  }

  if (!visible) return null

  // Review due banner
  if (hasPriorities && isReviewDue) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-accent-subtle, rgba(79, 70, 229, 0.1))',
        border: '1px solid var(--color-accent)',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <span style={{ fontSize: '20px' }}>🔄</span>
          <div>
            <span style={{
              fontSize: 'var(--text-body)',
              color: 'var(--color-text-primary)',
              fontWeight: 500,
            }}>
              Time for a priority check-in
            </span>
            <p style={{
              fontSize: 'var(--text-small)',
              color: 'var(--color-text-secondary)',
              margin: '2px 0 0',
            }}>
              {daysSinceReview && daysSinceReview > 0
                ? `It's been ${daysSinceReview} days since you last reviewed your priorities.`
                : 'Life changes — want to review them?'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={handleDismiss}
            style={{
              padding: '6px 12px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              color: 'var(--color-text-tertiary)',
              fontSize: 'var(--text-small)',
              cursor: 'pointer',
            }}
          >
            Later
          </button>
          <button
            onClick={handleAction}
            style={{
              padding: '6px 12px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-accent)',
              color: '#fff',
              fontSize: 'var(--text-small)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Review
          </button>
        </div>
      </div>
    )
  }

  // New user prompt (card variant for more visibility)
  if (variant === 'card') {
    return (
      <div style={{
        padding: '20px',
        borderRadius: 'var(--radius-lg)',
        background: 'linear-gradient(135deg, var(--color-accent) 0%, #7C3AED 100%)',
        color: '#fff',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <span style={{ fontSize: '32px' }}>🎯</span>
          <div style={{ flex: 1 }}>
            <h3 style={{
              fontSize: 'var(--text-body)',
              fontWeight: 600,
              marginBottom: '4px',
            }}>
              Set your life priorities
            </h3>
            <p style={{
              fontSize: 'var(--text-small)',
              opacity: 0.9,
              marginBottom: '12px',
            }}>
              Now that you've captured some tasks, tell us what matters most. We'll help you stay balanced.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleDismiss}
                style={{
                  padding: '8px 14px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'transparent',
                  color: '#fff',
                  fontSize: 'var(--text-small)',
                  cursor: 'pointer',
                }}
              >
                Maybe later
              </button>
              <button
                onClick={handleAction}
                style={{
                  padding: '8px 14px',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  background: '#fff',
                  color: 'var(--color-accent)',
                  fontSize: 'var(--text-small)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Set priorities
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Default banner variant
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderRadius: 'var(--radius-md)',
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
        <span style={{ fontSize: '20px' }}>🎯</span>
        <span style={{
          fontSize: 'var(--text-body)',
          color: 'var(--color-text-primary)',
        }}>
          Want to set your life priorities?
        </span>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button
          onClick={handleDismiss}
          style={{
            padding: '6px 12px',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            background: 'transparent',
            color: 'var(--color-text-tertiary)',
            fontSize: 'var(--text-small)',
            cursor: 'pointer',
          }}
        >
          Later
        </button>
        <button
          onClick={handleAction}
          style={{
            padding: '6px 12px',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-accent)',
            color: '#fff',
            fontSize: 'var(--text-small)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Set up
        </button>
      </div>
    </div>
  )
}
