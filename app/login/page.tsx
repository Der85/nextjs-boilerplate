'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getMoodEmoji } from '@/lib/adhderData'

interface MoodEntry {
  id: string
  mood_score: number
  note: string | null
  created_at: string
}

interface Goal {
  id: string
  title: string
  progress_percent: number
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [moodScore, setMoodScore] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [recentMoods, setRecentMoods] = useState<MoodEntry[]>([])
  const [activeGoals, setActiveGoals] = useState<Goal[]>([])
  const [weeklyAvg, setWeeklyAvg] = useState<number | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      
      setUser(session.user)
      await Promise.all([fetchMoods(), fetchGoals()])
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

  const fetchGoals = async () => {
    const { data } = await supabase
      .from('goals')
      .select('id, title, progress_percent')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(3)
    if (data) setActiveGoals(data)
  }

  const handleSubmit = async () => {
    if (!user || moodScore === null) return
    setSaving(true)
    await supabase.from('mood_entries').insert({
      user_id: user.id,
      mood_score: moodScore,
      note: note || null,
    })
    setNote('')
    setMoodScore(null)
    await fetchMoods()
    setSaving(false)
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
        <div className="w-8 h-8 border-2 border-[#1da1f2] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="app-container">
      {/* Top Bar */}
      <div className="top-bar">
        <div className="top-bar-inner">
          <h1 style={{ fontSize: '19px', fontWeight: 800, color: '#1da1f2' }}>
            ADHDer.io
          </h1>
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
        {/* Quick Actions */}
        <div className="card" style={{ borderBottom: '10px solid var(--bg-gray)' }}>
          <p className="text-muted text-sm mb-3">Quick actions</p>
          <div className="flex gap-2">
            <button onClick={() => router.push('/ally')} className="btn btn-outline" style={{ flex: 1 }}>
              💜 I'm stuck
            </button>
            <button onClick={() => router.push('/brake')} className="btn btn-outline" style={{ flex: 1 }}>
              🛑 Need to pause
            </button>
          </div>
        </div>

        {/* Mood Check-in (like compose tweet) */}
        <div className="compose-box">
          <p className="font-bold text-lg mb-3">How are you feeling?</p>
          
          {/* Rating buttons */}
          <div className="rating-grid mb-4">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
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
              <div className="flex items-center gap-3 mb-4">
                <span className="emoji-large">{getMoodEmoji(moodScore)}</span>
                <span className="text-2xl font-extrabold">{moodScore}/10</span>
              </div>

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What's happening? (optional)"
                className="input-borderless w-full"
                rows={2}
              />

              <div className="flex justify-end mt-3">
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="btn btn-primary"
                >
                  {saving ? 'Saving...' : 'Log mood'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Stats */}
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

        {/* Section header */}
        <div className="page-header">
          <h2 className="page-title">Recent check-ins</h2>
        </div>

        {/* Recent moods (like tweets) */}
        {recentMoods.length === 0 ? (
          <div className="card text-center" style={{ padding: '40px 15px' }}>
            <p className="text-muted">No check-ins yet</p>
            <p className="text-sm text-muted mt-1">Your mood history will appear here</p>
          </div>
        ) : (
          recentMoods.map((entry) => (
            <div key={entry.id} className="card">
              <div className="flex items-center gap-3">
                <span className="emoji-medium">{getMoodEmoji(entry.mood_score)}</span>
                <div style={{ flex: 1 }}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{entry.mood_score}/10</span>
                    <span className="text-muted">·</span>
                    <span className="text-muted text-sm">{formatTime(entry.created_at)}</span>
                  </div>
                  {entry.note && (
                    <p className="mt-1" style={{ color: 'var(--black)' }}>{entry.note}</p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Goals section */}
        {activeGoals.length > 0 && (
          <>
            <div className="section-divider" />
            <div className="page-header flex justify-between items-center">
              <h2 className="page-title">Goals</h2>
              <button onClick={() => router.push('/goals')} className="btn btn-ghost text-sm">
                See all
              </button>
            </div>
            {activeGoals.map((goal) => (
              <div 
                key={goal.id} 
                className="card card-clickable"
                onClick={() => router.push('/goals')}
              >
                <p className="font-bold mb-2">{goal.title}</p>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${goal.progress_percent}%` }} />
                </div>
                <p className="text-sm text-muted mt-2">{goal.progress_percent}% complete</p>
              </div>
            ))}
          </>
        )}

        {/* Tools section */}
        <div className="section-divider" />
        <div className="page-header">
          <h2 className="page-title">Tools</h2>
        </div>
        
        <div className="card card-clickable" onClick={() => router.push('/focus')}>
          <div className="flex items-center gap-3">
            <span className="emoji-medium">🔨</span>
            <div>
              <p className="font-bold">Break it down</p>
              <p className="text-sm text-muted">Split tasks into smaller steps</p>
            </div>
          </div>
        </div>

        <div className="card card-clickable" onClick={() => router.push('/goals')}>
          <div className="flex items-center gap-3">
            <span className="emoji-medium">🌱</span>
            <div>
              <p className="font-bold">Goals</p>
              <p className="text-sm text-muted">Track your progress</p>
            </div>
          </div>
        </div>

        <div className="card card-clickable" onClick={() => router.push('/burnout')}>
          <div className="flex items-center gap-3">
            <span className="emoji-medium">🔋</span>
            <div>
              <p className="font-bold">Battery check</p>
              <p className="text-sm text-muted">Monitor your energy levels</p>
            </div>
          </div>
        </div>

        <div className="card card-clickable" onClick={() => router.push('/village')}>
          <div className="flex items-center gap-3">
            <span className="emoji-medium">👥</span>
            <div>
              <p className="font-bold">My village</p>
              <p className="text-sm text-muted">Your support network</p>
            </div>
          </div>
        </div>

        {/* Bottom padding */}
        <div style={{ height: '50px' }} />
      </div>
    </div>
  )
}
