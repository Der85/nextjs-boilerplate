'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getADHDCoachAdvice, CoachResponse } from '@/lib/gemini'
import { usePresenceWithFallback } from '@/hooks/usePresence'
import ModeIndicator from '@/components/adhd/ModeIndicator'
import ProgressiveCard from '@/components/adhd/ProgressiveCard'
import AppHeader from '@/components/AppHeader'
import MorningSleepCard from '@/components/micro/MorningSleepCard'
import InsightCard, { InsightData } from '@/components/micro/InsightCard'

interface MoodEntry {
  id: string
  mood_score: number
  note: string | null
  coach_advice: string | null
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

const getGreeting = (): string => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Mood check-in state
  const [moodScore, setMoodScore] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [coachResponse, setCoachResponse] = useState<CoachResponse | null>(null)
  const [checkInComplete, setCheckInComplete] = useState(false)

  // Data state
  const [recentMoods, setRecentMoods] = useState<MoodEntry[]>([])
  const [insights, setInsights] = useState<UserInsights | null>(null)
  
  // Phase 1: User Mode state for holistic dashboard
  const [userMode, setUserMode] = useState<UserMode>('maintenance')

  // Real-time presence - isFocusing: false because Dashboard is for overview
  const { onlineCount } = usePresenceWithFallback({ isFocusing: false })

  // UI state
  const [showCheckInAnyway, setShowCheckInAnyway] = useState(false) // Phase 3: Allow check-in in Recovery/Growth modes

  // AI Insight (Pattern Engine)
  const [aiInsight, setAiInsight] = useState<InsightData | null>(null)

