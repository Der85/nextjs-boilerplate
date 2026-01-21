'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface MoodEntry {
  id: string
  mood_score: number
  note: string | null
  created_at: string
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [moodScore, setMoodScore] = useState(5)
  const [note, setNote] = useState('')
  const [entries, setEntries] = useState<MoodEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const checkUserAndFetchEntries = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }
      
      setUser(session.user)
      await fetchEntries()
      setLoading(false)
    }

    checkUserAndFetchEntries()
  }, [router])

  const fetchEntries = async () => {
    const { data, error } = await supabase
      .from('mood_entries')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setEntries(data)
    }
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

  const getMoodColor = (score: number) => {
    if (score <= 3) return 'text-red-500'
    if (score <= 6) return 'text-yellow-500'
    return 'text-green-500'
  }

  const getMoodEmoji = (score: number) => {
    if (score <= 2) return '😢'
    if (score <= 4) return '😔'
    if (score <= 6) return '😐'
    if (score <= 8) return '😊'
    return '😄'
  }

  const getWeekData = () => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    return entries
      .filter(entry => new Date(entry.created_at) >= weekAgo)
      .map(entry => ({
        date: new Date(entry.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        time: new Date(entry.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        mood: entry.mood_score,
      }))
      .reverse()
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-teal-700">Mood Tracker</h1>
          <button
            onClick={handleLogout}
            className="text-gray-500 hover:text-gray-700 text-sm font-medium"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Mood Input Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">How are you feeling?</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Mood Slider */}
            <div className="space-y-4">
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
                className="w-full h-3 bg-gradient-to-r from-red-300 via-yellow-300 to-green-300 rounded-full appearance-none cursor-pointer slider-thumb"
                style={{
                  WebkitAppearance: 'none',
                }}
              />
              
              <div className="flex justify-between text-sm text-gray-400">
                <span>Very Sad</span>
                <span>Neutral</span>
                <span>Very Happy</span>
              </div>
            </div>

            {/* Note Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add a note (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What's on your mind?"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition resize-none"
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
          <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">This Week</h2>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getWeekData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }} 
                    stroke="#9ca3af"
                  />
                  <YAxis 
                    domain={[0, 10]} 
                    tick={{ fontSize: 12 }} 
                    stroke="#9ca3af"
                  />
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
                    dot={{ fill: '#14b8a6', strokeWidth: 2, r: 5 }}
                    activeDot={{ r: 7, fill: '#0d9488' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* History */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Recent Entries</h2>
          
          {entries.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No entries yet. Log your first mood above!
            </p>
          ) : (
            <div className="space-y-4">
              {entries.slice(0, 10).map((entry) => {
                const { date, time } = formatDateTime(entry.created_at)
                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl"
                  >
                    <div className="text-3xl">{getMoodEmoji(entry.mood_score)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xl font-bold ${getMoodColor(entry.mood_score)}`}>
                          {entry.mood_score}/10
                        </span>
                        <span className="text-sm text-gray-400">
                          {date} at {time}
                        </span>
                      </div>
                      {entry.note && (
                        <p className="text-gray-600 mt-1 break-words">{entry.note}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-gray-400 hover:text-red-500 transition p-1"
                      title="Delete entry"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 4px solid #14b8a6;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
        input[type='range']::-moz-range-thumb {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 4px solid #14b8a6;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  )
}
