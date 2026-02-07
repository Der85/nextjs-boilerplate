'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { usePresenceWithFallback } from '@/hooks/usePresence'
import ModeIndicator from '@/components/adhd/ModeIndicator'
import ProgressiveCard from '@/components/adhd/ProgressiveCard'
import AppHeader from '@/components/AppHeader'
import FABToolbox from '@/components/FABToolbox'
import WelcomeHero from '@/components/WelcomeHero'
import SoftLandingHero from '@/components/SoftLandingHero'
import GentleCheckIn from '@/components/GentleCheckIn'
import GentleTidyUp from '@/components/GentleTidyUp'
import TriageModal from '@/components/TriageModal'
import Just1ThingHero from '@/components/Just1ThingHero'
import DashboardSkeleton from '@/components/DashboardSkeleton'
import { useGamificationPrefsSafe } from '@/context/GamificationPrefsContext'
import { getCachedPrefetchData, clearPrefetchCache, type PrefetchedData } from '@/lib/prefetch'
import { autoArchiveOverdueTasks, getRecentlyAutoArchivedTasks, getTasksDueTomorrow, spreadTasksAcrossDays } from '@/lib/autoArchive'
import { getMoodEmoji, getEnergyParam, getPulseLabel, getGreeting, getPlantEmoji } from '@/lib/utils/ui-helpers'

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

interface OverduePlan {
  id: string
  task_name: string
  due_date: string | null
  created_at: string
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

// Phase 1: User Mode type for holistic state (includes warming_up transitional state)
type UserMode = 'recovery' | 'warming_up' | 'maintenance' | 'growth'

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
  const [saving, setSaving] = useState(false)

  // Mood check-in state
  const [moodScore, setMoodScore] = useState<number | null>(null)

  // Data state
  const [insights, setInsights] = useState<UserInsights | null>(null)
  const [activeGoal, setActiveGoal] = useState<ActiveGoal | null>(null)
  // aiInsight removed — atomic dashboard shows recommendation instead
  
  // Phase 1: User Mode state for holistic dashboard
  const [userMode, setUserMode] = useState<UserMode>('maintenance')
  const [modeManuallySet, setModeManuallySet] = useState(false)
  const [showModeSelector, setShowModeSelector] = useState(false)

  // Real-time presence - isFocusing: false because Dashboard is for overview
  const { onlineCount } = usePresenceWithFallback({ isFocusing: false })


  // Gentle Tidy Up (non-blocking overdue task card)
  const [overduePlans, setOverduePlans] = useState<OverduePlan[]>([])
  const [tidyUpDismissed, setTidyUpDismissed] = useState(false)
  const [tidyUpHidden, setTidyUpHidden] = useState(false) // Permanently hidden after 3 consecutive dismissals
  const [freshStartProcessing, setFreshStartProcessing] = useState(false)
  const [triageModalOpen, setTriageModalOpen] = useState(false)
  const [tasksDueTomorrow, setTasksDueTomorrow] = useState(0)

  // "Today's Wins" section
  const [todaysWins, setTodaysWins] = useState<Array<{ text: string; icon: string }>>([])

  // Welcome Hero (Value-First Dashboard)
  const [welcomeSkipped, setWelcomeSkipped] = useState(false)
  const [yesterdayWinsCount, setYesterdayWinsCount] = useState(0)
  const [welcomeTransitioning, setWelcomeTransitioning] = useState(false)

  // "Do This Next" recommendation (enhanced with full context)
  interface EnhancedSuggestion {
    goalId: string | null
    goalTitle: string | null
    suggestion: string
    reason: string
    timeEstimate: string
    effortLevel: 'low' | 'medium' | 'high'
    url: string
  }
  const [recommendations, setRecommendations] = useState<EnhancedSuggestion[]>([])
  const [shuffleCount, setShuffleCount] = useState(0)
  const [usedSuggestionIds, setUsedSuggestionIds] = useState<string[]>([])
  const accessTokenRef = useRef<string | null>(null)

  const [pulseSaved, setPulseSaved] = useState(false)
  const [pulseSaving, setPulseSaving] = useState(false)
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [lastPulseEntryId, setLastPulseEntryId] = useState<string | null>(null)
  const [showPulseUndo, setShowPulseUndo] = useState(false)
  const pulseUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mode override from URL (e.g., Brake tool re-entry)
  const [showOverrideToast, setShowOverrideToast] = useState(false)

  // Recovery mode: Soft Landing state
  const [recoveryEntryTime, setRecoveryEntryTime] = useState<number | null>(null)
  const [showGentleCheckIn, setShowGentleCheckIn] = useState(false)
  const [gentleCheckInVariant, setGentleCheckInVariant] = useState<'timed' | 'post-interaction'>('timed')
  const [showPulseConfirmation, setShowPulseConfirmation] = useState(false)
  const [pendingLowMoodScore, setPendingLowMoodScore] = useState<number | null>(null)
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warmingUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { prefs: gamPrefs, isMaintenanceDay } = useGamificationPrefsSafe()

  // Check localStorage for consecutive tidy-up dismissals (hide after 3)
  useEffect(() => {
    const dismissCount = localStorage.getItem('tidy-up-dismiss-count')
    if (dismissCount && parseInt(dismissCount) >= 3) {
      setTidyUpHidden(true)
    }
  }, [])