  // Trojan Horse intercepts
  const [showMorningKey, setShowMorningKey] = useState(false)
  const [showEveningWindDown, setShowEveningWindDown] = useState(false)
  const [tensionValue, setTensionValue] = useState(5)
  const [savingIntercept, setSavingIntercept] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)
      await fetchData(session.user.id)

      // Check for Trojan Horse intercepts
      const hour = new Date().getHours()
      const today = new Date()
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()

      if (hour < 11) {
        const { data: mk } = await supabase
          .from('burnout_logs')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('source', 'morning_key')
          .gte('created_at', todayStart)
          .limit(1)
        if (!mk || mk.length === 0) setShowMorningKey(true)
      }

      if (hour >= 19) {
        const { data: ew } = await supabase
          .from('burnout_logs')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('source', 'evening_winddown')
          .gte('created_at', todayStart)
          .limit(1)
        if (!ew || ew.length === 0) setShowEveningWindDown(true)
      }

      // Fetch latest undismissed AI insight
      const { data: insightRows } = await supabase
        .from('user_insights')
        .select('id, type, title, message, icon')
        .eq('user_id', session.user.id)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(1)

      if (insightRows && insightRows.length > 0) {
        setAiInsight(insightRows[0] as InsightData)
      }

      setLoading(false)
    }
    init()
  }, [router])

  const fetchData = async (userId: string) => {
    const { data } = await supabase
      .from('mood_entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(14)

    if (data && data.length > 0) {
      setRecentMoods(data)

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

  const handleSubmit = async () => {
    if (moodScore === null || !user) return
    setSaving(true)

    const response = await getADHDCoachAdvice(moodScore, note || null)

    await supabase.from('mood_entries').insert({
      user_id: user.id,
      mood_score: moodScore,
      note: note || null,
      coach_advice: response.advice,
    })

    setCoachResponse(response)
    setCheckInComplete(true)
    setSaving(false)
  }

  const resetCheckIn = async () => {
    setCheckInComplete(false)
    setCoachResponse(null)
    setMoodScore(null)
    setNote('')
    setShowCheckInAnyway(false) // Phase 3: Reset check-in anyway state
    if (user) await fetchData(user.id)
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days === 1) return 'Yesterday'
    return `${days}d ago`
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

  // Trojan Horse save handler (Evening Wind Down only — Morning Key is in MorningSleepCard)
  const saveEveningWindDown = async () => {
    if (!user || savingIntercept) return
    setSavingIntercept(true)
    await supabase.from('burnout_logs').insert({
      user_id: user.id,
      physical_tension: tensionValue,
      source: 'evening_winddown',
    })
    setShowEveningWindDown(false)
    setSavingIntercept(false)
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
          message: "Let's take it easy today. Focus on regulation, not productivity."
        }
      case 'growth':
        return {
          color: '#00ba7c',
          bgColor: 'rgba(0, 186, 124, 0.08)',
          borderColor: 'rgba(0, 186, 124, 0.2)',
          icon: '🚀',
          label: 'Growth Mode',
          message: "You're on fire! Let's channel this energy into something meaningful."
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
  const isRecoveryView = userMode === 'recovery' && !showCheckInAnyway && !checkInComplete
  const isGrowthView = userMode === 'growth' && !showCheckInAnyway && !checkInComplete

  return (
    <div className="dashboard">
      <AppHeader
        onlineCount={onlineCount}
        notificationBar={{
          text: modeConfig.message,
          color: modeConfig.color,
          icon: modeConfig.icon,
        }}
      />

      <main className="main">
        {/* Phase 3: Pinned Context Card - Dynamic based on userMode */}
        {userMode === 'recovery' && !showCheckInAnyway && !checkInComplete ? (
          // RECOVERY MODE CARD
          <div className="card pinned-card recovery">
            <ModeIndicator mode={userMode} position="absolute" />
            <div className="pinned-header">
              <span className="pinned-icon">🫂</span>
              <div className="pinned-titles">
                <h2 className="pinned-title">Low Power Mode Active</h2>
                <p className="pinned-subtitle">Energy is low — let's skip the big tasks.</p>
              </div>
            </div>
            <p className="pinned-message">
              Your last check-in showed you're running on fumes. Today isn't about productivity — it's about getting back to baseline.
            </p>
            <button onClick={() => router.push('/brake')} className="btn-action recovery">
              🛑 Start 10s Reset
            </button>
            <button onClick={() => setShowCheckInAnyway(true)} className="btn-text">
              Check in anyway →
            </button>
          </div>
        ) : userMode === 'growth' && !showCheckInAnyway && !checkInComplete ? (
          // GROWTH MODE CARD
          <div className="card pinned-card growth">
            <ModeIndicator mode={userMode} position="absolute" />
            <div className="pinned-header">
              <span className="pinned-icon">🚀</span>
              <div className="pinned-titles">
                <h2 className="pinned-title">Momentum Detected</h2>
                <p className="pinned-subtitle">You are in the zone.</p>
              </div>
            </div>
            <p className="pinned-message">
              Your mood is high and you've been consistent. Let's channel this energy into something meaningful before it fades.
            </p>
            <button onClick={() => router.push('/focus')} className="btn-action growth">
              ⏱️ Start Focus Session
            </button>
            <button onClick={() => setShowCheckInAnyway(true)} className="btn-text">
              Check in anyway →
            </button>
          </div>
        ) : (
          // MAINTENANCE MODE CARD (or check-in anyway)
          <div className="card main-card">
            <ModeIndicator mode={userMode} position="absolute" />
            <div className="greeting">
              <h1>{getGreeting()} 👋</h1>
              {!showCheckInAnyway && getContextMessage() && <p className="context-msg">{getContextMessage()}</p>}
              {showCheckInAnyway && (
                <p className="context-msg">
                  <button onClick={() => setShowCheckInAnyway(false)} className="back-link">
                    ← Back to {userMode === 'recovery' ? 'Recovery' : 'Growth'} mode
                  </button>
                </p>
              )}
            </div>

            <div className="checkin-button-container">
              <p className="checkin-prompt">
                {userMode === 'maintenance' ? 'Daily Pulse — How are you feeling right now?' : 'Quick check-in:'}
              </p>
              <button
                onClick={() => router.push('/check-in')}
                className="btn-checkin-start"
              >
                🎯 Start Daily Check-In
                {insights?.currentStreak && insights.currentStreak.days >= 1 && (
                  <span className="streak-badge-inline">
                    🔥 {insights.currentStreak.days} {insights.currentStreak.days === 1 ? 'day' : 'days'}
                  </span>
                )}
              </button>
            </div>
          </div>
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
            <button onClick={() => router.push('/focus?mode=sprint&energy=high')} className="btn-action growth">
              ⚡️ Start Hyperfocus Session
            </button>
          </div>
        )}

        {/* AI Insight Card (Pattern Engine) — hidden in Recovery */}
        {!isRecoveryView && aiInsight && (
          <InsightCard insight={aiInsight} onDismiss={() => setAiInsight(null)} />
        )}

        {/* Phase 4: Insight Card (replaces stats-row) — hidden in Recovery */}
        {!isRecoveryView && insights && (insights.trend === 'up' || insights.trend === 'down') && (
          <ProgressiveCard
            id="mood-trend-insight"
            title="Insights"
            icon="💡"
            preview={`Mood trending ${insights.trend === 'up' ? 'up 📈' : 'down 📉'}`}
            defaultExpanded={insights.trend === 'down'} // Auto-expand if trending down
          >
            <div className="insight-content-inner">
              <p className="insight-text">
                Your mood is trending <strong>{insights.trend === 'up' ? 'up 📈' : 'down 📉'}</strong> this week.
                {insights.trend === 'up'
                  ? " You're building momentum — keep it going!"
                  : " Be gentle with yourself. Consider using BREAK today."
                }
              </p>
            </div>
          </ProgressiveCard>
        )}

        {/* Phase 4: Activity Feed — hidden in Recovery */}
        {!isRecoveryView && recentMoods.length > 0 && (
          <ProgressiveCard
            id="recent-activity"
            title="Recent Activity"
            preview={`${recentMoods.length} check-ins`}
            defaultExpanded={false}
          >
            <div className="activity-feed">
              {recentMoods.map((entry) => (
              <div key={entry.id} className="feed-item">
                {/* Tweet-style layout: Avatar left, content right */}
                <div className="feed-avatar">
                  <span className="feed-emoji">{getMoodEmoji(entry.mood_score)}</span>
                </div>

                <div className="feed-body">
                  <div className="feed-meta">
                    <span className="feed-score">{entry.mood_score}/10</span>
                    <span className="feed-dot">·</span>
                    <span className="feed-time">{formatTime(entry.created_at)}</span>
                  </div>

                  {entry.note && (
                    <p className="feed-note">{entry.note}</p>
                  )}

                  {/* Coach advice bubble */}
                  {entry.coach_advice && (
                    <div className="coach-bubble">
                      <span className="coach-label">Der's advice</span>
                      <p className="coach-text">{entry.coach_advice}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}

              <button onClick={() => router.push('/history')} className="feed-view-all">
                View full history & charts →
              </button>
            </div>
          </ProgressiveCard>
        )}
        {/* Evening Wind Down intercept (after 7 PM) */}
        {showEveningWindDown && (
          <div className="card evening-card">
            <div className="evening-header">
              <span className="evening-icon">🌙</span>
              <div>
                <h3 className="evening-title">Evening Wind Down</h3>
                <p className="evening-subtitle">Carrying any tension?</p>
              </div>
            </div>
            <div className="slider-container">
              <input
                type="range"
                min="1"
                max="10"
                value={tensionValue}
                onChange={(e) => setTensionValue(Number(e.target.value))}
                className="intercept-slider"
              />
              <div className="slider-labels">
                <span>None</span>
                <span className="slider-value">{tensionValue}/10</span>
                <span>Very tense</span>
              </div>
            </div>
            <button onClick={saveEveningWindDown} className="evening-btn" disabled={savingIntercept}>
              {savingIntercept ? 'Saving...' : 'Log & Relax'}
            </button>
            <button onClick={() => setShowEveningWindDown(false)} className="evening-skip">
              Dismiss
            </button>
          </div>
        )}
      </main>

      {/* Morning Key Overlay (before 11 AM) — hidden in Recovery */}
      {!isRecoveryView && showMorningKey && user && (
        <MorningSleepCard userId={user.id} onDismiss={() => setShowMorningKey(false)} />
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
    margin-bottom: clamp(12px, 4vw, 18px);
  }

  /* ===== PHASE 3: PINNED CONTEXT CARDS ===== */
  .pinned-card {
    position: relative;
    padding: clamp(20px, 5.5vw, 32px);
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    margin-bottom: clamp(12px, 4vw, 18px);
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

  .btn-text {
    width: 100%;
    margin-top: clamp(12px, 3vw, 16px);
    padding: clamp(8px, 2.5vw, 12px);
    background: none;
    border: none;
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .btn-text:hover {
    color: var(--primary);
  }

  .back-link {
    background: none;
    border: none;
    padding: 0;
    font-size: inherit;
    color: var(--primary);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
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

  /* ===== CHECK-IN FORM ===== */
  .checkin-prompt {
    font-size: clamp(14px, 3.8vw, 17px);
    color: var(--dark-gray);
    margin: 0 0 clamp(14px, 4vw, 20px) 0;
  }

  .mood-grid {
    display: grid;
    grid-template-columns: repeat(11, 1fr);
    gap: clamp(3px, 1vw, 6px);
    margin-bottom: clamp(14px, 4vw, 20px);
  }

  .mood-btn {
    aspect-ratio: 1;
    border: 1px solid #e5e5e5;
    border-radius: clamp(6px, 1.5vw, 10px);
    background: white;
    cursor: pointer;
    font-size: clamp(11px, 3vw, 15px);
    font-weight: 500;
    color: var(--dark-gray);
    transition: all 0.15s ease;
    padding: 0;
  }

  .mood-btn.active {
    border: 2px solid var(--primary);
    background: rgba(29, 155, 240, 0.1);
    font-weight: 700;
    color: var(--primary);
  }

  .mood-selected {
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .selected-display {
    display: flex;
    align-items: center;
    gap: clamp(10px, 3vw, 16px);
    margin-bottom: clamp(12px, 3vw, 16px);
  }

  .emoji-xlarge { font-size: clamp(36px, 10vw, 52px); }
  .score-large { font-size: clamp(24px, 7vw, 34px); font-weight: 800; }

  .note-input {
    width: 100%;
    padding: clamp(10px, 3vw, 14px);
    border: 1px solid #e5e5e5;
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(14px, 3.8vw, 17px);
    resize: none;
    font-family: inherit;
    margin-bottom: clamp(12px, 3vw, 16px);
    box-sizing: border-box;
  }

  .note-input:focus {
    outline: none;
    border-color: var(--primary);
  }

  .btn-primary {
    width: 100%;
    padding: clamp(12px, 3.5vw, 16px);
    background: var(--primary);
    color: white;
    border: none;
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(14px, 4vw, 18px);
    font-weight: 600;
    cursor: pointer;
  }

  .btn-primary:disabled { opacity: 0.7; cursor: wait; }

  .btn-checkin-start {
    width: 100%;
    padding: clamp(16px, 4.5vw, 22px);
    background: linear-gradient(135deg, var(--primary) 0%, #1a8cd8 100%);
    color: white;
    border: none;
    border-radius: clamp(12px, 3vw, 16px);
    font-size: clamp(16px, 4.5vw, 20px);
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(8px, 2vw, 12px);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    box-shadow: 0 4px 16px rgba(29, 155, 240, 0.25);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .btn-checkin-start:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(29, 155, 240, 0.35);
  }

  .btn-checkin-start:active {
    transform: translateY(0);
  }

  .streak-badge-inline {
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 600;
    padding: clamp(4px, 1.5vw, 6px) clamp(8px, 2vw, 12px);
    background: rgba(255, 255, 255, 0.2);
    border-radius: 100px;
  }

  .checkin-button-container {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 3vw, 16px);
  }

  .btn-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
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

  /* ===== CHECK-IN COMPLETE ===== */
  .logged-mood {
    display: flex;
    align-items: center;
    gap: clamp(10px, 3vw, 14px);
    margin-bottom: clamp(14px, 4vw, 18px);
    padding: clamp(10px, 3vw, 14px);
    background: var(--bg-gray);
    border-radius: clamp(10px, 2.5vw, 14px);
  }

  .emoji-large { font-size: clamp(28px, 8vw, 38px); }
  .mood-score { font-size: clamp(18px, 5vw, 24px); font-weight: 700; }
  .mood-time {
    color: var(--light-gray);
    margin-left: clamp(6px, 2vw, 10px);
    font-size: clamp(12px, 3.2vw, 15px);
  }

  .ai-response {
    background: linear-gradient(135deg, rgba(29, 155, 240, 0.08) 0%, rgba(29, 155, 240, 0.02) 100%);
    border-left: 3px solid var(--primary);
    border-radius: 0 clamp(12px, 3vw, 18px) clamp(12px, 3vw, 18px) 0;
    padding: clamp(14px, 4vw, 20px);
  }

  .ai-response p {
    font-size: clamp(14px, 3.8vw, 17px);
    line-height: 1.6;
    color: var(--dark-gray);
    margin: 0 0 clamp(12px, 3vw, 16px) 0;
  }

  .context-badge {
    display: inline-flex;
    align-items: center;
    gap: clamp(4px, 1.5vw, 8px);
    background: rgba(29, 155, 240, 0.1);
    padding: clamp(4px, 1.2vw, 6px) clamp(8px, 2.5vw, 12px);
    border-radius: 20px;
    font-size: clamp(11px, 3vw, 13px);
    color: var(--primary);
  }

  /* ===== INSIGHT CONTENT (inside ProgressiveCard) ===== */
  .insight-content-inner {
    padding: clamp(4px, 1vw, 8px) 0;
  }

  .insight-text {
    font-size: clamp(14px, 3.8vw, 16px);
    color: var(--dark-gray);
    line-height: 1.5;
    margin: 0;
  }

  .insight-text strong {
    color: var(--primary);
  }

  /* ===== PHASE 4: ACTIVITY FEED ===== */
  .activity-feed {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 3.5vw, 16px);
  }

  .feed-header {
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 600;
    color: var(--dark-gray);
    margin: 0 0 clamp(4px, 1vw, 8px) 0;
    padding-left: clamp(4px, 1vw, 8px);
  }

  .feed-item {
    display: flex;
    gap: clamp(12px, 3.5vw, 16px);
    padding: clamp(16px, 4.5vw, 22px);
    background: white;
    border-radius: clamp(14px, 4vw, 20px);
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    border: 1px solid rgba(0,0,0,0.04);
  }

  .feed-avatar {
    flex-shrink: 0;
    width: clamp(40px, 11vw, 52px);
    height: clamp(40px, 11vw, 52px);
    background: var(--bg-gray);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .feed-emoji {
    font-size: clamp(22px, 6vw, 28px);
  }

  .feed-body {
    flex: 1;
    min-width: 0;
  }

  .feed-meta {
    display: flex;
    align-items: center;
    gap: clamp(6px, 1.5vw, 8px);
    margin-bottom: clamp(6px, 1.5vw, 10px);
  }

  .feed-score {
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 700;
    color: var(--text-dark, #0f1419);
  }

  .feed-dot {
    color: var(--light-gray);
    font-size: clamp(10px, 2.5vw, 12px);
  }

  .feed-time {
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--light-gray);
  }

  .feed-note {
    font-size: clamp(14px, 3.8vw, 16px);
    color: var(--dark-gray);
    line-height: 1.5;
    margin: 0 0 clamp(10px, 3vw, 14px) 0;
    word-wrap: break-word;
  }

  /* Coach advice bubble */
  .coach-bubble {
    background: linear-gradient(135deg, rgba(29, 155, 240, 0.08) 0%, rgba(29, 155, 240, 0.03) 100%);
    border-left: 3px solid var(--primary);
    border-radius: 0 clamp(10px, 2.5vw, 14px) clamp(10px, 2.5vw, 14px) 0;
    padding: clamp(10px, 3vw, 14px);
    margin-top: clamp(8px, 2vw, 12px);
  }

  .coach-label {
    font-size: clamp(10px, 2.8vw, 12px);
    font-weight: 600;
    color: var(--primary);
    text-transform: uppercase;
    letter-spacing: 0.3px;
    display: block;
    margin-bottom: clamp(4px, 1vw, 6px);
  }

  .coach-text {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    line-height: 1.5;
    margin: 0;
  }

  .feed-view-all {
    width: 100%;
    padding: clamp(14px, 4vw, 18px);
    background: white;
    border: 1px solid var(--extra-light-gray, #eff3f4);
    border-radius: clamp(12px, 3vw, 16px);
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 600;
    color: var(--primary);
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .feed-view-all:hover {
    background: var(--bg-gray);
  }


  /* ===== RECOVERY MODE: 2-COLUMN ACTION GRID ===== */
  .recovery-actions-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: clamp(10px, 3vw, 16px);
    margin-bottom: clamp(12px, 4vw, 18px);
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

  /* ===== GROWTH MODE: CTA WRAPPER ===== */
  .growth-cta {
    margin-bottom: clamp(12px, 4vw, 18px);
  }

  /* ===== SHARED SLIDER STYLES (Evening Wind Down) ===== */
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

  /* ===== EVENING WIND DOWN CARD ===== */
  .evening-card {
    padding: clamp(18px, 5vw, 26px);
    margin-bottom: clamp(12px, 4vw, 18px);
    border: 1px solid rgba(99, 102, 241, 0.2);
    background: rgba(99, 102, 241, 0.04);
  }

  .evening-header {
    display: flex;
    align-items: center;
    gap: clamp(12px, 3.5vw, 16px);
    margin-bottom: clamp(16px, 4vw, 22px);
  }

  .evening-icon {
    font-size: clamp(32px, 9vw, 42px);
    flex-shrink: 0;
  }

  .evening-title {
    font-size: clamp(16px, 4.5vw, 20px);
    font-weight: 700;
    color: #4338ca;
    margin: 0 0 clamp(2px, 0.5vw, 4px) 0;
  }

  .evening-subtitle {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    margin: 0;
  }

  .evening-btn {
    width: 100%;
    padding: clamp(12px, 3.5vw, 16px);
    background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
    color: white;
    border: none;
    border-radius: 100px;
    font-size: clamp(14px, 4vw, 17px);
    font-weight: 700;
    cursor: pointer;
    margin-bottom: clamp(6px, 1.5vw, 10px);
    box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3);
  }

  .evening-btn:disabled { opacity: 0.7; cursor: wait; }

  .evening-skip {
    width: 100%;
    padding: clamp(8px, 2vw, 12px);
    background: none;
    border: none;
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--dark-gray);
    cursor: pointer;
    text-align: center;
  }

  /* ===== TABLET/DESKTOP ADJUSTMENTS ===== */
  @media (min-width: 768px) {
    .main { padding: 24px; padding-bottom: 24px; }
    .mood-grid { gap: 8px; }
    .mood-btn { font-size: 16px; }
    .stats-row { gap: 16px; }
  }

  @media (min-width: 1024px) {
    .main { max-width: 680px; }
  }
`
