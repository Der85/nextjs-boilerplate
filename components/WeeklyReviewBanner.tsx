'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api-client'

interface WeeklyReviewBannerProps {
  onDismiss?: () => void
}

export default function WeeklyReviewBanner({ onDismiss }: WeeklyReviewBannerProps) {
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  // Check if banner should be shown
  useEffect(() => {
    async function checkReviewStatus() {
      try {
        const res = await fetch('/api/weekly-review')
        if (res.ok) {
          const data = await res.json()
          // Show banner if:
          // 1. Can show review prompt (has enough tasks, account old enough, valid day)
          // 2. Either no review exists yet, or review exists but not read
          const shouldShow = data.canShowReviewPrompt && (
            !data.review || (data.review && !data.review.is_read)
          )
          setVisible(shouldShow)
        }
      } catch (err) {
        console.error('Failed to check review status:', err)
      } finally {
        setLoading(false)
      }
    }

    checkReviewStatus()
  }, [])

  const handleClick = useCallback(async () => {
    // If we don't have a review yet, generate it first
    try {
      setGenerating(true)
      const checkRes = await fetch('/api/weekly-review')
      const checkData = await checkRes.json()

      if (!checkData.review) {
        // Generate the review
        await apiFetch('/api/weekly-review/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Navigate to review page
      router.push('/weekly-review')
    } catch (err) {
      console.error('Failed to navigate to review:', err)
      router.push('/weekly-review')
    } finally {
      setGenerating(false)
    }
  }, [router])

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    setVisible(false)
    onDismiss?.()
    // Store dismissal in localStorage for this week
    const weekKey = `weekly-review-dismissed-${getWeekKey()}`
    localStorage.setItem(weekKey, 'true')
  }

  // Check localStorage for dismissal
  useEffect(() => {
    const weekKey = `weekly-review-dismissed-${getWeekKey()}`
    if (localStorage.getItem(weekKey)) {
      setVisible(false)
    }
  }, [])

  if (loading || !visible) return null

  return (
    <div
      onClick={handleClick}
      style={{
        background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        marginBottom: '16px',
        cursor: generating ? 'wait' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <span style={{ fontSize: '24px' }}>📊</span>
        <div>
          <div style={{
            fontSize: 'var(--text-body)',
            fontWeight: 600,
            color: '#fff',
          }}>
            {generating ? 'Generating your review...' : 'Your weekly review is ready!'}
          </div>
          <div style={{
            fontSize: 'var(--text-caption)',
            color: 'rgba(255, 255, 255, 0.8)',
          }}>
            See your wins, patterns, and suggested focus
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        {/* View button */}
        <span style={{
          padding: '8px 16px',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(255, 255, 255, 0.2)',
          color: '#fff',
          fontSize: 'var(--text-small)',
          fontWeight: 600,
        }}>
          View
        </span>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(255, 255, 255, 0.15)',
            color: 'rgba(255, 255, 255, 0.7)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
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

function getWeekKey(): string {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - daysToMonday)
  return monday.toISOString().split('T')[0]
}
