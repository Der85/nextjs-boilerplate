'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { usePresenceWithFallback } from '@/hooks/usePresence'
import UnifiedHeader from '@/components/UnifiedHeader'
import WelcomeHero from '@/components/WelcomeHero'
import Just1ThingHero from '@/components/Just1ThingHero'
import DashboardSkeleton from '@/components/DashboardSkeleton'
import { useGamificationPrefsSafe } from '@/context/GamificationPrefsContext'
import { getCachedPrefetchData, clearPrefetchCache, type PrefetchedData } from '@/lib/prefetch'
import { autoArchiveOverdueTasks } from '@/lib/autoArchive'
import { getEnergyParam, getGreeting, getPlantEmoji } from '@/lib/utils/ui-helpers'

interface MoodEntry {
  id: string
  mood_score: number
  note: string | null
  coach_advice: string | null
  created_at: string
}

interface ActiveGoal {
  id: string
  title: string
  progress_percent: number
  plant_type: string | null
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

type UserMode = 'recovery' | 'maintenance' | 'growth'

interface EnhancedSuggestion {
  goalId: string | null
  goalTitle: string | null
  suggestion: string
  reason: string
  timeEstimate: string
  effortLevel: 'low' | 'medium' | 'high'
  url: string
}

export default function Dashboard() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  )
}

