'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import EmptyState from '@/components/EmptyState'
import type { InsightSummary, WeeklyTrend, CategoryBreakdown } from '@/lib/types'

// Lazy load charts to keep bundle size small
const InsightCharts = dynamic(() => import('@/components/InsightCharts'), { ssr: false })

export default function InsightsPage() {
  const [summary, setSummary] = useState<InsightSummary | null>(null)
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrend[]>([])
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchInsights() {
      try {
        const [summaryRes, trendRes] = await Promise.all([
          fetch('/api/insights/summary'),
          fetch('/api/insights/trend'),
        ])

        if (summaryRes.ok) {
          setSummary(await summaryRes.json())
        }
        if (trendRes.ok) {
          const trendData = await trendRes.json()
          setWeeklyTrend(trendData.weekly_trend || [])
          setCategoryBreakdown(trendData.category_breakdown || [])
        }
      } catch (err) {
        console.error('Failed to fetch insights:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchInsights()
  }, [])

  if (loading) {
    return (
      <div style={{ paddingTop: '24px' }}>
        <div className="skeleton" style={{ height: '28px', width: '120px', marginBottom: '24px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '32px' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: '80px', borderRadius: 'var(--radius-md)' }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: '200px', borderRadius: 'var(--radius-md)' }} />
      </div>
    )
  }

  if (!summary || summary.total_tasks < 5) {
    return (
      <div style={{ paddingTop: '24px' }}>
        <h1 style={{
          fontSize: 'var(--text-heading)',
          fontWeight: 'var(--font-heading)',
          marginBottom: '16px',
        }}>
          Insights
        </h1>
        <EmptyState
          icon={String.fromCodePoint(0x1F4CA)}
          title="Not enough data yet"
          message="Complete a few more tasks and I'll start showing you patterns here."
        />
      </div>
    )
  }

  return (
    <div style={{ paddingTop: '20px', paddingBottom: '24px' }}>
      <h1 style={{
        fontSize: 'var(--text-heading)',
        fontWeight: 'var(--font-heading)',
        color: 'var(--color-text-primary)',
        marginBottom: '20px',
      }}>
        Insights
      </h1>

      {/* Stats grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        marginBottom: '32px',
      }}>
        {/* Streak */}
        <div style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
        }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {summary.current_streak}
            <span style={{ fontSize: '20px', marginLeft: '4px' }}>
              {summary.current_streak > 0 ? String.fromCodePoint(0x1F525) : ''}
            </span>
          </div>
          <div style={{ fontSize: 'var(--text-small)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            day streak
          </div>
        </div>

        {/* Completion rate */}
        <div style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
        }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {summary.completion_rate}%
          </div>
          <div style={{ fontSize: 'var(--text-small)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            completion rate
          </div>
        </div>

        {/* Completed today */}
        <div style={{
          background: 'var(--color-success-light)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
        }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-success)' }}>
            {summary.completed_today}
          </div>
          <div style={{ fontSize: 'var(--text-small)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            done today
          </div>
        </div>

        {/* This week */}
        <div style={{
          background: 'var(--color-accent-light)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
        }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-accent)' }}>
            {summary.completed_this_week}
          </div>
          <div style={{ fontSize: 'var(--text-small)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            this week
          </div>
        </div>
      </div>

      {/* Charts */}
      <InsightCharts
        weeklyTrend={weeklyTrend}
        categoryBreakdown={categoryBreakdown}
      />
    </div>
  )
}
