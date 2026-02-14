'use client'

import type { BalanceScoreTrendDirection } from '@/lib/types'

interface WeeklyReviewHeaderProps {
  weekRange: string
  tasksCompleted: number
  completionRate: number
  balanceScore: number | null
  balanceTrend: BalanceScoreTrendDirection | null
}

function getTrendIcon(trend: BalanceScoreTrendDirection | null): { icon: string; color: string } {
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

export default function WeeklyReviewHeader({
  weekRange,
  tasksCompleted,
  completionRate,
  balanceScore,
  balanceTrend,
}: WeeklyReviewHeaderProps) {
  const { icon: trendIcon, color: trendColor } = getTrendIcon(balanceTrend)
  const completionPercent = Math.round(completionRate * 100)

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Week title */}
      <h1 style={{
        fontSize: 'var(--text-heading)',
        fontWeight: 'var(--font-heading)',
        color: 'var(--color-text-primary)',
        marginBottom: '4px',
      }}>
        Week of {weekRange}
      </h1>
      <p style={{
        fontSize: 'var(--text-small)',
        color: 'var(--color-text-tertiary)',
        marginBottom: '20px',
      }}>
        Your AI-generated weekly review
      </p>

      {/* Stats row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: balanceScore !== null ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
        gap: '12px',
      }}>
        {/* Tasks completed */}
        <div style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          textAlign: 'center',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '4px',
          }}>
            <span style={{ fontSize: '32px', fontWeight: 700, color: 'var(--color-success)' }}>
              {tasksCompleted}
            </span>
            <span style={{ fontSize: '20px' }}>✓</span>
          </div>
          <div style={{
            fontSize: 'var(--text-caption)',
            color: 'var(--color-text-tertiary)',
          }}>
            tasks done
          </div>
        </div>

        {/* Completion rate */}
        <div style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          textAlign: 'center',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            marginBottom: '4px',
          }}>
            <span style={{
              fontSize: '32px',
              fontWeight: 700,
              color: completionPercent >= 70 ? '#10B981' : completionPercent >= 40 ? '#F59E0B' : '#EF4444',
            }}>
              {completionPercent}%
            </span>
          </div>
          <div style={{
            fontSize: 'var(--text-caption)',
            color: 'var(--color-text-tertiary)',
          }}>
            completion
          </div>
        </div>

        {/* Balance score */}
        {balanceScore !== null && (
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            textAlign: 'center',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginBottom: '4px',
            }}>
              <span style={{
                fontSize: '32px',
                fontWeight: 700,
                color: balanceScore >= 70 ? '#10B981' : balanceScore >= 40 ? '#F59E0B' : '#EF4444',
              }}>
                {balanceScore}
              </span>
              <span style={{
                fontSize: '20px',
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
              balance score
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
