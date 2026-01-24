'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getADHDCoachAdvice } from '@/lib/gemini'

interface MoodEntry {
  id: string
  mood_score: number
  note: string | null
  coach_advice: string | null
  created_at: string
}

const getMoodEmoji = (score: number): string => {
  if (score <= 2) return '😢'
  if (score <= 4) return '😕'
  if (score <= 6) return '😐'
  if (score <= 8) return '🙂'
  return '😊'
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [moodScore, setMoodScore] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [recentMoods, setRecentMoods] = useState<MoodEntry[]>([])
  const [weeklyAvg, setWeeklyAvg] = useState<number | null>(null)
  const [coachAdvice, setCoachAdvice] = useState<string | null>(null)
  const [showAdvice, setShowAdvice] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      await fetchMoods()
      setLoading(false)
    }
    init()
  }, [router])

  const fetchMoods = async () => {
    const { data } = await supabase
      .from('mood_entries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (data) {
      setRecentMoods(data)
      if (data.length > 0) {
        const avg = data.reduce((s, e) => s + e.mood_score, 0) / data.length
        setWeeklyAvg(Math.round(avg * 10) / 10)
      }
    }
  }

  const handleSubmit = async () => {
    if (!user || moodScore === null) return
    setSaving(true)
    setCoachAdvice(null)
    
    // Get advice from Gemini
    const advice = await getADHDCoachAdvice(moodScore, note || null)
    
    // Save to database
    await supabase.from('mood_entries').insert({
      user_id: user.id,
      mood_score: moodScore,
      note: note || null,
      coach_advice: advice,
    })
    
    // Show the advice
    setCoachAdvice(advice)
    setShowAdvice(true)
    
    // Reset form but keep advice visible
    setNote('')
    setMoodScore(null)
    await fetchMoods()
    setSaving(false)
  }

  const dismissAdvice = () => {
    setShowAdvice(false)
    setCoachAdvice(null)
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return 'now'
    if (mins < 60) return `${mins}m`
    if (hours < 24) return `${hours}h`
    if (days < 7) return `${days}d`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="app-container flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="app-container">
      <div className="top-bar">
        <div className="top-bar-inner">
          <h1 style={{ fontSize: '19px', fontWeight: 800, color: 'var(--primary)' }}>ADHDer.io</h1>
          <button 
            onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
            className="btn btn-ghost"
            style={{ height: '32px', padding: '0 12px', fontSize: '14px' }}
          >
            Log out
          </button>
        </div>
      </div>

      <div className="main-content">
        <div className="card" style={{ borderBottom: '10px solid var(--bg-gray)' }}>
          <p className="text-muted text-sm mb-3">Quick actions</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => router.push('/ally')} className="btn btn-outline" style={{ flex: 1 }}>
              💜 I'm stuck
            </button>
            <button onClick={() => router.push('/brake')} className="btn btn-outline" style={{ flex: 1 }}>
              🛑 Need to pause
            </button>
          </div>
        </div>

        {/* Coach Advice Display */}
        {showAdvice && coachAdvice && (
          <div className="card" style={{ 
            background: 'rgba(29, 161, 242, 0.08)', 
            borderLeft: '3px solid var(--primary)',
            borderBottom: '10px solid var(--bg-gray)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>🧠</span>
              <div style={{ flex: 1 }}>
                <p className="text-sm font-bold mb-1" style={{ color: 'var(--primary)' }}>Your ADHD Coach says:</p>
                <p style={{ lineHeight: 1.5 }}>{coachAdvice}</p>
              </div>
              <button onClick={dismissAdvice} className="btn btn-ghost btn-icon" style={{ marginTop: '-4px' }}>×</button>
            </div>
          </div>
        )}

        <div className="compose-box">
          <p className="font-bold text-lg mb-3">How are you feeling?</p>
          <div className="rating-grid mb-4">
            {[0,1,2,3,4,5,6,7,8,9,10].map((n) => (
              <button
                key={n}
                onClick={() => setMoodScore(n)}
                className={`rating-btn ${moodScore === n ? 'rating-btn-active' : ''}`}
              >
                {n}
              </button>
            ))}
          </div>

          {moodScore !== null && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <span className="emoji-large">{getMoodEmoji(moodScore)}</span>
                <span className="text-2xl font-extrabold">{moodScore}/10</span>
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What's happening? (optional - helps personalize advice)"
                className="input-borderless w-full"
                rows={2}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button onClick={handleSubmit} disabled={saving} className="btn btn-primary">
                  {saving ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Getting advice...
                    </span>
                  ) : 'Log mood'}
                </button>
              </div>
            </>
          )}
        </div>

        {weeklyAvg && (
          <div className="card">
            <div className="stats-row">
              <div className="stat">
                <span className="stat-value">{weeklyAvg}</span>
                <span className="stat-label">avg this week</span>
              </div>
              <div className="stat">
                <span className="stat-value">{recentMoods.length}</span>
                <span className="stat-label">check-ins</span>
              </div>
            </div>
          </div>
        )}

        <div className="page-header"><h2 className="page-title">Recent check-ins</h2></div>

        {recentMoods.length === 0 ? (
          <div className="card text-center" style={{ padding: '40px 15px' }}>
            <p className="text-muted">No check-ins yet</p>
          </div>
        ) : (
          recentMoods.map((entry) => (
            <div key={entry.id} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="emoji-medium">{getMoodEmoji(entry.mood_score)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="font-bold">{entry.mood_score}/10</span>
                    <span className="text-muted">·</span>
                    <span className="text-muted text-sm">{formatTime(entry.created_at)}</span>
                  </div>
                  {entry.note && <p className="mt-1">{entry.note}</p>}
                  {entry.coach_advice && (
                    <div style={{ 
                      marginTop: '8px', 
                      padding: '8px 12px', 
                      background: 'rgba(29, 161, 242, 0.05)', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: 'var(--dark-gray)'
                    }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 700 }}>🧠 </span>
                      {entry.coach_advice}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        <div className="section-divider" />
        <div className="page-header"><h2 className="page-title">Tools</h2></div>
        
        {[
          { path: '/focus', icon: '🔨', title: 'Break it down', desc: 'Split tasks into smaller steps' },
          { path: '/goals', icon: '🌱', title: 'Goals', desc: 'Track your progress' },
          { path: '/burnout', icon: '🔋', title: 'Battery check', desc: 'Monitor your energy' },
          { path: '/village', icon: '👥', title: 'My village', desc: 'Your support network' },
        ].map((tool) => (
          <div key={tool.path} className="card card-clickable" onClick={() => router.push(tool.path)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="emoji-medium">{tool.icon}</span>
              <div>
                <p className="font-bold">{tool.title}</p>
                <p className="text-sm text-muted">{tool.desc}</p>
              </div>
            </div>
          </div>
        ))}

        <div style={{ height: '50px' }} />
      </div>
    </div>
  )
}