function DashboardContent() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Core state
  const [moodScore, setMoodScore] = useState<number | null>(null)
  const [insights, setInsights] = useState<UserInsights | null>(null)
  const [activeGoal, setActiveGoal] = useState<ActiveGoal | null>(null)
  const [userMode, setUserMode] = useState<UserMode>('maintenance')
  const [modeManuallySet, setModeManuallySet] = useState(false)

  // Presence
  const { onlineCount } = usePresenceWithFallback({ isFocusing: false })

  // Dashboard data
  const [todaysWins, setTodaysWins] = useState<Array<{ text: string; icon: string }>>([])
  const [strayThoughtsCount, setStrayThoughtsCount] = useState(0)
  const [yesterdayWinsCount, setYesterdayWinsCount] = useState(0)
  const [overduePlansCount, setOverduePlansCount] = useState(0)

  // Recommendations
  const [recommendations, setRecommendations] = useState<EnhancedSuggestion[]>([])
  const [shuffleCount, setShuffleCount] = useState(0)
  const [usedSuggestionIds, setUsedSuggestionIds] = useState<string[]>([])
  const accessTokenRef = useRef<string | null>(null)

  const { prefs: gamPrefs, isMaintenanceDay } = useGamificationPrefsSafe()

  // Sync user mode with localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem('user-mode') as UserMode | null
    if (savedMode && ['recovery', 'maintenance', 'growth'].includes(savedMode)) {
      setUserMode(savedMode)
      setModeManuallySet(true)
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user-mode' && e.newValue) {
        const newMode = e.newValue as UserMode
        if (['recovery', 'maintenance', 'growth'].includes(newMode)) {
          setUserMode(newMode)
          setModeManuallySet(true)
        }
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)

      const cachedData = getCachedPrefetchData()
      if (cachedData) {
        applyPrefetchedData(cachedData)
        setLoading(false)
        clearPrefetchCache()
        fetchData(session.user.id)
      } else {
        await fetchData(session.user.id)
        setLoading(false)
      }

      // Handle mode override from URL
      const modeParam = searchParams.get('mode') as UserMode | null
      if (modeParam && ['recovery', 'maintenance', 'growth'].includes(modeParam)) {
        setUserMode(modeParam)
      }

      loadRecommendation(session.access_token)
    }
    init()
  }, [router, searchParams])

  const applyPrefetchedData = (data: PrefetchedData) => {
    if (data.insights) {
      setInsights(data.insights)
      if (data.insights.lastMood !== null && !modeManuallySet) {
        const calculatedMode: UserMode = data.insights.lastMood <= 3 ? 'recovery'
          : data.insights.lastMood >= 8 ? 'growth'
          : 'maintenance'
        setUserMode(calculatedMode)
      }
    }
    if (data.activeGoal) setActiveGoal(data.activeGoal)
    if (data.todaysWinsCount > 0) setYesterdayWinsCount(data.todaysWinsCount)
  }

  const loadRecommendation = async (token: string, excludeIds: string[] = []) => {
    accessTokenRef.current = token
    try {
      const res = await fetch('/api/goals-coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'suggest_next',
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          moodScore: moodScore || insights?.lastMood || 6,
          excludeIds,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.suggestions && Array.isArray(data.suggestions)) {
          setRecommendations(data.suggestions)
        } else if (data.suggestion) {
          setRecommendations([{
            goalId: data.suggestion.goalId || null,
            goalTitle: data.suggestion.goalTitle || null,
            suggestion: data.suggestion.suggestion,
            reason: data.suggestion.reason || '',
            timeEstimate: data.suggestion.timeEstimate || '~10 min',
            effortLevel: data.suggestion.effortLevel || 'medium',
            url: data.suggestion.url || '/focus',
          }])
        }
      }
    } catch {
      // Recommendation is optional
    }
  }

  const handleShuffle = async () => {
    if (shuffleCount >= 3 || !accessTokenRef.current) return
    const currentSuggestion = recommendations[0]
    const newUsedIds = currentSuggestion?.goalId
      ? [...usedSuggestionIds, currentSuggestion.goalId]
      : usedSuggestionIds
    setUsedSuggestionIds(newUsedIds)
    setShuffleCount(prev => prev + 1)
    await loadRecommendation(accessTokenRef.current, newUsedIds)
  }

  const fetchData = async (userId: string) => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const yesterdayStart = new Date()
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)
    yesterdayStart.setHours(0, 0, 0, 0)
    const yesterdayEnd = new Date(yesterdayStart)
    yesterdayEnd.setHours(23, 59, 59, 999)

    const [moodRes, goalRes, winsRes, yesterdayWinsRes, strayThoughtsRes] = await Promise.all([
      supabase.from('mood_entries').select('*').eq('user_id', userId)
        .order('created_at', { ascending: false }).limit(14),
      supabase.from('goals').select('id, title, progress_percent, plant_type')
        .eq('user_id', userId).eq('status', 'active')
        .order('created_at', { ascending: false }).limit(1),
      supabase.from('goal_progress_logs').select('action_type, step_text')
        .eq('user_id', userId).gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false }),
      supabase.from('goal_progress_logs').select('id')
        .eq('user_id', userId)
        .gte('created_at', yesterdayStart.toISOString())
        .lte('created_at', yesterdayEnd.toISOString()),
      supabase.from('focus_plans').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('due_date', 'no_rush').eq('is_completed', false),
    ])

    const data = moodRes.data
    if (data && data.length > 0) {
      const lastEntry = data[0]
      const daysSince = Math.floor(
        (Date.now() - new Date(lastEntry.created_at).getTime()) / (1000 * 60 * 60 * 24)
      )

      let streak = 1
      for (let i = 1; i < data.length; i++) {
        const curr = new Date(data[i - 1].created_at)
        const prev = new Date(data[i].created_at)
        const diff = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
        if (diff <= 1) {
          streak++
        } else if (diff === 2) {
          const gapDay = new Date(curr)
          gapDay.setDate(gapDay.getDate() - 1)
          if (isMaintenanceDay(gapDay)) streak++
          else break
        } else break
      }

      let trend: 'up' | 'down' | 'stable' | null = null
      if (data.length >= 6) {
        const recent3 = data.slice(0, 3).reduce((s: number, m: MoodEntry) => s + m.mood_score, 0) / 3
        const prev3 = data.slice(3, 6).reduce((s: number, m: MoodEntry) => s + m.mood_score, 0) / 3
        if (recent3 - prev3 > 0.5) trend = 'up'
        else if (prev3 - recent3 > 0.5) trend = 'down'
        else trend = 'stable'
      }

      const recentAvg = data.slice(0, 7).reduce((s: number, m: MoodEntry) => s + m.mood_score, 0) / Math.min(data.length, 7)

      setInsights({
        totalCheckIns: data.length,
        currentStreak: streak >= 2 ? { type: 'checking_in', days: streak } : null,
        lastMood: lastEntry.mood_score,
        lastNote: lastEntry.note,
        daysSinceLastCheckIn: daysSince,
        recentAverage: Math.round(recentAvg * 10) / 10,
        trend,
      })

      if (!modeManuallySet) {
        const lastMood = lastEntry.mood_score
        const lastNote = lastEntry.note?.toLowerCase() || ''
        let calculatedMode: UserMode = 'maintenance'
        if (lastMood <= 3 || lastNote.includes('overwhelmed')) calculatedMode = 'recovery'
        else if (lastMood >= 8 && streak > 2) calculatedMode = 'growth'
        setUserMode(calculatedMode)
      }
    }

    if (goalRes.data && goalRes.data.length > 0) setActiveGoal(goalRes.data[0] as ActiveGoal)
    else setActiveGoal(null)

    // Process today's wins
    const wins: Array<{ text: string; icon: string }> = []
    if (winsRes.data) {
      for (const w of winsRes.data) {
        if (w.action_type === 'goal_completed') wins.push({ text: w.step_text || 'Completed a goal', icon: '🌸' })
        else if (w.action_type === 'step_completed') wins.push({ text: w.step_text || 'Completed a step', icon: '✅' })
      }
    }
    if (data && data.length > 0) {
      const todayEntries = data.filter((d: MoodEntry) =>
        new Date(d.created_at).toDateString() === new Date().toDateString()
      )
      if (todayEntries.length > 0) wins.push({ text: 'Checked in today', icon: '📋' })
    }
    setTodaysWins(wins)
    setYesterdayWinsCount(yesterdayWinsRes.data?.length || 0)
    setStrayThoughtsCount(strayThoughtsRes.count || 0)

    // Auto-archive overdue tasks
    await autoArchiveOverdueTasks(userId)
  }

  const getContextMessage = (): string | null => {
    if (!insights) return null
    if (insights.daysSinceLastCheckIn > 3) return `Welcome back! It's been ${insights.daysSinceLastCheckIn} days.`
    if (gamPrefs.showStreaks && insights.currentStreak && insights.currentStreak.days >= 3) {
      return `🔥 ${insights.currentStreak.days}-day streak! Keep it going.`
    }
    if (insights.trend === 'up') return `📈 Your mood has been trending up lately.`
    if (insights.trend === 'down' && insights.lastMood && insights.lastMood <= 4) {
      return `I noticed things have been tough. I'm here.`
    }
    return null
  }

  const handleWelcomeMoodSelect = async (mood: 'low' | 'okay' | 'good') => {
    if (!user) return
    const moodScoreMap = { low: 3, okay: 6, good: 8 }
    const score = moodScoreMap[mood]

    await supabase.from('mood_entries').insert({
      user_id: user.id,
      mood_score: score,
      note: null,
      coach_advice: null,
    })

    if (mood === 'low') setUserMode('recovery')
    else if (mood === 'good' && insights?.currentStreak && insights.currentStreak.days > 2) setUserMode('growth')
    else setUserMode('maintenance')

    setMoodScore(score)
    await fetchData(user.id)
  }

  if (loading) return <DashboardSkeleton />

  const hasCheckedInToday = insights?.daysSinceLastCheckIn === 0
  const energy = getEnergyParam(moodScore)

  // Build hero
  const renderHero = () => {
    // Not checked in → mood selection
    if (!hasCheckedInToday) {
      return (
        <WelcomeHero
          insights={insights}
          yesterdayWinsCount={yesterdayWinsCount}
          hasOverdueTasks={overduePlansCount > 0}
          onMoodSelect={handleWelcomeMoodSelect}
          onSkip={() => setUserMode('maintenance')}
        />
      )
    }

    // Recovery mode → gentle message
    if (userMode === 'recovery') {
      return (
        <div className="hero-card recovery-hero">
          <div className="hero-icon">🫂</div>
          <h2 className="hero-title">Take it easy</h2>
          <p className="hero-subtitle">No pressure. Here are some gentle options.</p>
          <div className="recovery-actions">
            <button className="btn btn-primary btn-full" onClick={() => router.push('/brake')}>
              🫁 Breathe
            </button>
            <button className="btn btn-secondary btn-full" onClick={() => router.push(`/focus?energy=low`)}>
              🎯 Try one small thing
            </button>
          </div>
        </div>
      )
    }

    // Normal/Growth → recommendation
    const suggestionsToShow: EnhancedSuggestion[] = recommendations.length > 0
      ? recommendations
      : activeGoal
        ? [{
            goalId: activeGoal.id,
            goalTitle: activeGoal.title,
            suggestion: activeGoal.title,
            reason: 'Your active goal',
            timeEstimate: '~15 min',
            effortLevel: 'medium' as const,
            url: `/focus?create=true&taskName=${encodeURIComponent(activeGoal.title)}&goalId=${activeGoal.id}&energy=${energy}`,
          }]
        : [{
            goalId: null,
            goalTitle: null,
            suggestion: 'Pick something small',
            reason: 'Start with what feels manageable',
            timeEstimate: '~5 min',
            effortLevel: 'low' as const,
            url: `/focus?energy=${energy}`,
          }]

    return (
      <Just1ThingHero
        greeting={getGreeting()}
        contextMessage={getContextMessage() || undefined}
        suggestions={suggestionsToShow}
        onShuffle={recommendations.length > 0 ? handleShuffle : undefined}
        shuffleCount={shuffleCount}
        maxShuffles={3}
      />
    )
  }

  return (
    <div className="dashboard">
      <UnifiedHeader subtitle="Dashboard" />

      <main className="main">
        {renderHero()}

        {/* Info rows — compact, not cards */}
        {hasCheckedInToday && (
          <div className="info-rows">
            {strayThoughtsCount > 0 && (
              <button className="info-row" onClick={() => router.push('/focus')}>
                <span className="info-icon">💡</span>
                <span className="info-text">
                  {strayThoughtsCount} stray thought{strayThoughtsCount !== 1 ? 's' : ''} parked
                </span>
                <span className="info-arrow">→</span>
              </button>
            )}

            {activeGoal && (
              <button className="info-row" onClick={() => router.push('/goals')}>
                <span className="info-icon">{getPlantEmoji(activeGoal.progress_percent)}</span>
                <span className="info-text">{activeGoal.title}</span>
                <span className="info-badge">{activeGoal.progress_percent}%</span>
                <span className="info-arrow">→</span>
              </button>
            )}

            <button className="info-row" onClick={() => router.push('/weekly-planning')}>
              <span className="info-icon">📋</span>
              <span className="info-text">Plan your week</span>
              <span className="info-arrow">→</span>
            </button>
          </div>
        )}

        {/* Today's Wins */}
        {todaysWins.length > 0 && (
          <div className="wins-section">
            <h3 className="section-title">Today's wins</h3>
            <div className="wins-list">
              {todaysWins.slice(0, 5).map((win, i) => (
                <div key={i} className="win-item">
                  <span className="win-icon">{win.icon}</span>
                  <span className="win-text">{win.text}</span>
                </div>
              ))}
            </div>
            {todaysWins.length > 5 && (
              <button className="btn btn-ghost btn-small" onClick={() => router.push('/wins')}>
                View all {todaysWins.length} wins →
              </button>
            )}
          </div>
        )}

        {/* Village presence */}
        {onlineCount > 1 && (
          <div className="village-footer">
            <span className="village-dot" />
            {onlineCount} people focusing right now
          </div>
        )}
      </main>

      <style jsx>{`
        .dashboard {
          background: var(--bg-gray);
          min-height: 100vh;
          min-height: 100dvh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .main {
          padding: 16px;
          padding-bottom: 80px;
          max-width: 600px;
          margin: 0 auto;
        }

        /* Recovery hero */
        .hero-card {
          background: white;
          border-radius: var(--card-radius);
          box-shadow: var(--card-shadow);
          padding: 24px;
          text-align: center;
          margin-bottom: 16px;
        }

        .hero-icon { font-size: 48px; margin-bottom: 12px; }
        .hero-title {
          font-size: 22px;
          font-weight: 700;
          color: #0f1419;
          margin: 0 0 8px 0;
        }
        .hero-subtitle {
          font-size: 15px;
          color: #536471;
          margin: 0 0 20px 0;
          line-height: 1.5;
        }

        .recovery-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* Info rows */
        .info-rows {
          display: flex;
          flex-direction: column;
          gap: 2px;
          background: white;
          border-radius: var(--card-radius);
          box-shadow: var(--card-shadow);
          overflow: hidden;
          margin-bottom: 16px;
        }

        .info-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: none;
          border: none;
          border-bottom: 1px solid #f0f3f5;
          cursor: pointer;
          transition: background 0.15s ease;
          font-family: inherit;
          text-align: left;
          width: 100%;
        }
        .info-row:last-child { border-bottom: none; }
        .info-row:hover { background: #f7f9fa; }

        .info-icon { font-size: 20px; flex-shrink: 0; }
        .info-text {
          flex: 1;
          font-size: 15px;
          font-weight: 500;
          color: #0f1419;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .info-badge {
          font-size: 13px;
          font-weight: 600;
          color: #17bf63;
          flex-shrink: 0;
        }
        .info-arrow {
          color: #aab8c2;
          font-size: 16px;
          flex-shrink: 0;
        }

        /* Wins section */
        .wins-section {
          margin-bottom: 16px;
        }

        .section-title {
          font-size: 14px;
          font-weight: 600;
          color: #536471;
          margin: 0 0 8px 4px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .wins-list {
          background: white;
          border-radius: var(--card-radius);
          box-shadow: var(--card-shadow);
          overflow: hidden;
        }

        .win-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-bottom: 1px solid #f0f3f5;
        }
        .win-item:last-child { border-bottom: none; }
        .win-icon { font-size: 16px; flex-shrink: 0; }
        .win-text {
          font-size: 14px;
          color: #0f1419;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Village footer */
        .village-footer {
          display: flex;
          align-items: center;
          gap: 8px;
          justify-content: center;
          padding: 12px;
          font-size: 13px;
          color: #8899a6;
        }

        .village-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #17bf63;
        }
      `}</style>
    </div>
  )
}
