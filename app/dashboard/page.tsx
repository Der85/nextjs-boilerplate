'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getADHDCoachAdvice, CoachResponse } from '@/lib/gemini'

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

  // UI state
  const [showHistory, setShowHistory] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)
      await fetchData(session.user.id)
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

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="header">
        <button onClick={() => router.push('/dashboard')} className="logo">
          ADHDer.io
        </button>
        <div className="header-actions">
          {/* Phase 2: Village Presence Indicator */}
          <div className="village-pill">
            <span className="presence-dot"></span>
            <span className="presence-count">42 online</span>
          </div>
          <button onClick={() => router.push('/ally')} className="icon-btn purple" title="I'm stuck">
            💜
          </button>
          <button onClick={() => router.push('/brake')} className="icon-btn red" title="Need to pause">
            🛑
          </button>
          <button onClick={() => setShowMenu(!showMenu)} className="icon-btn menu">
            ☰
          </button>
        </div>

        {showMenu && (
          <div className="dropdown-menu">
            <button onClick={() => { router.push('/focus'); setShowMenu(false) }} className="menu-item">
              ⏱️ Focus Mode
            </button>
            <button onClick={() => { router.push('/goals'); setShowMenu(false) }} className="menu-item">
              🎯 Goals
            </button>
            <button onClick={() => { router.push('/burnout'); setShowMenu(false) }} className="menu-item">
              ⚡ Energy Tracker
            </button>
            <button onClick={() => { router.push('/village'); setShowMenu(false) }} className="menu-item">
              👥 My Village
            </button>
            <div className="menu-divider" />
            <button
              onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
              className="menu-item logout"
            >
              Log out
            </button>
          </div>
        )}
      </header>

      {showMenu && <div className="menu-overlay" onClick={() => setShowMenu(false)} />}

      <main className="main">
        {/* Phase 1: Mode Indicator Banner */}
        {insights && insights.totalCheckIns > 0 && (
          <div 
            className="mode-banner"
            style={{ 
              background: modeConfig.bgColor, 
              borderColor: modeConfig.borderColor 
            }}
          >
            <span className="mode-icon">{modeConfig.icon}</span>
            <div className="mode-content">
              <span className="mode-label" style={{ color: modeConfig.color }}>
                {modeConfig.label}
              </span>
              <span className="mode-message">{modeConfig.message}</span>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="card main-card">
          <div className="greeting">
            <h1>{getGreeting()} 👋</h1>
            {getContextMessage() && <p className="context-msg">{getContextMessage()}</p>}
          </div>

          {checkInComplete && coachResponse ? (
            <div className="checkin-complete">
              <div className="logged-mood">
                <span className="emoji-large">{getMoodEmoji(moodScore!)}</span>
                <div>
                  <span className="mood-score">{moodScore}/10</span>
                  <span className="mood-time">Logged just now</span>
                </div>
              </div>

              <div className="ai-response">
                <p>{coachResponse.advice}</p>
                {coachResponse.context?.currentStreak && (
                  <div className="context-badge">
                    {coachResponse.context.currentStreak.type === 'low_mood' ? '💙' : '🔥'}
                    {coachResponse.context.currentStreak.days} day{coachResponse.context.currentStreak.days > 1 ? 's' : ''}
                    {coachResponse.context.currentStreak.type === 'low_mood' ? ' - I see you' : ' streak'}
                  </div>
                )}
              </div>

              <button onClick={resetCheckIn} className="btn-secondary">
                ✓ Done — check in again later
              </button>
            </div>
          ) : (
            <div className="checkin-form">
              <p className="checkin-prompt">How are you feeling right now?</p>

              <div className="mood-grid">
                {[0,1,2,3,4,5,6,7,8,9,10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setMoodScore(n)}
                    className={`mood-btn ${moodScore === n ? 'active' : ''}`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              {moodScore !== null && (
                <div className="mood-selected">
                  <div className="selected-display">
                    <span className="emoji-xlarge">{getMoodEmoji(moodScore)}</span>
                    <span className="score-large">{moodScore}/10</span>
                  </div>

                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="What's on your mind? (helps me give better advice)"
                    className="note-input"
                    rows={2}
                  />

                  <button onClick={handleSubmit} disabled={saving} className="btn-primary">
                    {saving ? (
                      <span className="btn-loading">
                        <span className="spinner-small" />
                        Thinking...
                      </span>
                    ) : (
                      'Log & Get Advice'
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stats Row */}
        {insights && insights.totalCheckIns > 0 && (
          <div className="stats-row">
            <div className="stat-card">
              <span className="stat-emoji">{insights.recentAverage ? getMoodEmoji(insights.recentAverage) : '📊'}</span>
              <p className="stat-value">{insights.recentAverage?.toFixed(1) || '-'}</p>
              <p className="stat-label">This week</p>
            </div>
            <div className="stat-card">
              <span className="stat-emoji">📝</span>
              <p className="stat-value">{insights.totalCheckIns}</p>
              <p className="stat-label">Check-ins</p>
            </div>
            <div className="stat-card">
              <span className="stat-emoji">{insights.trend === 'up' ? '📈' : insights.trend === 'down' ? '📉' : '➡️'}</span>
              <p className="stat-value">{insights.trend === 'up' ? 'Up' : insights.trend === 'down' ? 'Down' : 'Steady'}</p>
              <p className="stat-label">Trend</p>
            </div>
          </div>
        )}

        {/* Expandable History */}
        {recentMoods.length > 0 && (
          <div className="card history-card">
            <button onClick={() => setShowHistory(!showHistory)} className="history-toggle">
              <span>Recent Check-ins</span>
              <span className={`arrow ${showHistory ? 'open' : ''}`}>▼</span>
            </button>

            {showHistory && (
              <div className="history-list">
                {recentMoods.slice(0, 5).map((entry, i) => (
                  <div key={entry.id} className={`history-item ${i > 0 ? 'bordered' : ''}`}>
                    <span className="history-emoji">{getMoodEmoji(entry.mood_score)}</span>
                    <div className="history-content">
                      <div className="history-header">
                        <span className="history-score">{entry.mood_score}/10</span>
                        <span className="history-time">{formatTime(entry.created_at)}</span>
                      </div>
                      {entry.note && <p className="history-note">{entry.note}</p>}
                    </div>
                  </div>
                ))}

                <button onClick={() => router.push('/history')} className="view-all-btn">
                  View full history & charts →
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="bottom-nav">
        <button className="nav-btn active">
          <span className="nav-icon">🏠</span>
          <span className="nav-label">Home</span>
        </button>
        <button onClick={() => router.push('/focus')} className="nav-btn">
          <span className="nav-icon">⏱️</span>
          <span className="nav-label">Focus</span>
        </button>
        <button onClick={() => router.push('/history')} className="nav-btn">
          <span className="nav-icon">📊</span>
          <span className="nav-label">Insights</span>
        </button>
      </nav>

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

  /* ===== PHASE 2: VILLAGE PRESENCE PILL ===== */
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
    background: #00ba7c;
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
    color: #00ba7c;
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
    padding-bottom: clamp(80px, 20vw, 110px);
    max-width: 600px;
    margin: 0 auto;
  }

  .card {
    background: white;
    border-radius: clamp(14px, 4vw, 22px);
    overflow: hidden;
  }

  .main-card {
    padding: clamp(16px, 5vw, 28px);
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    margin-bottom: clamp(12px, 4vw, 18px);
  }

  /* ===== PHASE 1: MODE BANNER ===== */
  .mode-banner {
    display: flex;
    align-items: center;
    gap: clamp(12px, 3vw, 16px);
    padding: clamp(12px, 3.5vw, 18px);
    border-radius: clamp(12px, 3vw, 16px);
    border: 1px solid;
    margin-bottom: clamp(12px, 4vw, 18px);
  }

  .mode-icon {
    font-size: clamp(24px, 7vw, 32px);
    flex-shrink: 0;
  }

  .mode-content {
    display: flex;
    flex-direction: column;
    gap: clamp(2px, 0.5vw, 4px);
  }

  .mode-label {
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .mode-message {
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--dark-gray);
    line-height: 1.4;
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

  /* ===== STATS ROW ===== */
  .stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: clamp(8px, 2.5vw, 12px);
    margin-bottom: clamp(12px, 4vw, 18px);
  }

  .stat-card {
    background: white;
    border-radius: clamp(10px, 2.5vw, 14px);
    padding: clamp(10px, 3vw, 16px);
    text-align: center;
  }

  .stat-emoji { font-size: clamp(18px, 5vw, 26px); }
  .stat-value {
    font-size: clamp(16px, 4.5vw, 22px);
    font-weight: 700;
    margin: clamp(2px, 1vw, 6px) 0;
  }
  .stat-label {
    font-size: clamp(10px, 2.8vw, 12px);
    color: var(--light-gray);
    margin: 0;
  }

  /* ===== HISTORY ===== */
  .history-card { margin-bottom: clamp(12px, 4vw, 18px); }

  .history-toggle {
    width: 100%;
    padding: clamp(14px, 4vw, 18px);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: none;
    border: none;
    cursor: pointer;
    font-size: clamp(14px, 3.8vw, 17px);
    font-weight: 600;
  }

  .arrow {
    transition: transform 0.2s ease;
    font-size: clamp(10px, 2.5vw, 12px);
  }
  .arrow.open { transform: rotate(180deg); }

  .history-list {
    padding: 0 clamp(14px, 4vw, 18px) clamp(14px, 4vw, 18px);
  }

  .history-item {
    display: flex;
    align-items: flex-start;
    gap: clamp(10px, 3vw, 14px);
    padding: clamp(10px, 3vw, 14px) 0;
  }

  .history-item.bordered { border-top: 1px solid #f0f0f0; }
  .history-emoji { font-size: clamp(22px, 6vw, 30px); flex-shrink: 0; }

  .history-content { flex: 1; min-width: 0; }

  .history-header {
    display: flex;
    align-items: center;
    gap: clamp(6px, 2vw, 10px);
  }

  .history-score { font-weight: 600; font-size: clamp(14px, 3.8vw, 16px); }
  .history-time { color: var(--light-gray); font-size: clamp(11px, 3vw, 14px); }

  .history-note {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    margin: clamp(3px, 1vw, 6px) 0 0 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .view-all-btn {
    width: 100%;
    padding: clamp(10px, 3vw, 14px);
    margin-top: clamp(8px, 2vw, 12px);
    background: var(--bg-gray);
    border: none;
    border-radius: clamp(8px, 2vw, 10px);
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--primary);
    cursor: pointer;
  }

  /* ===== BOTTOM NAV ===== */
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: white;
    border-top: 1px solid #eee;
    display: flex;
    justify-content: space-around;
    padding: clamp(6px, 2vw, 10px) 0;
    padding-bottom: max(clamp(6px, 2vw, 10px), env(safe-area-inset-bottom));
    z-index: 100;
  }

  .nav-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(2px, 1vw, 4px);
    background: none;
    border: none;
    cursor: pointer;
    padding: clamp(6px, 2vw, 10px) clamp(14px, 4vw, 20px);
    color: var(--light-gray);
  }

  .nav-btn.active { color: var(--primary); }
  .nav-icon { font-size: clamp(18px, 5vw, 24px); }
  .nav-label { font-size: clamp(10px, 2.8vw, 12px); font-weight: 400; }
  .nav-btn.active .nav-label { font-weight: 600; }

  /* ===== TABLET/DESKTOP ADJUSTMENTS ===== */
  @media (min-width: 768px) {
    .main { padding: 24px; padding-bottom: 120px; }
    .mood-grid { gap: 8px; }
    .mood-btn { font-size: 16px; }
    .stats-row { gap: 16px; }
  }

  @media (min-width: 1024px) {
    .header { padding: 16px 32px; }
    .main { max-width: 680px; }
  }
`
