'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import UnifiedHeader from '@/components/UnifiedHeader'
import FABToolbox from '@/components/FABToolbox'

// ===========================================
// Types
// ===========================================

interface Win {
  id: string
  type: 'completed_task' | 'completed_step' | 'check_in' | 'outcome' | 'weekly_win'
  label: string
  detail?: string
  time: string
  icon: string
}

interface WinGroup {
  label: string
  wins: Win[]
}

type TimeRange = 'today' | 'week' | 'month'

// ===========================================
// Main Page
// ===========================================

export default function WinsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<TimeRange>('week')
  const [winGroups, setWinGroups] = useState<WinGroup[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    loadWins()
  }, [timeRange])

  const loadWins = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    const userId = session.user.id
    const now = new Date()
    const rangeStart = new Date()

    if (timeRange === 'today') {
      rangeStart.setHours(0, 0, 0, 0)
    } else if (timeRange === 'week') {
      rangeStart.setDate(now.getDate() - 7)
      rangeStart.setHours(0, 0, 0, 0)
    } else {
      rangeStart.setDate(now.getDate() - 30)
      rangeStart.setHours(0, 0, 0, 0)
    }

    const allWins: Win[] = []

    // 1. Completed tasks (focus_plans with is_completed = true)
    const { data: completedTasks } = await supabase
      .from('focus_plans')
      .select('id, task_name, steps, updated_at, is_completed')
      .eq('user_id', userId)
      .eq('is_completed', true)
      .gte('updated_at', rangeStart.toISOString())
      .order('updated_at', { ascending: false })
      .limit(50)

    if (completedTasks) {
      completedTasks.forEach(task => {
        allWins.push({
          id: `task-${task.id}`,
          type: 'completed_task',
          label: task.task_name || 'Completed task',
          icon: '✅',
          time: task.updated_at,
        })
      })
    }

    // 2. Completed focus steps (from active tasks too)
    const { data: focusPlans } = await supabase
      .from('focus_plans')
      .select('id, task_name, steps, updated_at')
      .eq('user_id', userId)
      .eq('is_completed', false)
      .gte('updated_at', rangeStart.toISOString())
      .order('updated_at', { ascending: false })
      .limit(50)

    if (focusPlans) {
      focusPlans.forEach(plan => {
        const steps = plan.steps as Array<{ completed: boolean; text: string }> | null
        const completedSteps = steps?.filter(s => s.completed) || []
        completedSteps.forEach((s, i) => {
          allWins.push({
            id: `step-${plan.id}-${i}`,
            type: 'completed_step',
            label: s.text || 'Completed step',
            detail: plan.task_name,
            icon: '🎯',
            time: plan.updated_at,
          })
        })
      })
    }

    // 3. Check-ins (mood_entries)
    const { data: checkIns } = await supabase
      .from('mood_entries')
      .select('id, created_at, mood_score, breathing_completed')
      .eq('user_id', userId)
      .gte('created_at', rangeStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(30)

    if (checkIns) {
      checkIns.forEach(ci => {
        allWins.push({
          id: `checkin-${ci.id}`,
          type: 'check_in',
          label: 'Checked in with yourself',
          detail: ci.mood_score ? `Mood: ${ci.mood_score}/10${ci.breathing_completed ? ' + breathing' : ''}` : undefined,
          icon: '💚',
          time: ci.created_at,
        })
      })

      // Calculate check-in streak
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      let currentStreak = 0
      const checkDate = new Date(today)

      for (let d = 0; d < 30; d++) {
        const dayStart = new Date(checkDate)
        dayStart.setDate(checkDate.getDate() - d)
        dayStart.setHours(0, 0, 0, 0)
        const dayEnd = new Date(dayStart)
        dayEnd.setDate(dayStart.getDate() + 1)

        const hasCheckin = checkIns.some(ci => {
          const ciDate = new Date(ci.created_at)
          return ciDate >= dayStart && ciDate < dayEnd
        })

        if (hasCheckin) {
          currentStreak++
        } else if (d > 0) {
          break
        }
      }
      setStreak(currentStreak)
    }

    // 4. Completed outcomes
    const { data: completedOutcomes } = await supabase
      .from('outcomes')
      .select('id, title, horizon, updated_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('updated_at', rangeStart.toISOString())
      .order('updated_at', { ascending: false })

    if (completedOutcomes) {
      completedOutcomes.forEach(o => {
        allWins.push({
          id: `outcome-${o.id}`,
          type: 'outcome',
          label: o.title,
          detail: `${o.horizon} outcome completed`,
          icon: '🏆',
          time: o.updated_at,
        })
      })
    }

    // 5. Weekly plan wins
    const { data: weeklyPlans } = await supabase
      .from('weekly_plans')
      .select('id, wins, year, week_number, updated_at')
      .eq('user_id', userId)
      .gte('updated_at', rangeStart.toISOString())
      .order('updated_at', { ascending: false })
      .limit(4)

    if (weeklyPlans) {
      weeklyPlans.forEach(plan => {
        const planWins = plan.wins as string[] | null
        if (planWins && planWins.length > 0) {
          planWins.forEach((w, i) => {
            if (w.trim()) {
              allWins.push({
                id: `weekly-${plan.id}-${i}`,
                type: 'weekly_win',
                label: w,
                detail: `Week ${plan.week_number} reflection`,
                icon: '⭐',
                time: plan.updated_at,
              })
            }
          })
        }
      })
    }

    // Sort all wins by time, newest first
    allWins.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    setTotalCount(allWins.length)

    // Group wins by day
    const groups: Record<string, Win[]> = {}
    allWins.forEach(win => {
      const date = new Date(win.time)
      const today = new Date()
      const yesterday = new Date()
      yesterday.setDate(today.getDate() - 1)

      let dayLabel: string
      if (date.toDateString() === today.toDateString()) {
        dayLabel = 'Today'
      } else if (date.toDateString() === yesterday.toDateString()) {
        dayLabel = 'Yesterday'
      } else {
        dayLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
      }

      if (!groups[dayLabel]) groups[dayLabel] = []
      groups[dayLabel].push(win)
    })

    setWinGroups(Object.entries(groups).map(([label, wins]) => ({ label, wins })))
    setLoading(false)
  }

  // ===========================================
  // Render
  // ===========================================

  return (
    <div className="wins-page">
      <UnifiedHeader subtitle="Celebrate your progress" backPath="/dashboard" />

      <main className="main">
        {/* Header Section */}
        <div className="hero">
          <div className="hero-icon">🏆</div>
          <h1 className="hero-title">Your Wins</h1>
          <p className="hero-subtitle">
            Every step forward counts. Here&apos;s what you&apos;ve accomplished.
          </p>
        </div>

        {/* Stats Row */}
        {!loading && (
          <div className="stats-row">
            <div className="stat-card">
              <span className="stat-value">{totalCount}</span>
              <span className="stat-label">
                {timeRange === 'today' ? "Today's wins" : timeRange === 'week' ? 'This week' : 'This month'}
              </span>
            </div>
            {streak > 0 && (
              <div className="stat-card streak">
                <span className="stat-value">{streak}🔥</span>
                <span className="stat-label">Day check-in streak</span>
              </div>
            )}
          </div>
        )}

        {/* Time Range Picker */}
        <div className="range-picker">
          {(['today', 'week', 'month'] as TimeRange[]).map(range => (
            <button
              key={range}
              className={`range-btn ${timeRange === range ? 'active' : ''}`}
              onClick={() => setTimeRange(range)}
            >
              {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div className="loading-state">
            <div className="loading-icon">✨</div>
            <p>Gathering your wins...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && totalCount === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🌱</div>
            <h2 className="empty-title">No wins yet {timeRange === 'today' ? 'today' : `this ${timeRange}`}</h2>
            <p className="empty-subtitle">
              And that&apos;s okay. Every journey has quiet days.
              {timeRange === 'today' && ' Try checking in or starting a focus session.'}
            </p>
            <button className="empty-cta" onClick={() => router.push('/focus')}>
              Start a focus session
            </button>
          </div>
        )}

        {/* Win Groups */}
        {!loading && winGroups.map(group => (
          <div key={group.label} className="day-group">
            <h2 className="day-label">{group.label}</h2>
            <div className="wins-list">
              {group.wins.map(win => (
                <div key={win.id} className="win-card">
                  <span className="win-icon">{win.icon}</span>
                  <div className="win-content">
                    <span className="win-label">{win.label}</span>
                    {win.detail && <span className="win-detail">{win.detail}</span>}
                  </div>
                  <span className="win-time">
                    {new Date(win.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Motivation Footer */}
        {!loading && totalCount > 0 && (
          <div className="motivation">
            <p className="motivation-text">
              {totalCount >= 10
                ? "You're on fire! Keep this momentum going."
                : totalCount >= 5
                  ? 'Solid progress. Every win builds on the last.'
                  : "Small wins add up. You're moving forward."}
            </p>
          </div>
        )}
      </main>

      <FABToolbox mode="maintenance" />

      <style jsx>{styles}</style>
    </div>
  )
}

// ===========================================
// Styles
// ===========================================

const styles = `
  .wins-page {
    min-height: 100vh;
    min-height: 100dvh;
    background: linear-gradient(180deg, #0c4a1f 0%, #14532d 40%, #1a2e05 100%);
  }

  .main {
    max-width: 520px;
    margin: 0 auto;
    padding: clamp(16px, 4vw, 24px);
    padding-top: clamp(24px, 6vw, 40px);
    padding-bottom: 120px;
  }

  /* Hero */
  .hero {
    text-align: center;
    margin-bottom: clamp(24px, 6vw, 32px);
    animation: fadeIn 0.5s ease;
  }

  .hero-icon {
    font-size: clamp(48px, 12vw, 64px);
    margin-bottom: clamp(12px, 3vw, 16px);
  }

  .hero-title {
    font-size: clamp(28px, 7vw, 36px);
    font-weight: 700;
    color: white;
    margin: 0 0 clamp(8px, 2vw, 12px) 0;
  }

  .hero-subtitle {
    font-size: clamp(14px, 3.8vw, 16px);
    color: rgba(255, 255, 255, 0.65);
    margin: 0;
    line-height: 1.5;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Stats */
  .stats-row {
    display: flex;
    gap: clamp(10px, 2.5vw, 14px);
    margin-bottom: clamp(20px, 5vw, 28px);
    animation: fadeIn 0.5s ease 0.1s both;
  }

  .stat-card {
    flex: 1;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: clamp(12px, 3vw, 16px);
    padding: clamp(16px, 4vw, 20px);
    text-align: center;
  }

  .stat-card.streak {
    background: rgba(255, 165, 0, 0.15);
  }

  .stat-value {
    display: block;
    font-size: clamp(28px, 7vw, 36px);
    font-weight: 700;
    color: white;
    margin-bottom: 4px;
  }

  .stat-label {
    font-size: clamp(11px, 3vw, 13px);
    color: rgba(255, 255, 255, 0.55);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Range Picker */
  .range-picker {
    display: flex;
    background: rgba(255, 255, 255, 0.08);
    border-radius: clamp(10px, 2.5vw, 12px);
    padding: 4px;
    margin-bottom: clamp(24px, 6vw, 32px);
    animation: fadeIn 0.5s ease 0.2s both;
  }

  .range-btn {
    flex: 1;
    padding: clamp(10px, 2.5vw, 12px) clamp(12px, 3vw, 16px);
    background: transparent;
    border: none;
    border-radius: clamp(8px, 2vw, 10px);
    font-size: clamp(13px, 3.5vw, 14px);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .range-btn.active {
    background: rgba(255, 255, 255, 0.15);
    color: white;
  }

  .range-btn:hover:not(.active) {
    color: rgba(255, 255, 255, 0.75);
  }

  /* Loading */
  .loading-state {
    text-align: center;
    padding: clamp(40px, 10vw, 60px) 0;
    animation: fadeIn 0.5s ease;
  }

  .loading-icon {
    font-size: clamp(40px, 10vw, 56px);
    margin-bottom: 16px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .loading-state p {
    color: rgba(255, 255, 255, 0.6);
    font-size: clamp(14px, 3.8vw, 16px);
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }

  /* Empty State */
  .empty-state {
    text-align: center;
    padding: clamp(32px, 8vw, 48px) clamp(16px, 4vw, 24px);
    background: rgba(255, 255, 255, 0.05);
    border-radius: clamp(16px, 4vw, 24px);
    animation: fadeIn 0.5s ease 0.3s both;
  }

  .empty-icon {
    font-size: clamp(48px, 12vw, 64px);
    margin-bottom: clamp(12px, 3vw, 16px);
  }

  .empty-title {
    font-size: clamp(18px, 5vw, 22px);
    font-weight: 600;
    color: white;
    margin: 0 0 clamp(8px, 2vw, 12px) 0;
  }

  .empty-subtitle {
    font-size: clamp(14px, 3.8vw, 16px);
    color: rgba(255, 255, 255, 0.55);
    margin: 0 0 clamp(20px, 5vw, 28px) 0;
    line-height: 1.5;
  }

  .empty-cta {
    padding: clamp(12px, 3vw, 16px) clamp(24px, 6vw, 32px);
    background: rgba(255, 255, 255, 0.15);
    border: 2px solid rgba(255, 255, 255, 0.25);
    border-radius: clamp(10px, 2.5vw, 12px);
    color: white;
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .empty-cta:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.4);
  }

  /* Day Groups */
  .day-group {
    margin-bottom: clamp(24px, 6vw, 32px);
    animation: fadeIn 0.5s ease 0.3s both;
  }

  .day-label {
    font-size: clamp(13px, 3.5vw, 14px);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 clamp(10px, 2.5vw, 14px) 0;
  }

  .wins-list {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 2vw, 10px);
  }

  .win-card {
    display: flex;
    align-items: center;
    gap: clamp(10px, 2.5vw, 14px);
    padding: clamp(14px, 3.5vw, 18px);
    background: rgba(255, 255, 255, 0.08);
    border-radius: clamp(12px, 3vw, 16px);
    backdrop-filter: blur(10px);
    transition: transform 0.15s ease, background 0.15s ease;
  }

  .win-card:hover {
    transform: translateX(4px);
    background: rgba(255, 255, 255, 0.12);
  }

  .win-icon {
    font-size: clamp(20px, 5.5vw, 26px);
    flex-shrink: 0;
    width: clamp(36px, 9vw, 44px);
    height: clamp(36px, 9vw, 44px);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
  }

  .win-content {
    flex: 1;
    min-width: 0;
  }

  .win-label {
    display: block;
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 500;
    color: white;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .win-detail {
    display: block;
    font-size: clamp(11px, 3vw, 13px);
    color: rgba(255, 255, 255, 0.45);
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .win-time {
    font-size: clamp(11px, 3vw, 12px);
    color: rgba(255, 255, 255, 0.35);
    flex-shrink: 0;
    white-space: nowrap;
  }

  /* Motivation Footer */
  .motivation {
    text-align: center;
    padding: clamp(24px, 6vw, 32px) 0;
    animation: fadeIn 0.5s ease 0.5s both;
  }

  .motivation-text {
    font-size: clamp(14px, 3.8vw, 16px);
    color: rgba(255, 255, 255, 0.5);
    font-style: italic;
    margin: 0;
    line-height: 1.5;
  }
`
