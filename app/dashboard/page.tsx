'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getMoodEmoji, getMoodColor } from '@/lib/adhderData'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface MoodEntry {
  id: string
  mood_score: number
  note: string | null
  created_at: string
}

interface WeeklyStats {
  moodAvg: number | null
  moodCount: number
  allyCount: number
  impulseCount: number
  impulseSuccessRate: number | null
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [moodScore, setMoodScore] = useState(5)
  const [note, setNote] = useState('')
  const [entries, setEntries] = useState<MoodEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({
    moodAvg: null,
    moodCount: 0,
    allyCount: 0,
    impulseCount: 0,
    impulseSuccessRate: null
  })

  useEffect(() => {
    const checkUserAndFetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }
      
      setUser(session.user)
      await Promise.all([
        fetchEntries(),
        fetchWeeklyStats(session.user.id)
      ])
      setLoading(false)
    }

    checkUserAndFetchData()
  }, [router])

  const fetchEntries = async () => {
    const { data, error } = await supabase
      .from('mood_entries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    if (!error && data) {
      setEntries(data)
    }
  }

  const fetchWeeklyStats = async (userId: string) => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoISO = weekAgo.toISOString()

    // Fetch mood stats
    const { data: moodData } = await supabase
      .from('mood_entries')
      .select('mood_score')
      .gte('created_at', weekAgoISO)

    // Fetch ally sessions count
    const { count: allyCount } = await supabase
      .from('ally_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgoISO)

    // Fetch impulse events
    const { data: impulseData } = await supabase
      .from('impulse_events')
      .select('acted_on_impulse')
      .gte('created_at', weekAgoISO)

    const moodScores = moodData?.map(m => m.mood_score) || []
    const moodAvg = moodScores.length > 0 
      ? Math.round((moodScores.reduce((a, b) => a + b, 0) / moodScores.length) * 10) / 10
      : null

    const impulseResults = impulseData?.filter(i => i.acted_on_impulse !== null) || []
    const impulseSuccesses = impulseResults.filter(i => i.acted_on_impulse === false).length
    const impulseSuccessRate = impulseResults.length > 0
      ? Math.round((impulseSuccesses / impulseResults.length) * 100)
      : null

    setWeeklyStats({
      moodAvg,
      moodCount: moodScores.length,
      allyCount: allyCount || 0,
      impulseCount: impulseData?.length || 0,
      impulseSuccessRate
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const { error } = await supabase
      .from('mood_entries')
      .insert({
        user_id: user.id,
        mood_score: moodScore,
        note: note || null,
      })

    if (!error) {
      setNote('')
      setMoodScore(5)
      await fetchEntries()
      await fetchWeeklyStats(user.id)
    }

    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('mood_entries')
      .delete()
      .eq('id', id)

    if (!error) {
      await fetchEntries()
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const getWeekData = () => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    return entries
      .filter(entry => new Date(entry.created_at) >= weekAgo)
      .map(entry => ({
        date: new Date(entry.created_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }),
        mood: entry.mood_score,
      }))
      .reverse()
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    }
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-800">ADHDer.net</h1>
            <p className="text-sm text-slate-500">{getGreeting()}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-slate-500 hover:text-slate-700 text-sm font-medium"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        
        {/* Smart State Selector - "How are you right now?" */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 text-center">
            What do you need right now?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Track Mood - Teal */}
            <button
              onClick={() => document.getElementById('mood-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="flex flex-col items-center p-5 bg-gradient-to-br from-teal-50 to-cyan-50 hover:from-teal-100 hover:to-cyan-100 rounded-xl border-2 border-teal-200 transition-all hover:scale-[1.02]"
            >
              <span className="text-3xl mb-2">📊</span>
              <span className="font-semibold text-teal-700">Check In</span>
              <span className="text-sm text-teal-600 mt-1">Log how I'm feeling</span>
            </button>

            {/* Stuck/Paralysed - Purple */}
            <button
              onClick={() => router.push('/ally')}
              className="flex flex-col items-center p-5 bg-gradient-to-br from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 rounded-xl border-2 border-purple-200 transition-all hover:scale-[1.02]"
            >
              <span className="text-3xl mb-2">💜</span>
              <span className="font-semibold text-purple-700">I'm Stuck</span>
              <span className="text-sm text-purple-600 mt-1">Can't start or focus</span>
            </button>

            {/* Crisis/Reactive - Amber */}
            <button
              onClick={() => router.push('/brake')}
              className="flex flex-col items-center p-5 bg-gradient-to-br from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 rounded-xl border-2 border-amber-200 transition-all hover:scale-[1.02]"
            >
              <span className="text-3xl mb-2">🛑</span>
              <span className="font-semibold text-amber-700">Hit the Brake</span>
              <span className="text-sm text-amber-600 mt-1">About to react</span>
            </button>
          </div>
        </div>

        {/* Weekly Insights */}
        {(weeklyStats.moodCount > 0 || weeklyStats.allyCount > 0 || weeklyStats.impulseCount > 0) && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Your Week</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Mood Average */}
              <div className="bg-teal-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-teal-700">
                  {weeklyStats.moodAvg !== null ? weeklyStats.moodAvg : '—'}
                </div>
                <div className="text-sm text-teal-600">Avg Mood</div>
                <div className="text-xs text-teal-500 mt-1">{weeklyStats.moodCount} check-ins</div>
              </div>

              {/* Ally Sessions */}
              <div className="bg-purple-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-purple-700">{weeklyStats.allyCount}</div>
                <div className="text-sm text-purple-600">Ally Sessions</div>
                <div className="text-xs text-purple-500 mt-1">times unstuck</div>
              </div>

              {/* Impulse Events */}
              <div className="bg-amber-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-amber-700">{weeklyStats.impulseCount}</div>
                <div className="text-sm text-amber-600">Brakes Hit</div>
                <div className="text-xs text-amber-500 mt-1">impulses caught</div>
              </div>

              {/* Success Rate */}
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-green-700">
                  {weeklyStats.impulseSuccessRate !== null ? `${weeklyStats.impulseSuccessRate}%` : '—'}
                </div>
                <div className="text-sm text-green-600">Success Rate</div>
                <div className="text-xs text-green-500 mt-1">impulses managed</div>
              </div>
            </div>
          </div>
        )}

        {/* Mood Input Card */}
        <div id="mood-section" className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">How are you feeling?</h2>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Mood Slider */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-4xl">{getMoodEmoji(moodScore)}</span>
                <span className={`text-4xl font-bold ${getMoodColor(moodScore)}`}>
                  {moodScore}
                </span>
              </div>
              
              <input
                type="range"
                min="0"
                max="10"
                value={moodScore}
                onChange={(e) => setMoodScore(Number(e.target.value))}
                className="w-full h-3 bg-gradient-to-r from-red-300 via-yellow-300 to-green-300 rounded-full appearance-none cursor-pointer"
              />
              
              <div className="flex justify-between text-xs text-slate-400">
                <span>Struggling</span>
                <span>Okay</span>
                <span>Great</span>
              </div>
            </div>

            {/* Note Input */}
            <div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note (optional)"
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition resize-none text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Log Mood'}
            </button>
          </form>
        </div>

        {/* Weekly Chart */}
        {entries.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">This Week</h2>
            
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getWeekData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' 
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="mood" 
                    stroke="#14b8a6" 
                    strokeWidth={3}
                    dot={{ fill: '#14b8a6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#0d9488' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Recent Entries */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Recent Check-ins</h2>
          
          {entries.length === 0 ? (
            <p className="text-slate-500 text-center py-6 text-sm">
              No entries yet. Log your first mood above!
            </p>
          ) : (
            <div className="space-y-3">
              {entries.slice(0, 5).map((entry) => {
                const { date, time } = formatDateTime(entry.created_at)
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl"
                  >
                    <div className="text-2xl">{getMoodEmoji(entry.mood_score)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${getMoodColor(entry.mood_score)}`}>
                          {entry.mood_score}/10
                        </span>
                        <span className="text-xs text-slate-400">
                          {date}, {time}
                        </span>
                      </div>
                      {entry.note && (
                        <p className="text-sm text-slate-600 truncate">{entry.note}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-slate-400 hover:text-red-500 transition p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </main>

      {/* Custom slider styles */}
      <style jsx>{`
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 3px solid #14b8a6;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }
        input[type='range']::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 3px solid #14b8a6;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }
      `}</style>
    </div>
  )
}
