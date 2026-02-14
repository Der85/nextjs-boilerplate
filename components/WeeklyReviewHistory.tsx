'use client'

import { useState, useEffect } from 'react'
import type { WeeklyReview, BalanceScoreTrendDirection } from '@/lib/types'

interface WeeklyReviewHistoryProps {
  currentWeekStart: string
  onSelectReview: (weekStart: string) => void
}

function formatDateRange(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart)
  const end = new Date(weekEnd)
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${startStr} - ${endStr}`
}

function getTrendIndicator(trend: BalanceScoreTrendDirection | null): { icon: string; color: string } {
  switch (trend) {
    case 'improving':
      return { icon: '↑', color: '#10B981' }
    case 'declining':
      return { icon: '↓', color: '#EF4444' }
    case 'stable':
    default:
      return { icon: '→', color: '#6B7280' }
  }
}

export default function WeeklyReviewHistory({
  currentWeekStart,
  onSelectReview,
}: WeeklyReviewHistoryProps) {
  const [reviews, setReviews] = useState<WeeklyReview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch('/api/weekly-review/history?limit=10')
        if (res.ok) {
          const data = await res.json()
          setReviews(data.reviews || [])
        }
      } catch (err) {
        console.error('Failed to fetch history:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [])

  if (loading) {
    return (
      <div>
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="skeleton"
            style={{ height: '72px', marginBottom: '8px', borderRadius: 'var(--radius-md)' }}
          />
        ))}
      </div>
    )
  }

  // Filter out current week
  const pastReviews = reviews.filter(r => r.week_start !== currentWeekStart)

  if (pastReviews.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '32px 16px',
        color: 'var(--color-text-tertiary)',
        fontSize: 'var(--text-body)',
      }}>
        No previous reviews yet. Check back next week!
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      {pastReviews.map(review => {
        const { icon: trendIcon, color: trendColor } = getTrendIndicator(review.balance_score_trend)
        const completionPercent = Math.round(review.completion_rate * 100)

        return (
          <button
            key={review.id}
            onClick={() => onSelectReview(review.week_start)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px',
              background: 'var(--color-surface)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.15s ease',
            }}
          >
            <div>
              <div style={{
                fontSize: 'var(--text-body)',
                fontWeight: 500,
                color: 'var(--color-text-primary)',
                marginBottom: '4px',
              }}>
                {formatDateRange(review.week_start, review.week_end)}
              </div>
              <div style={{
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-tertiary)',
              }}>
                {review.tasks_completed} tasks completed
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}>
              {/* Completion rate */}
              <div style={{
                textAlign: 'right',
              }}>
                <div style={{
                  fontSize: 'var(--text-body)',
                  fontWeight: 600,
                  color: completionPercent >= 70 ? '#10B981' : completionPercent >= 40 ? '#F59E0B' : '#EF4444',
                }}>
                  {completionPercent}%
                </div>
                <div style={{
                  fontSize: 'var(--text-caption)',
                  color: 'var(--color-text-tertiary)',
                }}>
                  completion
                </div>
              </div>

              {/* Balance score */}
              {review.balance_score_avg !== null && (
                <div style={{
                  textAlign: 'right',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <span style={{
                      fontSize: 'var(--text-body)',
                      fontWeight: 600,
                      color: review.balance_score_avg >= 70 ? '#10B981' : review.balance_score_avg >= 40 ? '#F59E0B' : '#EF4444',
                    }}>
                      {review.balance_score_avg}
                    </span>
                    <span style={{
                      fontSize: 'var(--text-small)',
                      fontWeight: 600,
                      color: trendColor,
                    }}>
                      {trendIcon}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 'var(--text-caption)',
                    color: 'var(--color-text-tertiary)',
                  }}>
                    balance
                  </div>
                </div>
              )}

              {/* Chevron */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-text-tertiary)"
                strokeWidth="2"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </button>
        )
      })}
    </div>
  )
}
