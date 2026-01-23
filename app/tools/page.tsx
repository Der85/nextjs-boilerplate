'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getMoodEmoji, getMoodColor } from '@/lib/adhderData'
import BottomNav from '@/components/BottomNav'

interface MoodEntry {
  id: string
  mood_score: number
  note: string | null
  created_at: string
}

interface QuickStat {
  moodAvg: number | null
  streak: number
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Mood input
  const [moodScore, setMoodScore] = useState(5)
  const [note, setNote] = useState('')
  const [showNoteInput, setShowNoteInput] = useState(false)
  
  // Data
  const [recentEntries, setRecentEntries] = useState<MoodEntry[]>([])
  const [quickStat, setQuickStat] = useState<QuickStat>({ moodAvg: null, streak: 0 })

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }
      
      setUser(session.user)
      await fetchData()
      setLoading(false)
    }
    init()
  }, [router])

  const fetchData = async () => {
    // Fetch recent entries
    const { data: entries } = await supabase
      .from('mood_entries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)
    
    if (entries) {
      setRecentEntries(entries)
      
      // Calculate average
      if (entries.length > 0) {
        const avg = entries.reduce((sum, e) => sum + e.mood_score, 0) / entries.length
        setQuickStat(prev => ({ ...prev, moodAvg: Math.round(avg * 10) / 10 }))
      }
    }
  }

  const handleSubmit = async () => {
    if (!user) return
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
      setShowNoteInput(false)
      setMoodScore(5)
      await fetchData()
    }

    setSaving(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffHours < 48) return 'Yesterday'
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Simple Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">{getGreeting()}</p>
            <h1 className="text-xl font-bold text-slate-800">ADHDer.net</h1>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-slate-500 hover:text-slate-700 px-3 py-2"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        
        {/* Quick Actions - Simplified to 3 */}
        <section aria-labelledby="quick-actions-heading">
          <h2 id="quick-actions-heading" className="sr-only">Quick Actions</h2>
          
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => router.push('/ally')}
              className="flex flex-col items-center p-4 bg-white rounded-xl border-2 border-purple-200 hover:border-purple-300 transition-colors"
            >
              <span className="text-2xl mb-2" aria-hidden="true">💜</span>
              <span className="text-sm font-medium text-purple-700">I'm stuck</span>
            </button>

            <button
              onClick={() => router.push('/brake')}
              className="flex flex-col items-center p-4 bg-white rounded-xl border-2 border-amber-200 hover:border-amber-300 transition-colors"
            >
              <span className="text-2xl mb-2" aria-hidden="true">🛑</span>
              <span className="text-sm font-medium text-amber-700">Need to pause</span>
            </button>

            <button
              onClick={() => router.push('/tools')}
              className="flex flex-col items-center p-4 bg-white rounded-xl border-2 border-slate-200 hover:border-slate-300 transition-colors"
            >
              <span className="text-2xl mb-2" aria-hidden="true">🧰</span>
              <span className="text-sm font-medium text-slate-700">All tools</span>
            </button>
          </div>
        </section>

        {/* Mood Check-In */}
        <section 
          id="mood-section" 
          aria-labelledby="mood-heading"
          className="bg-white rounded-xl p-6 border border-slate-200"
        >
          <h2 id="mood-heading" className="text-lg font-semibold text-slate-800 mb-4">
            How are you feeling?
          </h2>
          
          <div className="space-y-4">
            {/* Mood display */}
            <div className="flex items-center justify-between">
              <span className="text-5xl" aria-hidden="true">
                {getMoodEmoji(moodScore)}
              </span>
              <span 
                className={`text-4xl font-bold ${getMoodColor(moodScore)}`}
                aria-label={`Mood score: ${moodScore} out of 10`}
              >
                {moodScore}
              </span>
            </div>
            
            {/* Slider */}
            <div>
              <input
                type="range"
                min="0"
                max="10"
                value={moodScore}
                onChange={(e) => setMoodScore(Number(e.target.value))}
                className="w-full h-3 bg-gradient-to-r from-red-300 via-yellow-300 to-green-300 rounded-full appearance-none cursor-pointer"
                aria-label="Mood score slider"
              />
              <div className="flex justify-between text-sm text-slate-500 mt-2">
                <span>Struggling</span>
                <span>Great</span>
              </div>
            </div>

            {/* Optional note toggle */}
            {!showNoteInput ? (
              <button
                onClick={() => setShowNoteInput(true)}
                className="text-sm text-teal-600 hover:text-teal-700"
              >
                + Add a note (optional)
              </button>
            ) : (
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What's on your mind?"
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 outline-none resize-none text-base"
                autoFocus
              />
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Log mood'}
            </button>
          </div>
        </section>

        {/* Recent Check-ins - Simplified */}
        {recentEntries.length > 0 && (
          <section aria-labelledby="recent-heading">
            <div className="flex items-center justify-between mb-3">
              <h2 id="recent-heading" className="text-lg font-semibold text-slate-800">
                Recent
              </h2>
              {quickStat.moodAvg !== null && (
                <span className="text-sm text-slate-500">
                  Avg: <strong className="text-teal-600">{quickStat.moodAvg}</strong>
                </span>
              )}
            </div>
            
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {recentEntries.map((entry) => (
                <div 
                  key={entry.id} 
                  className="flex items-center gap-3 p-4"
                >
                  <span className="text-2xl" aria-hidden="true">
                    {getMoodEmoji(entry.mood_score)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className={`font-semibold ${getMoodColor(entry.mood_score)}`}>
                      {entry.mood_score}/10
                    </span>
                    {entry.note && (
                      <p className="text-sm text-slate-600 truncate mt-0.5">
                        {entry.note}
                      </p>
                    )}
                  </div>
                  <span className="text-sm text-slate-400">
                    {formatTime(entry.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Gentle prompt for other features */}
        <section className="bg-slate-100 rounded-xl p-4">
          <p className="text-sm text-slate-600 text-center">
            Explore <button onClick={() => router.push('/goals')} className="text-green-600 font-medium hover:underline">Goals</button> or 
            set up your <button onClick={() => router.push('/village')} className="text-orange-600 font-medium hover:underline">Support Village</button>
          </p>
        </section>

      </main>

      <BottomNav />

      {/* Slider thumb styles */}
      <style jsx>{`
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 3px solid #14b8a6;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }
        input[type='range']::-moz-range-thumb {
          width: 28px;
          height: 28px;
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
