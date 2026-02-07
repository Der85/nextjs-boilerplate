'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  type CheckinTrendPoint,
  type CheckinCorrelations,
  CHECKIN_METRICS,
  calculateSparklineData,
} from '@/lib/types/daily-checkin'
import type { CorrelationInsight } from '@/lib/adaptive-engine'

interface CheckinInsightsWidgetProps {
  className?: string
}

interface TrendData {
  trend: CheckinTrendPoint[]
  correlations: CheckinCorrelations | null
  insights: CorrelationInsight[] | null
  summary: {
    overwhelm: { average: number; min: number; max: number }
    anxiety: { average: number; min: number; max: number }
    energy: { average: number; min: number; max: number }
    clarity: { average: number; min: number; max: number }
  } | null
  days_with_data: number
}

export default function CheckinInsightsWidget({ className = '' }: CheckinInsightsWidgetProps) {
  const supabase = createClient()
  const [trendData, setTrendData] = useState<TrendData | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<'week' | 'month'>('week')

  const fetchTrends = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`/api/daily-checkin/trend?range=${range}&correlations=true`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setTrendData(data)
      }
    } catch (err) {
      console.error('Error fetching trends:', err)
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    fetchTrends()
  }, [fetchTrends])

  if (loading) {
    return (
      <div className={`insights-widget loading ${className}`}>
        <div className="loading-spinner" />
        <span>Loading insights...</span>
        <style jsx>{`
          .insights-widget.loading {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            padding: 40px;
            background: #1a1a2e;
            border-radius: 16px;
            color: #8b8ba7;
          }
          .loading-spinner {
            width: 20px;
            height: 20px;
            border: 2px solid #3a3a5e;
            border-top-color: #1D9BF0;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    )
  }

  if (!trendData || trendData.days_with_data === 0) {
    return (
      <div className={`insights-widget empty ${className}`}>
        <div className="empty-icon">📊</div>
        <h3>No check-in data yet</h3>
        <p>Complete your first daily check-in to start tracking trends.</p>
        <style jsx>{`
          .insights-widget.empty {
            text-align: center;
            padding: 40px;
            background: #1a1a2e;
            border-radius: 16px;
          }
          .empty-icon { font-size: 48px; margin-bottom: 16px; }
          h3 { color: #e4e4f0; font-size: 18px; margin: 0 0 8px; }
          p { color: #8b8ba7; font-size: 14px; margin: 0; }
        `}</style>
      </div>
    )
  }

  return (
    <div className={`insights-widget ${className}`}>
      <div className="widget-header">
        <h3>Your Trends</h3>
        <div className="range-toggle">
          <button
            className={range === 'week' ? 'active' : ''}
            onClick={() => setRange('week')}
          >
            Week
          </button>
          <button
            className={range === 'month' ? 'active' : ''}
            onClick={() => setRange('month')}
          >
            Month
          </button>
        </div>
      </div>

      <div className="sparklines-grid">
        {CHECKIN_METRICS.map((metric) => {
          const sparkline = calculateSparklineData(trendData.trend, metric.key)
          const isInverted = metric.invertedScale
          const trendDirection = isInverted
            ? sparkline.trend === 'up' ? 'worse' : sparkline.trend === 'down' ? 'better' : 'stable'
            : sparkline.trend === 'up' ? 'better' : sparkline.trend === 'down' ? 'worse' : 'stable'

          return (
            <div key={metric.key} className="sparkline-card">
              <div className="sparkline-header">
                <span className="metric-icon">{metric.icon}</span>
                <span className="metric-label">{metric.label}</span>
                <span className={`trend-badge ${trendDirection}`}>
                  {trendDirection === 'better' && '↗'}
                  {trendDirection === 'worse' && '↘'}
                  {trendDirection === 'stable' && '→'}
                </span>
              </div>

              <Sparkline
                values={sparkline.values}
                color={metric.color}
                inverted={isInverted}
              />

              <div className="sparkline-stats">
                <span>Avg: {sparkline.average.toFixed(1)}</span>
                <span>Range: {sparkline.min}-{sparkline.max}</span>
              </div>
            </div>
          )
        })}
      </div>

      {trendData.insights && trendData.insights.length > 0 && (
        <div className="insights-section">
          <h4>Patterns</h4>
          <div className="insights-list">
            {trendData.insights.map((insight) => (
              <div key={insight.id} className={`insight-card ${insight.type}`}>
                <div className="insight-title">{insight.title}</div>
                <div className="insight-description">{insight.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .insights-widget {
          background: #1a1a2e;
          border-radius: 16px;
          padding: 24px;
        }

        .widget-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .widget-header h3 {
          font-size: 18px;
          font-weight: 600;
          color: #e4e4f0;
          margin: 0;
        }

        .range-toggle {
          display: flex;
          background: #12121f;
          border-radius: 8px;
          padding: 2px;
        }

        .range-toggle button {
          padding: 6px 14px;
          border: none;
          background: transparent;
          color: #8b8ba7;
          font-size: 13px;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.15s ease;
        }

        .range-toggle button.active {
          background: #2a2a4e;
          color: #e4e4f0;
        }

        .sparklines-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .sparkline-card {
          background: #12121f;
          border-radius: 12px;
          padding: 16px;
        }

        .sparkline-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .metric-icon {
          font-size: 16px;
        }

        .metric-label {
          flex: 1;
          font-size: 13px;
          font-weight: 500;
          color: #e4e4f0;
        }

        .trend-badge {
          font-size: 14px;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .trend-badge.better {
          background: rgba(16, 185, 129, 0.2);
          color: #10b981;
        }

        .trend-badge.worse {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .trend-badge.stable {
          background: rgba(139, 139, 167, 0.2);
          color: #8b8ba7;
        }

        .sparkline-stats {
          display: flex;
          justify-content: space-between;
          margin-top: 8px;
          font-size: 11px;
          color: #6b6b8e;
        }

        .insights-section {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #2a2a4e;
        }

        .insights-section h4 {
          font-size: 14px;
          font-weight: 600;
          color: #e4e4f0;
          margin: 0 0 12px;
        }

        .insights-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .insight-card {
          padding: 12px;
          border-radius: 10px;
          border-left: 3px solid;
        }

        .insight-card.positive {
          background: rgba(16, 185, 129, 0.1);
          border-color: #10b981;
        }

        .insight-card.negative {
          background: rgba(239, 68, 68, 0.1);
          border-color: #ef4444;
        }

        .insight-card.neutral {
          background: rgba(139, 139, 167, 0.1);
          border-color: #8b8ba7;
        }

        .insight-title {
          font-size: 13px;
          font-weight: 500;
          color: #e4e4f0;
          margin-bottom: 4px;
        }

        .insight-description {
          font-size: 12px;
          color: #a0a0be;
          line-height: 1.4;
        }

        @media (max-width: 480px) {
          .sparklines-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

// ===========================================
// Sparkline SVG Component
// ===========================================
function Sparkline({
  values,
  color,
  inverted = false,
}: {
  values: number[]
  color: string
  inverted?: boolean
}) {
  if (values.length === 0) {
    return (
      <div className="sparkline-empty">
        No data
        <style jsx>{`
          .sparkline-empty {
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #6b6b8e;
            font-size: 11px;
          }
        `}</style>
      </div>
    )
  }

  const width = 200
  const height = 40
  const padding = 4
  const min = 1
  const max = 5

  // Calculate points
  const points = values.map((value, index) => {
    const x = padding + (index / (values.length - 1 || 1)) * (width - padding * 2)
    const normalizedValue = inverted ? (max - value + min) : value
    const y = height - padding - ((normalizedValue - min) / (max - min)) * (height - padding * 2)
    return { x, y }
  })

  // Create path
  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')

  // Create area path for fill
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="sparkline-svg"
    >
      {/* Area fill */}
      <path
        d={areaD}
        fill={color}
        fillOpacity="0.1"
      />
      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Latest point */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="4"
        fill={color}
      />
      <style jsx>{`
        .sparkline-svg {
          display: block;
        }
      `}</style>
    </svg>
  )
}
