'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { usePresenceWithFallback } from '@/hooks/usePresence'
import ModeIndicator from '@/components/adhd/ModeIndicator'
import ProgressiveCard from '@/components/adhd/ProgressiveCard'
import AppHeader from '@/components/AppHeader'
import FABToolbox from '@/components/FABToolbox'
import { useGamificationPrefsSafe } from '@/context/GamificationPrefsContext'

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
  // aiInsight removed — atomic dashboard shows recommendation instead
  
  // Phase 1: User Mode state for holistic dashboard
  const [userMode, setUserMode] = useState<UserMode>('maintenance')
  const [modeManuallySet, setModeManuallySet] = useState(false)
  const [showModeSelector, setShowModeSelector] = useState(false)

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
  const [lastPulseEntryId, setLastPulseEntryId] = useState<string | null>(null)
  const [showPulseUndo, setShowPulseUndo] = useState(false)
  const pulseUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mode override from URL (e.g., Brake tool re-entry)
  const [showOverrideToast, setShowOverrideToast] = useState(false)

  const { prefs: gamPrefs, isMaintenanceDay } = useGamificationPrefsSafe()

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

      // Calculate streak (accounting for maintenance days)
      let streak = 1
      for (let i = 1; i < data.length; i++) {
        const curr = new Date(data[i - 1].created_at)
        const prev = new Date(data[i].created_at)
        const diff = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
        if (diff <= 1) {
          streak++
        } else if (diff === 2) {
          // Check if the gap day was a maintenance day
          const gapDay = new Date(curr)
          gapDay.setDate(gapDay.getDate() - 1)
          if (isMaintenanceDay(gapDay)) {
            streak++ // Continue streak through maintenance day
          } else {
            break
          }
        } else {
          break
        }
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
      // Only auto-set mode if not manually overridden
      if (!modeManuallySet) {
        const calculatedMode = calculateUserMode(lastEntry, streak)
        setUserMode(calculatedMode)
      }
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
    if (gamPrefs.showStreaks && insights.currentStreak && insights.currentStreak.days >= 3) {
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
    // Clear any pending undo timer
    if (pulseUndoTimerRef.current) {
      clearTimeout(pulseUndoTimerRef.current)
    }
    setSaving(true)
    const { data: insertedEntry } = await supabase.from('mood_entries').insert({
      user_id: user.id,
      mood_score: moodScore,
      note: null,
      coach_advice: null,
    }).select('id').single()

    if (insertedEntry) {
      setLastPulseEntryId(insertedEntry.id)
    }
    await fetchData(user.id)
    setSaving(false)
    setPulseSaving(false)
    setPulseSaved(true)
    setShowPulseUndo(true)

    // Hide undo option after 5 seconds
    pulseUndoTimerRef.current = setTimeout(() => {
      setShowPulseUndo(false)
      setLastPulseEntryId(null)
    }, 5000)
  }

  const handlePulseUndo = async () => {
    if (!lastPulseEntryId || !user) return
    // Clear undo timer
    if (pulseUndoTimerRef.current) {
      clearTimeout(pulseUndoTimerRef.current)
    }
    // Delete the entry
    await supabase.from('mood_entries').delete().eq('id', lastPulseEntryId)
    setLastPulseEntryId(null)
    setShowPulseUndo(false)
    setPulseSaved(false)
    setMoodScore(null)
    await fetchData(user.id)
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

  // Handle manual mode change
  const handleModeChange = (newMode: UserMode) => {
    setUserMode(newMode)
    setModeManuallySet(true)
    setShowModeSelector(false)
  }

  // Reset to auto mode
  const handleResetAutoMode = () => {
    setModeManuallySet(false)
    setShowModeSelector(false)
    // Recalculate mode based on last entry
    if (insights && insights.lastMood !== null) {
      const mockEntry = { mood_score: insights.lastMood } as MoodEntry
      const streak = insights.currentStreak?.days || 0
      const calculatedMode = calculateUserMode(mockEntry, streak)
      setUserMode(calculatedMode)
    }
  }

  // Computed view flags for mode-specific rendering
  const isRecoveryView = userMode === 'recovery'
  // isGrowthView removed — atomic dashboard uses unified hero flow
  const brakeVariant: 'urgent' | 'neutral' =
    userMode === 'recovery' || insights?.trend === 'down' ? 'urgent' : 'neutral'

  // Atomic Dashboard: Has the user checked in today?
  const hasCheckedInToday = insights?.daysSinceLastCheckIn === 0

  // ===== "ONE THING" PRINCIPLE: renderHero() =====
  // Returns ONLY ONE hero card based on strict priority hierarchy.
  // This eliminates choice paralysis by showing the single most important action.
  const renderHero = () => {
    const energy = getEnergyParam(moodScore)

    // PRIORITY 1: Recovery Mode — absolute simplicity
    if (isRecoveryView) {
      return (
        <div className="card hero-card recovery-hero">
          <div className="hero-icon">🫂</div>
          <h2 className="hero-title">Low Battery</h2>
          <p className="hero-subtitle">One thing only: rest and regulate.</p>
          <button onClick={() => router.push('/brake')} className="hero-btn recovery">
            🛑 Press the Brake (10s)
          </button>
        </div>
      )
    }

    // PRIORITY 2: Fresh Start — simplified (only 2 options to reduce decision fatigue)
    if (overduePlans.length > 0 && !freshStartDismissed) {
      return (
        <div className="card hero-card fresh-start-hero">
          <div className="hero-icon">🌅</div>
          <h2 className="hero-title">Fresh Start</h2>
          <p className="hero-subtitle">
            {overduePlans.length} item{overduePlans.length !== 1 ? 's' : ''} from yesterday
          </p>
          <div className="fresh-start-items">
            {overduePlans.slice(0, 2).map(p => (
              <div key={p.id} className="fresh-start-item">
                <span className="fresh-start-item-dot" />
                <span className="fresh-start-item-text">{p.task_name}</span>
              </div>
            ))}
            {overduePlans.length > 2 && (
              <p className="fresh-start-more">+{overduePlans.length - 2} more</p>
            )}
          </div>
          <div className="fresh-start-actions-simple">
            <button
              className="hero-btn primary"
              onClick={handleFreshStartMoveToday}
              disabled={freshStartProcessing}
            >
              📋 Move to Today
            </button>
            <button
              className="hero-btn secondary"
              onClick={handleFreshStartBacklog}
              disabled={freshStartProcessing}
            >
              🌊 Backlog
            </button>
          </div>
        </div>
      )
    }

    // PRIORITY 3: Just One Thing (recommendation or fallback)
    const just1 = recommendation
      ? { label: recommendation.suggestion, url: recommendation.url }
      : activeGoal
        ? { label: activeGoal.title, url: `/focus?create=true&taskName=${encodeURIComponent(activeGoal.title)}&goalId=${activeGoal.id}&energy=${energy}` }
        : { label: 'Pick something small', url: `/focus?energy=${energy}` }

    return (
      <div className="card hero-card just1-hero">
        <div className="hero-greeting">
          <h1>{getGreeting()} 👋</h1>
          {getContextMessage() && <p className="hero-context">{getContextMessage()}</p>}
        </div>
        <button onClick={() => router.push(just1.url)} className="hero-btn primary large">
          <span className="hero-btn-label">Just 1 Thing</span>
          <span className="hero-btn-task">{just1.label}</span>
          <span className="hero-btn-arrow">→</span>
        </button>
      </div>
    )
  }

  return (
    <div className={`dashboard ${isRecoveryView ? 'recovery-dimmed zen-mode' : ''}`}>
      <AppHeader
        onlineCount={onlineCount}
        notificationBar={{
          text: modeConfig.message,
          color: modeConfig.color,
          icon: modeConfig.icon,
        }}
        brakeVariant={brakeVariant}
        userMode={userMode}
      />

      <main className="main">
        {/* ===== "ONE THING" DASHBOARD =====
            Aggressive progressive disclosure: only ONE hero element at a time.
            Strict hierarchy: 1. Recovery → 2. Fresh Start → 3. Just One Thing */}
        {renderHero()}

        {/* Mode Override Selector */}
        <div className="mode-override-section">
          <button
            className="mode-override-trigger"
            onClick={() => setShowModeSelector(!showModeSelector)}
          >
            <span className="mode-icon">{modeConfig.icon}</span>
            <span className="mode-label">{modeConfig.label}</span>
            {modeManuallySet && <span className="mode-manual-badge">Manual</span>}
            <span className="mode-chevron">{showModeSelector ? '▲' : '▼'}</span>
          </button>

          {showModeSelector && (
            <div className="mode-selector-dropdown">
              <button
                className={`mode-option ${userMode === 'recovery' ? 'active' : ''}`}
                onClick={() => handleModeChange('recovery')}
              >
                <span className="mode-option-icon">🫂</span>
                <div className="mode-option-text">
                  <span className="mode-option-label">Recovery</span>
                  <span className="mode-option-desc">Low energy, need rest</span>
                </div>
              </button>
              <button
                className={`mode-option ${userMode === 'maintenance' ? 'active' : ''}`}
                onClick={() => handleModeChange('maintenance')}
              >
                <span className="mode-option-icon">⚖️</span>
                <div className="mode-option-text">
                  <span className="mode-option-label">Steady</span>
                  <span className="mode-option-desc">Consistent and sustainable</span>
                </div>
              </button>
              <button
                className={`mode-option ${userMode === 'growth' ? 'active' : ''}`}
                onClick={() => handleModeChange('growth')}
              >
                <span className="mode-option-icon">🚀</span>
                <div className="mode-option-text">
                  <span className="mode-option-label">Growth</span>
                  <span className="mode-option-desc">High energy, push harder</span>
                </div>
              </button>
              {modeManuallySet && (
                <button className="mode-reset-btn" onClick={handleResetAutoMode}>
                  ↻ Reset to Auto
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* FAB Toolbox */}
      <FABToolbox energyParam={getEnergyParam(moodScore)} isRecoveryMode={isRecoveryView} />

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

  /* ===== ATOMIC DASHBOARD: HERO CARD ===== */
  .atomic-hero {
    position: relative;
  }

  .atomic-greeting h1 {
    font-size: clamp(22px, 6vw, 28px);
    font-weight: 700;
    color: #0f1419;
    margin: 0 0 clamp(6px, 1.5vw, 10px) 0;
  }

  .atomic-rec-btn {
    display: flex;
    align-items: center;
    gap: clamp(12px, 3vw, 16px);
    width: 100%;
    padding: clamp(14px, 4vw, 20px);
    margin-top: clamp(16px, 4vw, 22px);
    background: linear-gradient(135deg, #1D9BF0 0%, #1a8cd8 100%);
    color: white;
    border: none;
    border-radius: clamp(12px, 3vw, 16px);
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 4px 16px rgba(29, 155, 240, 0.3);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    text-align: left;
  }

  .atomic-rec-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(29, 155, 240, 0.4);
  }

  .atomic-rec-icon {
    font-size: clamp(24px, 6vw, 32px);
    flex-shrink: 0;
  }

  .atomic-rec-content {
    flex: 1;
    min-width: 0;
  }

  .atomic-rec-title {
    display: block;
    font-size: clamp(11px, 3vw, 13px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.85;
    margin-bottom: clamp(2px, 0.5vw, 4px);
  }

  .atomic-rec-suggestion {
    display: block;
    font-size: clamp(15px, 4.2vw, 18px);
    font-weight: 600;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .atomic-rec-arrow {
    font-size: clamp(18px, 5vw, 24px);
    font-weight: 700;
    opacity: 0.7;
    flex-shrink: 0;
  }

  .atomic-just1 {
    display: flex;
    align-items: center;
    gap: clamp(12px, 3vw, 16px);
    width: 100%;
    padding: clamp(14px, 4vw, 20px);
    margin-top: clamp(16px, 4vw, 22px);
    background: linear-gradient(135deg, #1D9BF0 0%, #1a8cd8 100%);
    color: white;
    border: none;
    border-radius: clamp(12px, 3vw, 16px);
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 4px 16px rgba(29, 155, 240, 0.3);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    text-align: left;
  }

  .atomic-just1:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(29, 155, 240, 0.4);
  }

  .atomic-just1-label {
    font-size: clamp(11px, 3vw, 13px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.85;
    flex-shrink: 0;
  }

  .atomic-just1-task {
    flex: 1;
    font-size: clamp(15px, 4.2vw, 18px);
    font-weight: 600;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .atomic-just1-hint {
    font-size: clamp(18px, 5vw, 24px);
    font-weight: 700;
    opacity: 0.7;
    flex-shrink: 0;
  }

  /* ===== RECOVERY MODE: SIMPLIFIED ===== */
  .recovery-secondary {
    width: 100%;
    margin-top: clamp(10px, 2.5vw, 14px);
    padding: clamp(12px, 3.5vw, 16px);
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 600;
    color: var(--dark-gray);
    cursor: pointer;
    transition: background 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .recovery-secondary:hover {
    background: #f7f9fa;
  }

  /* ===== PULSE INNER (inside ProgressiveCard) ===== */
  .pulse-inner {
    padding-top: clamp(4px, 1vw, 8px);
  }

  /* ===== COLLAPSIBLE TOOLBOX ===== */
  .toolbox-section {
    margin-top: clamp(8px, 2vw, 12px);
  }

  .toolbox-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(6px, 1.5vw, 8px);
    width: 100%;
    padding: clamp(12px, 3.5vw, 16px);
    background: white;
    border: 1px dashed #d1d5db;
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 500;
    color: var(--dark-gray);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .toolbox-toggle:hover {
    background: #f7f9fa;
    border-color: var(--primary);
  }

  .toolbox-toggle-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(29, 155, 240, 0.1);
    color: var(--primary);
    font-size: 14px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toolbox-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: clamp(8px, 2vw, 12px);
    margin-top: clamp(10px, 2.5vw, 14px);
  }

  .toolbox-btn {
    padding: clamp(14px, 4vw, 18px) clamp(10px, 2.5vw, 14px);
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 600;
    color: var(--dark-gray);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    text-align: center;
  }

  .toolbox-btn:hover {
    background: #f7f9fa;
    border-color: var(--primary);
  }

  .toolbox-btn:active {
    transform: scale(0.98);
  }

  /* Fresh Start: +N more indicator */
  .fresh-start-more {
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--light-gray);
    margin: clamp(4px, 1vw, 6px) 0 0 clamp(14px, 3.5vw, 18px);
    font-style: italic;
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

  /* ===== "ONE THING" HERO CARDS ===== */
  .hero-card {
    padding: clamp(24px, 6vw, 36px);
    text-align: center;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  }

  .hero-icon {
    font-size: clamp(48px, 12vw, 64px);
    margin-bottom: clamp(12px, 3vw, 18px);
    line-height: 1;
  }

  .hero-title {
    font-size: clamp(22px, 6vw, 28px);
    font-weight: 700;
    color: #0f1419;
    margin: 0 0 clamp(6px, 1.5vw, 10px) 0;
  }

  .hero-subtitle {
    font-size: clamp(14px, 3.8vw, 16px);
    color: var(--dark-gray);
    margin: 0 0 clamp(20px, 5vw, 28px) 0;
    line-height: 1.5;
  }

  .recovery-hero .hero-title {
    color: #dc2626;
  }

  .fresh-start-hero {
    background: linear-gradient(135deg, rgba(249, 115, 22, 0.04) 0%, white 100%);
    border: 1.5px solid rgba(249, 115, 22, 0.2);
  }

  .fresh-start-hero .hero-title {
    color: #ea580c;
  }

  .fresh-start-actions-simple {
    display: flex;
    gap: clamp(10px, 2.5vw, 14px);
    margin-bottom: clamp(12px, 3vw, 16px);
  }

  .fresh-start-actions-simple .hero-btn {
    flex: 1;
  }

  .hero-btn {
    padding: clamp(14px, 4vw, 18px) clamp(20px, 5vw, 28px);
    border: none;
    border-radius: clamp(12px, 3vw, 16px);
    font-size: clamp(15px, 4.2vw, 18px);
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    width: 100%;
  }

  .hero-btn:hover {
    transform: translateY(-2px);
  }

  .hero-btn:active {
    transform: translateY(0);
  }

  .hero-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .hero-btn.recovery {
    background: linear-gradient(135deg, #f4212e 0%, #dc2626 100%);
    color: white;
    box-shadow: 0 4px 16px rgba(244, 33, 46, 0.3);
  }

  .hero-btn.primary {
    background: linear-gradient(135deg, #1D9BF0 0%, #1a8cd8 100%);
    color: white;
    box-shadow: 0 4px 16px rgba(29, 155, 240, 0.3);
  }

  .hero-btn.secondary {
    background: white;
    color: var(--dark-gray);
    border: 2px solid #e5e7eb;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  .hero-btn.secondary:hover {
    border-color: var(--primary);
    color: var(--primary);
  }

  .hero-btn.large {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(4px, 1vw, 8px);
    padding: clamp(20px, 5.5vw, 28px);
  }

  .hero-btn-label {
    font-size: clamp(11px, 3vw, 13px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    opacity: 0.85;
  }

  .hero-btn-task {
    font-size: clamp(17px, 4.8vw, 21px);
    font-weight: 700;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .hero-btn-arrow {
    font-size: clamp(16px, 4vw, 20px);
    opacity: 0.7;
  }

  .hero-dismiss {
    background: none;
    border: none;
    color: var(--light-gray);
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 500;
    cursor: pointer;
    padding: clamp(8px, 2vw, 12px);
    transition: color 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .hero-dismiss:hover {
    color: var(--dark-gray);
  }

  .hero-greeting h1 {
    font-size: clamp(24px, 6.5vw, 32px);
    font-weight: 700;
    color: #0f1419;
    margin: 0 0 clamp(6px, 1.5vw, 10px) 0;
  }

  .hero-context {
    font-size: clamp(14px, 3.8vw, 16px);
    color: var(--dark-gray);
    margin: 0 0 clamp(20px, 5vw, 28px) 0;
    line-height: 1.5;
  }

  .just1-hero {
    text-align: center;
  }

  /* ===== MODE OVERRIDE SELECTOR ===== */
  .mode-override-section {
    margin-top: clamp(16px, 4vw, 24px);
    position: relative;
  }

  .mode-override-trigger {
    display: flex;
    align-items: center;
    gap: clamp(8px, 2vw, 12px);
    width: 100%;
    padding: clamp(12px, 3vw, 16px);
    background: white;
    border: 1px solid var(--extra-light-gray);
    border-radius: clamp(12px, 3vw, 16px);
    cursor: pointer;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .mode-override-trigger:hover {
    border-color: var(--primary);
    box-shadow: 0 2px 8px rgba(29, 155, 240, 0.1);
  }

  .mode-icon {
    font-size: clamp(20px, 5vw, 24px);
  }

  .mode-label {
    flex: 1;
    text-align: left;
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 600;
    color: #0f1419;
  }

  .mode-manual-badge {
    font-size: clamp(10px, 2.8vw, 12px);
    font-weight: 600;
    color: #f97316;
    background: rgba(249, 115, 22, 0.1);
    padding: 2px 8px;
    border-radius: 100px;
  }

  .mode-chevron {
    font-size: clamp(10px, 2.8vw, 12px);
    color: var(--dark-gray);
  }

  .mode-selector-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    background: white;
    border: 1px solid var(--extra-light-gray);
    border-radius: clamp(12px, 3vw, 16px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
    z-index: 50;
    overflow: hidden;
    animation: dropdownSlide 0.15s ease;
  }

  @keyframes dropdownSlide {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .mode-option {
    display: flex;
    align-items: center;
    gap: clamp(10px, 2.5vw, 14px);
    width: 100%;
    padding: clamp(14px, 3.5vw, 18px);
    background: white;
    border: none;
    border-bottom: 1px solid var(--extra-light-gray);
    cursor: pointer;
    transition: background 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    text-align: left;
  }

  .mode-option:last-of-type {
    border-bottom: none;
  }

  .mode-option:hover {
    background: var(--bg-gray);
  }

  .mode-option.active {
    background: rgba(29, 155, 240, 0.08);
  }

  .mode-option-icon {
    font-size: clamp(22px, 5.5vw, 26px);
  }

  .mode-option-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .mode-option-label {
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 600;
    color: #0f1419;
  }

  .mode-option-desc {
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--dark-gray);
  }

  .mode-reset-btn {
    width: 100%;
    padding: clamp(12px, 3vw, 16px);
    background: var(--bg-gray);
    border: none;
    border-top: 1px solid var(--extra-light-gray);
    color: var(--primary);
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .mode-reset-btn:hover {
    background: #e5e7eb;
  }

  /* ===== FLOATING ACTION BUTTON (FAB) ===== */
  .toolbox-fab {
    position: fixed;
    bottom: clamp(20px, 5vw, 28px);
    right: clamp(20px, 5vw, 28px);
    width: clamp(56px, 14vw, 64px);
    height: clamp(56px, 14vw, 64px);
    border-radius: 50%;
    background: linear-gradient(135deg, #1D9BF0 0%, #1a8cd8 100%);
    border: none;
    cursor: pointer;
    font-size: clamp(24px, 6vw, 28px);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 20px rgba(29, 155, 240, 0.4);
    z-index: 900;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .toolbox-fab:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 28px rgba(29, 155, 240, 0.5);
  }

  .toolbox-fab:active {
    transform: scale(0.95);
  }

  .fab-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 910;
    animation: fadeIn 0.2s ease;
  }

  .fab-modal {
    position: fixed;
    bottom: clamp(90px, 20vw, 110px);
    right: clamp(20px, 5vw, 28px);
    background: white;
    border-radius: clamp(16px, 4vw, 22px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    z-index: 920;
    width: clamp(260px, 70vw, 320px);
    animation: fabModalSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes fabModalSlideUp {
    from { opacity: 0; transform: translateY(20px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .fab-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: clamp(14px, 3.5vw, 18px) clamp(16px, 4vw, 20px);
    border-bottom: 1px solid #eff3f4;
  }

  .fab-modal-title {
    font-size: clamp(15px, 4vw, 17px);
    font-weight: 700;
    color: #0f1419;
  }

  .fab-modal-close {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: #eff3f4;
    color: var(--dark-gray);
    font-size: 18px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease;
  }

  .fab-modal-close:hover {
    background: #e5e7eb;
  }

  .fab-modal-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: clamp(8px, 2vw, 12px);
    padding: clamp(14px, 3.5vw, 18px);
  }

  .fab-tool-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(6px, 1.5vw, 8px);
    padding: clamp(14px, 3.5vw, 18px) clamp(8px, 2vw, 12px);
    background: #f7f9fa;
    border: 1px solid #eff3f4;
    border-radius: clamp(12px, 3vw, 16px);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .fab-tool-btn:hover {
    background: white;
    border-color: var(--primary);
  }

  .fab-tool-btn:active {
    transform: scale(0.95);
  }

  .fab-tool-icon {
    font-size: clamp(22px, 5.5vw, 26px);
    line-height: 1;
  }

  .fab-tool-label {
    font-size: clamp(11px, 2.8vw, 13px);
    font-weight: 600;
    color: var(--dark-gray);
  }

  /* ===== SETTINGS MODAL ===== */
  .settings-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
    animation: fade-in 0.15s ease;
  }

  .settings-modal {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: white;
    border-radius: clamp(16px, 4vw, 24px) clamp(16px, 4vw, 24px) 0 0;
    z-index: 1000;
    animation: slide-up 0.2s ease;
    max-height: 85vh;
    overflow-y: auto;
  }

  .settings-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: clamp(14px, 3.5vw, 18px);
    border-bottom: 1px solid #eff3f4;
    position: sticky;
    top: 0;
    background: white;
    z-index: 1;
  }

  .settings-modal-title {
    font-size: clamp(16px, 4.5vw, 18px);
    font-weight: 700;
    color: #0f1419;
  }

  .settings-modal-close {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: #eff3f4;
    color: var(--dark-gray);
    font-size: 18px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease;
  }

  .settings-modal-close:hover {
    background: #e5e7eb;
  }

  .settings-modal-content {
    padding: clamp(18px, 4.5vw, 24px);
    padding-bottom: calc(clamp(18px, 4.5vw, 24px) + var(--safe-area-bottom));
  }

  @keyframes slide-up {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  /* ===== TABLET/DESKTOP ADJUSTMENTS ===== */
  @media (min-width: 768px) {
    .main { padding: 24px; padding-bottom: 24px; }
    .fab-modal { width: 340px; }
    .settings-modal { max-width: 480px; left: 50%; transform: translateX(-50%); border-radius: clamp(16px, 4vw, 24px); bottom: 50%; transform: translate(-50%, 50%); }
  }

  @media (min-width: 1024px) {
    .main { max-width: 680px; }
  }
`
