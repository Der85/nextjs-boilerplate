'use client'

import type { DomainScore } from '@/lib/types'

interface BalanceBreakdownProps {
  breakdown: DomainScore[]
}

// Domain emoji mapping (fallback if category icon not available)
const DOMAIN_ICONS: Record<string, string> = {
  'Work': '💼',
  'Health': '🏃',
  'Home': '🏠',
  'Finance': '💰',
  'Social': '👥',
  'Personal Growth': '🌱',
  'Admin': '📋',
  'Family': '❤️',
}

// Default colors for domains without category color
const DOMAIN_COLORS: Record<string, string> = {
  'Work': '#4F46E5',
  'Health': '#10B981',
  'Home': '#F59E0B',
  'Finance': '#6366F1',
  'Social': '#EC4899',
  'Personal Growth': '#8B5CF6',
  'Admin': '#6B7280',
  'Family': '#EF4444',
}

function getScoreIndicator(score: number): { emoji: string; color: string } | null {
  if (score < 30) {
    return { emoji: '⚠️', color: '#EF4444' }
  }
  if (score >= 80) {
    return { emoji: '✓', color: '#10B981' }
  }
  return null
}

export default function BalanceBreakdown({ breakdown }: BalanceBreakdownProps) {
  // Sort by weight (importance) - highest first
  const sortedBreakdown = [...breakdown].sort((a, b) => b.weight - a.weight)

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      {sortedBreakdown.map((domain) => {
        const icon = domain.categoryIcon || DOMAIN_ICONS[domain.domain] || '📊'
        const color = domain.categoryColor || DOMAIN_COLORS[domain.domain] || '#6B7280'
        const indicator = getScoreIndicator(domain.score)
        const importancePercent = Math.round(domain.weight * 100)

        return (
          <div key={domain.domain}>
            {/* Domain header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span style={{ fontSize: '16px' }}>{icon}</span>
                <span style={{
                  fontSize: 'var(--text-small)',
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                }}>
                  {domain.domain}
                </span>
                <span style={{
                  fontSize: 'var(--text-caption)',
                  color: 'var(--color-text-tertiary)',
                }}>
                  ({importancePercent}% weight)
                </span>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                {indicator && (
                  <span style={{
                    fontSize: '12px',
                    color: indicator.color,
                  }}>
                    {indicator.emoji}
                  </span>
                )}
                <span style={{
                  fontSize: 'var(--text-small)',
                  fontWeight: 600,
                  color: domain.score < 30 ? '#EF4444' : domain.score >= 80 ? '#10B981' : 'var(--color-text-primary)',
                }}>
                  {domain.score}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div
              role="progressbar"
              aria-valuenow={domain.score}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${domain.domain} score: ${domain.score} out of 100${domain.score < 30 ? ' - Needs attention' : domain.score >= 80 ? ' - On track' : ''}`}
              style={{
                height: '8px',
                background: 'var(--color-border)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div style={{
                height: '100%',
                width: `${domain.score}%`,
                background: domain.score < 30
                  ? '#EF4444'
                  : domain.score < 60
                    ? '#F59E0B'
                    : color,
                borderRadius: '4px',
                transition: 'width 0.6s ease-out',
              }} />
            </div>

            {/* Task stats */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '4px',
            }}>
              <span style={{
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-tertiary)',
              }}>
                {domain.taskCount} task{domain.taskCount !== 1 ? 's' : ''}
              </span>
              {domain.taskCount > 0 && (
                <span style={{
                  fontSize: 'var(--text-caption)',
                  color: 'var(--color-text-tertiary)',
                }}>
                  {Math.round(domain.completionRate * 100)}% complete
                </span>
              )}
            </div>
          </div>
        )
      })}

      {/* Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '16px',
        marginTop: '8px',
        paddingTop: '12px',
        borderTop: '1px solid var(--color-border)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: 'var(--text-caption)',
          color: 'var(--color-text-tertiary)',
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#EF4444',
          }} />
          Needs attention
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: 'var(--text-caption)',
          color: 'var(--color-text-tertiary)',
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#10B981',
          }} />
          On track
        </div>
      </div>
    </div>
  )
}
