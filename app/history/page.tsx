'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import MoodHistoryViz from '@/components/MoodHistoryViz'
import UnifiedHeader from '@/components/UnifiedHeader'
import FABToolbox from '@/components/FABToolbox'
import ProgressiveCard from '@/components/adhd/ProgressiveCard'
import { useUserStats, getLevelProgress } from '@/context/UserStatsContext'
import { getMoodEmoji } from '@/lib/utils/ui-helpers'

interface MoodEntry {
  id: string
  mood_score: number
  note: string | null
  coach_advice: string | null
  created_at: string
}

interface CompletedPlan {
  id: string
  task_name: string
  created_at: string
  related_goal_id: string | null
  steps: Array<{ id: string; text: string; completed: boolean }>
}

interface GoalInfo {
  id: string
  title: string
}

interface DateGroup {
  label: string
  goalGroups: Array<{
    goalId: string | null
    goalTitle: string
    items: CompletedPlan[]
  }>
}

function groupPlansByDateAndGoal(plans: CompletedPlan[], goals: GoalInfo[]): DateGroup[] {
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()

  const dateMap = new Map<string, CompletedPlan[]>()
  for (const plan of plans) {
    const dateStr = new Date(plan.created_at).toDateString()
    if (!dateMap.has(dateStr)) dateMap.set(dateStr, [])
    dateMap.get(dateStr)!.push(plan)
  }

  const result: DateGroup[] = []
  for (const [dateStr, items] of dateMap) {
    let label: string
    if (dateStr === today) label = 'Today'
    else if (dateStr === yesterday) label = 'Yesterday'
    else {
      label = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    }

    const goalMap = new Map<string, CompletedPlan[]>()
    for (const item of items) {
      const key = item.related_goal_id || '__orphan__'
      if (!goalMap.has(key)) goalMap.set(key, [])
      goalMap.get(key)!.push(item)
    }

    const goalGroups = Array.from(goalMap.entries()).map(([key, groupPlans]) => {
      const goal = key !== '__orphan__' ? goals.find(g => g.id === key) : null
      return {
        goalId: key === '__orphan__' ? null : key,
        goalTitle: goal?.title || 'Maintenance / Chores',
        items: groupPlans,
      }
    })

    goalGroups.sort((a, b) => {
      if (a.goalId && !b.goalId) return -1
      if (!a.goalId && b.goalId) return 1
      return 0
    })

    result.push({ label, goalGroups })
  }

  return result
}

