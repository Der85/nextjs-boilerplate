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
      <div className="app-shell flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="sticky top-0 z-50 -mx-4 px-4 glass border-b border-slate-200/50">
        <div className="app-max py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">{getGreeting()}</p>
            <h1 className="text-xl font-bold text-gradient bg-gradient-to-r from-teal-600 to-cyan-600">
              ADHDer
            </h1>
          </div>
          <button
            onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
            className="btn btn-ghost text-sm"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="app-max py-6 space-y-6">
        
        {/* Quick Actions */}
        <section>
          <h2 className="text-sm font-medium text-slate-500 mb-3">Quick help</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => router.push('/ally')}
              className="surface card-hover p-5 text-left bg-gradient-to-br from-purple-500 to-indigo-600 border-purple-400/30"
            >
              <span className="text-3xl">💜</span>
              <p className="mt-2 font-semibold text-white">I'm stuck</p>
              <p className="text-sm text-purple-100">Can't start or focus</p>
            </button>

            <button
              onClick={() => router.push('/brake')}
              className="surface card-hover p-5 text-left bg-gradient-to-br from-amber-500 to-orange-600 border-amber-400/30"
            >
              <span className="text-3xl">🛑</span>
              <p className="mt-2 font-semibold text-white">Pause</p>
              <p className="text-sm text-amber-100">About to react</p>
            </button>
          </div>
        </section>

        {/* Mood Check-In */}
        <section className="surface p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">How are you?</h2>
            {weeklyAvg && (
              <span className="text-sm text-slate-500">
                Week avg: <span className="font-medium text-teal-600">{weeklyAvg}</span>
              </span>
            )}
          </div>
          
          <div className="flex items-center justify-between py-2">
            <span className="text-5xl">{getMoodEmoji(moodScore)}</span>
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
            className="w-full my-4"
          />

          {!showNote ? (
            <button
              onClick={() => setShowNote(true)}
              className="btn btn-ghost text-sm mb-4"
            >
              + Add a note
            </button>
          ) : (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What's on your mind?"
              className="input min-h-[80px] mb-4"
              autoFocus
            />
          )}

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn btn-primary w-full"
          >
            {saving ? 'Saving...' : 'Log mood'}
          </button>

          {/* Mini mood history */}
          {recentMoods.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200/50">
              <div className="flex items-end gap-1 h-12">
                {recentMoods.slice(0, 7).reverse().map((entry) => (
                  <div
                    key={entry.id}
                    className="flex-1 rounded-t transition-all hover:opacity-80"
                    style={{
                      height: `${Math.max(20, entry.mood_score * 10)}%`,
                      background: entry.mood_score <= 3 ? '#fca5a5' :
                                  entry.mood_score <= 6 ? '#fcd34d' : '#6ee7b7'
                    }}
                    title={`${entry.mood_score}/10`}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Tools */}
        <section>
          <h2 className="text-sm font-medium text-slate-500 mb-3">Tools</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { path: '/focus', icon: '🔨', label: 'Break it down' },
              { path: '/goals', icon: '🌱', label: 'Goals' },
              { path: '/burnout', icon: '🔋', label: 'Battery check' },
              { path: '/village', icon: '👥', label: `Village${villageCount ? ` (${villageCount})` : ''}` },
            ].map((tool) => (
              <button
                key={tool.path}
                onClick={() => router.push(tool.path)}
                className="surface card-hover px-4 py-2.5 flex items-center gap-2"
              >
                <span>{tool.icon}</span>
                <span className="text-sm font-medium text-slate-700">{tool.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Active Goals */}
        {activeGoals.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-slate-500">Growing</h2>
              <button 
                onClick={() => router.push('/goals')}
                className="btn btn-ghost text-sm text-teal-600 py-1 px-2 min-h-0"
              >
                See all →
              </button>
            </div>
            <div className="space-y-2">
              {activeGoals.map((goal) => (
                <button
                  key={goal.id}
                  onClick={() => router.push('/goals')}
                  className="surface card-hover w-full flex items-center gap-4 p-4 text-left"
                >
                  <span className="text-2xl">{plantEmojis[goal.plant_type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{goal.title}</p>
                    <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
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
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-slate-500">In progress</h2>
              <button 
                onClick={() => router.push('/focus')}
                className="btn btn-ghost text-sm text-teal-600 py-1 px-2 min-h-0"
              >
                See all →
              </button>
            </div>
            <div className="space-y-2">
              {activePlans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => router.push('/focus')}
                  className="surface card-hover w-full flex items-center gap-4 p-4 text-left"
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
                        stroke="#3b82f6"
                        strokeWidth="4" 
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${(plan.steps_completed / plan.total_steps) * 126} 126`}
                      />
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

        {/* Bottom spacing for nav */}
        <div className="h-20" />
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 inset-x-0 glass border-t border-slate-200/50">
        <div className="app-max flex">
          {[
            { path: '/dashboard', icon: '🏠', label: 'Home', active: true },
            { path: '/goals', icon: '🌱', label: 'Goals', active: false },
            { path: '/village', icon: '👥', label: 'Village', active: false },
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
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  )
}
