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
  
  // UI state
  const [showHistory, setShowHistory] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      await fetchData(session.user.id)
      setLoading(false)
    }
    init()
  }, [router])

  const fetchData = async (userId: string) => {
    // Fetch recent moods
    const { data } = await supabase
      .from('mood_entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(14)
    
    if (data && data.length > 0) {
      setRecentMoods(data)
      
      // Calculate insights
      const lastEntry = data[0]
      const daysSince = Math.floor(
        (Date.now() - new Date(lastEntry.created_at).getTime()) / (1000 * 60 * 60 * 24)
      )
      
      // Calculate streak (consecutive days with entries)
      let streak = 1
      for (let i = 1; i < data.length; i++) {
        const curr = new Date(data[i - 1].created_at)
        const prev = new Date(data[i].created_at)
        const diff = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
        if (diff <= 1) streak++
        else break
      }

      // Calculate trend (comparing last 3 to previous 3)
      let trend: 'up' | 'down' | 'stable' | null = null
      if (data.length >= 6) {
        const recent3 = data.slice(0, 3).reduce((s, m) => s + m.mood_score, 0) / 3
        const prev3 = data.slice(3, 6).reduce((s, m) => s + m.mood_score, 0) / 3
        if (recent3 - prev3 > 0.5) trend = 'up'
        else if (prev3 - recent3 > 0.5) trend = 'down'
        else trend = 'stable'
      }

      // Recent average
      const recentAvg = data.slice(0, 7).reduce((s, m) => s + m.mood_score, 0) / Math.min(data.length, 7)

      setInsights({
        totalCheckIns: data.length,
        currentStreak: streak >= 2 ? { type: 'checking_in', days: streak } : null,
        lastMood: lastEntry.mood_score,
        lastNote: lastEntry.note,
        daysSinceLastCheckIn: daysSince,
        recentAverage: Math.round(recentAvg * 10) / 10,
        trend
      })
    }
  }

  const handleSubmit = async () => {
    if (moodScore === null || !user) return
    setSaving(true)

    // Get context-aware advice from Gemini
    const response = await getADHDCoachAdvice(moodScore, note || null)
    
    // Save to database
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

  // Generate context-aware subtitle
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

  if (loading) {
    return (
      <div className="app-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <div style={{ textAlign: 'center' }}>
            <span 
              className="animate-spin" 
              style={{ 
                display: 'block',
                width: '32px', 
                height: '32px', 
                border: '3px solid var(--primary)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                margin: '0 auto 12px'
              }} 
            />
            <p style={{ color: 'var(--light-gray)' }}>Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container" style={{ background: 'var(--bg-gray)', minHeight: '100vh' }}>
      {/* Minimal Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        background: 'white',
        borderBottom: '1px solid #eee',
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 100
      }}>
        <button 
          onClick={() => router.push('/dashboard')}
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer',
            fontSize: '18px', 
            fontWeight: 800, 
            color: 'var(--primary)' 
          }}
        >
          ADHDer.io
        </button>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* Quick Actions - Collapsed into icon buttons */}
          <button 
            onClick={() => router.push('/ally')}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(128, 90, 213, 0.1)',
              cursor: 'pointer',
              fontSize: '16px'
            }}
            title="I'm stuck"
          >
            💜
          </button>
          <button 
            onClick={() => router.push('/brake')}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: 'none',
              background: 'rgba(239, 68, 68, 0.1)',
              cursor: 'pointer',
              fontSize: '16px'
            }}
            title="Need to pause"
          >
            🛑
          </button>
          <button 
            onClick={() => setShowMenu(!showMenu)}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: '1px solid #ddd',
              background: 'white',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ☰
          </button>
        </div>

        {/* Dropdown Menu */}
        {showMenu && (
          <div style={{
            position: 'absolute',
            top: '56px',
            right: '16px',
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            padding: '8px',
            minWidth: '160px',
            zIndex: 200
          }}>
            <button 
              onClick={() => { router.push('/focus'); setShowMenu(false) }}
              style={menuItemStyle}
            >
              ⏱️ Focus Mode
            </button>
            <button 
              onClick={() => { router.push('/goals'); setShowMenu(false) }}
              style={menuItemStyle}
            >
              🎯 Goals
            </button>
            <button 
              onClick={() => { router.push('/burnout'); setShowMenu(false) }}
              style={menuItemStyle}
            >
              ⚡ Energy Tracker
            </button>
            <button 
              onClick={() => { router.push('/village'); setShowMenu(false) }}
              style={menuItemStyle}
            >
              👥 My Village
            </button>
            <div style={{ borderTop: '1px solid #eee', margin: '8px 0' }} />
            <button 
              onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
              style={{ ...menuItemStyle, color: '#ef4444' }}
            >
              Log out
            </button>
          </div>
        )}
      </header>

      {/* Click outside to close menu */}
      {showMenu && (
        <div 
          onClick={() => setShowMenu(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99
          }}
        />
      )}

      <main style={{ padding: '16px', paddingBottom: '100px' }}>
        {/* Main Card - The ONE thing to focus on */}
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          marginBottom: '16px'
        }}>
          {/* Personalized Greeting */}
          <div style={{ marginBottom: '20px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>
              {getGreeting()} 👋
            </h1>
            {getContextMessage() && (
              <p style={{ color: 'var(--dark-gray)', fontSize: '14px' }}>
                {getContextMessage()}
              </p>
            )}
          </div>

          {/* Check-in Complete State */}
          {checkInComplete && coachResponse ? (
            <div>
              {/* What they logged */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
                padding: '12px',
                background: 'var(--bg-gray)',
                borderRadius: '12px'
              }}>
                <span style={{ fontSize: '32px' }}>{getMoodEmoji(moodScore!)}</span>
                <div>
                  <span style={{ fontSize: '20px', fontWeight: 700 }}>{moodScore}/10</span>
                  <span style={{ color: 'var(--light-gray)', marginLeft: '8px', fontSize: '14px' }}>
                    Logged just now
                  </span>
                </div>
              </div>

              {/* AI Response - THE STAR */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(29, 155, 240, 0.08) 0%, rgba(29, 155, 240, 0.02) 100%)',
                borderLeft: '3px solid var(--primary)',
                borderRadius: '0 16px 16px 0',
                padding: '16px'
              }}>
                <p style={{ 
                  fontSize: '15px', 
                  lineHeight: 1.6, 
                  color: 'var(--dark-gray)',
                  marginBottom: '16px'
                }}>
                  {coachResponse.advice}
                </p>
                
                {/* Context badge (optional - shows the AI "gets" them) */}
                {coachResponse.context?.currentStreak && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(29, 155, 240, 0.1)',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    color: 'var(--primary)'
                  }}>
                    {coachResponse.context.currentStreak.type === 'low_mood' ? '💙' : '🔥'}
                    {coachResponse.context.currentStreak.days} day{coachResponse.context.currentStreak.days > 1 ? 's' : ''}
                    {coachResponse.context.currentStreak.type === 'low_mood' ? ' - I see you' : ' streak'}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button
                onClick={resetCheckIn}
                style={{
                  width: '100%',
                  marginTop: '16px',
                  padding: '12px',
                  background: 'var(--bg-gray)',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  color: 'var(--dark-gray)',
                  cursor: 'pointer'
                }}
              >
                ✓ Done — check in again later
              </button>
            </div>
          ) : (
            /* Check-in Form */
            <div>
              <p style={{ 
                fontSize: '15px', 
                color: 'var(--dark-gray)', 
                marginBottom: '16px' 
              }}>
                How are you feeling right now?
              </p>

              {/* Mood Slider/Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(11, 1fr)',
                gap: '4px',
                marginBottom: '16px'
              }}>
                {[0,1,2,3,4,5,6,7,8,9,10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setMoodScore(n)}
                    style={{
                      aspectRatio: '1',
                      border: moodScore === n ? '2px solid var(--primary)' : '1px solid #e5e5e5',
                      borderRadius: '8px',
                      background: moodScore === n ? 'rgba(29, 155, 240, 0.1)' : 'white',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: moodScore === n ? 700 : 500,
                      color: moodScore === n ? 'var(--primary)' : 'var(--dark-gray)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>

              {/* Selected mood display + note */}
              {moodScore !== null && (
                <div style={{ 
                  animation: 'fadeIn 0.2s ease',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '12px'
                  }}>
                    <span style={{ fontSize: '40px' }}>{getMoodEmoji(moodScore)}</span>
                    <span style={{ fontSize: '28px', fontWeight: 800 }}>{moodScore}/10</span>
                  </div>

                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="What's on your mind? (helps me give better advice)"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e5e5e5',
                      borderRadius: '12px',
                      fontSize: '15px',
                      resize: 'none',
                      fontFamily: 'inherit',
                      marginBottom: '12px'
                    }}
                    rows={2}
                  />

                  <button
                    onClick={handleSubmit}
                    disabled={saving}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: 'var(--primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '16px',
                      fontWeight: 600,
                      cursor: saving ? 'wait' : 'pointer',
                      opacity: saving ? 0.7 : 1
                    }}
                  >
                    {saving ? (
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <span 
                          className="animate-spin"
                          style={{ 
                            width: '16px', 
                            height: '16px', 
                            border: '2px solid white',
                            borderTopColor: 'transparent',
                            borderRadius: '50%',
                            display: 'inline-block'
                          }} 
                        />
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

        {/* Stats Row - Compact */}
        {insights && insights.totalCheckIns > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            marginBottom: '16px'
          }}>
            <StatCard 
              label="This week" 
              value={insights.recentAverage?.toFixed(1) || '-'} 
              emoji={insights.recentAverage ? getMoodEmoji(insights.recentAverage) : '📊'}
            />
            <StatCard 
              label="Check-ins" 
              value={insights.totalCheckIns.toString()}
              emoji="📝"
            />
            <StatCard 
              label="Trend" 
              value={insights.trend === 'up' ? 'Up' : insights.trend === 'down' ? 'Down' : 'Steady'}
              emoji={insights.trend === 'up' ? '📈' : insights.trend === 'down' ? '📉' : '➡️'}
            />
          </div>
        )}

        {/* Expandable History Section */}
        {recentMoods.length > 0 && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            overflow: 'hidden'
          }}>
            <button
              onClick={() => setShowHistory(!showHistory)}
              style={{
                width: '100%',
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: 600
              }}
            >
              <span>Recent Check-ins</span>
              <span style={{ 
                transform: showHistory ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}>
                ▼
              </span>
            </button>

            {showHistory && (
              <div style={{ padding: '0 16px 16px' }}>
                {recentMoods.slice(0, 5).map((entry, i) => (
                  <div 
                    key={entry.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px 0',
                      borderTop: i > 0 ? '1px solid #f0f0f0' : 'none'
                    }}
                  >
                    <span style={{ fontSize: '24px' }}>{getMoodEmoji(entry.mood_score)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600 }}>{entry.mood_score}/10</span>
                        <span style={{ color: 'var(--light-gray)', fontSize: '13px' }}>
                          {formatTime(entry.created_at)}
                        </span>
                      </div>
                      {entry.note && (
                        <p style={{ 
                          fontSize: '14px', 
                          color: 'var(--dark-gray)',
                          marginTop: '4px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {entry.note}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {/* View Full History Link */}
                <button
                  onClick={() => router.push('/history')}
                  style={{
                    width: '100%',
                    padding: '12px',
                    marginTop: '8px',
                    background: 'var(--bg-gray)',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: 'var(--primary)',
                    cursor: 'pointer'
                  }}
                >
                  View full history & charts →
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Simplified Bottom Nav - Only 3 key actions */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'white',
        borderTop: '1px solid #eee',
        display: 'flex',
        justifyContent: 'space-around',
        padding: '8px 0 max(8px, env(safe-area-inset-bottom))',
        zIndex: 100
      }}>
        <NavButton 
          icon="🏠" 
          label="Home" 
          active={true}
          onClick={() => {}}
        />
        <NavButton 
          icon="⏱️" 
          label="Focus" 
          onClick={() => router.push('/focus')}
        />
        <NavButton 
          icon="📊" 
          label="Insights" 
          onClick={() => router.push('/history')}
        />
      </nav>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// Helper Components
const StatCard = ({ label, value, emoji }: { label: string; value: string; emoji: string }) => (
  <div style={{
    background: 'white',
    borderRadius: '12px',
    padding: '12px',
    textAlign: 'center'
  }}>
    <span style={{ fontSize: '20px' }}>{emoji}</span>
    <p style={{ fontSize: '18px', fontWeight: 700, margin: '4px 0 2px' }}>{value}</p>
    <p style={{ fontSize: '11px', color: 'var(--light-gray)' }}>{label}</p>
  </div>
)

const NavButton = ({ icon, label, active, onClick }: { 
  icon: string; 
  label: string; 
  active?: boolean;
  onClick: () => void 
}) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '8px 16px',
      color: active ? 'var(--primary)' : 'var(--light-gray)',
      fontSize: '20px'
    }}
  >
    <span>{icon}</span>
    <span style={{ fontSize: '11px', fontWeight: active ? 600 : 400 }}>{label}</span>
  </button>
)

const menuItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '10px 12px',
  textAlign: 'left',
  background: 'none',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '14px',
  color: 'var(--dark-gray)'
}
