'use client'

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import type { WeeklyTrend, CategoryBreakdown } from '@/lib/types'

interface InsightChartsProps {
  weeklyTrend: WeeklyTrend[]
  categoryBreakdown: CategoryBreakdown[]
}

export default function InsightCharts({ weeklyTrend, categoryBreakdown }: InsightChartsProps) {
  const formatWeekLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Weekly Trend */}
      {weeklyTrend.length > 0 && (
        <div>
          <h3 style={{
            fontSize: 'var(--text-caption)',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '16px',
          }}>
            Last 4 Weeks
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyTrend} barGap={4}>
              <XAxis
                dataKey="week_start"
                tickFormatter={formatWeekLabel}
                tick={{ fontSize: 12, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
                formatter={((value: number, name: string) => [value, name === 'completed' ? 'Completed' : 'Created']) as any}
                labelFormatter={formatWeekLabel}
              />
              <Bar dataKey="completed" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="created" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={32} opacity={0.4} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#10B981' }} />
              Completed
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: '#3B82F6', opacity: 0.4 }} />
              Created
            </div>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {categoryBreakdown.length > 0 && (
        <div>
          <h3 style={{
            fontSize: 'var(--text-caption)',
            fontWeight: 600,
            color: 'var(--color-text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '16px',
          }}>
            Category Balance
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie
                  data={categoryBreakdown}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={65}
                  paddingAngle={2}
                >
                  {categoryBreakdown.map((entry, i) => (
                    <Cell key={i} fill={entry.category_color || '#3B82F6'} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              {categoryBreakdown.map((cat, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '2px',
                    background: cat.category_color || '#3B82F6',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: '13px', color: 'var(--color-text-primary)', flex: 1 }}>
                    {cat.category_name}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-tertiary)', fontWeight: 500 }}>
                    {cat.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
