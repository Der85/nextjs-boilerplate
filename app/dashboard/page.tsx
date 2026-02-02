'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { usePresenceWithFallback } from '@/hooks/usePresence'
import ModeIndicator from '@/components/adhd/ModeIndicator'
import ProgressiveCard from '@/components/adhd/ProgressiveCard'
import AppHeader from '@/components/AppHeader'

interface MoodEntry {
  id: string
  mood_score: number
  note: string | null
  coach_advice: string | null
  created_at: string
}

interface ActiveGoal {
  id: string
  title: string
  progress_percent: number
  plant_type: string | null
}

interface OverduePlan {
  id: string
  task_name: string
  due_date: string | null
  created_at: string
}

interface UserInsights {
  totalCheckIns: number
  currentStreak: { type: string; days: number } | null
  lastMood: number | null
  lastNote: string | null
  daysSinceLastCheckIn: number
  recentAverage: number | null
  trend: 'up' | 'down' | 'stable' | null
}

// Phase 1: User Mode type for holistic state
type UserMode = 'recovery' | 'maintenance' | 'growth'

const getMoodEmoji = (score: number): string => {
  if (score <= 2) return '😢'
  if (score <= 4) return '😔'
  if (score <= 6) return '😐'
  if (score <= 8) return '🙂'
  return '😄'
}

const getMoodLabel = (score: number): { text: string; dot: string } => {
  if (score <= 3) return { text: 'Depleted (Need Rest)', dot: '🔴' }
  if (score <= 6) return { text: 'Steady (Maintenance)', dot: '🔵' }
  return { text: 'Charged (Ready to Go)', dot: '🟢' }
}

const getEnergyParam = (score: number | null): 'low' | 'medium' | 'high' => {
  if (score === null) return 'medium'
  if (score <= 3) return 'low'
  if (score <= 6) return 'medium'
  return 'high'
}

const getPulseLabel = (): string => {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 11) return '🌅 Morning Check-in: How did you sleep?'
  if (hour >= 11 && hour < 18) return '⚡ Daily Pulse: How is your energy?'
  return '🌙 Evening Wind Down: Carrying any tension?'
}

