'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { usePresenceWithFallback } from '@/hooks/usePresence'
import ModeIndicator from '@/components/adhd/ModeIndicator'
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
  if (hour >= 11 && hour < 18) return '☀️ Daily Pulse: How is your energy?'
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
  const router = useRouter()
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


  const [pulseSaved, setPulseSaved] = useState(false)
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

      setLoading(false)
    }
    init()
    return () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
    }
  }, [router])

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
      .select('id, title, progress_percent')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)

    if (goalData && goalData.length > 0) {
      setActiveGoal(goalData[0] as ActiveGoal)
    } else {
      setActiveGoal(null)
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
    setPulseSaved(true)
    setTimeout(() => setPulseSaved(false), 2000)
  }

  const handlePulseChange = (value: number) => {
    setMoodScore(value)
    setPulseSaved(false)
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
    }, 1500)
  }

  // Ref to always call latest handlePulseSave (avoids stale closure in timer)
  const handlePulseSaveRef = useRef(handlePulseSave)
  handlePulseSaveRef.current = handlePulseSave

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
        {/* Pinned Context Card - Dynamic based on userMode */}
        {isRecoveryView ? (
          // RECOVERY MODE CARD
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
          // GROWTH MODE CARD
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
            <button onClick={() => router.push('/focus')} className="btn-action growth">
              ⏱️ Start Focus Session
            </button>
          </div>
        ) : (
          // MAINTENANCE MODE CARD
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
                onClick={() => router.push('/goals')}
                className="active-goal-badge"
              >
                <span className="goal-plant">{getPlantEmoji(activeGoal.progress_percent)}</span>
                <span className="goal-badge-text">{activeGoal.title}</span>
                <span className="goal-badge-percent">{activeGoal.progress_percent}%</span>
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
          {pulseSaved && (
            <div className="pulse-saved-toast">✓ Saved</div>
          )}
        </div>

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

        {/* Maintenance Mode: 2x2 action grid */}
        {!isRecoveryView && !isGrowthView && (() => {
          const energy = getEnergyParam(moodScore)
          const focusUrl = energy === 'low'
            ? '/focus?mode=gentle&energy=low'
            : energy === 'high'
              ? '/focus?mode=sprint&energy=high'
              : `/focus?energy=${energy}`
          return (
            <div className="maintenance-actions-grid">
              <button onClick={() => router.push(focusUrl)} className="maintenance-action-btn primary">
                ⏱️ Focus Mode
              </button>
              <button onClick={() => router.push(`/goals?energy=${energy}`)} className="maintenance-action-btn secondary">
                🎯 Goals{activeGoal && <span className="maintenance-badge">1 active</span>}
              </button>
              <button onClick={() => router.push(`/ally?energy=${energy}`)} className="maintenance-action-btn secondary">
                💜 I&apos;m Stuck
              </button>
              <button onClick={() => router.push(`/history?energy=${energy}`)} className="maintenance-action-btn secondary">
                📊 History
              </button>
            </div>
          )
        })()}

      </main>

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

  /* ===== MAINTENANCE MODE: 2x2 ACTION GRID ===== */
  .maintenance-actions-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: clamp(10px, 3vw, 16px);
    margin-bottom: clamp(12px, 4vw, 18px);
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
    margin-bottom: clamp(12px, 4vw, 18px);
  }

  /* ===== ACTIVE GOAL BADGE (Maintenance Mode) ===== */
  .active-goal-badge {
    display: flex;
    align-items: center;
    gap: clamp(8px, 2vw, 12px);
    width: 100%;
    padding: clamp(12px, 3vw, 16px);
    margin-top: clamp(14px, 4vw, 18px);
    background: rgba(0, 186, 124, 0.06);
    border: 1px solid rgba(0, 186, 124, 0.15);
    border-radius: clamp(10px, 2.5vw, 14px);
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: background 0.15s ease;
  }

  .active-goal-badge:hover {
    background: rgba(0, 186, 124, 0.1);
  }

  .goal-plant {
    font-size: clamp(20px, 5.5vw, 26px);
    flex-shrink: 0;
  }

  .goal-badge-text {
    flex: 1;
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 600;
    color: var(--dark-gray);
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .goal-badge-percent {
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 700;
    color: var(--success);
    flex-shrink: 0;
  }

  /* ===== DAILY PULSE CARD ===== */
  .pulse-card {
    padding: clamp(16px, 4.5vw, 24px);
    margin-bottom: clamp(12px, 4vw, 18px);
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

  /* ===== TABLET/DESKTOP ADJUSTMENTS ===== */
  @media (min-width: 768px) {
    .main { padding: 24px; padding-bottom: 24px; }
  }

  @media (min-width: 1024px) {
    .main { max-width: 680px; }
  }
`
