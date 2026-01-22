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

interface FocusPlan {
  id: string
  task_name: string
  steps_completed: number
  total_steps: number
  is_completed: boolean
}

interface BurnoutLog {
  id: string
  total_score: number
  severity_level: 'green' | 'yellow' | 'red'
  created_at: string
}

interface Goal {
  id: string
  title: string
  progress_percent: number
  plant_type: string
}

interface VillageContact {
  id: string
  name: string
  support_emotional: boolean
  support_task: boolean
  support_fun: boolean
  support_emergency: boolean
}

interface WeeklyStats {
  moodAvg: number | null
  moodCount: number
  allyCount: number
  impulseCount: number
  impulseSuccessRate: number | null
  focusPlansCompleted: number
  goalsCompleted: number
}

const plantEmojis: Record<string, string> = {
  seedling: '🌱',
  sprout: '🌿',
  growing: '🪴',
  budding: '🌷',
  blooming: '🌸'
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [moodScore, setMoodScore] = useState(5)
  const [note, setNote] = useState('')
  const [entries, setEntries] = useState<MoodEntry[]>([])
  const [activePlans, setActivePlans] = useState<FocusPlan[]>([])
  const [latestBurnout, setLatestBurnout] = useState<BurnoutLog | null>(null)
  const [activeGoals, setActiveGoals] = useState<Goal[]>([])
  const [villageCount, setVillageCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({
    moodAvg: null,
    moodCount: 0,
    allyCount: 0,
    impulseCount: 0,
    impulseSuccessRate: null,
    focusPlansCompleted: 0,
    goalsCompleted: 0
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
        fetchWeeklyStats(session.user.id),
        fetchActivePlans(session.user.id),
        fetchLatestBurnout(session.user.id),
        fetchActiveGoals(session.user.id),
        fetchVillageCount(session.user.id)
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

  const fetchActivePlans = async (userId: string) => {
    const { data, error } = await supabase
      .from('focus_plans')
      .select('id, task_name, steps_completed, total_steps, is_completed')
      .eq('is_completed', false)
      .order('created_at', { ascending: false })
      .limit(2)

    if (!error && data) {
      setActivePlans(data)
    }
  }

  const fetchLatestBurnout = async (userId: string) => {
    const { data, error } = await supabase
      .from('burnout_logs')
      .select('id, total_score, severity_level, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!error && data) {
      setLatestBurnout(data)
    }
  }

  const fetchActiveGoals = async (userId: string) => {
    const { data, error } = await supabase
      .from('goals')
      .select('id, title, progress_percent, plant_type')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(4)

    if (!error && data) {
      setActiveGoals(data)
    }
  }

  const fetchVillageCount = async (userId: string) => {
    const { count, error } = await supabase
      .from('village_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('is_archived', false)

    if (!error && count !== null) {
      setVillageCount(count)
    }
  }

  const fetchWeeklyStats = async (userId: string) => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoISO = weekAgo.toISOString()

    const { data: moodData } = await supabase
      .from('mood_entries')
      .select('mood_score')
      .gte('created_at', weekAgoISO)

    const { count: allyCount } = await supabase
      .from('ally_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgoISO)

    const { data: impulseData } = await supabase
      .from('impulse_events')
      .select('acted_on_impulse')
      .gte('created_at', weekAgoISO)

    const { count: focusCount } = await supabase
      .from('focus_plans')
      .select('*', { count: 'exact', head: true })
      .eq('is_completed', true)
      .gte('created_at', weekAgoISO)

    const { count: goalsCount } = await supabase
      .from('goals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('updated_at', weekAgoISO)

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
      impulseSuccessRate,
      focusPlansCompleted: focusCount || 0,
      goalsCompleted: goalsCount || 0
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
    await supabase.from('mood_entries').delete().eq('id', id)
    await fetchEntries()
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

  const getBurnoutColor = (level: string) => {
    switch (level) {
      case 'green': return 'bg-green-500'
      case 'yellow': return 'bg-yellow-500'
      case 'red': return 'bg-red-500'
      default: return 'bg-slate-400'
    }
  }

  const getBurnoutBgColor = (level: string) => {
    switch (level) {
      case 'green': return 'from-green-50 to-emerald-50 border-green-200'
      case 'yellow': return 'from-yellow-50 to-amber-50 border-yellow-200'
      case 'red': return 'from-red-50 to-orange-50 border-red-200'
      default: return 'from-slate-50 to-slate-100 border-slate-200'
    }
  }

  const getBurnoutLabel = (level: string) => {
    switch (level) {
      case 'green': return 'Manageable'
      case 'yellow': return 'Warning'
      case 'red': return 'Burnout'
      default: return ''
    }
  }

  const daysSinceLastBurnoutCheck = () => {
    if (!latestBurnout) return null
    const lastCheck = new Date(latestBurnout.created_at)
    const now = new Date()
    return Math.floor((now.getTime() - lastCheck.getTime()) / (1000 * 60 * 60 * 24))
  }

  const shouldPromptBurnoutCheck = () => {
    const days = daysSinceLastBurnoutCheck()
    return days === null || days >= 7
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
        
        {/* Burnout Check Prompt */}
        {shouldPromptBurnoutCheck() && (
          <button
            onClick={() => router.push('/burnout')}
            className={`w-full p-4 rounded-2xl border-2 transition-all hover:scale-[1.01] ${
              latestBurnout?.severity_level === 'red' 
                ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-300'
                : 'bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">🔋</span>
              <div className="flex-1 text-left">
                <p className="font-semibold text-slate-800">
                  {latestBurnout ? 'Weekly Battery Check' : 'Check Your Burnout Level'}
                </p>
                <p className="text-sm text-slate-500">
                  {latestBurnout 
                    ? `Last check: ${daysSinceLastBurnoutCheck()} days ago`
                    : "Take 2 minutes to check in with yourself"
                  }
                </p>
              </div>
              <span className="text-slate-400">→</span>
            </div>
          </button>
        )}

        {/* Burnout Status (if recent) */}
        {latestBurnout && !shouldPromptBurnoutCheck() && (
          <div className={`p-4 rounded-2xl border-2 bg-gradient-to-r ${getBurnoutBgColor(latestBurnout.severity_level)}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔋</span>
                <div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getBurnoutColor(latestBurnout.severity_level)}`}></div>
                    <span className="font-semibold text-slate-800">
                      {getBurnoutLabel(latestBurnout.severity_level)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => router.push('/burnout')}
                className="text-sm text-slate-600 hover:text-slate-800"
              >
                Recheck →
              </button>
            </div>
          </div>
        )}

        {/* Quick Actions - 2 rows */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 text-center">
            What do you need?
          </h2>
          
          {/* Row 1: Hot Tools (Reactive) */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            <button
              onClick={() => document.getElementById('mood-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="flex flex-col items-center p-3 bg-gradient-to-br from-teal-50 to-cyan-50 hover:from-teal-100 hover:to-cyan-100 rounded-xl border border-teal-200 transition-all"
            >
              <span className="text-xl">📊</span>
              <span className="font-medium text-teal-700 text-xs mt-1">Check In</span>
            </button>

            <button
              onClick={() => router.push('/ally')}
              className="flex flex-col items-center p-3 bg-gradient-to-br from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 rounded-xl border border-purple-200 transition-all"
            >
              <span className="text-xl">💜</span>
              <span className="font-medium text-purple-700 text-xs mt-1">Stuck</span>
            </button>

            <button
              onClick={() => router.push('/brake')}
              className="flex flex-col items-center p-3 bg-gradient-to-br from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 rounded-xl border border-amber-200 transition-all"
            >
              <span className="text-xl">🛑</span>
              <span className="font-medium text-amber-700 text-xs mt-1">Brake</span>
            </button>

            <button
              onClick={() => router.push('/village')}
              className="flex flex-col items-center p-3 bg-gradient-to-br from-orange-50 to-red-50 hover:from-orange-100 hover:to-red-100 rounded-xl border border-orange-200 transition-all"
            >
              <span className="text-xl">🏘️</span>
              <span className="font-medium text-orange-700 text-xs mt-1">Village</span>
            </button>
          </div>

          {/* Row 2: Cool Tools (Proactive) */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => router.push('/focus')}
              className="flex flex-col items-center p-3 bg-gradient-to-br from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 rounded-xl border border-blue-200 transition-all"
            >
              <span className="text-xl">🔨</span>
              <span className="font-medium text-blue-700 text-xs mt-1">Break Down</span>
            </button>

            <button
              onClick={() => router.push('/goals')}
              className="flex flex-col items-center p-3 bg-gradient-to-br from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 rounded-xl border border-green-200 transition-all"
            >
              <span className="text-xl">🌱</span>
              <span className="font-medium text-green-700 text-xs mt-1">Goals</span>
            </button>

            <button
              onClick={() => router.push('/burnout')}
              className="flex flex-col items-center p-3 bg-gradient-to-br from-slate-50 to-gray-100 hover:from-slate-100 hover:to-gray-200 rounded-xl border border-slate-200 transition-all"
            >
              <span className="text-xl">🔋</span>
              <span className="font-medium text-slate-700 text-xs mt-1">Battery</span>
            </button>
          </div>
        </div>

        {/* Goal Garden + Village Row */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Goal Garden Preview */}
          <div className="bg-white rounded-2xl shadow-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-800">🌱 Goals</h2>
              <button onClick={() => router.push('/goals')} className="text-xs text-green-600 hover:text-green-700">
                View all →
              </button>
            </div>
            
            {activeGoals.length === 0 ? (
              <button
                onClick={() => router.push('/goals')}
                className="w-full p-4 bg-green-50 hover:bg-green-100 rounded-xl border border-dashed border-green-300 transition text-center"
              >
                <span className="text-2xl">🌱</span>
                <p className="text-green-700 text-sm mt-1">Plant a goal</p>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {activeGoals.slice(0, 4).map((goal) => (
                  <button
                    key={goal.id}
                    onClick={() => router.push('/goals')}
                    className="p-3 bg-green-50 hover:bg-green-100 rounded-xl transition text-center"
                  >
                    <span className="text-2xl">{plantEmojis[goal.plant_type]}</span>
                    <p className="text-xs text-slate-700 mt-1 truncate">{goal.title}</p>
                    <div className="mt-1 h-1 bg-green-200 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${goal.progress_percent}%` }} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Village Preview */}
          <div className="bg-white rounded-2xl shadow-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-800">🏘️ Village</h2>
              <button onClick={() => router.push('/village')} className="text-xs text-orange-600 hover:text-orange-700">
                Manage →
              </button>
            </div>
            
            {villageCount === 0 ? (
              <button
                onClick={() => router.push('/village')}
                className="w-full p-4 bg-orange-50 hover:bg-orange-100 rounded-xl border border-dashed border-orange-300 transition text-center"
              >
                <span className="text-2xl">👥</span>
                <p className="text-orange-700 text-sm mt-1">Add your support people</p>
              </button>
            ) : (
              <button
                onClick={() => router.push('/village')}
                className="w-full p-4 bg-orange-50 hover:bg-orange-100 rounded-xl transition text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">👥</span>
                  <div>
                    <p className="font-medium text-slate-800">{villageCount} people in your village</p>
                    <p className="text-sm text-orange-600">Tap for SOS quick-connect</p>
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Active Focus Plans */}
        {activePlans.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-800">📋 Active Tasks</h2>
              <button onClick={() => router.push('/focus')} className="text-xs text-blue-600">View all →</button>
            </div>
            <div className="space-y-2">
              {activePlans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => router.push('/focus')}
                  className="w-full flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 rounded-xl transition text-left"
                >
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 text-sm">{plan.task_name}</p>
                    <p className="text-xs text-slate-500">{plan.steps_completed}/{plan.total_steps} steps</p>
                  </div>
                  <div className="w-10 h-10 relative">
                    <svg className="w-10 h-10 transform -rotate-90">
                      <circle cx="20" cy="20" r="16" stroke="#e2e8f0" strokeWidth="4" fill="none" />
                      <circle cx="20" cy="20" r="16" stroke="#3b82f6" strokeWidth="4" fill="none"
                        strokeDasharray={`${(plan.steps_completed / plan.total_steps) * 100} 100`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-blue-600">
                      {Math.round((plan.steps_completed / plan.total_steps) * 100)}%
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Weekly Stats */}
        {(weeklyStats.moodCount > 0 || weeklyStats.allyCount > 0) && (
          <div className="bg-white rounded-2xl shadow-lg p-5">
            <h2 className="font-semibold text-slate-800 mb-3">This Week</h2>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              <div className="bg-teal-50 rounded-xl p-2 text-center">
                <div className="text-lg font-bold text-teal-700">{weeklyStats.moodAvg ?? '—'}</div>
                <div className="text-xs text-teal-600">Mood</div>
              </div>
              <div className="bg-purple-50 rounded-xl p-2 text-center">
                <div className="text-lg font-bold text-purple-700">{weeklyStats.allyCount}</div>
                <div className="text-xs text-purple-600">Ally</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-2 text-center">
                <div className="text-lg font-bold text-blue-700">{weeklyStats.focusPlansCompleted}</div>
                <div className="text-xs text-blue-600">Tasks</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-2 text-center">
                <div className="text-lg font-bold text-amber-700">{weeklyStats.impulseCount}</div>
                <div className="text-xs text-amber-600">Brakes</div>
              </div>
              <div className="bg-green-50 rounded-xl p-2 text-center">
                <div className="text-lg font-bold text-green-700">{weeklyStats.goalsCompleted}</div>
                <div className="text-xs text-green-600">Goals</div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-2 text-center">
                <div className="text-lg font-bold text-emerald-700">
                  {weeklyStats.impulseSuccessRate !== null ? `${weeklyStats.impulseSuccessRate}%` : '—'}
                </div>
                <div className="text-xs text-emerald-600">Success</div>
              </div>
            </div>
          </div>
        )}

        {/* Mood Input */}
        <div id="mood-section" className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="font-semibold text-slate-800 mb-4">How are you feeling?</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-4xl">{getMoodEmoji(moodScore)}</span>
                <span className={`text-4xl font-bold ${getMoodColor(moodScore)}`}>{moodScore}</span>
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
                <span>Great</span>
              </div>
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional)"
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none resize-none text-sm"
            />

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
          <div className="bg-white rounded-2xl shadow-lg p-5">
            <h2 className="font-semibold text-slate-800 mb-3">Mood This Week</h2>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getWeekData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                  <Line type="monotone" dataKey="mood" stroke="#14b8a6" strokeWidth={3} dot={{ fill: '#14b8a6', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Recent Entries */}
        <div className="bg-white rounded-2xl shadow-lg p-5">
          <h2 className="font-semibold text-slate-800 mb-3">Recent Check-ins</h2>
          
          {entries.length === 0 ? (
            <p className="text-slate-500 text-center py-4 text-sm">No entries yet</p>
          ) : (
            <div className="space-y-2">
              {entries.slice(0, 5).map((entry) => {
                const { date, time } = formatDateTime(entry.created_at)
                return (
                  <div key={entry.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <span className="text-2xl">{getMoodEmoji(entry.mood_score)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${getMoodColor(entry.mood_score)}`}>{entry.mood_score}/10</span>
                        <span className="text-xs text-slate-400">{date}</span>
                      </div>
                      {entry.note && <p className="text-sm text-slate-600 truncate">{entry.note}</p>}
                    </div>
                    <button onClick={() => handleDelete(entry.id)} className="text-slate-400 hover:text-red-500 p-1">
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

    </div>
  )
}
