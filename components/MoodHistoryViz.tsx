'use client'

import { useState, useMemo } from 'react'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine
} from 'recharts'
import { getMoodEmoji } from '@/lib/utils/ui-helpers'

interface MoodEntry {
  id: string
  mood_score: number
  note: string | null
  coach_advice?: string | null
  created_at: string
}

interface MoodHistoryVizProps {
  entries: MoodEntry[]
}

type TimeRange = '7d' | '30d' | '90d' | 'all'
type ChartType = 'area' | 'line' | 'bar'

// Helper functions
const getMoodColor = (score: number): string => {
  if (score <= 3) return '#e0245e' // red
  if (score <= 5) return '#ffad1f' // amber
  if (score <= 7) return '#1da1f2' // blue (primary)
  return '#17bf63' // green
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const getDayOfWeek = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}

const getHourOfDay = (dateString: string): number => {
  const date = new Date(dateString)
  return date.getHours()
}

// Custom tooltip for mood chart
const MoodTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.98)',
        border: '1px solid var(--extra-light-gray)',
        borderRadius: '12px',
        padding: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--black)', marginBottom: '4px' }}>{label}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '24px' }}>{getMoodEmoji(data.mood_score)}</span>
          <span style={{ 
            fontSize: '18px', 
            fontWeight: 700, 
            color: getMoodColor(data.mood_score) 
          }}>
            {data.mood_score}/10
          </span>
        </div>
        {data.note && (
          <p style={{ 
            fontSize: '12px', 
            color: 'var(--dark-gray)', 
            marginTop: '8px',
            maxWidth: '200px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>{data.note}</p>
        )}
      </div>
    )
  }
  return null
}

// Custom tooltip for pattern charts
const PatternTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div style={{
        background: 'rgba(255, 255, 255, 0.98)',
        border: '1px solid var(--extra-light-gray)',
        borderRadius: '12px',
        padding: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--black)', marginBottom: '4px' }}>{label}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '24px' }}>{getMoodEmoji(data.avgMood)}</span>
          <span style={{ 
            fontSize: '18px', 
            fontWeight: 700, 
            color: getMoodColor(data.avgMood) 
          }}>
            {data.avgMood.toFixed(1)} avg
          </span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--dark-gray)', marginTop: '4px' }}>
          {data.count} {data.count === 1 ? 'entry' : 'entries'}
        </p>
      </div>
    )
  }
  return null
}