  // Check for active brake snooze - suppresses recovery mode prompts
  const isBrakeSnoozeActive = (): boolean => {
    const snoozeUntil = localStorage.getItem('brake-snooze-until')
    if (!snoozeUntil) return false
    const snoozeTime = parseInt(snoozeUntil, 10)
    if (isNaN(snoozeTime)) return false
    // If snooze is still active, return true
    if (Date.now() < snoozeTime) return true
    // Snooze expired, clean up
    localStorage.removeItem('brake-snooze-until')
    return false
  }

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)

      // Check for prefetched data from smart router (instant render)
      const cachedData = getCachedPrefetchData()
      if (cachedData) {
        // Use prefetched data immediately - no loading state needed!
        applyPrefetchedData(cachedData)
        setLoading(false)
        // Clear cache after use
        clearPrefetchCache()
        // Still fetch fresh data in background (silent update)
        fetchData(session.user.id)
      } else {
        // No cached data - fetch normally
        await fetchData(session.user.id)
        setLoading(false)
      }

      // Prioritize URL mode param over calculated mode (e.g., from Brake tool)
      const modeParam = searchParams.get('mode') as UserMode | null
      if (modeParam && ['recovery', 'maintenance', 'growth'].includes(modeParam)) {
        setUserMode(modeParam)
        // Set slider to a safe default for the overridden mode
        if (modeParam === 'maintenance') setMoodScore(5)
        else if (modeParam === 'growth') setMoodScore(8)
        else if (modeParam === 'recovery') setMoodScore(3)
        setShowOverrideToast(true)
        setTimeout(() => setShowOverrideToast(false), 4000)
      }

      // Load "Do This Next" recommendation (non-blocking)
      loadRecommendation(session.access_token)
    }
    init()
    return () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current)
    }
  }, [router, searchParams])

  // Recovery mode: 15-minute gentle check-in timer
  useEffect(() => {
    // Clear any existing timer
    if (recoveryTimerRef.current) {
      clearTimeout(recoveryTimerRef.current)
      recoveryTimerRef.current = null
    }

    // Only set timer if in recovery mode
    if (userMode === 'recovery' && recoveryEntryTime) {
      recoveryTimerRef.current = setTimeout(() => {
        setGentleCheckInVariant('timed')
        setShowGentleCheckIn(true)
      }, 15 * 60 * 1000) // 15 minutes
    }

    // Clean up warming up timer if we leave warming_up
    if (userMode !== 'warming_up' && warmingUpTimerRef.current) {
      clearTimeout(warmingUpTimerRef.current)
      warmingUpTimerRef.current = null
    }

    return () => {
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current)
    }
  }, [userMode, recoveryEntryTime])

  // Apply prefetched data to state (for instant rendering from smart router)
  const applyPrefetchedData = (data: PrefetchedData) => {
    if (data.insights) {
      setInsights(data.insights)
      // Calculate mode from insights
      if (data.insights.lastMood !== null) {
        let calculatedMode: UserMode = data.insights.lastMood <= 3 ? 'recovery'
          : data.insights.lastMood >= 8 ? 'growth'
          : 'maintenance'
        // Apply snooze override: if snooze is active, force maintenance instead of recovery
        if (calculatedMode === 'recovery' && isBrakeSnoozeActive()) {
          calculatedMode = 'maintenance'
        }
        setUserMode(calculatedMode)
      }
    }
    if (data.activeGoal) {
      setActiveGoal(data.activeGoal)
    }
    if (data.todaysWinsCount > 0) {
      setYesterdayWinsCount(data.todaysWinsCount)
    }
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
          // Fallback for old API format
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
      // Silently fail — recommendation is optional
    }
  }

  // Shuffle handler for Just1ThingHero
  const handleShuffle = async () => {
    if (shuffleCount >= 3 || !accessTokenRef.current) return

    // Track the current suggestion so we don't repeat it
    const currentSuggestion = recommendations[0]
    const newUsedIds = currentSuggestion?.goalId
      ? [...usedSuggestionIds, currentSuggestion.goalId]
      : usedSuggestionIds

    setUsedSuggestionIds(newUsedIds)
    setShuffleCount(prev => prev + 1)

    // Fetch new recommendations excluding used ones
    await loadRecommendation(accessTokenRef.current, newUsedIds)
  }

  const fetchData = async (userId: string) => {
    // Prepare date ranges for queries
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const yesterdayStart = new Date()
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)
    yesterdayStart.setHours(0, 0, 0, 0)
    const yesterdayEnd = new Date(yesterdayStart)
    yesterdayEnd.setHours(23, 59, 59, 999)

    // CONCURRENT FETCH: Run all independent queries in parallel
    const [moodRes, goalRes, winsRes, yesterdayWinsRes] = await Promise.all([
      // Mood entries (last 14)
      supabase
        .from('mood_entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(14),

      // Most recent active goal
      supabase
        .from('goals')
        .select('id, title, progress_percent, plant_type')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1),

      // Today's wins
      supabase
        .from('goal_progress_logs')
        .select('action_type, step_text')
        .eq('user_id', userId)
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false }),

      // Yesterday's wins count
      supabase
        .from('goal_progress_logs')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', yesterdayStart.toISOString())
        .lte('created_at', yesterdayEnd.toISOString()),
    ])

    const data = moodRes.data
    const goalData = goalRes.data
    const winsData = winsRes.data
    const yesterdayWinsData = yesterdayWinsRes.data

    // Process mood entries
    if (data && data.length > 0) {
      const lastEntry = data[0]
      const daysSince = Math.floor(
        (Date.now() - new Date(lastEntry.created_at).getTime()) / (1000 * 60 * 60 * 24)
      )

      // Calculate streak (accounting for maintenance days)
      let streak = 1
      for (let i = 1; i < data.length; i++) {
        const curr = new Date(data[i - 1].created_at)
        const prev = new Date(data[i].created_at)
        const diff = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
        if (diff <= 1) {
          streak++
        } else if (diff === 2) {
          // Check if the gap day was a maintenance day
          const gapDay = new Date(curr)
          gapDay.setDate(gapDay.getDate() - 1)
          if (isMaintenanceDay(gapDay)) {
            streak++ // Continue streak through maintenance day
          } else {
            break
          }
        } else {
          break
        }
      }

      // Calculate trend
      let trend: 'up' | 'down' | 'stable' | null = null
      if (data.length >= 6) {
        const recent3 = data.slice(0, 3).reduce((s, m) => s + m.mood_score, 0) / 3
        const prev3 = data.slice(3, 6).reduce((s, m) => s + m.mood_score, 0) / 3
        if (recent3 - prev3 > 0.5) trend = 'up'
        else if (prev3 - recent3 > 0.5) trend = 'down'
        else trend = 'stable'
      }

      const recentAvg = data.slice(0, 7).reduce((s, m) => s + m.mood_score, 0) / Math.min(data.length, 7)

      // Set insights
      setInsights({
        totalCheckIns: data.length,
        currentStreak: streak >= 2 ? { type: 'checking_in', days: streak } : null,
        lastMood: lastEntry.mood_score,
        lastNote: lastEntry.note,
        daysSinceLastCheckIn: daysSince,
        recentAverage: Math.round(recentAvg * 10) / 10,
        trend
      })

      // Phase 1: Calculate User Mode based on mood data
      // Only auto-set mode if not manually overridden
      if (!modeManuallySet) {
        let calculatedMode = calculateUserMode(lastEntry, streak)

        // Check for active brake snooze - suppress recovery mode if snoozed
        if (calculatedMode === 'recovery' && isBrakeSnoozeActive()) {
          calculatedMode = 'maintenance'
        }

        setUserMode(calculatedMode)
      }
    }

    // Process goal data
    if (goalData && goalData.length > 0) {
      setActiveGoal(goalData[0] as ActiveGoal)
    } else {
      setActiveGoal(null)
    }

    // Process today's wins
    const wins: Array<{ text: string; icon: string }> = []
    if (winsData) {
      for (const w of winsData) {
        if (w.action_type === 'goal_completed') {
          wins.push({ text: w.step_text || 'Completed a goal', icon: '🌸' })
        } else if (w.action_type === 'step_completed') {
          wins.push({ text: w.step_text || 'Completed a step', icon: '✅' })
        }
      }
    }
    // Count today's mood entries as a win
    if (data && data.length > 0) {
      const todayEntries = data.filter((d: MoodEntry) =>
        new Date(d.created_at).toDateString() === new Date().toDateString()
      )
      if (todayEntries.length > 0) {
        wins.push({ text: 'Checked in today', icon: '📋' })
      }
    }
    setTodaysWins(wins)

    // Process yesterday's wins
    setYesterdayWinsCount(yesterdayWinsData?.length || 0)

    // SECOND BATCH: Auto-archive tasks, then fetch archived + tomorrow count
    // These have a dependency: archive must run before fetching archived tasks
    await autoArchiveOverdueTasks(userId)

    // These can run in parallel after archiving
    const [autoArchivedTasks, tomorrowCount] = await Promise.all([
      getRecentlyAutoArchivedTasks(userId),
      getTasksDueTomorrow(userId),
    ])

    setOverduePlans(autoArchivedTasks.map(t => ({
      id: t.id,
      task_name: t.task_name,
      due_date: t.due_date,
      created_at: t.created_at,
    })) as OverduePlan[])

    setTasksDueTomorrow(tomorrowCount)
  }

  // Phase 1: User Mode calculation logic
  const calculateUserMode = (lastEntry: MoodEntry, streak: number): UserMode => {
    const lastMood = lastEntry.mood_score
    const lastNote = lastEntry.note?.toLowerCase() || ''
    
    // Recovery: If the last mood score was ≤ 3 OR the last note mentions 'overwhelmed'
    if (lastMood <= 3 || lastNote.includes('overwhelmed')) {
      return 'recovery'
    }
    
    // Growth: If the last mood score was ≥ 8 AND there is a current streak > 2 days
    if (lastMood >= 8 && streak > 2) {
      return 'growth'
    }
    
    // Maintenance: Everything else (default)
    return 'maintenance'
  }


  const getContextMessage = (): string | null => {
    if (!insights) return null

    if (insights.daysSinceLastCheckIn > 3) {
      return `Welcome back! It's been ${insights.daysSinceLastCheckIn} days.`
    }
    if (gamPrefs.showStreaks && insights.currentStreak && insights.currentStreak.days >= 3) {
      return `🔥 ${insights.currentStreak.days}-day streak! Keep it going.`
    }
    if (insights.trend === 'up') {
      return `📈 Your mood has been trending up lately.`
    }
    if (insights.trend === 'down' && insights.lastMood && insights.lastMood <= 4) {
      return `I noticed things have been tough. I'm here.`
    }
    return null
  }

  const handlePulseSave = async () => {
    if (moodScore === null || !user || saving) return
    // Clear any pending auto-save timer
    if (pulseTimerRef.current) {
      clearTimeout(pulseTimerRef.current)
      pulseTimerRef.current = null
    }
    // Clear any pending undo timer
    if (pulseUndoTimerRef.current) {
      clearTimeout(pulseUndoTimerRef.current)
    }
    setSaving(true)
    const { data: insertedEntry } = await supabase.from('mood_entries').insert({
      user_id: user.id,
      mood_score: moodScore,
      note: null,
      coach_advice: null,
    }).select('id').single()

    if (insertedEntry) {
      setLastPulseEntryId(insertedEntry.id)
    }
    await fetchData(user.id)
    setSaving(false)
    setPulseSaving(false)
    setPulseSaved(true)
    setShowPulseUndo(true)

    // Hide undo option after 5 seconds
    pulseUndoTimerRef.current = setTimeout(() => {
      setShowPulseUndo(false)
      setLastPulseEntryId(null)
    }, 5000)
  }

  const handlePulseUndo = async () => {
    if (!lastPulseEntryId || !user) return
    // Clear undo timer
    if (pulseUndoTimerRef.current) {
      clearTimeout(pulseUndoTimerRef.current)
    }
    // Delete the entry
    await supabase.from('mood_entries').delete().eq('id', lastPulseEntryId)
    setLastPulseEntryId(null)
    setShowPulseUndo(false)
    setPulseSaved(false)
    setMoodScore(null)
    await fetchData(user.id)
  }

  const handlePulseChange = (value: number) => {
    setMoodScore(value)
    setPulseSaved(false)
    setPulseSaving(true)

    // Recovery transition: Require confirmation for scores 2-3, auto-enter for score 1
    // Note: enterRecoveryMode already checks snooze, so no additional check needed here
    if (value <= 3 && userMode !== 'recovery' && userMode !== 'warming_up') {
      // If snooze is active, skip recovery mode entirely
      if (isBrakeSnoozeActive()) {
        setUserMode('maintenance')
      } else if (value === 1) {
        // Score of 1 = strong signal, auto-enter recovery with smooth transition
        enterRecoveryMode()
      } else {
        // Score 2-3 = show confirmation
        setPendingLowMoodScore(value)
        setShowPulseConfirmation(true)
        // Still save the mood but don't change mode yet
      }
    } else if (value >= 8 && insights?.currentStreak && insights.currentStreak.days > 2) {
      setUserMode('growth')
    } else if (value > 3) {
      setUserMode('maintenance')
    }

    // Debounced auto-save after 3 seconds of inactivity
    if (pulseTimerRef.current) {
      clearTimeout(pulseTimerRef.current)
    }
    pulseTimerRef.current = setTimeout(() => {
      handlePulseSaveRef.current()
    }, 3000)
  }

  // Enter recovery mode with tracking (respects snooze)
  const enterRecoveryMode = () => {
    // If snooze is active, stay in maintenance instead of recovery
    if (isBrakeSnoozeActive()) {
      setUserMode('maintenance')
      setShowPulseConfirmation(false)
      setPendingLowMoodScore(null)
      return
    }
    setUserMode('recovery')
    setRecoveryEntryTime(Date.now())
    setShowGentleCheckIn(false)
    setShowPulseConfirmation(false)
    setPendingLowMoodScore(null)
  }

  // Handle pulse confirmation for entering recovery
  const handlePulseConfirmYes = () => {
    enterRecoveryMode()
  }

  const handlePulseConfirmNo = () => {
    setShowPulseConfirmation(false)
    setPendingLowMoodScore(null)
    // Keep the mood score logged but stay in current mode
  }

  // Recovery mode: Soft Landing interaction handler
  const handleSoftLandingInteraction = () => {
    // Show gentle check-in after user engages with any soft landing option
    setTimeout(() => {
      setGentleCheckInVariant('post-interaction')
      setShowGentleCheckIn(true)
    }, 500) // Small delay after returning from the interaction
  }

  // Gentle check-in handlers
  const handleStillLow = () => {
    setShowGentleCheckIn(false)
    setRecoveryEntryTime(Date.now()) // Reset the 15-minute timer
  }

  const handleALittleBetter = () => {
    setShowGentleCheckIn(false)
    setUserMode('warming_up')
    // Set up auto-transition to maintenance after 10 minutes
    if (warmingUpTimerRef.current) clearTimeout(warmingUpTimerRef.current)
    warmingUpTimerRef.current = setTimeout(() => {
      setUserMode('maintenance')
    }, 10 * 60 * 1000) // 10 minutes
  }

  const handleOkayNow = () => {
    setShowGentleCheckIn(false)
    setUserMode('maintenance')
  }

  // Ref to always call latest handlePulseSave (avoids stale closure in timer)
  const handlePulseSaveRef = useRef(handlePulseSave)
  handlePulseSaveRef.current = handlePulseSave

  // Fresh Start batch actions
  const handleFreshStartMoveToday = async () => {
    if (!user || overduePlans.length === 0) return
    setFreshStartProcessing(true)
    const ids = overduePlans.map(p => p.id)
    await supabase
      .from('focus_plans')
      .update({ due_date: 'today' })
      .in('id', ids)
      .eq('user_id', user.id)
    setOverduePlans([])
    setTidyUpDismissed(true)
    setFreshStartProcessing(false)
  }

  const handleFreshStartBacklog = async () => {
    if (!user || overduePlans.length === 0) return
    setFreshStartProcessing(true)
    const ids = overduePlans.map(p => p.id)
    await supabase
      .from('focus_plans')
      .update({ due_date: 'no_rush' })
      .in('id', ids)
      .eq('user_id', user.id)
    setOverduePlans([])
    setTidyUpDismissed(true)
    setFreshStartProcessing(false)
  }

  const handleFreshStartDelete = async () => {
    if (!user || overduePlans.length === 0) return
    setFreshStartProcessing(true)
    const ids = overduePlans.map(p => p.id)
    await supabase
      .from('focus_plans')
      .delete()
      .in('id', ids)
      .eq('user_id', user.id)
    setOverduePlans([])
    setTidyUpDismissed(true)
    setFreshStartProcessing(false)
  }

  // Gentle Tidy Up handlers
  const handleTidyUpDismiss = () => {
    // Track consecutive dismissals in localStorage
    const currentCount = parseInt(localStorage.getItem('tidy-up-dismiss-count') || '0')
    const newCount = currentCount + 1
    localStorage.setItem('tidy-up-dismiss-count', String(newCount))

    // After 3 consecutive dismissals, hide permanently
    if (newCount >= 3) {
      setTidyUpHidden(true)
    }

    setTidyUpDismissed(true)
  }

  const handleTidyUpReview = () => {
    // Reset the consecutive dismissal count when user actually reviews
    localStorage.removeItem('tidy-up-dismiss-count')
    // Open the triage modal instead of navigating
    setTriageModalOpen(true)
  }

  // Triage Modal handlers
  const handleTriageClose = () => {
    setTriageModalOpen(false)
    // If all items were handled, dismiss the tidy-up card
    if (overduePlans.length === 0) {
      setTidyUpDismissed(true)
    }
  }

  const handleTriageArchiveAll = async () => {
    if (!user || overduePlans.length === 0) return
    const ids = overduePlans.map(p => p.id)
    await supabase
      .from('focus_plans')
      .update({ due_date: null, status: 'archived' })
      .in('id', ids)
      .eq('user_id', user.id)
    setOverduePlans([])
    setTidyUpDismissed(true)
  }

  const handleTriageArchiveSelected = async (ids: string[]) => {
    if (!user || ids.length === 0) return
    await supabase
      .from('focus_plans')
      .update({ due_date: null, status: 'archived' })
      .in('id', ids)
      .eq('user_id', user.id)
    // Remove archived items from local state
    setOverduePlans(prev => prev.filter(p => !ids.includes(p.id)))
  }

  const handleTriageRescheduleSelected = async (ids: string[]) => {
    if (!user || ids.length === 0) return
    // Reschedule to tomorrow (not today - reduces pressure)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    await supabase
      .from('focus_plans')
      .update({ due_date: tomorrowStr })
      .in('id', ids)
      .eq('user_id', user.id)
    // Remove rescheduled items from overdue list
    setOverduePlans(prev => prev.filter(p => !ids.includes(p.id)))
    // Update tomorrow count
    setTasksDueTomorrow(prev => prev + ids.length)
  }

  const handleTriageSpreadTasks = async (ids: string[]) => {
    if (!user || ids.length === 0) return
    // Use the spreadTasksAcrossDays utility to distribute tasks
    await spreadTasksAcrossDays(user.id, ids)
    // Remove spread items from overdue list
    setOverduePlans(prev => prev.filter(p => !ids.includes(p.id)))
  }

  // Welcome Hero handlers (Value-First Dashboard)
  const handleWelcomeMoodSelect = async (mood: 'low' | 'okay' | 'good') => {
    if (!user) return

    // Map mood to score: low=3, okay=6, good=8
    const moodScoreMap = { low: 3, okay: 6, good: 8 }
    const score = moodScoreMap[mood]

    setWelcomeTransitioning(true)

    // Save the mood entry
    await supabase.from('mood_entries').insert({
      user_id: user.id,
      mood_score: score,
      note: null,
      coach_advice: null,
    })

    // Set the mode based on mood (respects snooze)
    if (mood === 'low') {
      // If snooze is active, stay in maintenance instead of recovery
      if (isBrakeSnoozeActive()) {
        setUserMode('maintenance')
      } else {
        setUserMode('recovery')
      }
    } else if (mood === 'good' && insights?.currentStreak && insights.currentStreak.days > 2) {
      setUserMode('growth')
    } else {
      setUserMode('maintenance')
    }

    // Set the mood score for compatibility with existing logic
    setMoodScore(score)

    // Refresh data to update hasCheckedInToday
    await fetchData(user.id)

    // Brief delay for smooth transition animation
    setTimeout(() => {
      setWelcomeTransitioning(false)
    }, 300)
  }

  const handleWelcomeSkip = () => {
    setWelcomeSkipped(true)
    // Default to maintenance mode when skipped
    setUserMode('maintenance')
  }

  // Phase 1: Get mode-specific styling and content
  const getModeConfig = () => {
    switch (userMode) {
      case 'recovery':
        return {
          color: '#f4212e',
          bgColor: 'rgba(244, 33, 46, 0.08)',
          borderColor: 'rgba(244, 33, 46, 0.2)',
          icon: '🫂',
          label: 'Recovery Mode',
          message: "Low battery detected. Let's simplify."
        }
      case 'growth':
        return {
          color: '#00ba7c',
          bgColor: 'rgba(0, 186, 124, 0.08)',
          borderColor: 'rgba(0, 186, 124, 0.2)',
          icon: '🚀',
          label: 'Growth Mode',
          message: "Channel this energy before it fades."
        }
      case 'maintenance':
      default:
        return {
          color: '#1D9BF0',
          bgColor: 'rgba(29, 155, 240, 0.08)',
          borderColor: 'rgba(29, 155, 240, 0.2)',
          icon: '⚖️',
          label: 'Steady Mode',
          message: "Consistency is key. Keep building those sustainable habits."
        }
    }
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  const modeConfig = getModeConfig()

  // Handle manual mode change
  const handleModeChange = (newMode: UserMode) => {
    setUserMode(newMode)
    setModeManuallySet(true)
    setShowModeSelector(false)
  }

  // Reset to auto mode
  const handleResetAutoMode = () => {
    setModeManuallySet(false)
    setShowModeSelector(false)
    // Recalculate mode based on last entry
    if (insights && insights.lastMood !== null) {
      const mockEntry = { mood_score: insights.lastMood } as MoodEntry
      const streak = insights.currentStreak?.days || 0
      const calculatedMode = calculateUserMode(mockEntry, streak)
      setUserMode(calculatedMode)
    }
  }

  // Computed view flags for mode-specific rendering
  const isRecoveryView = userMode === 'recovery' || userMode === 'warming_up'
  const isFullRecoveryView = userMode === 'recovery' // Strict recovery only
  // isGrowthView removed — atomic dashboard uses unified hero flow
  const brakeVariant: 'urgent' | 'neutral' =
    userMode === 'recovery' || insights?.trend === 'down' ? 'urgent' : 'neutral'

  // Atomic Dashboard: Has the user checked in today?
  const hasCheckedInToday = insights?.daysSinceLastCheckIn === 0

  // ===== "ONE THING" PRINCIPLE: renderHero() =====
  // Returns ONLY ONE hero card based on strict priority hierarchy.
  // This eliminates choice paralysis by showing the single most important action.
  const renderHero = () => {
    const energy = getEnergyParam(moodScore)

    // PRIORITY 0: Welcome Hero — Value-First Dashboard
    // Show when user hasn't checked in today and hasn't skipped
    if (!hasCheckedInToday && !welcomeSkipped && !welcomeTransitioning) {
      return (
        <WelcomeHero
          insights={insights}
          yesterdayWinsCount={yesterdayWinsCount}
          hasOverdueTasks={overduePlans.length > 0}
          onMoodSelect={handleWelcomeMoodSelect}
          onSkip={handleWelcomeSkip}
        />
      )
    }

    // PRIORITY 1: Recovery Mode — Soft Landing (not lockdown)
    if (isFullRecoveryView) {
      return (
        <SoftLandingHero onInteraction={handleSoftLandingInteraction} />
      )
    }

    // PRIORITY 1.5: Warming Up — transitional state from recovery
    if (userMode === 'warming_up') {
      return (
        <div className="card hero-card warming-up-hero">
          <div className="hero-icon">🌤️</div>
          <h2 className="hero-title">Warming Up</h2>
          <p className="hero-subtitle">You're easing back. Take it slow.</p>
          <div className="warming-up-options">
            <button
              onClick={() => router.push(`/focus?energy=low`)}
              className="hero-btn warming-primary"
            >
              🎯 Try one small thing
            </button>
            <button
              onClick={() => {
                setUserMode('recovery')
                setRecoveryEntryTime(Date.now())
              }}
              className="hero-btn warming-secondary"
            >
              🫂 Need more time
            </button>
          </div>
        </div>
      )
    }

    // PRIORITY 2: Just One Thing (recommendation or fallback)
    // Note: Fresh Start removed from hero hierarchy — now a non-blocking card below

    // Build suggestions array from recommendations or fallback to activeGoal
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

  // Determine header mode (accounts for pre-check-in state)
  // Note: 'warming_up' maps to 'maintenance' for header since header doesn't have warming_up
  const getHeaderMode = (): 'pre-checkin' | 'recovery' | 'maintenance' | 'growth' => {
    if (!hasCheckedInToday && !welcomeSkipped) return 'pre-checkin'
    if (userMode === 'warming_up') return 'maintenance'
    return userMode
  }

  const headerMode = getHeaderMode()
  const isReturningUser = insights ? insights.daysSinceLastCheckIn >= 3 : false

  return (
    <div className={`dashboard ${isRecoveryView ? 'recovery-dimmed zen-mode' : ''}`}>
      <AppHeader
        mode={headerMode}
        isReturningUser={isReturningUser}
        streakCount={insights?.currentStreak?.days || 0}
        moodTrending={insights?.trend || undefined}
      />

      <main className="main">
        {/* ===== "ONE THING" DASHBOARD =====
            Aggressive progressive disclosure: only ONE hero element at a time.
            Strict hierarchy: 1. Recovery → 2. Just One Thing */}
        {renderHero()}

        {/* Gentle Tidy Up - non-blocking card for overdue tasks
            Only shown: after user has checked in, if there are overdue tasks,
            if not dismissed this session, and if not hidden permanently */}
        {hasCheckedInToday && overduePlans.length > 0 && !tidyUpDismissed && !tidyUpHidden && (
          <GentleTidyUp
            overdueCount={overduePlans.length}
            onDismiss={handleTidyUpDismiss}
            onReview={handleTidyUpReview}
          />
        )}

        {/* Mode Override Selector */}
        <div className="mode-override-section">
          <button
            className="mode-override-trigger"
            onClick={() => setShowModeSelector(!showModeSelector)}
          >
            <span className="mode-icon">{modeConfig.icon}</span>
            <span className="mode-label">{modeConfig.label}</span>
            {modeManuallySet && <span className="mode-manual-badge">Manual</span>}
            <span className="mode-chevron">{showModeSelector ? '▲' : '▼'}</span>
          </button>

          {showModeSelector && (
            <div className="mode-selector-dropdown">
              <button
                className={`mode-option ${userMode === 'recovery' ? 'active' : ''}`}
                onClick={() => handleModeChange('recovery')}
              >
                <span className="mode-option-icon">🫂</span>
                <div className="mode-option-text">
                  <span className="mode-option-label">Recovery</span>
                  <span className="mode-option-desc">Low energy, need rest</span>
                </div>
              </button>
              <button
                className={`mode-option ${userMode === 'maintenance' ? 'active' : ''}`}
                onClick={() => handleModeChange('maintenance')}
              >
                <span className="mode-option-icon">⚖️</span>
                <div className="mode-option-text">
                  <span className="mode-option-label">Steady</span>
                  <span className="mode-option-desc">Consistent and sustainable</span>
                </div>
              </button>
              <button
                className={`mode-option ${userMode === 'growth' ? 'active' : ''}`}
                onClick={() => handleModeChange('growth')}
              >
                <span className="mode-option-icon">🚀</span>
                <div className="mode-option-text">
                  <span className="mode-option-label">Growth</span>
                  <span className="mode-option-desc">High energy, push harder</span>
                </div>
              </button>
              {modeManuallySet && (
                <button className="mode-reset-btn" onClick={handleResetAutoMode}>
                  ↻ Reset to Auto
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* FAB Toolbox */}
      <FABToolbox
        mode={headerMode}
        energyParam={getEnergyParam(moodScore)}
        streakCount={insights?.currentStreak?.days || 0}
        hasActiveGoalStep={!!activeGoal && activeGoal.progress_percent < 100}
      />

      {/* Mode Override Toast (from Brake tool re-entry) */}
      {showOverrideToast && (
        <div className="override-toast">
          <span className="override-toast-icon">🌿</span>
          <span className="override-toast-text">State updated from Breathing Session</span>
        </div>
      )}

      {/* Gentle Check-In (Recovery exit path) */}
      {showGentleCheckIn && (
        <div className="gentle-checkin-overlay">
          <GentleCheckIn
            variant={gentleCheckInVariant}
            onStillLow={handleStillLow}
            onALittleBetter={handleALittleBetter}
            onOkayNow={handleOkayNow}
            onDismiss={() => setShowGentleCheckIn(false)}
          />
        </div>
      )}

      {/* Pulse Confirmation (entering recovery for scores 2-3) */}
      {showPulseConfirmation && (
        <div className="pulse-confirmation-overlay">
          <div className="pulse-confirmation-card">
            <div className="pulse-confirmation-icon">🫂</div>
            <h3 className="pulse-confirmation-title">Need some quiet time?</h3>
            <p className="pulse-confirmation-subtitle">
              Recovery mode gives you space to rest and recharge.
            </p>
            <div className="pulse-confirmation-actions">
              <button className="pulse-confirm-btn yes" onClick={handlePulseConfirmYes}>
                Yes, I need rest
              </button>
              <button className="pulse-confirm-btn no" onClick={handlePulseConfirmNo}>
                I'm okay for now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Triage Modal (bulk-first overdue item handling) */}
      <TriageModal
        isOpen={triageModalOpen}
        items={overduePlans}
        tasksDueTomorrow={tasksDueTomorrow}
        onClose={handleTriageClose}
        onArchiveAll={handleTriageArchiveAll}
        onArchiveSelected={handleTriageArchiveSelected}
        onRescheduleSelected={handleTriageRescheduleSelected}
        onSpreadTasks={handleTriageSpreadTasks}
      />

      <style jsx>{styles}</style>
    </div>
  )
}

// ============================================
// RESPONSIVE STYLES
// Using clamp() for fluid scaling between breakpoints
// ============================================
const styles = `
  .dashboard {
    --primary: #1D9BF0;
    --success: #00ba7c;
    --danger: #f4212e;
    --bg-gray: #f7f9fa;
    --dark-gray: #536471;
    --light-gray: #8899a6;

    background: var(--bg-gray);
    min-height: 100vh;
    min-height: 100dvh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: filter 0.5s ease;
  }

  /* Recovery mode: warm, cozy palette instead of desaturated lockdown */
  .dashboard.recovery-dimmed {
    --primary: #8b5cf6;
    --bg-gray: #faf8f5;
    background: linear-gradient(135deg, #faf8f5 0%, #f5f0e8 50%, #faf5ef 100%);
  }

  /* ===== LOADING ===== */
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    min-height: 100dvh;
  }

  .spinner {
    width: clamp(24px, 5vw, 32px);
    height: clamp(24px, 5vw, 32px);
    border: 3px solid var(--primary);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 12px;
  }

  .spinner-small {
    width: clamp(14px, 3vw, 18px);
    height: clamp(14px, 3vw, 18px);
    border: 2px solid white;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    display: inline-block;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }


  /* ===== MAIN CONTENT ===== */
  .main {
    padding: clamp(12px, 4vw, 20px);
    padding-bottom: clamp(16px, 4vw, 24px);
    max-width: 600px;
    margin: 0 auto;
  }

  .card {
    background: white;
    border-radius: clamp(14px, 4vw, 22px);
    overflow: hidden;
  }

  .main-card {
    position: relative;
    padding: clamp(16px, 5vw, 28px);
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    margin-bottom: clamp(20px, 5vw, 32px);
  }

  /* ===== FRESH START (OVERDUE TASK CLEANUP) ===== */
  .fresh-start-card {
    padding: clamp(18px, 5vw, 26px);
    margin-bottom: clamp(20px, 5vw, 32px);
    border: 2px solid rgba(249, 115, 22, 0.25);
    background: linear-gradient(135deg, rgba(249, 115, 22, 0.06) 0%, rgba(255, 255, 255, 1) 100%);
    box-shadow: 0 2px 12px rgba(249, 115, 22, 0.1);
  }

  .fresh-start-header {
    display: flex;
    align-items: flex-start;
    gap: clamp(10px, 3vw, 14px);
    margin-bottom: clamp(12px, 3vw, 16px);
  }

  .fresh-start-icon {
    font-size: clamp(28px, 8vw, 36px);
    flex-shrink: 0;
    line-height: 1;
  }

  .fresh-start-titles {
    flex: 1;
    min-width: 0;
  }

  .fresh-start-title {
    font-size: clamp(18px, 5vw, 22px);
    font-weight: 700;
    color: #0f1419;
    margin: 0 0 clamp(2px, 0.5vw, 4px) 0;
  }

  .fresh-start-subtitle {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    margin: 0;
    line-height: 1.4;
  }

  .fresh-start-items {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 1.5vw, 8px);
    margin-bottom: clamp(14px, 4vw, 18px);
    padding: clamp(10px, 2.5vw, 14px);
    background: rgba(249, 115, 22, 0.04);
    border-radius: clamp(10px, 2.5vw, 14px);
  }

  .fresh-start-item {
    display: flex;
    align-items: center;
    gap: clamp(8px, 2vw, 10px);
  }

  .fresh-start-item-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #f97316;
    flex-shrink: 0;
  }

  .fresh-start-item-text {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .fresh-start-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: clamp(6px, 1.5vw, 10px);
    margin-bottom: clamp(8px, 2vw, 12px);
  }

  .fresh-start-btn {
    padding: clamp(10px, 2.5vw, 14px) clamp(6px, 1.5vw, 10px);
    border: none;
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(12px, 3.2vw, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    text-align: center;
  }

  .fresh-start-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .fresh-start-btn.primary {
    background: #f97316;
    color: white;
    box-shadow: 0 2px 8px rgba(249, 115, 22, 0.25);
  }

  .fresh-start-btn.primary:hover:not(:disabled) {
    background: #ea580c;
    transform: translateY(-1px);
  }

  .fresh-start-btn.remind {
    background: rgba(245, 158, 11, 0.08);
    color: #d97706;
  }

  .fresh-start-btn.remind:hover:not(:disabled) {
    background: rgba(245, 158, 11, 0.15);
  }

  .fresh-start-btn.secondary {
    background: rgba(29, 155, 240, 0.08);
    color: var(--primary);
  }

  .fresh-start-btn.secondary:hover:not(:disabled) {
    background: rgba(29, 155, 240, 0.15);
  }

  .fresh-start-btn.danger {
    background: rgba(244, 33, 46, 0.08);
    color: var(--danger);
  }

  .fresh-start-btn.danger:hover:not(:disabled) {
    background: rgba(244, 33, 46, 0.15);
  }

  .fresh-start-dismiss {
    display: block;
    width: 100%;
    background: none;
    border: none;
    color: var(--light-gray);
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 500;
    cursor: pointer;
    padding: clamp(6px, 1.5vw, 8px);
    transition: color 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    text-align: center;
  }

  .fresh-start-dismiss:hover {
    color: var(--dark-gray);
  }

  /* ===== PHASE 3: PINNED CONTEXT CARDS ===== */
  .pinned-card {
    position: relative;
    padding: clamp(20px, 5.5vw, 32px);
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    margin-bottom: clamp(20px, 5vw, 32px);
    border: 1px solid;
  }

  .pinned-card.recovery {
    background: rgba(244, 33, 46, 0.04);
    border-color: rgba(244, 33, 46, 0.15);
  }

  .pinned-card.growth {
    background: rgba(0, 186, 124, 0.04);
    border-color: rgba(0, 186, 124, 0.15);
  }

  .pinned-header {
    display: flex;
    align-items: flex-start;
    gap: clamp(12px, 3.5vw, 18px);
    margin-bottom: clamp(14px, 4vw, 20px);
  }

  .pinned-icon {
    font-size: clamp(32px, 9vw, 44px);
    flex-shrink: 0;
  }

  .pinned-titles {
    flex: 1;
  }

  .pinned-title {
    font-size: clamp(18px, 5vw, 24px);
    font-weight: 700;
    color: var(--text-dark, #0f1419);
    margin: 0 0 clamp(2px, 0.8vw, 4px) 0;
  }

  .pinned-card.recovery .pinned-title {
    color: #dc2626;
  }

  .pinned-card.growth .pinned-title {
    color: #059669;
  }

  .pinned-subtitle {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    margin: 0;
  }

  .pinned-message {
    font-size: clamp(14px, 3.8vw, 16px);
    color: var(--dark-gray);
    line-height: 1.6;
    margin: 0 0 clamp(18px, 5vw, 26px) 0;
  }

  .pinned-insights {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 1.5vw, 10px);
    margin-bottom: clamp(18px, 5vw, 26px);
    padding: clamp(10px, 3vw, 14px);
    background: rgba(0, 0, 0, 0.03);
    border-radius: clamp(10px, 2.5vw, 14px);
  }

  .pinned-insight-item {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    line-height: 1.5;
    margin: 0;
  }

  .btn-action {
    width: 100%;
    padding: clamp(14px, 4vw, 18px);
    border: none;
    border-radius: clamp(12px, 3vw, 16px);
    font-size: clamp(15px, 4.2vw, 18px);
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(8px, 2vw, 12px);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .btn-action:hover {
    transform: translateY(-1px);
  }

  .btn-action.recovery {
    background: linear-gradient(135deg, #f4212e 0%, #dc2626 100%);
    color: white;
    box-shadow: 0 4px 14px rgba(244, 33, 46, 0.3);
  }

  .btn-action.growth {
    background: linear-gradient(135deg, #00ba7c 0%, #059669 100%);
    color: white;
    box-shadow: 0 4px 14px rgba(0, 186, 124, 0.3);
  }

  /* ===== GREETING ===== */
  .greeting {
    margin-bottom: clamp(16px, 4vw, 24px);
  }

  .greeting h1 {
    font-size: clamp(20px, 5.5vw, 28px);
    font-weight: 700;
    margin: 0 0 clamp(2px, 1vw, 6px) 0;
  }

  .context-msg {
    color: var(--dark-gray);
    font-size: clamp(13px, 3.5vw, 16px);
    margin: 0;
  }

  .btn-secondary {
    width: 100%;
    margin-top: clamp(12px, 3vw, 18px);
    padding: clamp(10px, 3vw, 14px);
    background: var(--bg-gray);
    border: none;
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    cursor: pointer;
  }

  /* ===== "JUST 1 THING" CTA ===== */
  .just1-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    padding: clamp(22px, 6vw, 32px) clamp(16px, 4.5vw, 24px);
    background: linear-gradient(135deg, #1D9BF0 0%, #1a8cd8 100%);
    color: white;
    border: none;
    border-radius: clamp(14px, 4vw, 22px);
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin-bottom: clamp(14px, 4vw, 20px);
    box-shadow: 0 4px 20px rgba(29, 155, 240, 0.35);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    text-align: center;
  }

  .just1-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(29, 155, 240, 0.45);
  }

  .just1-btn:active {
    transform: translateY(0);
  }

  .just1-label {
    font-size: clamp(11px, 3vw, 13px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    opacity: 0.85;
    margin-bottom: clamp(4px, 1vw, 6px);
  }

  .just1-task {
    font-size: clamp(17px, 4.8vw, 21px);
    font-weight: 700;
    line-height: 1.3;
    margin-bottom: clamp(4px, 1vw, 8px);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .just1-hint {
    font-size: clamp(12px, 3.2vw, 14px);
    font-weight: 500;
    opacity: 0.75;
  }

  /* ===== ATOMIC DASHBOARD: HERO CARD ===== */
  .atomic-hero {
    position: relative;
  }

  .atomic-greeting h1 {
    font-size: clamp(22px, 6vw, 28px);
    font-weight: 700;
    color: #0f1419;
    margin: 0 0 clamp(6px, 1.5vw, 10px) 0;
  }

  .atomic-rec-btn {
    display: flex;
    align-items: center;
    gap: clamp(12px, 3vw, 16px);
    width: 100%;
    padding: clamp(14px, 4vw, 20px);
    margin-top: clamp(16px, 4vw, 22px);
    background: linear-gradient(135deg, #1D9BF0 0%, #1a8cd8 100%);
    color: white;
    border: none;
    border-radius: clamp(12px, 3vw, 16px);
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 4px 16px rgba(29, 155, 240, 0.3);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    text-align: left;
  }

  .atomic-rec-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(29, 155, 240, 0.4);
  }

  .atomic-rec-icon {
    font-size: clamp(24px, 6vw, 32px);
    flex-shrink: 0;
  }

  .atomic-rec-content {
    flex: 1;
    min-width: 0;
  }

  .atomic-rec-title {
    display: block;
    font-size: clamp(11px, 3vw, 13px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.85;
    margin-bottom: clamp(2px, 0.5vw, 4px);
  }

  .atomic-rec-suggestion {
    display: block;
    font-size: clamp(15px, 4.2vw, 18px);
    font-weight: 600;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .atomic-rec-arrow {
    font-size: clamp(18px, 5vw, 24px);
    font-weight: 700;
    opacity: 0.7;
    flex-shrink: 0;
  }

  .atomic-just1 {
    display: flex;
    align-items: center;
    gap: clamp(12px, 3vw, 16px);
    width: 100%;
    padding: clamp(14px, 4vw, 20px);
    margin-top: clamp(16px, 4vw, 22px);
    background: linear-gradient(135deg, #1D9BF0 0%, #1a8cd8 100%);
    color: white;
    border: none;
    border-radius: clamp(12px, 3vw, 16px);
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 4px 16px rgba(29, 155, 240, 0.3);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    text-align: left;
  }

  .atomic-just1:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(29, 155, 240, 0.4);
  }

  .atomic-just1-label {
    font-size: clamp(11px, 3vw, 13px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    opacity: 0.85;
    flex-shrink: 0;
  }

  .atomic-just1-task {
    flex: 1;
    font-size: clamp(15px, 4.2vw, 18px);
    font-weight: 600;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .atomic-just1-hint {
    font-size: clamp(18px, 5vw, 24px);
    font-weight: 700;
    opacity: 0.7;
    flex-shrink: 0;
  }

  /* ===== RECOVERY MODE: SIMPLIFIED ===== */
  .recovery-secondary {
    width: 100%;
    margin-top: clamp(10px, 2.5vw, 14px);
    padding: clamp(12px, 3.5vw, 16px);
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 600;
    color: var(--dark-gray);
    cursor: pointer;
    transition: background 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .recovery-secondary:hover {
    background: #f7f9fa;
  }

  /* ===== PULSE INNER (inside ProgressiveCard) ===== */
  .pulse-inner {
    padding-top: clamp(4px, 1vw, 8px);
  }

  /* ===== COLLAPSIBLE TOOLBOX ===== */
  .toolbox-section {
    margin-top: clamp(8px, 2vw, 12px);
  }

  .toolbox-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(6px, 1.5vw, 8px);
    width: 100%;
    padding: clamp(12px, 3.5vw, 16px);
    background: white;
    border: 1px dashed #d1d5db;
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 500;
    color: var(--dark-gray);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .toolbox-toggle:hover {
    background: #f7f9fa;
    border-color: var(--primary);
  }

  .toolbox-toggle-icon {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(29, 155, 240, 0.1);
    color: var(--primary);
    font-size: 14px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toolbox-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: clamp(8px, 2vw, 12px);
    margin-top: clamp(10px, 2.5vw, 14px);
  }

  .toolbox-btn {
    padding: clamp(14px, 4vw, 18px) clamp(10px, 2.5vw, 14px);
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 600;
    color: var(--dark-gray);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    text-align: center;
  }

  .toolbox-btn:hover {
    background: #f7f9fa;
    border-color: var(--primary);
  }

  .toolbox-btn:active {
    transform: scale(0.98);
  }

  /* Fresh Start: +N more indicator */
  .fresh-start-more {
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--light-gray);
    margin: clamp(4px, 1vw, 6px) 0 0 clamp(14px, 3.5vw, 18px);
    font-style: italic;
  }

  /* ===== RECOVERY MODE: 2-COLUMN ACTION GRID ===== */
  .recovery-actions-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: clamp(10px, 3vw, 16px);
    margin-bottom: clamp(20px, 5vw, 32px);
  }

  .recovery-action-btn {
    padding: clamp(20px, 5.5vw, 28px) clamp(12px, 3vw, 16px);
    font-size: clamp(15px, 4.2vw, 18px);
    font-weight: 700;
    text-align: center;
    margin-top: 0;
    border-radius: clamp(14px, 4vw, 22px);
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  }

  /* ===== MAINTENANCE MODE: GOAL-AWARE ACTIONS ===== */
  .maintenance-primary-cta {
    width: 100%;
    padding: clamp(16px, 4.5vw, 22px);
    margin-bottom: clamp(10px, 3vw, 14px);
    background: linear-gradient(135deg, #00ba7c 0%, #059669 100%);
    color: white;
    border: none;
    border-radius: clamp(14px, 4vw, 22px);
    font-size: clamp(15px, 4.2vw, 18px);
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0, 186, 124, 0.25);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }

  .maintenance-primary-cta:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(0, 186, 124, 0.3);
  }

  .maintenance-primary-cta:active {
    transform: translateY(0);
  }

  .maintenance-tools-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: clamp(10px, 3vw, 16px);
    margin-bottom: clamp(20px, 5vw, 32px);
  }

  .maintenance-actions-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: clamp(10px, 3vw, 16px);
    margin-bottom: clamp(20px, 5vw, 32px);
  }

  .maintenance-action-btn.full-width {
    grid-column: 1 / -1;
  }

  .maintenance-action-btn {
    padding: clamp(18px, 5vw, 24px) clamp(12px, 3vw, 16px);
    font-size: clamp(15px, 4.2vw, 18px);
    font-weight: 700;
    text-align: center;
    border: none;
    border-radius: clamp(14px, 4vw, 22px);
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: transform 0.1s ease, box-shadow 0.15s ease;
  }

  .maintenance-action-btn:hover {
    transform: scale(1.02);
  }

  .maintenance-action-btn:active {
    transform: scale(0.98);
  }

  .maintenance-action-btn.primary {
    background: #1D9BF0;
    color: white;
    box-shadow: 0 4px 14px rgba(29, 155, 240, 0.25);
  }

  .maintenance-action-btn.primary:hover {
    background: #1a8cd8;
  }

  .maintenance-action-btn.secondary {
    background: white;
    color: #536471;
    border: 2px solid #e5e7eb;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  }

  .maintenance-action-btn.secondary:hover {
    background: #f7f9fa;
    border-color: #d1d5db;
  }

  .maintenance-badge {
    display: block;
    font-size: clamp(10px, 2.5vw, 11px);
    font-weight: 600;
    color: #00ba7c;
    margin-top: 4px;
  }

  /* ===== GROWTH MODE: CTA WRAPPER ===== */
  .growth-cta {
    margin-bottom: clamp(20px, 5vw, 32px);
  }

  /* ===== MINI GARDEN (Dopamine Garden Widget) ===== */
  .mini-garden {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(6px, 1.5vw, 10px);
    width: 100%;
    padding: clamp(16px, 4.5vw, 22px) clamp(12px, 3vw, 16px);
    margin-top: clamp(14px, 4vw, 18px);
    background: linear-gradient(180deg, rgba(0, 186, 124, 0.06) 0%, rgba(0, 186, 124, 0.02) 100%);
    border: 1.5px solid rgba(0, 186, 124, 0.18);
    border-radius: clamp(14px, 4vw, 20px);
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  }

  .mini-garden:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 186, 124, 0.15);
    background: linear-gradient(180deg, rgba(0, 186, 124, 0.1) 0%, rgba(0, 186, 124, 0.04) 100%);
  }

  .mini-garden:active {
    transform: translateY(0);
  }

  .mini-garden.growth-garden {
    margin-top: 0;
    margin-bottom: clamp(12px, 3vw, 16px);
    background: linear-gradient(180deg, rgba(0, 186, 124, 0.08) 0%, rgba(0, 186, 124, 0.02) 100%);
    border-color: rgba(0, 186, 124, 0.25);
  }

  .mini-garden-plant {
    line-height: 1;
    transition: font-size 0.3s ease;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
  }

  .mini-garden-bar {
    width: 80%;
    max-width: 180px;
    height: 6px;
    background: rgba(0, 186, 124, 0.12);
    border-radius: 100px;
    overflow: hidden;
  }

  .mini-garden-fill {
    height: 100%;
    background: linear-gradient(90deg, #00ba7c 0%, #059669 100%);
    border-radius: 100px;
    transition: width 0.4s ease;
  }

  .mini-garden-bar.growth-bar {
    background: rgba(0, 186, 124, 0.18);
  }

  .mini-garden-fill.growth-fill {
    background: linear-gradient(90deg, #059669 0%, #00ba7c 100%);
  }

  .mini-garden-title {
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 600;
    color: var(--dark-gray);
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .mini-garden-label {
    font-size: clamp(11px, 3vw, 13px);
    font-weight: 600;
    color: var(--success);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  /* ===== DAILY PULSE CARD ===== */
  .pulse-card {
    padding: clamp(16px, 4.5vw, 24px);
    margin-bottom: clamp(20px, 5vw, 32px);
  }

  .pulse-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: clamp(12px, 3vw, 16px);
  }

  .pulse-label {
    font-size: clamp(14px, 3.8vw, 17px);
    font-weight: 600;
    color: var(--dark-gray);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .pulse-mood-label {
    font-size: clamp(12px, 3.2vw, 14px);
    font-weight: 600;
    color: #1D9BF0;
    background: rgba(29, 155, 240, 0.08);
    padding: 3px clamp(8px, 2vw, 12px);
    border-radius: 100px;
    white-space: nowrap;
  }

  .pulse-emoji {
    font-size: clamp(20px, 5.5vw, 26px);
  }

  .pulse-saving-toast {
    width: 100%;
    padding: clamp(10px, 2.5vw, 14px);
    text-align: center;
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 600;
    color: var(--light-gray);
    background: rgba(0, 0, 0, 0.03);
    border-radius: clamp(10px, 2.5vw, 14px);
    animation: fadeIn 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(6px, 1.5vw, 8px);
  }

  .pulse-saving-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--light-gray);
    animation: savingPulse 1.2s ease-in-out infinite;
  }

  @keyframes savingPulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }

  .pulse-saved-toast {
    width: 100%;
    padding: clamp(10px, 2.5vw, 14px);
    text-align: center;
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 600;
    color: #00ba7c;
    background: rgba(0, 186, 124, 0.08);
    border-radius: clamp(10px, 2.5vw, 14px);
    animation: fadeIn 0.3s ease;
  }

  /* ===== "DO THIS NEXT" RECOMMENDATION CARD ===== */
  .rec-card {
    display: block;
    width: 100%;
    padding: clamp(16px, 4.5vw, 22px);
    margin-bottom: clamp(20px, 5vw, 32px);
    border: 1.5px solid rgba(255, 173, 31, 0.3);
    background: linear-gradient(135deg, white 0%, rgba(255, 215, 0, 0.04) 100%);
    cursor: pointer;
    text-align: left;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .rec-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(255, 173, 31, 0.15);
  }

  .rec-header {
    display: flex;
    align-items: center;
    gap: clamp(6px, 1.5vw, 10px);
    margin-bottom: clamp(8px, 2vw, 12px);
  }

  .rec-icon {
    font-size: clamp(18px, 5vw, 24px);
  }

  .rec-title {
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 700;
    color: #b8860b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .rec-suggestion {
    font-size: clamp(15px, 4.2vw, 18px);
    font-weight: 600;
    color: #0f1419;
    margin: 0 0 clamp(4px, 1vw, 6px) 0;
    line-height: 1.4;
  }

  .rec-reason {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    margin: 0;
    line-height: 1.4;
  }

  /* ===== SHARED SLIDER STYLES (DailyPulse) ===== */
  .slider-container {
    margin-bottom: clamp(20px, 5vw, 28px);
  }

  .intercept-slider {
    width: 100%;
    height: 6px;
    -webkit-appearance: none;
    appearance: none;
    background: linear-gradient(to right, #f4212e, #ffad1f, #00ba7c);
    border-radius: 100px;
    outline: none;
    margin-bottom: clamp(10px, 2.5vw, 14px);
  }

  .intercept-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: clamp(24px, 6.5vw, 32px);
    height: clamp(24px, 6.5vw, 32px);
    border-radius: 50%;
    background: white;
    border: 3px solid var(--primary);
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }

  .intercept-slider::-moz-range-thumb {
    width: clamp(24px, 6.5vw, 32px);
    height: clamp(24px, 6.5vw, 32px);
    border-radius: 50%;
    background: white;
    border: 3px solid var(--primary);
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }

  .slider-labels {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--light-gray);
  }

  .slider-value {
    font-size: clamp(18px, 5vw, 24px);
    font-weight: 700;
    color: var(--primary);
  }

  /* ===== TODAY'S WINS (inside ProgressiveCard) ===== */

  .wins-list {
    padding: 0 clamp(16px, 4.5vw, 22px) clamp(14px, 4vw, 18px);
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 2vw, 12px);
  }

  .win-item {
    display: flex;
    align-items: center;
    gap: clamp(8px, 2vw, 12px);
    padding: clamp(8px, 2vw, 10px) 0;
    border-top: 1px solid #eff3f4;
  }

  .win-icon {
    font-size: clamp(16px, 4.5vw, 20px);
    flex-shrink: 0;
  }

  .win-text {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    line-height: 1.3;
  }

  /* ===== MODE OVERRIDE TOAST ===== */
  .override-toast {
    position: fixed;
    bottom: clamp(16px, 4vw, 24px);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: clamp(6px, 1.5vw, 10px);
    background: linear-gradient(135deg, #059669 0%, #00ba7c 100%);
    color: white;
    padding: clamp(10px, 2.5vw, 14px) clamp(16px, 4vw, 22px);
    border-radius: 100px;
    box-shadow: 0 4px 16px rgba(0, 186, 124, 0.35);
    z-index: 950;
    animation: toastSlideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    white-space: nowrap;
  }

  .override-toast-icon {
    font-size: clamp(16px, 4.5vw, 20px);
  }

  .override-toast-text {
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 600;
  }

  @keyframes toastSlideUp {
    from { opacity: 0; transform: translateX(-50%) translateY(20px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  /* ===== "ONE THING" HERO CARDS ===== */
  .hero-card {
    padding: clamp(24px, 6vw, 36px);
    text-align: center;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  }

  .hero-icon {
    font-size: clamp(48px, 12vw, 64px);
    margin-bottom: clamp(12px, 3vw, 18px);
    line-height: 1;
  }

  .hero-title {
    font-size: clamp(22px, 6vw, 28px);
    font-weight: 700;
    color: #0f1419;
    margin: 0 0 clamp(6px, 1.5vw, 10px) 0;
  }

  .hero-subtitle {
    font-size: clamp(14px, 3.8vw, 16px);
    color: var(--dark-gray);
    margin: 0 0 clamp(20px, 5vw, 28px) 0;
    line-height: 1.5;
  }

  .recovery-hero .hero-title {
    color: #7c3aed;
  }

  /* Warming Up hero - transitional state */
  .warming-up-hero {
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.06) 0%, rgba(245, 158, 11, 0.04) 100%);
    border: 1.5px solid rgba(251, 191, 36, 0.2);
  }

  .warming-up-hero .hero-title {
    color: #d97706;
  }

  .warming-up-options {
    display: flex;
    flex-direction: column;
    gap: clamp(10px, 2.5vw, 14px);
  }

  .hero-btn.warming-primary {
    background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
    color: #78350f;
    box-shadow: 0 4px 16px rgba(251, 191, 36, 0.3);
  }

  .hero-btn.warming-secondary {
    background: rgba(139, 92, 246, 0.1);
    color: #7c3aed;
    border: 1.5px solid rgba(139, 92, 246, 0.2);
  }

  .hero-btn.warming-secondary:hover {
    background: rgba(139, 92, 246, 0.15);
  }

  .fresh-start-hero {
    background: linear-gradient(135deg, rgba(249, 115, 22, 0.04) 0%, white 100%);
    border: 1.5px solid rgba(249, 115, 22, 0.2);
  }

  .fresh-start-hero .hero-title {
    color: #ea580c;
  }

  .fresh-start-actions-simple {
    display: flex;
    gap: clamp(10px, 2.5vw, 14px);
    margin-bottom: clamp(12px, 3vw, 16px);
  }

  .fresh-start-actions-simple .hero-btn {
    flex: 1;
  }

  .hero-btn {
    padding: clamp(14px, 4vw, 18px) clamp(20px, 5vw, 28px);
    border: none;
    border-radius: clamp(12px, 3vw, 16px);
    font-size: clamp(15px, 4.2vw, 18px);
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    width: 100%;
  }

  .hero-btn:hover {
    transform: translateY(-2px);
  }

  .hero-btn:active {
    transform: translateY(0);
  }

  .hero-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .hero-btn.recovery {
    background: linear-gradient(135deg, #f4212e 0%, #dc2626 100%);
    color: white;
    box-shadow: 0 4px 16px rgba(244, 33, 46, 0.3);
  }

  .hero-btn.primary {
    background: linear-gradient(135deg, #1D9BF0 0%, #1a8cd8 100%);
    color: white;
    box-shadow: 0 4px 16px rgba(29, 155, 240, 0.3);
  }

  .hero-btn.secondary {
    background: white;
    color: var(--dark-gray);
    border: 2px solid #e5e7eb;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  .hero-btn.secondary:hover {
    border-color: var(--primary);
    color: var(--primary);
  }

  .hero-btn.large {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(4px, 1vw, 8px);
    padding: clamp(20px, 5.5vw, 28px);
  }

  .hero-btn-label {
    font-size: clamp(11px, 3vw, 13px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    opacity: 0.85;
  }

  .hero-btn-task {
    font-size: clamp(17px, 4.8vw, 21px);
    font-weight: 700;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .hero-btn-arrow {
    font-size: clamp(16px, 4vw, 20px);
    opacity: 0.7;
  }

  .hero-dismiss {
    background: none;
    border: none;
    color: var(--light-gray);
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 500;
    cursor: pointer;
    padding: clamp(8px, 2vw, 12px);
    transition: color 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .hero-dismiss:hover {
    color: var(--dark-gray);
  }

  .hero-greeting h1 {
    font-size: clamp(24px, 6.5vw, 32px);
    font-weight: 700;
    color: #0f1419;
    margin: 0 0 clamp(6px, 1.5vw, 10px) 0;
  }

  .hero-context {
    font-size: clamp(14px, 3.8vw, 16px);
    color: var(--dark-gray);
    margin: 0 0 clamp(20px, 5vw, 28px) 0;
    line-height: 1.5;
  }

  .just1-hero {
    text-align: center;
  }

  /* ===== GENTLE CHECK-IN OVERLAY ===== */
  .gentle-checkin-overlay {
    position: fixed;
    bottom: clamp(80px, 20vw, 100px);
    left: 50%;
    transform: translateX(-50%);
    width: calc(100% - 32px);
    max-width: 400px;
    z-index: 100;
    animation: slideUpFade 0.4s ease-out;
  }

  @keyframes slideUpFade {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  /* ===== PULSE CONFIRMATION OVERLAY ===== */
  .pulse-confirmation-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 24px;
    animation: fadeIn 0.2s ease-out;
  }

  .pulse-confirmation-card {
    background: white;
    border-radius: clamp(16px, 4vw, 24px);
    padding: clamp(24px, 6vw, 36px);
    max-width: 360px;
    width: 100%;
    text-align: center;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
    animation: scaleIn 0.3s ease-out;
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .pulse-confirmation-icon {
    font-size: clamp(48px, 12vw, 64px);
    margin-bottom: clamp(12px, 3vw, 18px);
    line-height: 1;
  }

  .pulse-confirmation-title {
    font-size: clamp(20px, 5vw, 24px);
    font-weight: 700;
    color: #7c3aed;
    margin: 0 0 clamp(8px, 2vw, 12px) 0;
  }

  .pulse-confirmation-subtitle {
    font-size: clamp(14px, 3.5vw, 16px);
    color: #6b7280;
    margin: 0 0 clamp(20px, 5vw, 28px) 0;
    line-height: 1.5;
  }

  .pulse-confirmation-actions {
    display: flex;
    flex-direction: column;
    gap: clamp(10px, 2.5vw, 14px);
  }

  .pulse-confirm-btn {
    padding: clamp(14px, 3.5vw, 18px);
    border: none;
    border-radius: 100px;
    font-size: clamp(15px, 4vw, 17px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .pulse-confirm-btn.yes {
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    color: white;
    box-shadow: 0 4px 16px rgba(139, 92, 246, 0.3);
  }

  .pulse-confirm-btn.yes:hover {
    box-shadow: 0 6px 20px rgba(139, 92, 246, 0.4);
    transform: translateY(-1px);
  }

  .pulse-confirm-btn.no {
    background: #f3f4f6;
    color: #6b7280;
  }

  .pulse-confirm-btn.no:hover {
    background: #e5e7eb;
  }

  /* ===== MODE OVERRIDE SELECTOR ===== */
  .mode-override-section {
    margin-top: clamp(16px, 4vw, 24px);
    position: relative;
  }

  .mode-override-trigger {
    display: flex;
    align-items: center;
    gap: clamp(8px, 2vw, 12px);
    width: 100%;
    padding: clamp(12px, 3vw, 16px);
    background: white;
    border: 1px solid var(--extra-light-gray);
    border-radius: clamp(12px, 3vw, 16px);
    cursor: pointer;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .mode-override-trigger:hover {
    border-color: var(--primary);
    box-shadow: 0 2px 8px rgba(29, 155, 240, 0.1);
  }

  .mode-icon {
    font-size: clamp(20px, 5vw, 24px);
  }

  .mode-label {
    flex: 1;
    text-align: left;
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 600;
    color: #0f1419;
  }

  .mode-manual-badge {
    font-size: clamp(10px, 2.8vw, 12px);
    font-weight: 600;
    color: #f97316;
    background: rgba(249, 115, 22, 0.1);
    padding: 2px 8px;
    border-radius: 100px;
  }

  .mode-chevron {
    font-size: clamp(10px, 2.8vw, 12px);
    color: var(--dark-gray);
  }

  .mode-selector-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    background: white;
    border: 1px solid var(--extra-light-gray);
    border-radius: clamp(12px, 3vw, 16px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
    z-index: 50;
    overflow: hidden;
    animation: dropdownSlide 0.15s ease;
  }

  @keyframes dropdownSlide {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .mode-option {
    display: flex;
    align-items: center;
    gap: clamp(10px, 2.5vw, 14px);
    width: 100%;
    padding: clamp(14px, 3.5vw, 18px);
    background: white;
    border: none;
    border-bottom: 1px solid var(--extra-light-gray);
    cursor: pointer;
    transition: background 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    text-align: left;
  }

  .mode-option:last-of-type {
    border-bottom: none;
  }

  .mode-option:hover {
    background: var(--bg-gray);
  }

  .mode-option.active {
    background: rgba(29, 155, 240, 0.08);
  }

  .mode-option-icon {
    font-size: clamp(22px, 5.5vw, 26px);
  }

  .mode-option-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .mode-option-label {
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 600;
    color: #0f1419;
  }

  .mode-option-desc {
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--dark-gray);
  }

  .mode-reset-btn {
    width: 100%;
    padding: clamp(12px, 3vw, 16px);
    background: var(--bg-gray);
    border: none;
    border-top: 1px solid var(--extra-light-gray);
    color: var(--primary);
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .mode-reset-btn:hover {
    background: #e5e7eb;
  }

  /* ===== FLOATING ACTION BUTTON (FAB) ===== */
  .toolbox-fab {
    position: fixed;
    bottom: clamp(20px, 5vw, 28px);
    right: clamp(20px, 5vw, 28px);
    width: clamp(56px, 14vw, 64px);
    height: clamp(56px, 14vw, 64px);
    border-radius: 50%;
    background: linear-gradient(135deg, #1D9BF0 0%, #1a8cd8 100%);
    border: none;
    cursor: pointer;
    font-size: clamp(24px, 6vw, 28px);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 20px rgba(29, 155, 240, 0.4);
    z-index: 900;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .toolbox-fab:hover {
    transform: scale(1.08);
    box-shadow: 0 6px 28px rgba(29, 155, 240, 0.5);
  }

  .toolbox-fab:active {
    transform: scale(0.95);
  }

  .fab-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 910;
    animation: fadeIn 0.2s ease;
  }

  .fab-modal {
    position: fixed;
    bottom: clamp(90px, 20vw, 110px);
    right: clamp(20px, 5vw, 28px);
    background: white;
    border-radius: clamp(16px, 4vw, 22px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    z-index: 920;
    width: clamp(260px, 70vw, 320px);
    animation: fabModalSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes fabModalSlideUp {
    from { opacity: 0; transform: translateY(20px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .fab-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: clamp(14px, 3.5vw, 18px) clamp(16px, 4vw, 20px);
    border-bottom: 1px solid #eff3f4;
  }

  .fab-modal-title {
    font-size: clamp(15px, 4vw, 17px);
    font-weight: 700;
    color: #0f1419;
  }

  .fab-modal-close {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: #eff3f4;
    color: var(--dark-gray);
    font-size: 18px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease;
  }

  .fab-modal-close:hover {
    background: #e5e7eb;
  }

  .fab-modal-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: clamp(8px, 2vw, 12px);
    padding: clamp(14px, 3.5vw, 18px);
  }

  .fab-tool-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(6px, 1.5vw, 8px);
    padding: clamp(14px, 3.5vw, 18px) clamp(8px, 2vw, 12px);
    background: #f7f9fa;
    border: 1px solid #eff3f4;
    border-radius: clamp(12px, 3vw, 16px);
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .fab-tool-btn:hover {
    background: white;
    border-color: var(--primary);
  }

  .fab-tool-btn:active {
    transform: scale(0.95);
  }

  .fab-tool-icon {
    font-size: clamp(22px, 5.5vw, 26px);
    line-height: 1;
  }

  .fab-tool-label {
    font-size: clamp(11px, 2.8vw, 13px);
    font-weight: 600;
    color: var(--dark-gray);
  }

  /* ===== SETTINGS MODAL ===== */
  .settings-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
    animation: fade-in 0.15s ease;
  }

  .settings-modal {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: white;
    border-radius: clamp(16px, 4vw, 24px) clamp(16px, 4vw, 24px) 0 0;
    z-index: 1000;
    animation: slide-up 0.2s ease;
    max-height: 85vh;
    overflow-y: auto;
  }

  .settings-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: clamp(14px, 3.5vw, 18px);
    border-bottom: 1px solid #eff3f4;
    position: sticky;
    top: 0;
    background: white;
    z-index: 1;
  }

  .settings-modal-title {
    font-size: clamp(16px, 4.5vw, 18px);
    font-weight: 700;
    color: #0f1419;
  }

  .settings-modal-close {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: #eff3f4;
    color: var(--dark-gray);
    font-size: 18px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease;
  }

  .settings-modal-close:hover {
    background: #e5e7eb;
  }

  .settings-modal-content {
    padding: clamp(18px, 4.5vw, 24px);
    padding-bottom: calc(clamp(18px, 4.5vw, 24px) + var(--safe-area-bottom));
  }

  @keyframes slide-up {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  /* ===== TABLET/DESKTOP ADJUSTMENTS ===== */
  @media (min-width: 768px) {
    .main { padding: 24px; padding-bottom: 24px; }
    .fab-modal { width: 340px; }
    .settings-modal { max-width: 480px; left: 50%; transform: translateX(-50%); border-radius: clamp(16px, 4vw, 24px); bottom: 50%; transform: translate(-50%, 50%); }
  }

  @media (min-width: 1024px) {
    .main { max-width: 680px; }
  }
`