export default function HistoryPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<MoodEntry[]>([])
  const [stats, setStats] = useState({
    total: 0,
    average: 0,
    highest: 0,
    lowest: 10,
    weeklyAvg: 0,
    monthlyAvg: 0
  })

  // Growth Feed state
  const [completedPlans, setCompletedPlans] = useState<CompletedPlan[]>([])
  const [goalInfos, setGoalInfos] = useState<GoalInfo[]>([])

  // Online count for AppHeader
  const [onlineCount] = useState(() => Math.floor(Math.random() * 51)) // 0-50

  // XP bar (relocated from header for less visual noise)
  const { userStats, loading: statsLoading } = useUserStats()
  const levelProgress = userStats ? getLevelProgress(userStats) : null

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      await fetchHistory(session.user.id)
      setLoading(false)
    }
    init()
  }, [router])

  const fetchHistory = async (userId: string) => {
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const { data } = await supabase
      .from('mood_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', ninetyDaysAgo.toISOString())
      .order('created_at', { ascending: false })

    if (data) {
      setEntries(data)
      if (data.length > 0) {
        const scores = data.map(e => e.mood_score)
        const oneWeekAgo = new Date()
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
        const oneMonthAgo = new Date()
        oneMonthAgo.setDate(oneMonthAgo.getDate() - 30)

        const weekEntries = data.filter(e => new Date(e.created_at) >= oneWeekAgo)
        const monthEntries = data.filter(e => new Date(e.created_at) >= oneMonthAgo)

        setStats({
          total: data.length,
          average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10,
          highest: Math.max(...scores),
          lowest: Math.min(...scores),
          weeklyAvg: weekEntries.length > 0
            ? Math.round(weekEntries.reduce((a, e) => a + e.mood_score, 0) / weekEntries.length * 10) / 10
            : 0,
          monthlyAvg: monthEntries.length > 0
            ? Math.round(monthEntries.reduce((a, e) => a + e.mood_score, 0) / monthEntries.length * 10) / 10
            : 0
        })
      }
    }

    // Fetch completed focus plans for Growth Feed
    const { data: planData } = await supabase
      .from('focus_plans')
      .select('id, task_name, created_at, related_goal_id, steps')
      .eq('user_id', userId)
      .eq('is_completed', true)
      .gte('created_at', ninetyDaysAgo.toISOString())
      .order('created_at', { ascending: false })

    if (planData) {
      setCompletedPlans(planData as CompletedPlan[])

      // Fetch goal details for any plans linked to goals
      const goalIds = [...new Set(planData.map(p => p.related_goal_id).filter(Boolean))] as string[]
      if (goalIds.length > 0) {
        const { data: goalData } = await supabase
          .from('goals')
          .select('id, title')
          .in('id', goalIds)
        if (goalData) setGoalInfos(goalData as GoalInfo[])
      }
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  // Phase 3: Clinical Bridge - Export data for therapist/doctor
  const handleExport = () => {
    if (entries.length === 0) return

    // CSV Header
    const headers = ['Date', 'Mood Score', 'Note', 'Coach Advice']
    
    // Convert entries to CSV rows
    const rows = entries.map(entry => {
      const date = new Date(entry.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
      
      // Escape quotes and wrap in quotes if contains comma or newline
      const escapeCSV = (str: string | null) => {
        if (!str) return ''
        const escaped = str.replace(/"/g, '""')
        if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
          return `"${escaped}"`
        }
        return escaped
      }
      
      return [
        date,
        entry.mood_score,
        escapeCSV(entry.note),
        escapeCSV(entry.coach_advice)
      ].join(',')
    })
    
    // Combine header and rows
    const csvContent = [headers.join(','), ...rows].join('\n')
    
    // Create blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    
    // Generate filename with current date
    const today = new Date().toISOString().split('T')[0]
    link.setAttribute('href', url)
    link.setAttribute('download', `ADHDer_Report_${today}.csv`)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Clean up
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="history-page">
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    )
  }

  return (
    <div className="history-page">
      <UnifiedHeader subtitle="Your journey" />

      <main className="main">
        {/* Page Title with Export Button */}
        <div className="page-header-title">
          <h1>📊 Mood Insights</h1>
          {entries.length > 0 && (
            <button onClick={handleExport} className="btn-export">
              📥 Export for Doctor
            </button>
          )}
        </div>

        {/* XP Progress (relocated from header) */}
        {!statsLoading && userStats && levelProgress && (
          <div className="xp-card">
            <span className="xp-card-badge">Lv {userStats.current_level}</span>
            <div className="xp-card-track">
              <div className="xp-card-fill" style={{ width: `${levelProgress.progress}%` }} />
            </div>
            <span className="xp-card-text">{levelProgress.xpInLevel} / {levelProgress.xpNeeded} XP</span>
          </div>
        )}

        {/* Phase 2: Weekly Narrative Card (replaces stats-grid) */}
        {stats.total > 0 && (
          <ProgressiveCard
            id="weekly-summary"
            title="Weekly Summary"
            icon={stats.weeklyAvg < 4.5 ? '🫂' : stats.weeklyAvg > 7.5 ? '🚀' : '⚖️'}
            preview={`Week avg: ${stats.weeklyAvg.toFixed(1)}/10`}
            defaultExpanded={false}
          >
            <div className={`narrative-card ${
              stats.weeklyAvg < 4.5 ? 'recovery' :
              stats.weeklyAvg > 7.5 ? 'growth' :
              'maintenance'
            }`}>
              <div className="narrative-header">
                <span className="narrative-icon">
                  {stats.weeklyAvg < 4.5 ? '🫂' : stats.weeklyAvg > 7.5 ? '🚀' : '⚖️'}
                </span>
                <div className="narrative-titles">
                  <h2 className="narrative-title">
                    {stats.weeklyAvg < 4.5
                      ? 'Recovery Pattern Detected'
                      : stats.weeklyAvg > 7.5
                      ? 'High Momentum Week'
                      : 'Steady Baseline'}
                  </h2>
                  <p className="narrative-subtitle">Weekly Report</p>
                </div>
                <div className="narrative-score">
                  <span className="score-value">{stats.weeklyAvg.toFixed(1)}</span>
                  <span className="score-label">avg</span>
                </div>
              </div>
              <p className="narrative-text">
                {stats.weeklyAvg < 4.5
                  ? `This week has been heavy. You've faced some tough days, but showing up matters. Consider using BREAK more often.`
                  : stats.weeklyAvg > 7.5
                  ? `You're trending upward! Great job maintaining energy. This is a good time to tackle meaningful goals.`
                  : `You held your ground this week. Consistency is the goal — you're building sustainable habits.`}
              </p>
              <div className="narrative-stats">
                <div className="mini-stat">
                  <span className="mini-label">Month Avg</span>
                  <span className="mini-value">{stats.monthlyAvg.toFixed(1)}</span>
                </div>
                <div className="mini-stat">
                  <span className="mini-label">Best</span>
                  <span className="mini-value">{stats.highest}</span>
                </div>
                <div className="mini-stat">
                  <span className="mini-label">Low</span>
                  <span className="mini-value">{stats.lowest}</span>
                </div>
                <div className="mini-stat">
                  <span className="mini-label">Check-ins</span>
                  <span className="mini-value">{stats.total}</span>
                </div>
              </div>
            </div>
          </ProgressiveCard>
        )}

        {/* Impact Metric */}
        {(() => {
          const oneWeekAgo = new Date()
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
          const weekPlans = completedPlans.filter(p => new Date(p.created_at) >= oneWeekAgo)
          const uniqueGoalIds = new Set(weekPlans.map(p => p.related_goal_id).filter(Boolean))
          const goalCount = uniqueGoalIds.size
          const taskCount = weekPlans.length
          if (taskCount === 0) return null
          return (
            <div className="impact-card">
              <div className="impact-icon">🌱</div>
              <div className="impact-text">
                {goalCount > 0
                  ? <>You nurtured <strong>{goalCount} Goal{goalCount !== 1 ? 's' : ''}</strong> this week across <strong>{taskCount}</strong> completed task{taskCount !== 1 ? 's' : ''}</>
                  : <>You completed <strong>{taskCount}</strong> task{taskCount !== 1 ? 's' : ''} this week</>}
              </div>
            </div>
          )
        })()}

        {/* Growth Feed */}
        {completedPlans.length > 0 && (
          <ProgressiveCard
            id="growth-feed"
            title="Growth Feed"
            icon="🌿"
            preview={`${completedPlans.length} completed task${completedPlans.length !== 1 ? 's' : ''}`}
            defaultExpanded={true}
          >
            <div className="growth-feed">
              {groupPlansByDateAndGoal(completedPlans, goalInfos).map((dateGroup) => (
                <div key={dateGroup.label} className="gf-date-group">
                  <div className="gf-date-label">{dateGroup.label}</div>
                  {dateGroup.goalGroups.map((goalGroup) => (
                    <div
                      key={goalGroup.goalId || '__orphan__'}
                      className={`gf-goal-card ${goalGroup.goalId ? 'linked' : 'orphan'}`}
                    >
                      <div className="gf-goal-header">
                        <span className="gf-goal-icon">{goalGroup.goalId ? '🎯' : '🔧'}</span>
                        <span className="gf-goal-title">{goalGroup.goalTitle}</span>
                        <span className="gf-goal-count">{goalGroup.items.length}</span>
                      </div>
                      <div className="gf-items">
                        {goalGroup.items.map((plan) => (
                          <div key={plan.id} className="gf-item">
                            <span className="gf-item-check">✓</span>
                            <span className="gf-item-name">{plan.task_name}</span>
                            <span className="gf-item-steps">
                              {plan.steps.length} step{plan.steps.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </ProgressiveCard>
        )}

        {/* Charts */}
        <ProgressiveCard
          id="mood-charts"
          title="Charts & Visualizations"
          icon="📈"
          preview="View trends over time"
          defaultExpanded={false}
        >
          <div className="charts-card-inner">
            <MoodHistoryViz entries={entries} />
          </div>
        </ProgressiveCard>

        {/* Phase 4: Timeline Feed (replaces entries-card) */}
        {entries.length === 0 ? (
          <div className="empty-state-card">
            <p>No check-ins yet</p>
            <button onClick={() => router.push('/dashboard')} className="cta-btn">
              Log your first mood
            </button>
          </div>
        ) : (
          <ProgressiveCard
            id="all-check-ins"
            title="All Check-ins"
            preview={`${stats.total} check-ins`}
            defaultExpanded={false}
          >
            <div className="timeline-feed">
              {entries.map((entry) => (
                <div key={entry.id} className="timeline-item">
                  {/* Tweet-style layout: Avatar left, content right */}
                  <div className="timeline-avatar">
                    <span className="timeline-emoji">{getMoodEmoji(entry.mood_score)}</span>
                  </div>
                  
                  <div className="timeline-body">
                    <div className="timeline-meta">
                      <span className="timeline-score">{entry.mood_score}/10</span>
                      <span className="timeline-dot">·</span>
                      <span className="timeline-time">{formatDate(entry.created_at)}</span>
                    </div>
                    
                    {entry.note && (
                      <p className="timeline-note">{entry.note}</p>
                    )}
                    
                    {/* Coach advice bubble (reply style) */}
                    {entry.coach_advice && (
                      <div className="timeline-coach-bubble">
                        <span className="coach-bubble-label">Der's advice</span>
                        <p className="coach-bubble-text">{entry.coach_advice}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ProgressiveCard>
        )}
      </main>

      <FABToolbox mode="maintenance" />

      <style jsx>{styles}</style>
    </div>
  )
}

// ============================================
// RESPONSIVE STYLES
// ============================================
const styles = `
  .history-page {
    --primary: #1D9BF0;
    --success: #00ba7c;
    --bg-gray: #f7f9fa;
    --dark-gray: #536471;
    --light-gray: #8899a6;

    background: var(--bg-gray);
    min-height: 100vh;
    min-height: 100dvh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  /* ===== LOADING ===== */
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    min-height: 100dvh;
    color: var(--light-gray);
  }

  .spinner {
    width: clamp(24px, 5vw, 32px);
    height: clamp(24px, 5vw, 32px);
    border: 3px solid var(--primary);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 12px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ===== HEADER ===== */
  .header {
    position: sticky;
    top: 0;
    background: white;
    border-bottom: 1px solid #eee;
    padding: clamp(10px, 2.5vw, 14px) clamp(12px, 4vw, 20px);
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 100;
  }

  .logo {
    background: none;
    border: none;
    cursor: pointer;
    font-size: clamp(16px, 4vw, 20px);
    font-weight: 800;
    color: var(--primary);
  }

  .header-actions {
    display: flex;
    gap: clamp(6px, 2vw, 10px);
  }

  .icon-btn {
    width: clamp(32px, 8vw, 42px);
    height: clamp(32px, 8vw, 42px);
    border-radius: 50%;
    border: none;
    cursor: pointer;
    font-size: clamp(14px, 3.5vw, 18px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-btn.purple { background: rgba(128, 90, 213, 0.1); }
  .icon-btn.red { background: rgba(239, 68, 68, 0.1); }
  .icon-btn.menu {
    background: white;
    border: 1px solid #ddd;
    font-size: clamp(12px, 3vw, 16px);
  }

  /* ===== PHASE 1: VILLAGE PRESENCE PILL ===== */
  .village-pill {
    display: flex;
    align-items: center;
    gap: clamp(5px, 1.5vw, 8px);
    padding: clamp(4px, 1.2vw, 6px) clamp(8px, 2.5vw, 12px);
    background: rgba(0, 186, 124, 0.08);
    border: 1px solid rgba(0, 186, 124, 0.2);
    border-radius: 100px;
  }

  .presence-dot {
    width: clamp(6px, 1.8vw, 8px);
    height: clamp(6px, 1.8vw, 8px);
    background: var(--success);
    border-radius: 50%;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      box-shadow: 0 0 0 0 rgba(0, 186, 124, 0.4);
    }
    50% {
      opacity: 0.6;
      box-shadow: 0 0 0 4px rgba(0, 186, 124, 0);
    }
  }

  .presence-count {
    font-size: clamp(10px, 2.8vw, 12px);
    font-weight: 600;
    color: var(--success);
  }

  .dropdown-menu {
    position: absolute;
    top: clamp(50px, 12vw, 60px);
    right: clamp(12px, 4vw, 20px);
    background: white;
    border-radius: clamp(10px, 2.5vw, 14px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    padding: clamp(6px, 1.5vw, 10px);
    min-width: clamp(140px, 40vw, 180px);
    z-index: 200;
  }

  .menu-item {
    display: block;
    width: 100%;
    padding: clamp(8px, 2.5vw, 12px) clamp(10px, 3vw, 14px);
    text-align: left;
    background: none;
    border: none;
    border-radius: clamp(6px, 1.5vw, 10px);
    cursor: pointer;
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
  }

  .menu-item:hover { background: var(--bg-gray); }
  .menu-item.logout { color: #ef4444; }
  .menu-divider { border-top: 1px solid #eee; margin: 8px 0; }
  .menu-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 99;
  }

  /* ===== MAIN CONTENT ===== */
  .main {
    padding: clamp(12px, 4vw, 20px);
    padding-bottom: clamp(16px, 4vw, 24px);
    max-width: 600px;
    margin: 0 auto;
  }

  .page-header-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: clamp(14px, 4vw, 20px);
  }

  .page-header-title h1 {
    font-size: clamp(22px, 6vw, 28px);
    font-weight: 700;
    margin: 0;
  }

  /* Phase 3: Export Button */
  .btn-export {
    display: flex;
    align-items: center;
    gap: clamp(4px, 1vw, 6px);
    padding: clamp(6px, 2vw, 10px) clamp(10px, 3vw, 14px);
    background: white;
    border: 1px solid #ddd;
    border-radius: clamp(8px, 2vw, 12px);
    font-size: clamp(11px, 3vw, 13px);
    font-weight: 600;
    color: var(--dark-gray);
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .btn-export:hover {
    background: var(--bg-gray);
    border-color: var(--primary);
    color: var(--primary);
  }

  .btn-export:active {
    transform: scale(0.98);
  }

  .card {
    background: white;
    border-radius: clamp(12px, 3vw, 18px);
    overflow: hidden;
  }

  /* ===== XP PROGRESS CARD (relocated from header) ===== */
  .xp-card {
    display: flex;
    align-items: center;
    gap: clamp(8px, 2vw, 12px);
    background: white;
    border-radius: clamp(12px, 3vw, 16px);
    padding: clamp(12px, 3.5vw, 16px) clamp(16px, 4.5vw, 22px);
    margin-bottom: clamp(14px, 4vw, 20px);
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }

  .xp-card-badge {
    font-size: clamp(11px, 3vw, 13px);
    font-weight: 700;
    color: white;
    background: linear-gradient(135deg, #1D9BF0 0%, #1a8cd8 100%);
    padding: clamp(2px, 0.5vw, 4px) clamp(8px, 2vw, 12px);
    border-radius: 100px;
    white-space: nowrap;
    letter-spacing: 0.3px;
    text-transform: uppercase;
  }

  .xp-card-track {
    flex: 1;
    height: 6px;
    background: #e5e7eb;
    border-radius: 100px;
    overflow: hidden;
  }

  .xp-card-fill {
    height: 100%;
    background: linear-gradient(90deg, #00ba7c 0%, #22c55e 100%);
    border-radius: 100px;
    transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .xp-card-text {
    font-size: clamp(11px, 3vw, 13px);
    font-weight: 600;
    color: var(--light-gray);
    white-space: nowrap;
  }

  /* ===== PHASE 2: NARRATIVE CARD ===== */
  .narrative-card {
    background: white;
    border-radius: clamp(14px, 4vw, 20px);
    padding: clamp(18px, 5vw, 26px);
    margin-bottom: clamp(14px, 4vw, 22px);
    border: 1px solid;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  }

  .narrative-card.recovery {
    background: rgba(244, 33, 46, 0.04);
    border-color: rgba(244, 33, 46, 0.15);
  }

  .narrative-card.growth {
    background: rgba(0, 186, 124, 0.04);
    border-color: rgba(0, 186, 124, 0.15);
  }

  .narrative-card.maintenance {
    background: rgba(29, 155, 240, 0.04);
    border-color: rgba(29, 155, 240, 0.15);
  }

  .narrative-header {
    display: flex;
    align-items: flex-start;
    gap: clamp(12px, 3.5vw, 16px);
    margin-bottom: clamp(14px, 4vw, 18px);
  }

  .narrative-icon {
    font-size: clamp(32px, 9vw, 44px);
    flex-shrink: 0;
  }

  .narrative-titles {
    flex: 1;
  }

  .narrative-title {
    font-size: clamp(16px, 4.5vw, 20px);
    font-weight: 700;
    margin: 0 0 clamp(2px, 0.5vw, 4px) 0;
    color: var(--text-dark, #0f1419);
  }

  .narrative-card.recovery .narrative-title {
    color: #dc2626;
  }

  .narrative-card.growth .narrative-title {
    color: #059669;
  }

  .narrative-card.maintenance .narrative-title {
    color: var(--primary);
  }

  .narrative-subtitle {
    font-size: clamp(11px, 3vw, 13px);
    color: var(--light-gray);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .narrative-score {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: white;
    border-radius: clamp(10px, 2.5vw, 14px);
    padding: clamp(8px, 2.5vw, 12px) clamp(12px, 3.5vw, 18px);
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }

  .score-value {
    font-size: clamp(22px, 6.5vw, 30px);
    font-weight: 800;
    line-height: 1;
  }

  .narrative-card.recovery .score-value {
    color: #dc2626;
  }

  .narrative-card.growth .score-value {
    color: #059669;
  }

  .narrative-card.maintenance .score-value {
    color: var(--primary);
  }

  .score-label {
    font-size: clamp(10px, 2.8vw, 12px);
    color: var(--light-gray);
    text-transform: uppercase;
  }

  .narrative-text {
    font-size: clamp(14px, 3.8vw, 16px);
    color: var(--dark-gray);
    line-height: 1.6;
    margin: 0 0 clamp(16px, 4.5vw, 22px) 0;
  }

  .narrative-stats {
    display: flex;
    justify-content: space-between;
    padding-top: clamp(14px, 4vw, 18px);
    border-top: 1px solid rgba(0,0,0,0.06);
  }

  .mini-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(2px, 0.5vw, 4px);
  }

  .mini-label {
    font-size: clamp(9px, 2.5vw, 11px);
    color: var(--light-gray);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .mini-value {
    font-size: clamp(14px, 4vw, 18px);
    font-weight: 700;
    color: var(--dark-gray);
  }

  /* ===== CHARTS ===== */
  .charts-card {
    padding: clamp(12px, 4vw, 20px);
    margin-bottom: clamp(14px, 4vw, 22px);
  }

  /* ===== PHASE 4: TIMELINE FEED ===== */
  .timeline-section {
    margin-bottom: clamp(14px, 4vw, 22px);
  }

  .timeline-header {
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 600;
    color: var(--dark-gray);
    margin: 0 0 clamp(12px, 3.5vw, 16px) 0;
    padding-left: clamp(4px, 1vw, 8px);
  }

  .empty-state-card {
    background: white;
    border-radius: clamp(14px, 4vw, 20px);
    padding: clamp(30px, 8vw, 50px) clamp(16px, 4vw, 24px);
    text-align: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }

  .empty-state-card p {
    color: var(--light-gray);
    font-size: clamp(14px, 3.8vw, 16px);
    margin: 0 0 clamp(14px, 4vw, 20px) 0;
  }

  .cta-btn {
    background: var(--primary);
    color: white;
    border: none;
    border-radius: clamp(8px, 2vw, 12px);
    padding: clamp(10px, 3vw, 14px) clamp(18px, 5vw, 28px);
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 600;
    cursor: pointer;
  }

  .timeline-feed {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 3.5vw, 16px);
  }

  .timeline-item {
    display: flex;
    gap: clamp(12px, 3.5vw, 16px);
    padding: clamp(16px, 4.5vw, 22px);
    background: white;
    border-radius: clamp(14px, 4vw, 20px);
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    border: 1px solid rgba(0,0,0,0.04);
  }

  .timeline-avatar {
    flex-shrink: 0;
    width: clamp(40px, 11vw, 52px);
    height: clamp(40px, 11vw, 52px);
    background: var(--bg-gray);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .timeline-emoji {
    font-size: clamp(22px, 6vw, 28px);
  }

  .timeline-body {
    flex: 1;
    min-width: 0;
  }

  .timeline-meta {
    display: flex;
    align-items: center;
    gap: clamp(6px, 1.5vw, 8px);
    margin-bottom: clamp(6px, 1.5vw, 10px);
  }

  .timeline-score {
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 700;
    color: var(--text-dark, #0f1419);
  }

  .timeline-dot {
    color: var(--light-gray);
    font-size: clamp(10px, 2.5vw, 12px);
  }

  .timeline-time {
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--light-gray);
  }

  .timeline-note {
    font-size: clamp(14px, 3.8vw, 16px);
    color: var(--dark-gray);
    line-height: 1.5;
    margin: 0 0 clamp(10px, 3vw, 14px) 0;
    word-wrap: break-word;
  }

  /* Coach advice bubble (reply style) */
  .timeline-coach-bubble {
    background: linear-gradient(135deg, rgba(29, 155, 240, 0.08) 0%, rgba(29, 155, 240, 0.03) 100%);
    border-left: 3px solid var(--primary);
    border-radius: 0 clamp(10px, 2.5vw, 14px) clamp(10px, 2.5vw, 14px) 0;
    padding: clamp(10px, 3vw, 14px);
    margin-top: clamp(8px, 2vw, 12px);
  }

  .coach-bubble-label {
    font-size: clamp(10px, 2.8vw, 12px);
    font-weight: 600;
    color: var(--primary);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    display: block;
    margin-bottom: clamp(4px, 1vw, 6px);
  }

  .coach-bubble-text {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    line-height: 1.5;
    margin: 0;
  }


  /* ===== IMPACT CARD ===== */
  .impact-card {
    display: flex;
    align-items: center;
    gap: clamp(10px, 3vw, 14px);
    background: linear-gradient(135deg, rgba(0, 186, 124, 0.08) 0%, rgba(0, 186, 124, 0.03) 100%);
    border: 1px solid rgba(0, 186, 124, 0.2);
    border-radius: clamp(12px, 3vw, 16px);
    padding: clamp(14px, 4vw, 18px);
    margin-bottom: clamp(14px, 4vw, 20px);
  }

  .impact-icon {
    font-size: clamp(24px, 7vw, 32px);
    flex-shrink: 0;
  }

  .impact-text {
    font-size: clamp(14px, 3.8vw, 16px);
    color: #536471;
    line-height: 1.5;
  }

  .impact-text strong {
    color: #059669;
    font-weight: 700;
  }

  /* ===== GROWTH FEED ===== */
  .growth-feed {
    display: flex;
    flex-direction: column;
    gap: clamp(16px, 4.5vw, 22px);
  }

  .gf-date-group {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 2.5vw, 12px);
  }

  .gf-date-label {
    font-size: clamp(12px, 3.2vw, 14px);
    font-weight: 700;
    color: #8899a6;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding-left: clamp(2px, 0.5vw, 4px);
  }

  .gf-goal-card {
    background: white;
    border-radius: clamp(10px, 2.5vw, 14px);
    border: 1px solid rgba(0, 0, 0, 0.06);
    overflow: hidden;
  }

  .gf-goal-card.linked {
    border-left: 3px solid #00ba7c;
  }

  .gf-goal-card.orphan {
    border-left: 3px solid #8899a6;
  }

  .gf-goal-header {
    display: flex;
    align-items: center;
    gap: clamp(6px, 2vw, 10px);
    padding: clamp(10px, 3vw, 14px) clamp(12px, 3.5vw, 16px);
    background: rgba(0, 0, 0, 0.015);
    border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  }

  .gf-goal-icon {
    font-size: clamp(14px, 3.8vw, 18px);
  }

  .gf-goal-title {
    flex: 1;
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 600;
    color: #0f1419;
  }

  .gf-goal-count {
    font-size: clamp(11px, 3vw, 13px);
    font-weight: 600;
    color: #8899a6;
    background: rgba(0, 0, 0, 0.04);
    border-radius: 100px;
    padding: 2px 8px;
  }

  .gf-items {
    display: flex;
    flex-direction: column;
  }

  .gf-item {
    display: flex;
    align-items: center;
    gap: clamp(8px, 2.5vw, 12px);
    padding: clamp(10px, 3vw, 13px) clamp(12px, 3.5vw, 16px);
    border-bottom: 1px solid rgba(0, 0, 0, 0.03);
  }

  .gf-item:last-child {
    border-bottom: none;
  }

  .gf-item-check {
    font-size: clamp(12px, 3.2vw, 14px);
    font-weight: 700;
    color: #00ba7c;
    flex-shrink: 0;
    width: clamp(20px, 5.5vw, 24px);
    height: clamp(20px, 5.5vw, 24px);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 186, 124, 0.1);
    border-radius: 50%;
  }

  .gf-item-name {
    flex: 1;
    font-size: clamp(13px, 3.5vw, 15px);
    color: #536471;
    line-height: 1.3;
  }

  .gf-item-steps {
    font-size: clamp(10px, 2.8vw, 12px);
    color: #8899a6;
    white-space: nowrap;
  }

  /* ===== TABLET/DESKTOP ===== */
  @media (min-width: 768px) {
    .main {
      padding: 24px;
      padding-bottom: 24px;
    }

    .stats-grid {
      gap: 16px;
    }

    .entries-list {
      max-height: 600px;
    }
  }

  @media (min-width: 1024px) {
    .header {
      padding: 16px 32px;
    }

    .main {
      max-width: 680px;
    }
  }
`