export default function MoodHistoryViz({ entries }: MoodHistoryVizProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d')
  const [chartType, setChartType] = useState<ChartType>('area')
  const [activeTab, setActiveTab] = useState<'timeline' | 'patterns' | 'insights'>('timeline')

  // Filter entries by time range
  const filteredEntries = useMemo(() => {
    const now = new Date()
    let cutoffDate: Date

    switch (timeRange) {
      case '7d':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      default:
        cutoffDate = new Date(0)
    }

    return entries
      .filter(e => new Date(e.created_at) >= cutoffDate)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }, [entries, timeRange])

  // Prepare chart data
  const chartData = useMemo(() => {
    return filteredEntries.map(entry => ({
      ...entry,
      date: formatDate(entry.created_at),
      dayOfWeek: getDayOfWeek(entry.created_at),
      hour: getHourOfDay(entry.created_at)
    }))
  }, [filteredEntries])

  // Calculate day-of-week patterns
  const dayOfWeekData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const grouped: Record<string, { total: number; count: number }> = {}
    
    days.forEach(day => {
      grouped[day] = { total: 0, count: 0 }
    })

    filteredEntries.forEach(entry => {
      const day = getDayOfWeek(entry.created_at)
      grouped[day].total += entry.mood_score
      grouped[day].count++
    })

    return days.map(day => ({
      day,
      avgMood: grouped[day].count > 0 ? grouped[day].total / grouped[day].count : 0,
      count: grouped[day].count
    }))
  }, [filteredEntries])

  // Calculate time-of-day patterns
  const timeOfDayData = useMemo(() => {
    const periods = [
      { name: 'Morning', range: [5, 12], emoji: '🌅' },
      { name: 'Afternoon', range: [12, 17], emoji: '☀️' },
      { name: 'Evening', range: [17, 21], emoji: '🌆' },
      { name: 'Night', range: [21, 5], emoji: '🌙' }
    ]

    const grouped: Record<string, { total: number; count: number }> = {}
    periods.forEach(p => {
      grouped[p.name] = { total: 0, count: 0 }
    })

    filteredEntries.forEach(entry => {
      const hour = getHourOfDay(entry.created_at)
      let periodName = 'Night'
      
      if (hour >= 5 && hour < 12) periodName = 'Morning'
      else if (hour >= 12 && hour < 17) periodName = 'Afternoon'
      else if (hour >= 17 && hour < 21) periodName = 'Evening'

      grouped[periodName].total += entry.mood_score
      grouped[periodName].count++
    })

    return periods.map(p => ({
      period: p.name,
      emoji: p.emoji,
      avgMood: grouped[p.name].count > 0 ? grouped[p.name].total / grouped[p.name].count : 0,
      count: grouped[p.name].count
    }))
  }, [filteredEntries])

  // Calculate insights
  const insights = useMemo(() => {
    if (filteredEntries.length < 2) return null

    const avgMood = filteredEntries.reduce((sum, e) => sum + e.mood_score, 0) / filteredEntries.length
    const maxMood = Math.max(...filteredEntries.map(e => e.mood_score))
    const minMood = Math.min(...filteredEntries.map(e => e.mood_score))
    
    // Calculate trend
    const n = filteredEntries.length
    const xMean = (n - 1) / 2
    const yMean = avgMood
    let numerator = 0
    let denominator = 0
    
    filteredEntries.forEach((entry, i) => {
      numerator += (i - xMean) * (entry.mood_score - yMean)
      denominator += (i - xMean) ** 2
    })
    
    const slope = denominator !== 0 ? numerator / denominator : 0
    const trend = slope > 0.05 ? 'improving' : slope < -0.05 ? 'declining' : 'stable'

    // Find best and worst days
    const daysWithData = dayOfWeekData.filter(d => d.count > 0)
    const bestDay = daysWithData.length > 0 
      ? daysWithData.reduce((best, day) => day.avgMood > best.avgMood ? day : best)
      : null
    const worstDay = daysWithData.length > 0
      ? daysWithData.reduce((worst, day) => day.avgMood < worst.avgMood ? day : worst)
      : null

    // Find best time of day
    const timesWithData = timeOfDayData.filter(t => t.count > 0)
    const bestTime = timesWithData.length > 0
      ? timesWithData.reduce((best, time) => time.avgMood > best.avgMood ? time : best)
      : null

    // Calculate streak of good days (mood >= 6)
    let currentStreak = 0
    let maxStreak = 0
    const sortedByDate = [...filteredEntries].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    
    for (const entry of sortedByDate) {
      if (entry.mood_score >= 6) {
        currentStreak++
        maxStreak = Math.max(maxStreak, currentStreak)
      } else {
        break
      }
    }

    return {
      avgMood,
      maxMood,
      minMood,
      trend,
      bestDay: bestDay?.day || null,
      worstDay: worstDay?.day || null,
      bestTime,
      totalEntries: n,
      currentStreak,
      maxStreak
    }
  }, [filteredEntries, dayOfWeekData, timeOfDayData])

  // Empty state
  if (entries.length === 0) {
    return (
      <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--black)', marginBottom: '8px' }}>
          No mood data yet
        </h3>
        <p className="text-muted">
          Start logging your moods to see patterns and insights over time.
        </p>
      </div>
    )
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Header with tabs */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '16px',
        borderBottom: '1px solid var(--extra-light-gray)'
      }}>
        <h2 style={{ 
          fontSize: '18px', 
          fontWeight: 600, 
          color: 'var(--black)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '24px' }}>📈</span>
          Mood History
        </h2>
        
        {/* Tab navigation */}
        <div style={{ 
          display: 'flex', 
          gap: '4px', 
          background: 'var(--bg-gray)', 
          borderRadius: '8px', 
          padding: '4px' 
        }}>
          {[
            { key: 'timeline', label: 'Timeline' },
            { key: 'patterns', label: 'Patterns' },
            { key: 'insights', label: 'Insights' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                fontWeight: 500,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: activeTab === tab.key ? 'var(--white)' : 'transparent',
                color: activeTab === tab.key ? 'var(--primary)' : 'var(--dark-gray)',
                boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <div style={{ padding: '16px' }}>
          {/* Controls */}
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap',
            alignItems: 'center', 
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '16px'
          }}>
            {/* Time range selector */}
            <div style={{ 
              display: 'flex', 
              gap: '4px', 
              background: 'var(--bg-gray)', 
              borderRadius: '8px', 
              padding: '4px' 
            }}>
              {[
                { key: '7d', label: '7 Days' },
                { key: '30d', label: '30 Days' },
                { key: '90d', label: '90 Days' },
                { key: 'all', label: 'All' }
              ].map(range => (
                <button
                  key={range.key}
                  onClick={() => setTimeRange(range.key as TimeRange)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '13px',
                    fontWeight: 500,
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: timeRange === range.key ? 'var(--white)' : 'transparent',
                    color: timeRange === range.key ? 'var(--primary)' : 'var(--dark-gray)',
                    boxShadow: timeRange === range.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  {range.label}
                </button>
              ))}
            </div>

            {/* Chart type selector */}
            <div style={{ 
              display: 'flex', 
              gap: '4px', 
              background: 'var(--bg-gray)', 
              borderRadius: '8px', 
              padding: '4px' 
            }}>
              {[
                { key: 'area', icon: '〰️', title: 'Area chart' },
                { key: 'line', icon: '📈', title: 'Line chart' },
                { key: 'bar', icon: '📊', title: 'Bar chart' }
              ].map(type => (
                <button
                  key={type.key}
                  onClick={() => setChartType(type.key as ChartType)}
                  title={type.title}
                  style={{
                    padding: '6px 10px',
                    fontSize: '16px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: chartType === type.key ? 'var(--white)' : 'transparent',
                    opacity: chartType === type.key ? 1 : 0.5,
                    boxShadow: chartType === type.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  {type.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Main Chart */}
          <div style={{ height: '280px', width: '100%' }}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'area' ? (
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1da1f2" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#1da1f2" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e1e8ed" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: '#657786', fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: '#e1e8ed' }}
                    />
                    <YAxis 
                      domain={[0, 10]} 
                      ticks={[0, 2, 4, 6, 8, 10]}
                      tick={{ fill: '#657786', fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: '#e1e8ed' }}
                    />
                    <Tooltip content={<MoodTooltip />} />
                    <ReferenceLine y={5} stroke="#ffad1f" strokeDasharray="3 3" opacity={0.5} />
                    <Area 
                      type="monotone" 
                      dataKey="mood_score" 
                      stroke="#1da1f2" 
                      strokeWidth={2}
                      fill="url(#moodGradient)" 
                      dot={{ fill: '#1da1f2', strokeWidth: 2, r: 4, stroke: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </AreaChart>
                ) : chartType === 'line' ? (
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e1e8ed" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: '#657786', fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: '#e1e8ed' }}
                    />
                    <YAxis 
                      domain={[0, 10]} 
                      ticks={[0, 2, 4, 6, 8, 10]}
                      tick={{ fill: '#657786', fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: '#e1e8ed' }}
                    />
                    <Tooltip content={<MoodTooltip />} />
                    <ReferenceLine y={5} stroke="#ffad1f" strokeDasharray="3 3" opacity={0.5} />
                    <Line 
                      type="monotone" 
                      dataKey="mood_score" 
                      stroke="#1da1f2" 
                      strokeWidth={2}
                      dot={{ fill: '#1da1f2', strokeWidth: 2, r: 4, stroke: '#fff' }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e1e8ed" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: '#657786', fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: '#e1e8ed' }}
                    />
                    <YAxis 
                      domain={[0, 10]} 
                      ticks={[0, 2, 4, 6, 8, 10]}
                      tick={{ fill: '#657786', fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: '#e1e8ed' }}
                    />
                    <Tooltip content={<MoodTooltip />} />
                    <ReferenceLine y={5} stroke="#ffad1f" strokeDasharray="3 3" opacity={0.5} />
                    <Bar 
                      dataKey="mood_score" 
                      fill="#1da1f2"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div style={{ 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'var(--dark-gray)'
              }}>
                No data for selected time range
              </div>
            )}
          </div>

          {/* Quick stats */}
          {insights && (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(4, 1fr)', 
              gap: '12px',
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid var(--extra-light-gray)'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--primary)' }}>
                  {insights.avgMood.toFixed(1)}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--dark-gray)' }}>Average</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--success)' }}>
                  {insights.maxMood}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--dark-gray)' }}>Highest</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--danger)' }}>
                  {insights.minMood}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--dark-gray)' }}>Lowest</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--black)' }}>
                  {insights.totalEntries}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--dark-gray)' }}>Entries</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Patterns Tab */}
      {activeTab === 'patterns' && (
        <div style={{ padding: '16px' }}>
          {/* Day of Week Pattern */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ 
              fontSize: '14px', 
              fontWeight: 600, 
              color: 'var(--black)',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>📅</span> Day of Week Patterns
            </h3>
            <div style={{ height: '180px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dayOfWeekData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e1e8ed" />
                  <XAxis 
                    dataKey="day" 
                    tick={{ fill: '#657786', fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e1e8ed' }}
                  />
                  <YAxis 
                    domain={[0, 10]} 
                    ticks={[0, 5, 10]}
                    tick={{ fill: '#657786', fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e1e8ed' }}
                  />
                  <Tooltip content={<PatternTooltip />} />
                  <Bar 
                    dataKey="avgMood" 
                    fill="#1da1f2"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Time of Day Pattern */}
          <div>
            <h3 style={{ 
              fontSize: '14px', 
              fontWeight: 600, 
              color: 'var(--black)',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>🕐</span> Time of Day Patterns
            </h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(4, 1fr)', 
              gap: '12px' 
            }}>
              {timeOfDayData.map(period => (
                <div 
                  key={period.period}
                  style={{
                    background: 'var(--bg-gray)',
                    borderRadius: '12px',
                    padding: '16px',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: '4px' }}>{period.emoji}</div>
                  <div style={{ fontSize: '12px', color: 'var(--dark-gray)', marginBottom: '8px' }}>
                    {period.period}
                  </div>
                  {period.count > 0 ? (
                    <>
                      <div style={{ 
                        fontSize: '20px', 
                        fontWeight: 700,
                        color: getMoodColor(period.avgMood)
                      }}>
                        {period.avgMood.toFixed(1)}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--light-gray)' }}>
                        {period.count} {period.count === 1 ? 'entry' : 'entries'}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--light-gray)' }}>No data</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Insights Tab */}
      {activeTab === 'insights' && (
        <div style={{ padding: '16px' }}>
          {insights ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Trend Card */}
              <div style={{
                background: insights.trend === 'improving' ? 'rgba(23, 191, 99, 0.08)' :
                           insights.trend === 'declining' ? 'rgba(224, 36, 94, 0.08)' :
                           'var(--bg-gray)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ 
                  fontSize: '32px',
                  lineHeight: 1
                }}>
                  {insights.trend === 'improving' ? '📈' : 
                   insights.trend === 'declining' ? '📉' : '➡️'}
                </div>
                <div>
                  <div style={{ 
                    fontSize: '16px', 
                    fontWeight: 600, 
                    color: insights.trend === 'improving' ? 'var(--success)' :
                           insights.trend === 'declining' ? 'var(--danger)' :
                           'var(--black)'
                  }}>
                    {insights.trend === 'improving' ? 'Mood is improving!' :
                     insights.trend === 'declining' ? 'Mood trending down' :
                     'Mood is stable'}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--dark-gray)' }}>
                    Based on {insights.totalEntries} entries
                  </div>
                </div>
              </div>

              {/* Streak Card */}
              {insights.currentStreak > 0 && (
                <div style={{
                  background: 'rgba(29, 161, 242, 0.08)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{ fontSize: '32px', lineHeight: 1 }}>🔥</div>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--primary)' }}>
                      {insights.currentStreak} day streak!
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--dark-gray)' }}>
                      Consecutive days with mood 6+
                    </div>
                  </div>
                </div>
              )}

              {/* Best/Worst Days */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '12px' 
              }}>
                {insights.bestDay && (
                  <div style={{
                    background: 'var(--bg-gray)',
                    borderRadius: '12px',
                    padding: '16px'
                  }}>
                    <div style={{ 
                      fontSize: '12px', 
                      color: 'var(--dark-gray)', 
                      marginBottom: '4px' 
                    }}>
                      Best Day
                    </div>
                    <div style={{ 
                      fontSize: '18px', 
                      fontWeight: 600, 
                      color: 'var(--success)' 
                    }}>
                      {insights.bestDay}s 🎉
                    </div>
                  </div>
                )}
                {insights.worstDay && (
                  <div style={{
                    background: 'var(--bg-gray)',
                    borderRadius: '12px',
                    padding: '16px'
                  }}>
                    <div style={{ 
                      fontSize: '12px', 
                      color: 'var(--dark-gray)', 
                      marginBottom: '4px' 
                    }}>
                      Toughest Day
                    </div>
                    <div style={{ 
                      fontSize: '18px', 
                      fontWeight: 600, 
                      color: 'var(--warning)' 
                    }}>
                      {insights.worstDay}s 💪
                    </div>
                  </div>
                )}
              </div>

              {/* Best Time */}
              {insights.bestTime && insights.bestTime.count > 0 && (
                <div style={{
                  background: 'var(--bg-gray)',
                  borderRadius: '12px',
                  padding: '16px'
                }}>
                  <div style={{ 
                    fontSize: '12px', 
                    color: 'var(--dark-gray)', 
                    marginBottom: '4px' 
                  }}>
                    You feel best in the
                  </div>
                  <div style={{ 
                    fontSize: '18px', 
                    fontWeight: 600, 
                    color: 'var(--black)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span>{insights.bestTime.emoji}</span>
                    <span>{insights.bestTime.period}</span>
                    <span style={{ 
                      fontSize: '14px', 
                      color: 'var(--primary)', 
                      fontWeight: 500 
                    }}>
                      ({insights.bestTime.avgMood.toFixed(1)} avg)
                    </span>
                  </div>
                </div>
              )}

              {/* ADHD-specific tip based on patterns */}
              <div style={{
                background: 'rgba(29, 161, 242, 0.05)',
                borderLeft: '3px solid var(--primary)',
                borderRadius: '0 12px 12px 0',
                padding: '16px'
              }}>
                <div style={{ 
                  fontSize: '13px', 
                  fontWeight: 600, 
                  color: 'var(--primary)',
                  marginBottom: '4px'
                }}>
                  💡 ADHD Insight
                </div>
                <div style={{ fontSize: '14px', color: 'var(--dark-gray)', lineHeight: 1.5 }}>
                  {insights.trend === 'declining' 
                    ? "Your mood has been dipping. This is common with ADHD—consider checking if you've been overcommitting or missing rest. Small wins and breaks can help reverse the trend."
                    : insights.bestTime?.period === 'Morning'
                    ? "You seem to thrive in the morning! Try scheduling important tasks early when your focus is naturally stronger."
                    : insights.bestTime?.period === 'Night'
                    ? "You're a night owl! While that works for some ADHD brains, watch out for sleep debt affecting tomorrow's mood."
                    : "Keep tracking—patterns become clearer over time. You're building valuable self-awareness!"
                  }
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--black)', marginBottom: '8px' }}>
                Need more data
              </h3>
              <p className="text-muted">
                Log at least 2 moods to see insights and patterns.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