const getGreeting = (): string => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const getPlantEmoji = (p: number): string => {
  if (p >= 100) return '🌸'
  if (p >= 75) return '🌷'
  if (p >= 50) return '🪴'
  if (p >= 25) return '🌿'
  return '🌱'
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f7f9fa',
        color: '#8899a6',
      }}>
        <div style={{
          width: 32,
          height: 32,
          border: '3px solid #1D9BF0',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: 16,
        }} />
        <p>Loading...</p>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Mood check-in state
  const [moodScore, setMoodScore] = useState<number | null>(null)

  // Data state
  const [insights, setInsights] = useState<UserInsights | null>(null)
  const [activeGoal, setActiveGoal] = useState<ActiveGoal | null>(null)
  const [aiInsight, setAiInsight] = useState<string | null>(null)
  
  // Phase 1: User Mode state for holistic dashboard
  const [userMode, setUserMode] = useState<UserMode>('maintenance')

  // Real-time presence - isFocusing: false because Dashboard is for overview
  const { onlineCount } = usePresenceWithFallback({ isFocusing: false })


  // Fresh Start (overdue task cleanup)
  const [overduePlans, setOverduePlans] = useState<OverduePlan[]>([])
  const [freshStartDismissed, setFreshStartDismissed] = useState(false)
  const [freshStartProcessing, setFreshStartProcessing] = useState(false)
  const [freshStartReminded, setFreshStartReminded] = useState(false)

  // "Today's Wins" section
  const [todaysWins, setTodaysWins] = useState<Array<{ text: string; icon: string }>>([])


  // "Do This Next" recommendation
  const [recommendation, setRecommendation] = useState<{
    suggestion: string
    reason: string
    goalId?: string
    url: string
  } | null>(null)

  const [pulseSaved, setPulseSaved] = useState(false)
  const [pulseSaving, setPulseSaving] = useState(false)
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mode override from URL (e.g., Brake tool re-entry)
  const [showOverrideToast, setShowOverrideToast] = useState(false)

  // Check if a "Remind me at 4 PM" reminder has triggered
  useEffect(() => {
    const remindAt = localStorage.getItem('fresh-start-remind-at')
    if (remindAt && Date.now() >= Number(remindAt)) {
      localStorage.removeItem('fresh-start-remind-at')
      setFreshStartDismissed(false)
      setFreshStartReminded(true)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)
      await fetchData(session.user.id)

      // Fetch latest undismissed AI insight (for inline display in PinnedCard)
      const { data: insightRows } = await supabase
        .from('user_insights')
        .select('message')
        .eq('user_id', session.user.id)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(1)

      if (insightRows && insightRows.length > 0) {
        setAiInsight(insightRows[0].message)
      }

      // Prioritize URL mode param over calculated mode (e.g., from Brake tool)
      const modeParam = searchParams.get('mode') as UserMode | null
      if (modeParam && ['recovery', 'maintenance', 'growth'].includes(modeParam)) {
        setUserMode(modeParam)
        // Set slider to a safe default for the overridden mode
        if (modeParam === 'maintenance') setMoodScore(5)
        else if (modeParam === 'growth') setMoodScore(8)
        else if (modeParam === 'recovery') setMoodScore(3)
        setShowOverrideToast(true)
        setTimeout(() => setShowOverrideToast(false), 4000)
      }

      setLoading(false)

      // Load "Do This Next" recommendation (non-blocking)
      loadRecommendation(session.access_token)
    }
    init()
    return () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
    }
  }, [router, searchParams])

  const loadRecommendation = async (token: string) => {
    try {
      const res = await fetch('/api/goals-coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'suggest_next',
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.suggestion) {
          setRecommendation({
            suggestion: data.suggestion.suggestion,
            reason: data.suggestion.reason,
            goalId: data.suggestion.goalId,
            url: data.suggestion.goalId ? '/goals' : '/focus',
          })
        }
      }
    } catch {
      // Silently fail — recommendation is optional
    }
  }

  const fetchData = async (userId: string) => {
    const { data } = await supabase
      .from('mood_entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(14)

    if (data && data.length > 0) {
      const lastEntry = data[0]
      const daysSince = Math.floor(
        (Date.now() - new Date(lastEntry.created_at).getTime()) / (1000 * 60 * 60 * 24)
      )

      // Calculate streak
      let streak = 1
      for (let i = 1; i < data.length; i++) {
        const curr = new Date(data[i - 1].created_at)
        const prev = new Date(data[i].created_at)
        const diff = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
        if (diff <= 1) streak++
        else break
      }

      // Calculate trend
      let trend: 'up' | 'down' | 'stable' | null = null
      if (data.length >= 6) {
        const recent3 = data.slice(0, 3).reduce((s, m) => s + m.mood_score, 0) / 3
        const prev3 = data.slice(3, 6).reduce((s, m) => s + m.mood_score, 0) / 3
        if (recent3 - prev3 > 0.5) trend = 'up'
        else if (prev3 - recent3 > 0.5) trend = 'down'
        else trend = 'stable'
      }

      const recentAvg = data.slice(0, 7).reduce((s, m) => s + m.mood_score, 0) / Math.min(data.length, 7)

      // Set insights (existing logic)
      setInsights({
        totalCheckIns: data.length,
        currentStreak: streak >= 2 ? { type: 'checking_in', days: streak } : null,
        lastMood: lastEntry.mood_score,
        lastNote: lastEntry.note,
        daysSinceLastCheckIn: daysSince,
        recentAverage: Math.round(recentAvg * 10) / 10,
        trend
      })

      // Phase 1: Calculate User Mode based on mood data
      const calculatedMode = calculateUserMode(lastEntry, streak)
      setUserMode(calculatedMode)
    }

    // Fetch most recent active goal
    const { data: goalData } = await supabase
      .from('goals')
      .select('id, title, progress_percent, plant_type')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)

    if (goalData && goalData.length > 0) {
      setActiveGoal(goalData[0] as ActiveGoal)
    } else {
      setActiveGoal(null)
    }

    // Fetch today's wins from goal_progress_logs
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data: winsData } = await supabase
      .from('goal_progress_logs')
      .select('action_type, step_text')
      .eq('user_id', userId)
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })

    const wins: Array<{ text: string; icon: string }> = []
    if (winsData) {
      for (const w of winsData) {
        if (w.action_type === 'goal_completed') {
          wins.push({ text: w.step_text || 'Completed a goal', icon: '🌸' })
        } else if (w.action_type === 'step_completed') {
          wins.push({ text: w.step_text || 'Completed a step', icon: '✅' })
        }
      }
    }
    // Count today's mood entries as a win
    if (data && data.length > 0) {
      const todayEntries = data.filter((d: MoodEntry) =>
        new Date(d.created_at).toDateString() === new Date().toDateString()
      )
      if (todayEntries.length > 0) {
        wins.push({ text: 'Checked in today', icon: '📋' })
      }
    }
    setTodaysWins(wins)

    // Fetch overdue focus plans (incomplete plans from previous days with urgent due_dates)
    const todayDateStr = new Date().toISOString().split('T')[0]
    const { data: overdueCandidates } = await supabase
      .from('focus_plans')
      .select('id, task_name, due_date, created_at')
      .eq('user_id', userId)
      .eq('is_completed', false)
      .in('due_date', ['today', 'tomorrow'])

    if (overdueCandidates) {
      const overdue = overdueCandidates.filter(p => {
        const createdDate = new Date(p.created_at).toISOString().split('T')[0]
        if (p.due_date === 'today' && createdDate < todayDateStr) return true
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]
        if (p.due_date === 'tomorrow' && createdDate < yesterdayStr) return true
        return false
      })
      setOverduePlans(overdue as OverduePlan[])
    }
  }

  // Phase 1: User Mode calculation logic
  const calculateUserMode = (lastEntry: MoodEntry, streak: number): UserMode => {
    const lastMood = lastEntry.mood_score
    const lastNote = lastEntry.note?.toLowerCase() || ''
    
    // Recovery: If the last mood score was ≤ 3 OR the last note mentions 'overwhelmed'
    if (lastMood <= 3 || lastNote.includes('overwhelmed')) {
      return 'recovery'
    }
    
    // Growth: If the last mood score was ≥ 8 AND there is a current streak > 2 days
    if (lastMood >= 8 && streak > 2) {
      return 'growth'
    }
    
    // Maintenance: Everything else (default)
    return 'maintenance'
  }


  const getContextMessage = (): string | null => {
    if (!insights) return null

    if (insights.daysSinceLastCheckIn > 3) {
      return `Welcome back! It's been ${insights.daysSinceLastCheckIn} days.`
    }
    if (insights.currentStreak && insights.currentStreak.days >= 3) {
      return `🔥 ${insights.currentStreak.days}-day streak! Keep it going.`
    }
    if (insights.trend === 'up') {
      return `📈 Your mood has been trending up lately.`
    }
    if (insights.trend === 'down' && insights.lastMood && insights.lastMood <= 4) {
      return `I noticed things have been tough. I'm here.`
    }
    return null
  }

  const handlePulseSave = async () => {
    if (moodScore === null || !user || saving) return
    // Clear any pending auto-save timer
    if (pulseTimerRef.current) {
      clearTimeout(pulseTimerRef.current)
      pulseTimerRef.current = null
    }
    setSaving(true)
    await supabase.from('mood_entries').insert({
      user_id: user.id,
      mood_score: moodScore,
      note: null,
      coach_advice: null,
    })
    await fetchData(user.id)
    setSaving(false)
    setPulseSaving(false)
    setPulseSaved(true)
    setTimeout(() => setPulseSaved(false), 2000)
  }

  const handlePulseChange = (value: number) => {
    setMoodScore(value)
    setPulseSaved(false)
    setPulseSaving(true)
    if (value <= 3) {
      setUserMode('recovery')
    } else if (value >= 8 && insights?.currentStreak && insights.currentStreak.days > 2) {
      setUserMode('growth')
    } else {
      setUserMode('maintenance')
    }
    // Debounced auto-save after 3 seconds of inactivity
    if (pulseTimerRef.current) {
      clearTimeout(pulseTimerRef.current)
    }
    pulseTimerRef.current = setTimeout(() => {
      handlePulseSaveRef.current()
    }, 3000)
  }

  // Ref to always call latest handlePulseSave (avoids stale closure in timer)
  const handlePulseSaveRef = useRef(handlePulseSave)
  handlePulseSaveRef.current = handlePulseSave

  // Fresh Start batch actions
  const handleFreshStartMoveToday = async () => {
    if (!user || overduePlans.length === 0) return
    setFreshStartProcessing(true)
    const ids = overduePlans.map(p => p.id)
    await supabase
      .from('focus_plans')
      .update({ due_date: 'today' })
      .in('id', ids)
      .eq('user_id', user.id)
    setOverduePlans([])
    setFreshStartDismissed(true)
    setFreshStartProcessing(false)
  }

  const handleFreshStartBacklog = async () => {
    if (!user || overduePlans.length === 0) return
    setFreshStartProcessing(true)
    const ids = overduePlans.map(p => p.id)
    await supabase
      .from('focus_plans')
      .update({ due_date: 'no_rush' })
      .in('id', ids)
      .eq('user_id', user.id)
    setOverduePlans([])
    setFreshStartDismissed(true)
    setFreshStartProcessing(false)
  }

  const handleFreshStartDelete = async () => {
    if (!user || overduePlans.length === 0) return
    setFreshStartProcessing(true)
    const ids = overduePlans.map(p => p.id)
    await supabase
      .from('focus_plans')
      .delete()
      .in('id', ids)
      .eq('user_id', user.id)
    setOverduePlans([])
    setFreshStartDismissed(true)
    setFreshStartProcessing(false)
  }

  const handleFreshStartRemind4PM = () => {
    const now = new Date()
    const fourPM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 0, 0)
    // If it's already past 4 PM, set for tomorrow
    if (now >= fourPM) {
      fourPM.setDate(fourPM.getDate() + 1)
    }
    localStorage.setItem('fresh-start-remind-at', String(fourPM.getTime()))
    setFreshStartDismissed(true)
  }

  // Phase 1: Get mode-specific styling and content
  const getModeConfig = () => {
    switch (userMode) {
      case 'recovery':
        return {
          color: '#f4212e',
          bgColor: 'rgba(244, 33, 46, 0.08)',
          borderColor: 'rgba(244, 33, 46, 0.2)',
          icon: '🫂',
          label: 'Recovery Mode',
          message: "Low battery detected. Let's simplify."
        }
      case 'growth':
        return {
          color: '#00ba7c',
          bgColor: 'rgba(0, 186, 124, 0.08)',
          borderColor: 'rgba(0, 186, 124, 0.2)',
          icon: '🚀',
          label: 'Growth Mode',
          message: "Channel this energy before it fades."
        }
      case 'maintenance':
      default:
        return {
          color: '#1D9BF0',
          bgColor: 'rgba(29, 155, 240, 0.08)',
          borderColor: 'rgba(29, 155, 240, 0.2)',
          icon: '⚖️',
          label: 'Steady Mode',
          message: "Consistency is key. Keep building those sustainable habits."
        }
    }
  }

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    )
  }

  const modeConfig = getModeConfig()

  // Computed view flags for mode-specific rendering
  const isRecoveryView = userMode === 'recovery'
  const isGrowthView = userMode === 'growth'
  const brakeVariant: 'urgent' | 'neutral' =
    userMode === 'recovery' || insights?.trend === 'down' ? 'urgent' : 'neutral'

  return (
    <div className={`dashboard ${isRecoveryView ? 'recovery-dimmed' : ''}`}>
      <AppHeader
        onlineCount={onlineCount}
        notificationBar={{
          text: modeConfig.message,
          color: modeConfig.color,
          icon: modeConfig.icon,
        }}
        brakeVariant={brakeVariant}
      />

      <main className="main">
        {/* ===== SINGLE FOCUS HERO SLOT =====
            Show only ONE hero card at a time to reduce visual noise.
            Priority: Fresh Start (overdue tasks) > Pinned Context/Greeting */}
        {overduePlans.length > 0 && !freshStartDismissed && (new Date().getHours() < 14 || freshStartReminded) ? (
          <div className="card fresh-start-card">
            <div className="fresh-start-header">
              <span className="fresh-start-icon">🌅</span>
              <div className="fresh-start-titles">
                <h2 className="fresh-start-title">Fresh Start</h2>
                <p className="fresh-start-subtitle">
                  It&apos;s a new day. You have {overduePlans.length} item{overduePlans.length !== 1 ? 's' : ''} left from yesterday.
                </p>
              </div>
            </div>
            <div className="fresh-start-items">
              {overduePlans.map(p => (
                <div key={p.id} className="fresh-start-item">
                  <span className="fresh-start-item-dot" />
                  <span className="fresh-start-item-text">{p.task_name}</span>
                </div>
              ))}
            </div>
            <div className="fresh-start-actions">
              <button
                className="fresh-start-btn primary"
                onClick={handleFreshStartMoveToday}
                disabled={freshStartProcessing}
              >
                📋 Move to Today
              </button>
              <button
                className="fresh-start-btn remind"
                onClick={handleFreshStartRemind4PM}
                disabled={freshStartProcessing}
              >
                🕓 Remind at 4 PM
              </button>
              <button
                className="fresh-start-btn secondary"
                onClick={handleFreshStartBacklog}
                disabled={freshStartProcessing}
              >
                🌊 Backlog All
              </button>
              <button
                className="fresh-start-btn danger"
                onClick={handleFreshStartDelete}
                disabled={freshStartProcessing}
              >
                🗑️ Clear All
              </button>
            </div>
            <button
              className="fresh-start-dismiss"
              onClick={() => setFreshStartDismissed(true)}
            >
              Decide later
            </button>
          </div>
        ) : isRecoveryView ? (
          /* Pinned Context: RECOVERY MODE CARD (shown when no overdue tasks) */
          <div className="card pinned-card recovery">
            <ModeIndicator mode={userMode} position="absolute" />
            <div className="pinned-header">
              <span className="pinned-icon">🫂</span>
              <div className="pinned-titles">
                <h2 className="pinned-title">Low Battery Detected</h2>
                <p className="pinned-subtitle">Let&apos;s simplify.</p>
              </div>
            </div>
            <p className="pinned-message">
              Skip the big tasks. Focus on rest and regulation today.
            </p>
            {(aiInsight || insights?.trend) && (
              <div className="pinned-insights">
                {insights?.trend && insights.trend !== 'stable' && (
                  <p className="pinned-insight-item">
                    {insights.trend === 'up' ? '📈' : '📉'} Trend: Mood trending {insights.trend}
                  </p>
                )}
                {aiInsight && (
                  <p className="pinned-insight-item">✨ Pattern: {aiInsight}</p>
                )}
              </div>
            )}
            <button onClick={() => router.push('/brake')} className="btn-action recovery">
              🛑 Start 10s Reset
            </button>
          </div>
        ) : isGrowthView ? (
          /* Pinned Context: GROWTH MODE CARD */
          <div className="card pinned-card growth">
            <ModeIndicator mode={userMode} position="absolute" />
            <div className="pinned-header">
              <span className="pinned-icon">🚀</span>
              <div className="pinned-titles">
                <h2 className="pinned-title">Momentum Detected</h2>
                <p className="pinned-subtitle">You&apos;re charged up.</p>
              </div>
            </div>
            <p className="pinned-message">
              Channel this energy before it fades.
            </p>
            {(aiInsight || insights?.trend) && (
              <div className="pinned-insights">
                {insights?.trend && insights.trend !== 'stable' && (
                  <p className="pinned-insight-item">
                    {insights.trend === 'up' ? '📈' : '📉'} Trend: Mood trending {insights.trend}
                  </p>
                )}
                {aiInsight && (
                  <p className="pinned-insight-item">✨ Pattern: {aiInsight}</p>
                )}
              </div>
            )}
            {activeGoal && (
              <button
                onClick={() => router.push(
                  `/focus?create=true&taskName=${encodeURIComponent(activeGoal.title)}&goalId=${activeGoal.id}&energy=high`
                )}
                className="mini-garden growth-garden"
              >
                <div
                  className="mini-garden-plant"
                  style={{ fontSize: `${1 + (activeGoal.progress_percent / 100) * 2}rem` }}
                >
                  {activeGoal.plant_type || getPlantEmoji(activeGoal.progress_percent)}
                </div>
                <div className="mini-garden-bar growth-bar">
                  <div
                    className="mini-garden-fill growth-fill"
                    style={{ width: `${activeGoal.progress_percent}%` }}
                  />
                </div>
                <span className="mini-garden-title">{activeGoal.title}</span>
                <span className="mini-garden-label">Water this plant (Focus)</span>
              </button>
            )}
            {!activeGoal && (
              <button onClick={() => router.push('/focus')} className="btn-action growth">
                ⏱️ Start Focus Session
              </button>
            )}
          </div>
        ) : (
          /* Pinned Context: MAINTENANCE MODE CARD */
          <div className="card main-card">
            <ModeIndicator mode={userMode} position="absolute" />
            <div className="greeting">
              <h1>{getGreeting()} 👋</h1>
              {getContextMessage() && <p className="context-msg">{getContextMessage()}</p>}
            </div>

            {(aiInsight || (insights?.trend && insights.trend !== 'stable')) && (
              <div className="pinned-insights">
                {insights?.trend && insights.trend !== 'stable' && (
                  <p className="pinned-insight-item">
                    {insights.trend === 'up' ? '📈' : '📉'} Trend: Mood trending {insights.trend}
                  </p>
                )}
                {aiInsight && (
                  <p className="pinned-insight-item">✨ Pattern: {aiInsight}</p>
                )}
              </div>
            )}

            {activeGoal && (
              <button
                onClick={() => router.push(
                  `/focus?create=true&taskName=${encodeURIComponent(activeGoal.title)}&goalId=${activeGoal.id}`
                )}
                className="mini-garden"
              >
                <div
                  className="mini-garden-plant"
                  style={{ fontSize: `${1 + (activeGoal.progress_percent / 100) * 2}rem` }}
                >
                  {activeGoal.plant_type || getPlantEmoji(activeGoal.progress_percent)}
                </div>
                <div className="mini-garden-bar">
                  <div
                    className="mini-garden-fill"
                    style={{ width: `${activeGoal.progress_percent}%` }}
                  />
                </div>
                <span className="mini-garden-title">{activeGoal.title}</span>
                <span className="mini-garden-label">Water this plant (Focus)</span>
              </button>
            )}
          </div>
        )}

        {/* DailyPulse Slider — always visible, label adapts to time of day */}
        <div className="card pulse-card">
          <div className="pulse-header">
            <p className="pulse-label">
              {getPulseLabel()} {moodScore !== null && <span className="pulse-emoji">{getMoodEmoji(moodScore)}</span>}
            </p>
            {moodScore !== null && (() => {
              const label = getMoodLabel(moodScore)
              return <span className="pulse-mood-label">{label.dot} {label.text}</span>
            })()}
          </div>
          <div className="slider-container">
            <input
              type="range" min="1" max="10"
              value={moodScore ?? 5}
              onChange={(e) => handlePulseChange(Number(e.target.value))}
              className="intercept-slider"
            />
            <div className="slider-labels">
              <span>Low</span>
              <span className="slider-value">{moodScore ?? 5}/10</span>
              <span>High</span>
            </div>
          </div>
          {pulseSaving && !pulseSaved && (
            <div className="pulse-saving-toast">
              <span className="pulse-saving-dot" />
              Saving...
            </div>
          )}
          {pulseSaved && (
            <div className="pulse-saved-toast">✓ Saved</div>
          )}
        </div>

        {/* "Do This Next" Recommendation Card */}
        {recommendation && !isRecoveryView && (
          <button onClick={() => router.push(recommendation.url)} className="card rec-card">
            <div className="rec-header">
              <span className="rec-icon">💡</span>
              <span className="rec-title">Do This Next</span>
            </div>
            <p className="rec-suggestion">{recommendation.suggestion}</p>
            <p className="rec-reason">{recommendation.reason}</p>
          </button>
        )}

        {/* Recovery Mode: 2-column action grid */}
        {isRecoveryView && (
          <div className="recovery-actions-grid">
            <button onClick={() => router.push('/brake')} className="btn-secondary recovery-action-btn">
              🛑 Brake / Reset
            </button>
            <button onClick={() => router.push('/ally')} className="btn-secondary recovery-action-btn">
              💜 I'm Stuck
            </button>
          </div>
        )}

        {/* Growth Mode: Primary CTA */}
        {isGrowthView && (
          <div className="growth-cta">
            <button
              onClick={() => router.push(
                activeGoal
                  ? `/focus?create=true&taskName=${encodeURIComponent(activeGoal.title)}&goalId=${activeGoal.id}&energy=high`
                  : '/focus?mode=sprint&energy=high'
              )}
              className="btn-action growth"
            >
              {activeGoal ? `⚡️ Focus on: ${activeGoal.title}` : '⚡️ Start Hyperfocus Session'}
            </button>
          </div>
        )}

        {/* Maintenance Mode: "Just 1 Thing" + Goal-aware actions */}
        {!isRecoveryView && !isGrowthView && (() => {
          const energy = getEnergyParam(moodScore)
          const focusUrl = energy === 'low'
            ? '/focus?mode=gentle&energy=low'
            : energy === 'high'
              ? '/focus?mode=sprint&energy=high'
              : `/focus?energy=${energy}`

          // "Just 1 Thing" — pick the most relevant task to reduce choice paralysis
          const just1 = overduePlans.length > 0
            ? { label: overduePlans[0].task_name, url: `/focus?create=true&taskName=${encodeURIComponent(overduePlans[0].task_name)}&energy=${energy}` }
            : activeGoal
              ? { label: activeGoal.title, url: `/focus?create=true&taskName=${encodeURIComponent(activeGoal.title)}&goalId=${activeGoal.id}&energy=${energy}` }
              : null

          return (
            <>
              {just1 ? (
                <button
                  onClick={() => router.push(just1.url)}
                  className="just1-btn"
                >
                  <span className="just1-label">Just 1 Thing</span>
                  <span className="just1-task">{just1.label}</span>
                  <span className="just1-hint">Start here →</span>
                </button>
              ) : (
                <button onClick={() => router.push(focusUrl)} className="just1-btn">
                  <span className="just1-label">Just 1 Thing</span>
                  <span className="just1-task">Pick something small</span>
                  <span className="just1-hint">Start here →</span>
                </button>
              )}

              {activeGoal && (
                <button
                  onClick={() => router.push(
                    `/focus?create=true&taskName=${encodeURIComponent(activeGoal.title)}&goalId=${activeGoal.id}&energy=${energy}`
                  )}
                  className="maintenance-primary-cta"
                >
                  🌿 Water your plant: {activeGoal.title}
                </button>
              )}
              <div className="maintenance-tools-grid">
                <button onClick={() => router.push(focusUrl)} className="maintenance-action-btn secondary">
                  ⏱️ Focus
                </button>
                <button onClick={() => router.push(`/goals?energy=${energy}`)} className="maintenance-action-btn secondary">
                  🎯 Goals
                </button>
                <button onClick={() => router.push(`/ally?energy=${energy}`)} className="maintenance-action-btn secondary">
                  💜 I&apos;m Stuck
                </button>
                <button onClick={() => router.push(`/history?energy=${energy}`)} className="maintenance-action-btn secondary">
                  📊 History
                </button>
              </div>
            </>
          )
        })()}

        {/* Today's Wins — collapsed by default to reduce visual noise */}
        {todaysWins.length > 0 && (
          <ProgressiveCard
            id="todays-wins"
            title={`Today's Wins (${todaysWins.length})`}
            icon="🏆"
            preview={`${todaysWins.length} item${todaysWins.length !== 1 ? 's' : ''}`}
            defaultExpanded={false}
            autoCollapseDelay={0}
          >
            <div className="wins-list">
              {todaysWins.map((win, i) => (
                <div key={i} className="win-item">
                  <span className="win-icon">{win.icon}</span>
                  <span className="win-text">{win.text}</span>
                </div>
              ))}
            </div>
          </ProgressiveCard>
        )}

      </main>

      {/* Mode Override Toast (from Brake tool re-entry) */}
      {showOverrideToast && (
        <div className="override-toast">
          <span className="override-toast-icon">🌿</span>
          <span className="override-toast-text">State updated from Breathing Session</span>
        </div>
      )}

      <style jsx>{styles}</style>
    </div>
  )
}

