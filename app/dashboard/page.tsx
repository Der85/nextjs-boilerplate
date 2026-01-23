'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getMoodEmoji, getMoodColor } from '@/lib/adhderData'

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
  plant_type: string
}

interface FocusPlan {
  id: string
  task_name: string
  steps_completed: number
  total_steps: number
}

const plantEmojis: Record<string, string> = {
  seedling: '🌱', sprout: '🌿', growing: '🪴', budding: '🌷', blooming: '🌸'
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [moodScore, setMoodScore] = useState(5)
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [recentMoods, setRecentMoods] = useState<MoodEntry[]>([])
  const [activeGoals, setActiveGoals] = useState<Goal[]>([])
  const [activePlans, setActivePlans] = useState<FocusPlan[]>([])
  const [villageCount, setVillageCount] = useState(0)
  const [weeklyAvg, setWeeklyAvg] = useState<number | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      
      setUser(session.user)
      await Promise.all([
        fetchMoods(),
        fetchGoals(),
        fetchPlans(),
        fetchVillage()
      ])
      setLoading(false)
    }
    init()
  }, [router])

  const fetchMoods = async () => {
    const { data } = await supabase
      .from('mood_entries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(7)
    
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
      .select('id, title, progress_percent, plant_type')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(3)
    if (data) setActiveGoals(data)
  }

  const fetchPlans = async () => {
    const { data } = await supabase
      .from('focus_plans')
      .select('id, task_name, steps_completed, total_steps')
      .eq('is_completed', false)
      .order('created_at', { ascending: false })
      .limit(2)
    if (data) setActivePlans(data)
  }

  const fetchVillage = async () => {
    const { count } = await supabase
      .from('village_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('is_archived', false)
    if (count) setVillageCount(count)
  }

  const handleSubmit = async () => {
    if (!user) return
    setSaving(true)
    await supabase.from('mood_entries').insert({
      user_id: user.id,
      mood_score: moodScore,
      note: note || null,
    })
    setNote('')
    setShowNote(false)
    setMoodScore(5)
    await fetchMoods()
    setSaving(false)
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const hours = Math.floor((now.getTime() - date.getTime()) / 3600000)
    if (hours < 1) return 'Now'
    if (hours < 24) return `${hours}h`
    if (hours < 48) return 'Yesterday'
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50">
        <div className="max-w-xl mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">{getGreeting()}</p>
            <h1 className="text-xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
              ADHDer.net
            </h1>
          </div>
          <button
            onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-5 py-6 space-y-6">
        
        {/* Quick Actions - Modern cards with subtle depth */}
        <section>
          <h2 className="text-sm font-medium text-slate-500 mb-3 px-1">Quick help</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => router.push('/ally')}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 p-5 text-left shadow-lg shadow-purple-500/20 transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-3xl">💜</span>
              <p className="mt-2 font-semibold text-white">I'm stuck</p>
              <p className="text-sm text-purple-100">Can't start or focus</p>
            </button>

            <button
              onClick={() => router.push('/brake')}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-5 text-left shadow-lg shadow-amber-500/20 transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-3xl">🛑</span>
              <p className="mt-2 font-semibold text-white">Pause</p>
              <p className="text-sm text-amber-100">About to react</p>
            </button>
          </div>
        </section>

        {/* Mood Check-In - Clean card */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200/50 overflow-hidden">
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">How are you?</h2>
              {weeklyAvg && (
                <span className="text-sm text-slate-500">
                  Week avg: <span className="font-medium text-teal-600">{weeklyAvg}</span>
                </span>
              )}
            </div>
            
            <div className="flex items-center justify-between py-2">
              <span className="text-5xl transition-transform hover:scale-110">
                {getMoodEmoji(moodScore)}
              </span>
              <span className={`text-5xl font-bold ${getMoodColor(moodScore)}`}>
                {moodScore}
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="10"
              value={moodScore}
              onChange={(e) => setMoodScore(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gradient-to-r from-rose-400 via-amber-400 to-emerald-400"
            />

            {!showNote ? (
              <button
                onClick={() => setShowNote(true)}
                className="text-sm text-slate-500 hover:text-teal-600 transition-colors"
              >
                + Add a note
              </button>
            ) : (
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What's on your mind?"
                rows={2}
                className="w-full px-4 py-3 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-teal-500/20 resize-none text-sm"
                autoFocus
              />
            )}

            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-teal-500 to-cyan-500 shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Log mood'}
            </button>
          </div>

          {/* Mini mood history - subtle visual */}
          {recentMoods.length > 0 && (
            <div className="px-5 py-3 bg-slate-50/50 border-t border-slate-100">
              <div className="flex items-center gap-1">
                {recentMoods.slice(0, 7).reverse().map((entry, i) => (
                  <div
                    key={entry.id}
                    className="flex-1 group relative"
                  >
                    <div
                      className="h-8 rounded-md transition-all group-hover:scale-110"
                      style={{
                        background: `linear-gradient(to top, ${
                          entry.mood_score <= 3 ? '#fca5a5' :
                          entry.mood_score <= 6 ? '#fcd34d' : '#6ee7b7'
                        }, transparent)`,
                        height: `${Math.max(20, entry.mood_score * 8)}%`
                      }}
                    />
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs bg-slate-800 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {entry.mood_score}/10
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Tools Grid - Modern pill navigation */}
        <section>
          <h2 className="text-sm font-medium text-slate-500 mb-3 px-1">Tools</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { path: '/focus', icon: '🔨', label: 'Break it down', color: 'from-blue-500 to-cyan-500' },
              { path: '/goals', icon: '🌱', label: 'Goals', color: 'from-green-500 to-emerald-500' },
              { path: '/burnout', icon: '🔋', label: 'Battery check', color: 'from-slate-500 to-slate-600' },
              { path: '/village', icon: '👥', label: `Village${villageCount ? ` (${villageCount})` : ''}`, color: 'from-orange-500 to-red-500' },
            ].map((tool) => (
              <button
                key={tool.path}
                onClick={() => router.push(tool.path)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-full border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
              >
                <span>{tool.icon}</span>
                <span className="text-sm font-medium text-slate-700">{tool.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Active Goals - Modern cards */}
        {activeGoals.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-sm font-medium text-slate-500">Growing</h2>
              <button 
                onClick={() => router.push('/goals')}
                className="text-sm text-teal-600 hover:text-teal-700"
              >
                See all →
              </button>
            </div>
            <div className="space-y-2">
              {activeGoals.map((goal) => (
                <button
                  key={goal.id}
                  onClick={() => router.push('/goals')}
                  className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200/50 shadow-sm hover:shadow-md transition-all text-left"
                >
                  <span className="text-2xl">{plantEmojis[goal.plant_type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{goal.title}</p>
                    <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all"
                        style={{ width: `${goal.progress_percent}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium text-green-600">{goal.progress_percent}%</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Active Tasks */}
        {activePlans.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-sm font-medium text-slate-500">In progress</h2>
              <button 
                onClick={() => router.push('/focus')}
                className="text-sm text-teal-600 hover:text-teal-700"
              >
                See all →
              </button>
            </div>
            <div className="space-y-2">
              {activePlans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => router.push('/focus')}
                  className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200/50 shadow-sm hover:shadow-md transition-all text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-lg">🔨</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{plan.task_name}</p>
                    <p className="text-sm text-slate-500">{plan.steps_completed} of {plan.total_steps} steps</p>
                  </div>
                  <div className="w-12 h-12 relative">
                    <svg className="w-12 h-12 -rotate-90">
                      <circle cx="24" cy="24" r="20" stroke="#e2e8f0" strokeWidth="4" fill="none" />
                      <circle 
                        cx="24" cy="24" r="20" 
                        stroke="url(#blueGradient)" 
                        strokeWidth="4" 
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${(plan.steps_completed / plan.total_steps) * 126} 126`}
                      />
                      <defs>
                        <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#06b6d4" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-blue-600">
                      {Math.round((plan.steps_completed / plan.total_steps) * 100)}%
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Bottom spacing */}
        <div className="h-6" />
      </main>

      {/* Modern bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur-md border-t border-slate-200/50">
        <div className="max-w-xl mx-auto flex">
          {[
            { path: '/dashboard', icon: '🏠', label: 'Home', active: true },
            { path: '/goals', icon: '🌱', label: 'Goals' },
            { path: '/village', icon: '👥', label: 'Village' },
          ].map((item) => (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex-1 flex flex-col items-center py-3 transition-colors ${
                item.active ? 'text-teal-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs mt-0.5 font-medium">{item.label}</span>
            </button>
          ))}
        </div>
        {/* Safe area */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>

      <style jsx>{`
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: white;
          border: 3px solid #14b8a6;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          cursor: pointer;
          transition: transform 0.15s;
        }
        input[type='range']::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
        input[type='range']::-webkit-slider-thumb:active {
          transform: scale(0.95);
        }
      `}</style>
    </div>
  )
}
