'use client'

import { ResponsiveContainer, LineChart, Line, Tooltip } from 'recharts'
import type { BalanceScoreTrend } from '@/lib/types'

interface BalanceSparklineProps {
  trend: BalanceScoreTrend[]
}

function getTrendDirection(trend: BalanceScoreTrend[]): 'up' | 'down' | 'flat' {
  if (trend.length < 2) return 'flat'

  // Compare first half to second half
  const midpoint = Math.floor(trend.length / 2)
  const firstHalf = trend.slice(0, midpoint)
  const secondHalf = trend.slice(midpoint)

  if (firstHalf.length === 0 || secondHalf.length === 0) return 'flat'

  const firstAvg = firstHalf.reduce((sum, t) => sum + t.score, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((sum, t) => sum + t.score, 0) / secondHalf.length
  const diff = secondAvg - firstAvg

  if (diff > 3) return 'up'
  if (diff < -3) return 'down'
  return 'flat'
}

function getTrendColor(direction: 'up' | 'down' | 'flat'): string {
  switch (direction) {
    case 'up': return '#10B981' // green
    case 'down': return '#EF4444' // red
    case 'flat': return '#6B7280' // gray
  }
}

// Custom tooltip
interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: BalanceScoreTrend }>
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0]
    const date = new Date(data.payload.date)
    const formattedDate = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })

    return (
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)',
        padding: '6px 10px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{
          fontSize: 'var(--text-caption)',
          color: 'var(--color-text-tertiary)',
          marginBottom: '2px',
        }}>
          {formattedDate}
        </div>
        <div style={{
          fontSize: 'var(--text-small)',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
        }}>
          Score: {data.value}
        </div>
      </div>
    )
  }
  return null
}

export default function BalanceSparkline({ trend }: BalanceSparklineProps) {
  if (trend.length < 2) return null

  const direction = getTrendDirection(trend)
  const lineColor = getTrendColor(direction)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }}>
      <div style={{
        width: '100%',
        height: '40px',
        minWidth: '100px',
      }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend}>
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="score"
              stroke={lineColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={true}
              animationDuration={800}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Trend indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: 'var(--text-caption)',
        color: lineColor,
        fontWeight: 500,
        flexShrink: 0,
      }}>
        {direction === 'up' && (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            trending up
          </>
        )}
        {direction === 'down' && (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            trending down
          </>
        )}
        {direction === 'flat' && (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            steady
          </>
        )}
      </div>
    </div>
  )
}