// ============================================
// RESPONSIVE STYLES
// Using clamp() for fluid scaling between breakpoints
// ============================================
const styles = `
  .dashboard {
    --primary: #1D9BF0;
    --success: #00ba7c;
    --danger: #f4212e;
    --bg-gray: #f7f9fa;
    --dark-gray: #536471;
    --light-gray: #8899a6;

    background: var(--bg-gray);
    min-height: 100vh;
    min-height: 100dvh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: filter 0.5s ease;
  }

  .dashboard.recovery-dimmed {
    filter: saturate(0.45) brightness(1.02);
  }

  /* ===== LOADING ===== */
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    min-height: 100dvh;
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

  .spinner-small {
    width: clamp(14px, 3vw, 18px);
    height: clamp(14px, 3vw, 18px);
    border: 2px solid white;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    display: inline-block;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }


  /* ===== MAIN CONTENT ===== */
  .main {
    padding: clamp(12px, 4vw, 20px);
    padding-bottom: clamp(16px, 4vw, 24px);
    max-width: 600px;
    margin: 0 auto;
  }

  .card {
    background: white;
    border-radius: clamp(14px, 4vw, 22px);
    overflow: hidden;
  }

  .main-card {
    position: relative;
    padding: clamp(16px, 5vw, 28px);
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    margin-bottom: clamp(20px, 5vw, 32px);
  }

  /* ===== FRESH START (OVERDUE TASK CLEANUP) ===== */
  .fresh-start-card {
    padding: clamp(18px, 5vw, 26px);
    margin-bottom: clamp(20px, 5vw, 32px);
    border: 2px solid rgba(249, 115, 22, 0.25);
    background: linear-gradient(135deg, rgba(249, 115, 22, 0.06) 0%, rgba(255, 255, 255, 1) 100%);
    box-shadow: 0 2px 12px rgba(249, 115, 22, 0.1);
  }

  .fresh-start-header {
    display: flex;
    align-items: flex-start;
    gap: clamp(10px, 3vw, 14px);
    margin-bottom: clamp(12px, 3vw, 16px);
  }

  .fresh-start-icon {
    font-size: clamp(28px, 8vw, 36px);
    flex-shrink: 0;
    line-height: 1;
  }

  .fresh-start-titles {
    flex: 1;
    min-width: 0;
  }

  .fresh-start-title {
    font-size: clamp(18px, 5vw, 22px);
    font-weight: 700;
    color: #0f1419;
    margin: 0 0 clamp(2px, 0.5vw, 4px) 0;
  }

  .fresh-start-subtitle {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    margin: 0;
    line-height: 1.4;
  }

  .fresh-start-items {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 1.5vw, 8px);
    margin-bottom: clamp(14px, 4vw, 18px);
    padding: clamp(10px, 2.5vw, 14px);
    background: rgba(249, 115, 22, 0.04);
    border-radius: clamp(10px, 2.5vw, 14px);
  }

  .fresh-start-item {
    display: flex;
    align-items: center;
    gap: clamp(8px, 2vw, 10px);
  }

  .fresh-start-item-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #f97316;
    flex-shrink: 0;
  }

  .fresh-start-item-text {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .fresh-start-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: clamp(6px, 1.5vw, 10px);
    margin-bottom: clamp(8px, 2vw, 12px);
  }

  .fresh-start-btn {
    padding: clamp(10px, 2.5vw, 14px) clamp(6px, 1.5vw, 10px);
    border: none;
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(12px, 3.2vw, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    text-align: center;
  }

  .fresh-start-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .fresh-start-btn.primary {
    background: #f97316;
    color: white;
    box-shadow: 0 2px 8px rgba(249, 115, 22, 0.25);
  }

  .fresh-start-btn.primary:hover:not(:disabled) {
    background: #ea580c;
    transform: translateY(-1px);
  }

  .fresh-start-btn.remind {
    background: rgba(245, 158, 11, 0.08);
    color: #d97706;
  }

  .fresh-start-btn.remind:hover:not(:disabled) {
    background: rgba(245, 158, 11, 0.15);
  }

  .fresh-start-btn.secondary {
    background: rgba(29, 155, 240, 0.08);
    color: var(--primary);
  }

  .fresh-start-btn.secondary:hover:not(:disabled) {
    background: rgba(29, 155, 240, 0.15);
  }

  .fresh-start-btn.danger {
    background: rgba(244, 33, 46, 0.08);
    color: var(--danger);
  }

  .fresh-start-btn.danger:hover:not(:disabled) {
    background: rgba(244, 33, 46, 0.15);
  }

  .fresh-start-dismiss {
    display: block;
    width: 100%;
    background: none;
    border: none;
    color: var(--light-gray);
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 500;
    cursor: pointer;
    padding: clamp(6px, 1.5vw, 8px);
    transition: color 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    text-align: center;
  }

  .fresh-start-dismiss:hover {
    color: var(--dark-gray);
  }

  /* ===== PHASE 3: PINNED CONTEXT CARDS ===== */
  .pinned-card {
    position: relative;
    padding: clamp(20px, 5.5vw, 32px);
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    margin-bottom: clamp(20px, 5vw, 32px);
    border: 1px solid;
  }

  .pinned-card.recovery {
    background: rgba(244, 33, 46, 0.04);
    border-color: rgba(244, 33, 46, 0.15);
  }

  .pinned-card.growth {
    background: rgba(0, 186, 124, 0.04);
    border-color: rgba(0, 186, 124, 0.15);
  }

  .pinned-header {
    display: flex;
    align-items: flex-start;
    gap: clamp(12px, 3.5vw, 18px);
    margin-bottom: clamp(14px, 4vw, 20px);
  }

  .pinned-icon {
    font-size: clamp(32px, 9vw, 44px);
    flex-shrink: 0;
  }

  .pinned-titles {
    flex: 1;
  }

  .pinned-title {
    font-size: clamp(18px, 5vw, 24px);
    font-weight: 700;
    color: var(--text-dark, #0f1419);
    margin: 0 0 clamp(2px, 0.8vw, 4px) 0;
  }

  .pinned-card.recovery .pinned-title {
    color: #dc2626;
  }

  .pinned-card.growth .pinned-title {
    color: #059669;
  }

  .pinned-subtitle {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    margin: 0;
  }

  .pinned-message {
    font-size: clamp(14px, 3.8vw, 16px);
    color: var(--dark-gray);
    line-height: 1.6;
    margin: 0 0 clamp(18px, 5vw, 26px) 0;
  }

  .pinned-insights {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 1.5vw, 10px);
    margin-bottom: clamp(18px, 5vw, 26px);
    padding: clamp(10px, 3vw, 14px);
    background: rgba(0, 0, 0, 0.03);
    border-radius: clamp(10px, 2.5vw, 14px);
  }

  .pinned-insight-item {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    line-height: 1.5;
    margin: 0;
  }

  .btn-action {
    width: 100%;
    padding: clamp(14px, 4vw, 18px);
    border: none;
    border-radius: clamp(12px, 3vw, 16px);
    font-size: clamp(15px, 4.2vw, 18px);
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(8px, 2vw, 12px);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .btn-action:hover {
    transform: translateY(-1px);
  }

  .btn-action.recovery {
    background: linear-gradient(135deg, #f4212e 0%, #dc2626 100%);
    color: white;
    box-shadow: 0 4px 14px rgba(244, 33, 46, 0.3);
  }

  .btn-action.growth {
    background: linear-gradient(135deg, #00ba7c 0%, #059669 100%);
    color: white;
    box-shadow: 0 4px 14px rgba(0, 186, 124, 0.3);
  }

  /* ===== GREETING ===== */
  .greeting {
    margin-bottom: clamp(16px, 4vw, 24px);
  }

  .greeting h1 {
    font-size: clamp(20px, 5.5vw, 28px);
    font-weight: 700;
    margin: 0 0 clamp(2px, 1vw, 6px) 0;
  }

  .context-msg {
    color: var(--dark-gray);
    font-size: clamp(13px, 3.5vw, 16px);
    margin: 0;
  }

  .btn-secondary {
    width: 100%;
    margin-top: clamp(12px, 3vw, 18px);
    padding: clamp(10px, 3vw, 14px);
    background: var(--bg-gray);
    border: none;
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    cursor: pointer;
  }

  /* ===== "JUST 1 THING" CTA ===== */
  .just1-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    padding: clamp(22px, 6vw, 32px) clamp(16px, 4.5vw, 24px);
    background: linear-gradient(135deg, #1D9BF0 0%, #1a8cd8 100%);
    color: white;
    border: none;
    border-radius: clamp(14px, 4vw, 22px);
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin-bottom: clamp(14px, 4vw, 20px);
    box-shadow: 0 4px 20px rgba(29, 155, 240, 0.35);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    text-align: center;
  }

  .just1-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(29, 155, 240, 0.45);
  }

  .just1-btn:active {
    transform: translateY(0);
  }

  .just1-label {
    font-size: clamp(11px, 3vw, 13px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    opacity: 0.85;
    margin-bottom: clamp(4px, 1vw, 6px);
  }

  .just1-task {
    font-size: clamp(17px, 4.8vw, 21px);
    font-weight: 700;
    line-height: 1.3;
    margin-bottom: clamp(4px, 1vw, 8px);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .just1-hint {
    font-size: clamp(12px, 3.2vw, 14px);
    font-weight: 500;
    opacity: 0.75;
  }

  /* ===== RECOVERY MODE: 2-COLUMN ACTION GRID ===== */
  .recovery-actions-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: clamp(10px, 3vw, 16px);
    margin-bottom: clamp(20px, 5vw, 32px);
  }

  .recovery-action-btn {
    padding: clamp(20px, 5.5vw, 28px) clamp(12px, 3vw, 16px);
    font-size: clamp(15px, 4.2vw, 18px);
    font-weight: 700;
    text-align: center;
    margin-top: 0;
    border-radius: clamp(14px, 4vw, 22px);
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  }

  /* ===== MAINTENANCE MODE: GOAL-AWARE ACTIONS ===== */
  .maintenance-primary-cta {
    width: 100%;
    padding: clamp(16px, 4.5vw, 22px);
    margin-bottom: clamp(10px, 3vw, 14px);
    background: linear-gradient(135deg, #00ba7c 0%, #059669 100%);
    color: white;
    border: none;
    border-radius: clamp(14px, 4vw, 22px);
    font-size: clamp(15px, 4.2vw, 18px);
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0, 186, 124, 0.25);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }

  .maintenance-primary-cta:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(0, 186, 124, 0.3);
  }

  .maintenance-primary-cta:active {
    transform: translateY(0);
  }

  .maintenance-tools-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: clamp(10px, 3vw, 16px);
    margin-bottom: clamp(20px, 5vw, 32px);
  }

  .maintenance-actions-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: clamp(10px, 3vw, 16px);
    margin-bottom: clamp(20px, 5vw, 32px);
  }

  .maintenance-action-btn.full-width {
    grid-column: 1 / -1;
  }

  .maintenance-action-btn {
    padding: clamp(18px, 5vw, 24px) clamp(12px, 3vw, 16px);
    font-size: clamp(15px, 4.2vw, 18px);
    font-weight: 700;
    text-align: center;
    border: none;
    border-radius: clamp(14px, 4vw, 22px);
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: transform 0.1s ease, box-shadow 0.15s ease;
  }

  .maintenance-action-btn:hover {
    transform: scale(1.02);
  }

  .maintenance-action-btn:active {
    transform: scale(0.98);
  }

  .maintenance-action-btn.primary {
    background: #1D9BF0;
    color: white;
    box-shadow: 0 4px 14px rgba(29, 155, 240, 0.25);
  }

  .maintenance-action-btn.primary:hover {
    background: #1a8cd8;
  }

  .maintenance-action-btn.secondary {
    background: white;
    color: #536471;
    border: 2px solid #e5e7eb;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  }

  .maintenance-action-btn.secondary:hover {
    background: #f7f9fa;
    border-color: #d1d5db;
  }

  .maintenance-badge {
    display: block;
    font-size: clamp(10px, 2.5vw, 11px);
    font-weight: 600;
    color: #00ba7c;
    margin-top: 4px;
  }

  /* ===== GROWTH MODE: CTA WRAPPER ===== */
  .growth-cta {
    margin-bottom: clamp(20px, 5vw, 32px);
  }

  /* ===== MINI GARDEN (Dopamine Garden Widget) ===== */
  .mini-garden {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(6px, 1.5vw, 10px);
    width: 100%;
    padding: clamp(16px, 4.5vw, 22px) clamp(12px, 3vw, 16px);
    margin-top: clamp(14px, 4vw, 18px);
    background: linear-gradient(180deg, rgba(0, 186, 124, 0.06) 0%, rgba(0, 186, 124, 0.02) 100%);
    border: 1.5px solid rgba(0, 186, 124, 0.18);
    border-radius: clamp(14px, 4vw, 20px);
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  }

  .mini-garden:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 186, 124, 0.15);
    background: linear-gradient(180deg, rgba(0, 186, 124, 0.1) 0%, rgba(0, 186, 124, 0.04) 100%);
  }

  .mini-garden:active {
    transform: translateY(0);
  }

  .mini-garden.growth-garden {
    margin-top: 0;
    margin-bottom: clamp(12px, 3vw, 16px);
    background: linear-gradient(180deg, rgba(0, 186, 124, 0.08) 0%, rgba(0, 186, 124, 0.02) 100%);
    border-color: rgba(0, 186, 124, 0.25);
  }

  .mini-garden-plant {
    line-height: 1;
    transition: font-size 0.3s ease;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
  }

  .mini-garden-bar {
    width: 80%;
    max-width: 180px;
    height: 6px;
    background: rgba(0, 186, 124, 0.12);
    border-radius: 100px;
    overflow: hidden;
  }

  .mini-garden-fill {
    height: 100%;
    background: linear-gradient(90deg, #00ba7c 0%, #059669 100%);
    border-radius: 100px;
    transition: width 0.4s ease;
  }

  .mini-garden-bar.growth-bar {
    background: rgba(0, 186, 124, 0.18);
  }

  .mini-garden-fill.growth-fill {
    background: linear-gradient(90deg, #059669 0%, #00ba7c 100%);
  }

  .mini-garden-title {
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 600;
    color: var(--dark-gray);
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .mini-garden-label {
    font-size: clamp(11px, 3vw, 13px);
    font-weight: 600;
    color: var(--success);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  /* ===== DAILY PULSE CARD ===== */
  .pulse-card {
    padding: clamp(16px, 4.5vw, 24px);
    margin-bottom: clamp(20px, 5vw, 32px);
  }

  .pulse-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: clamp(12px, 3vw, 16px);
  }

  .pulse-label {
    font-size: clamp(14px, 3.8vw, 17px);
    font-weight: 600;
    color: var(--dark-gray);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .pulse-mood-label {
    font-size: clamp(12px, 3.2vw, 14px);
    font-weight: 600;
    color: #1D9BF0;
    background: rgba(29, 155, 240, 0.08);
    padding: 3px clamp(8px, 2vw, 12px);
    border-radius: 100px;
    white-space: nowrap;
  }

  .pulse-emoji {
    font-size: clamp(20px, 5.5vw, 26px);
  }

  .pulse-saving-toast {
    width: 100%;
    padding: clamp(10px, 2.5vw, 14px);
    text-align: center;
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 600;
    color: var(--light-gray);
    background: rgba(0, 0, 0, 0.03);
    border-radius: clamp(10px, 2.5vw, 14px);
    animation: fadeIn 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(6px, 1.5vw, 8px);
  }

  .pulse-saving-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--light-gray);
    animation: savingPulse 1.2s ease-in-out infinite;
  }

  @keyframes savingPulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }

  .pulse-saved-toast {
    width: 100%;
    padding: clamp(10px, 2.5vw, 14px);
    text-align: center;
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 600;
    color: #00ba7c;
    background: rgba(0, 186, 124, 0.08);
    border-radius: clamp(10px, 2.5vw, 14px);
    animation: fadeIn 0.3s ease;
  }

  /* ===== "DO THIS NEXT" RECOMMENDATION CARD ===== */
  .rec-card {
    display: block;
    width: 100%;
    padding: clamp(16px, 4.5vw, 22px);
    margin-bottom: clamp(20px, 5vw, 32px);
    border: 1.5px solid rgba(255, 173, 31, 0.3);
    background: linear-gradient(135deg, white 0%, rgba(255, 215, 0, 0.04) 100%);
    cursor: pointer;
    text-align: left;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .rec-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(255, 173, 31, 0.15);
  }

  .rec-header {
    display: flex;
    align-items: center;
    gap: clamp(6px, 1.5vw, 10px);
    margin-bottom: clamp(8px, 2vw, 12px);
  }

  .rec-icon {
    font-size: clamp(18px, 5vw, 24px);
  }

  .rec-title {
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 700;
    color: #b8860b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .rec-suggestion {
    font-size: clamp(15px, 4.2vw, 18px);
    font-weight: 600;
    color: #0f1419;
    margin: 0 0 clamp(4px, 1vw, 6px) 0;
    line-height: 1.4;
  }

  .rec-reason {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    margin: 0;
    line-height: 1.4;
  }

  /* ===== SHARED SLIDER STYLES (DailyPulse) ===== */
  .slider-container {
    margin-bottom: clamp(20px, 5vw, 28px);
  }

  .intercept-slider {
    width: 100%;
    height: 6px;
    -webkit-appearance: none;
    appearance: none;
    background: linear-gradient(to right, #f4212e, #ffad1f, #00ba7c);
    border-radius: 100px;
    outline: none;
    margin-bottom: clamp(10px, 2.5vw, 14px);
  }

  .intercept-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: clamp(24px, 6.5vw, 32px);
    height: clamp(24px, 6.5vw, 32px);
    border-radius: 50%;
    background: white;
    border: 3px solid var(--primary);
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }

  .intercept-slider::-moz-range-thumb {
    width: clamp(24px, 6.5vw, 32px);
    height: clamp(24px, 6.5vw, 32px);
    border-radius: 50%;
    background: white;
    border: 3px solid var(--primary);
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }

  .slider-labels {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--light-gray);
  }

  .slider-value {
    font-size: clamp(18px, 5vw, 24px);
    font-weight: 700;
    color: var(--primary);
  }

  /* ===== TODAY'S WINS (inside ProgressiveCard) ===== */

  .wins-list {
    padding: 0 clamp(16px, 4.5vw, 22px) clamp(14px, 4vw, 18px);
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 2vw, 12px);
  }

  .win-item {
    display: flex;
    align-items: center;
    gap: clamp(8px, 2vw, 12px);
    padding: clamp(8px, 2vw, 10px) 0;
    border-top: 1px solid #eff3f4;
  }

  .win-icon {
    font-size: clamp(16px, 4.5vw, 20px);
    flex-shrink: 0;
  }

  .win-text {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    line-height: 1.3;
  }

  /* ===== MODE OVERRIDE TOAST ===== */
  .override-toast {
    position: fixed;
    bottom: clamp(16px, 4vw, 24px);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: clamp(6px, 1.5vw, 10px);
    background: linear-gradient(135deg, #059669 0%, #00ba7c 100%);
    color: white;
    padding: clamp(10px, 2.5vw, 14px) clamp(16px, 4vw, 22px);
    border-radius: 100px;
    box-shadow: 0 4px 16px rgba(0, 186, 124, 0.35);
    z-index: 950;
    animation: toastSlideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;
  }

  .override-toast-icon {
    font-size: clamp(16px, 4.5vw, 20px);
  }

  .override-toast-text {
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 600;
  }

  @keyframes toastSlideUp {
    from { opacity: 0; transform: translateX(-50%) translateY(20px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  /* ===== TABLET/DESKTOP ADJUSTMENTS ===== */
  @media (min-width: 768px) {
    .main { padding: 24px; padding-bottom: 24px; }
  }

  @media (min-width: 1024px) {
    .main { max-width: 680px; }
  }
`
