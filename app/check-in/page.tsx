'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { calculateXP, checkAchievements, getXPForNextLevel, calculateLevel } from '@/lib/gamification'
import type { SessionData, Badge, UserStats } from '@/lib/gamification'
import { getGreeting } from '@/lib/utils/ui-helpers'
import UnifiedHeader from '@/components/UnifiedHeader'
import { trackCheckinCompleted } from '@/lib/analytics'

// Step components — "Snap Check-In" flow: vitals → coach → achievement → summary
import VitalsCheck from './components/VitalsCheck'
import CoachProcessing from './components/CoachProcessing'
import AchievementScreen from './components/AchievementScreen'
import SummaryScreen from './components/SummaryScreen'

// Simplified flow for lower barrier to entry
type Step = 'vitals' | 'coach' | 'achievement' | 'summary'
type UserMode = 'recovery' | 'maintenance' | 'growth'

interface CoachResponse {
  advice: string
}

export default function CheckInPage() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>('vitals')

  // Session data
  const [sessionData, setSessionData] = useState<SessionData>({
    startTime: Date.now(),
    breathingCompleted: false,
    energyLevel: null,
    moodScore: null,
    note: '',
    selectedEmotion: null,
    stepTimings: {}
  })

  // User context
  const [currentStreak, setCurrentStreak] = useState(0)
  const [lastMoodScore, setLastMoodScore] = useState<number | null>(null)
  const [yesterdayMood, setYesterdayMood] = useState<number | null>(null)
  const [userMode, setUserMode] = useState<UserMode>('maintenance')
  const [userStats, setUserStats] = useState<UserStats>({
    total_xp: 0,
    current_level: 1,
    achievements_unlocked: [],
    last_check_in_time: null,
    preferred_check_in_time: null
  })

  // Coach response
  const [coachAdvice, setCoachAdvice] = useState<string>('')
  const [newBadges, setNewBadges] = useState<Badge[]>([])
  const [xpEarned, setXpEarned] = useState(0)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)

      // Fetch user context
      await fetchUserContext(session.user.id)
      setLoading(false)
    }
    init()
  }, [router])

  const fetchUserContext = async (userId: string) => {
    // Fetch recent mood entries
    const { data: moodData } = await supabase
      .from('mood_entries')
      .select('mood_score, created_at, note, breathing_completed')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (moodData && moodData.length > 0) {
      // Get last mood score
      setLastMoodScore(moodData[0].mood_score)

      // Get yesterday's mood (if exists)
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStart = new Date(yesterday.setHours(0, 0, 0, 0))
      const yesterdayEnd = new Date(yesterday.setHours(23, 59, 59, 999))

      const yesterdayEntry = moodData.find(entry => {
        const entryDate = new Date(entry.created_at)
        return entryDate >= yesterdayStart && entryDate <= yesterdayEnd
      })
      if (yesterdayEntry) {
        setYesterdayMood(yesterdayEntry.mood_score)
      }

      // Calculate streak
      let streak = 1
      for (let i = 1; i < moodData.length; i++) {
        const curr = new Date(moodData[i - 1].created_at)
        const prev = new Date(moodData[i].created_at)
        const diff = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
        if (diff <= 1) streak++
        else break
      }
      setCurrentStreak(streak)

      // Determine user mode
      const lastMood = moodData[0].mood_score
      if (lastMood <= 3) {
        setUserMode('recovery')
      } else if (lastMood >= 8 && streak > 2) {
        setUserMode('growth')
      } else {
        setUserMode('maintenance')
      }
    }

    // Fetch user stats
    const { data: statsData } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (statsData) {
      setUserStats(statsData)
    }
  }

  const advanceStep = (nextStep: Step) => {
    const now = Date.now()
    setSessionData(prev => ({
      ...prev,
      stepTimings: {
        ...prev.stepTimings,
        [step]: now - (prev.stepTimings[step] || prev.startTime)
      }
    }))
    setStep(nextStep)
  }

  // "Snap Check-In" handler — combines mood, energy, and note in one step
  const handleVitalsSubmit = async (moodScore: number, energyLevel: number, note: string) => {
    setSessionData(prev => ({
      ...prev,
      moodScore,
      energyLevel,
      note,
      breathingCompleted: false, // Breathing moved to suggested next step in Summary
    }))
    advanceStep('coach')

    // Call AI coach API
    await getCoachAdvice(moodScore, note, energyLevel)
  }

  const getCoachAdvice = async (moodScore: number, note: string, energyLevel: number | null) => {
    try {
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moodScore,
          note: note || null,
          energyLevel
        })
      })

      const data: CoachResponse = await response.json()
      setCoachAdvice(data.advice)

      // Process and save check-in
      await saveCheckIn(data.advice)
    } catch (error) {
      console.error('Error getting coach advice:', error)
      setCoachAdvice('Thank you for checking in. Keep taking care of yourself.')
      await saveCheckIn('Thank you for checking in. Keep taking care of yourself.')
    }
  }

  const saveCheckIn = async (advice: string) => {
    if (!user) return

    // Calculate XP
    const xp = calculateXP(sessionData, currentStreak, userStats.last_check_in_time)
    setXpEarned(xp)

    // Fetch mood history for achievement checking
    const { data: moodHistory } = await supabase
      .from('mood_entries')
      .select('mood_score, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    const breathingCompletedCount = await supabase
      .from('mood_entries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('breathing_completed', true)

    const notesWrittenCount = await supabase
      .from('mood_entries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('note', 'is', null)

    // Check for new achievements
    const badges = await checkAchievements(
      user.id,
      sessionData,
      {
        currentStreak: currentStreak + 1, // +1 because we just completed a check-in
        totalCheckIns: (moodHistory?.length || 0) + 1,
        moodHistory: moodHistory || [],
        breathingCompletedCount: (breathingCompletedCount.count || 0) + (sessionData.breathingCompleted ? 1 : 0),
        notesWrittenCount: (notesWrittenCount.count || 0) + (sessionData.note.length > 0 ? 1 : 0)
      },
      userStats.achievements_unlocked
    )
    setNewBadges(badges)

    // Save mood entry
    await supabase.from('mood_entries').insert({
      user_id: user.id,
      mood_score: sessionData.moodScore!,
      energy_level: sessionData.energyLevel,
      note: sessionData.note || null,
      selected_emotion: sessionData.selectedEmotion || null,
      breathing_completed: sessionData.breathingCompleted,
      breathing_skipped: !sessionData.breathingCompleted,
      note_length: sessionData.note.length,
      session_duration_ms: Date.now() - sessionData.startTime,
      xp_earned: xp,
      achievements_earned: badges.map(b => b.id),
      coach_advice: advice
    })

    // Update user stats
    const newTotalXP = userStats.total_xp + xp
    const newLevel = calculateLevel(newTotalXP)
    const newAchievements = [...userStats.achievements_unlocked, ...badges.map(b => b.id)]

    await supabase.from('user_stats').upsert({
      user_id: user.id,
      total_xp: newTotalXP,
      current_level: newLevel,
      achievements_unlocked: newAchievements,
      last_check_in_time: new Date().toISOString()
    })

    // Update local state
    setUserStats({
      ...userStats,
      total_xp: newTotalXP,
      current_level: newLevel,
      achievements_unlocked: newAchievements,
      last_check_in_time: new Date().toISOString()
    })

    // Track analytics event
    trackCheckinCompleted({
      mood_score: sessionData.moodScore!,
      has_note: sessionData.note.length > 0,
      energy_level: sessionData.energyLevel ?? undefined,
    })

    // Move to achievement screen
    advanceStep('achievement')
  }

  const handleAchievementContinue = () => {
    advanceStep('summary')
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading...</p>
        <style jsx>{`
          .loading-screen {
            min-height: 100vh;
            min-height: 100dvh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #f7f9fa;
            color: #536471;
          }

          .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid #1D9BF0;
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 16px;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <>
      <UnifiedHeader subtitle="Daily check-in" />

      {/* "Snap Check-In" flow: vitals → coach → achievement → summary */}
      {step === 'vitals' && (
        <VitalsCheck
          onSubmit={handleVitalsSubmit}
          greeting={getGreeting()}
          currentStreak={currentStreak}
        />
      )}
      {step === 'coach' && (
        <CoachProcessing
          energyLevel={sessionData.energyLevel}
          moodScore={sessionData.moodScore}
        />
      )}
      {step === 'achievement' && (
        <AchievementScreen
          coachAdvice={coachAdvice}
          xpEarned={xpEarned}
          newBadges={newBadges}
          currentXP={userStats.total_xp + xpEarned}
          xpForNextLevel={getXPForNextLevel(userStats.current_level)}
          currentLevel={userStats.current_level}
          onContinue={handleAchievementContinue}
        />
      )}
      {step === 'summary' && (
        <SummaryScreen
          energyLevel={sessionData.energyLevel}
          moodScore={sessionData.moodScore}
          currentStreak={currentStreak + 1}
          userMode={userMode}
        />
      )}
    </>
  )
}
