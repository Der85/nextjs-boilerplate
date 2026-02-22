'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import BalanceBreakdown from './BalanceBreakdown'
import BalanceSparkline from './BalanceSparkline'
import { getBalanceScoreMessage, getBalanceScoreColor } from '@/lib/types'
import type { BalanceScoreRow, BalanceScoreTrend, DomainScore } from '@/lib/types'

interface BalanceScoreWidgetProps {
  onThresholdCrossed?: (threshold: number, direction: 'up' | 'down') => void
}

export default function BalanceScoreWidget({ onThresholdCrossed }: BalanceScoreWidgetProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [hasPriorities, setHasPriorities] = useState(true)
  const [score, setScore] = useState<BalanceScoreRow | null>(null)
  const [trend, setTrend] = useState<BalanceScoreTrend[]>([])
  const [changeFromYesterday, setChangeFromYesterday] = useState<number | null>(null)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)

  // Ref to hold latest callback without re-triggering the fetch effect
  const thresholdRef = useRef(onThresholdCrossed)
  useEffect(() => { thresholdRef.current = onThresholdCrossed })

  useEffect(() => {
    async function fetchBalance() {
      try {
        const res = await fetch('/api/balance')
        if (res.ok) {
          const data = await res.json()
          setHasPriorities(data.hasPriorities)

          if (data.hasPriorities && data.score) {
            setScore(data.score)
            setTrend(data.trend || [])
            setChangeFromYesterday(data.changeFromYesterday)

            // Check for threshold crossing
            if (data.changeFromYesterday !== null && data.changeFromYesterday > 0) {
              const prevScore = data.score.score - data.changeFromYesterday
              const thresholds = [30, 60, 80]

              for (const threshold of thresholds) {
                if (prevScore < threshold && data.score.score >= threshold) {
                  thresholdRef.current?.(threshold, 'up')
                  setShowCelebration(true)
                  setTimeout(() => setShowCelebration(false), 2000)
                  break
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch balance:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchBalance()
  }, []) // stable: runs once on mount

  if (loading) {
    return (
      <div style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        marginBottom: '20px',
      }}>
        <div className="skeleton" style={{ height: '140px', borderRadius: 'var(--radius-md)' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        marginBottom: '20px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>⚠️</div>
        <p style={{
          fontSize: 'var(--text-small)',
          color: 'var(--color-text-secondary)',
          margin: 0,
        }}>
          Couldn't load your balance score. Pull down to refresh.
        </p>
      </div>
    )
  }

  if (!hasPriorities) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        marginBottom: '20px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎯</div>
        <h3 style={{
          fontSize: 'var(--text-subheading)',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          marginBottom: '8px',
        }}>
          Set Your Life Priorities
        </h3>
        <p style={{
          fontSize: 'var(--text-body)',
          color: 'var(--color-text-secondary)',
          marginBottom: '16px',
        }}>
          Once you set your priorities, you'll see your Life Balance Score here.
        </p>
        <button
          onClick={() => router.push('/priorities')}
          style={{
            padding: '10px 24px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'var(--color-accent)',
            color: '#fff',
            fontSize: 'var(--text-body)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Set Priorities
        </button>
      </div>
    )
  }

  if (!score) return null

  const scoreColor = getBalanceScoreColor(score.score)
  const message = getBalanceScoreMessage(score.score)
  const circumference = 2 * Math.PI * 45 // radius = 45
  const strokeDashoffset = circumference - (score.score / 100) * circumference

  return (
    <div style={{
      background: 'var(--color-surface)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
      marginBottom: '20px',
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: '16px',
      }}>
        <h3 style={{
          fontSize: 'var(--text-body)',
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          margin: 0,
        }}>
          Life Balance
        </h3>
        {changeFromYesterday !== null && changeFromYesterday !== 0 && (
          <div
            aria-label={`Balance score changed by ${changeFromYesterday > 0 ? '+' : ''}${changeFromYesterday} points`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              background: changeFromYesterday > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: changeFromYesterday > 0 ? '#10B981' : '#EF4444',
              fontSize: 'var(--text-small)',
              fontWeight: 600,
              animation: showCelebration ? 'pulse 0.5s ease-in-out' : undefined,
            }}
          >
            {changeFromYesterday > 0 ? '+' : ''}{changeFromYesterday}
            <span aria-hidden="true">{changeFromYesterday > 0 ? '↑' : '↓'}</span>
          </div>
        )}
      </div>

      {/* Main content: Score ring + sparkline */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
      }}>
        {/* Circular progress ring */}
        <div style={{
          position: 'relative',
          width: '120px',
          height: '120px',
          flexShrink: 0,
        }}>
          <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
            style={{ transform: 'rotate(-90deg)' }}
          >
            {/* Background circle */}
            <circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke="var(--color-border)"
              strokeWidth="10"
            />
            {/* Progress circle */}
            <circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke={scoreColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{
                transition: 'stroke-dashoffset 0.6s ease-out, stroke 0.3s ease',
              }}
            />
          </svg>
          {/* Score number in center */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}>
            <div aria-hidden="true" style={{
              fontSize: '32px',
              fontWeight: 700,
              color: scoreColor,
              lineHeight: 1,
            }}>
              {score.score}
            </div>
            <div aria-hidden="true" style={{
              fontSize: 'var(--text-caption)',
              color: 'var(--color-text-tertiary)',
              marginTop: '2px',
            }}>
              / 100
            </div>
            <span style={{
              position: 'absolute',
              width: '1px',
              height: '1px',
              padding: 0,
              margin: '-1px',
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
              borderWidth: 0,
            }}>
              Life balance score: {score.score} out of 100. {message}
            </span>
          </div>
        </div>

        {/* Message and sparkline */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 'var(--text-body)',
            color: 'var(--color-text-primary)',
            fontWeight: 500,
            margin: '0 0 12px 0',
            lineHeight: 1.4,
          }}>
            {message}
            {score.score >= 86 && ' 🌟'}
          </p>

          {/* Sparkline */}
          {trend.length >= 2 && (
            <BalanceSparkline trend={trend} />
          )}
        </div>
      </div>

      {/* Breakdown toggle */}
      <button
        onClick={() => setShowBreakdown(!showBreakdown)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          width: '100%',
          marginTop: '16px',
          padding: '10px',
          background: 'transparent',
          border: `1px solid var(--color-border)`,
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--text-small)',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        {showBreakdown ? 'Hide breakdown' : 'See breakdown'}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            transform: showBreakdown ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Breakdown panel */}
      {showBreakdown && (
        <div style={{
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid var(--color-border)',
        }}>
          <BalanceBreakdown breakdown={score.breakdown as DomainScore[]} />
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}
