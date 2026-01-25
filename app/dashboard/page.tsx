'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getADHDCoachAdvice } from '@/lib/gemini'
import MoodHistoryViz from '@/components/MoodHistoryViz'

interface MoodEntry {
  id: string
  mood_score: number
  note: string | null
  coach_advice: string | null
  created_at: string
}

const getMoodEmoji = (score: number): string => {
  if (score <= 2) return '😢'
  if (score <= 4) return '😔'
  if (score <= 6) return '😐'
  if (score <= 8) return '🙂'
  return '😄'
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [moodScore, setMoodScore] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [recentMoods, setRecentMoods] = useState<MoodEntry[]>([])
  const [allMoods, setAllMoods] = useState<MoodEntry[]>([])
  const [weeklyAvg, setWeeklyAvg] = useState<number | null>(null)
  const [coachAdvice, setCoachAdvice] = useState<string | null>(null)
  const [showAdvice, setShowAdvice] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      await fetchMoods(session.user.id)
      setLoading(false)
    }
    init()
  }, [router])

  const fetchMoods = async (userId: string) => {
    // Fetch recent moods for display (last 5)
    const { data: recentData } = await supabase
      .from('mood_entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (recentData) {
      setRecentMoods(recentData)
    }

    // Fetch all moods for charts (last 90 days)
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    
    const { data: allData } = await supabase
      .from('mood_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', ninetyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
    
    if (allData) {
      setAllMoods(allData)
      
      // Calculate weekly average
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      const weekMoods = allData.filter(m => new Date(m.created_at) >= oneWeekAgo)
      if (weekMoods.length > 0) {
        const avg = weekMoods.reduce((sum, m) => sum + m.mood_score, 0) / weekMoods.length
        setWeeklyAvg(avg)
      }
    }
  }

  const handleSubmit = async () => {
    if (moodScore === null || !user) return
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
    if (user) await fetchMoods(user.id)
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
    
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  if (loading) {
    return (
      <div className="app-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <span className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" 
                style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent', width: '32px', height: '32px', borderWidth: '3px' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      {/* Top Bar */}
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
        {/* Quick Actions */}
        <div className="card" style={{ borderBottom: '1px solid var(--bg-gray)' }}>
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
            borderRadius: '0 16px 16px 0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ color: 'var(--primary)', fontWeight: 700 }}>🧠 </span>
              <button 
                onClick={dismissAdvice}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer', 
                  color: 'var(--light-gray)',
                  fontSize: '18px',
                  padding: '0',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>
            <p style={{ color: 'var(--dark-gray)', fontSize: '14px', lineHeight: 1.5 }}>
              {coachAdvice}
            </p>
          </div>
        )}

        {/* Weekly Summary */}
        {weeklyAvg !== null && (
          <div className="card" style={{ 
            background: 'linear-gradient(135deg, var(--primary) 0%, #1a91da 100%)',
            color: 'white'
          }}>
            <p style={{ fontSize: '13px', opacity: 0.9, marginBottom: '4px' }}>This week's average</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '36px' }}>{getMoodEmoji(weeklyAvg)}</span>
              <span style={{ fontSize: '32px', fontWeight: 700 }}>{weeklyAvg.toFixed(1)}</span>
              <span style={{ fontSize: '16px', opacity: 0.8 }}>/10</span>
            </div>
          </div>
        )}

        {/* Mood Check-in */}
        <div className="card">
          <div className="page-header">
            <h2 className="page-title">How are you feeling?</h2>
          </div>

          {/* Rating Grid */}
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

        {/* Mood History Visualization */}
        <MoodHistoryViz entries={allMoods} />

        {/* Recent Check-ins */}
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

        {/* Bottom Navigation */}
        <nav className="bottom-nav">
          <button className="nav-item nav-item-active">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            <span>Dashboard</span>
          </button>
          <button onClick={() => router.push('/focus')} className="nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            <span>Focus</span>
          </button>
          <button onClick={() => router.push('/goals')} className="nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
            </svg>
            <span>Goals</span>
          </button>
          <button onClick={() => router.push('/burnout')} className="nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 1 0 10 10H12V2z"/><path d="M12 2a10 10 0 0 1 10 10"/>
            </svg>
            <span>Energy</span>
          </button>
          <button onClick={() => router.push('/village')} className="nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span>Village</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
