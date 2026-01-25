'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface UserInsights {
  totalCheckIns: number
  averageMood: number
  currentStreak: {
    type: 'checking_in' | 'low_mood' | 'high_mood' | 'improving'
    days: number
  } | null
  recentAverageMood: number
  comparedToBaseline: 'better' | 'worse' | 'same'
  daysSinceLastCheckIn: number
}

export function UserInsightsCard() {
  const [insights, setInsights] = useState<UserInsights | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchInsights() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Fetch recent mood entries
        const { data: entries } = await supabase
          .from('mood_entries')
          .select('mood_score, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(30)

        if (!entries || entries.length === 0) {
          setLoading(false)
          return
        }

        // Calculate insights
        const allScores = entries.map(e => e.mood_score)
        const recentScores = entries.slice(0, 7).map(e => e.mood_score)
        const averageMood = allScores.reduce((a, b) => a + b, 0) / allScores.length
        const recentAverageMood = recentScores.reduce((a, b) => a + b, 0) / recentScores.length

        // Calculate check-in streak
        let checkInStreak = 1
        for (let i = 1; i < entries.length; i++) {
          const current = new Date(entries[i - 1].created_at)
          const previous = new Date(entries[i].created_at)
          const daysDiff = Math.floor((current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24))
          if (daysDiff <= 1) checkInStreak++
          else break
        }

        // Calculate low/high mood streaks
        let lowMoodStreak = 0
        let highMoodStreak = 0
        for (const score of recentScores) {
          if (score <= 4) lowMoodStreak++
          else break
        }
        for (const score of recentScores) {
          if (score >= 7) highMoodStreak++
          else break
        }

        // Determine streak type
        let currentStreak: UserInsights['currentStreak'] = null
        if (lowMoodStreak >= 3) {
          currentStreak = { type: 'low_mood', days: lowMoodStreak }
        } else if (highMoodStreak >= 3) {
          currentStreak = { type: 'high_mood', days: highMoodStreak }
        } else if (checkInStreak >= 3) {
          currentStreak = { type: 'checking_in', days: checkInStreak }
        }

        // Compare to baseline
        const baselineDiff = recentAverageMood - averageMood
        const comparedToBaseline: UserInsights['comparedToBaseline'] = 
          baselineDiff > 0.5 ? 'better' : baselineDiff < -0.5 ? 'worse' : 'same'

        // Days since last check-in
        const lastCheckIn = new Date(entries[0].created_at)
        const daysSinceLastCheckIn = Math.floor(
          (Date.now() - lastCheckIn.getTime()) / (1000 * 60 * 60 * 24)
        )

        setInsights({
          totalCheckIns: entries.length,
          averageMood: Math.round(averageMood * 10) / 10,
          currentStreak,
          recentAverageMood: Math.round(recentAverageMood * 10) / 10,
          comparedToBaseline,
          daysSinceLastCheckIn
        })
      } catch (error) {
        console.error('Error fetching insights:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchInsights()
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
      </div>
    )
  }

  if (!insights || insights.totalCheckIns === 0) {
    return null // Don't show card for new users
  }

  const getStreakEmoji = () => {
    if (!insights.currentStreak) return '📊'
    switch (insights.currentStreak.type) {
      case 'checking_in': return '🔥'
      case 'high_mood': return '✨'
      case 'low_mood': return '💙'
      case 'improving': return '📈'
      default: return '📊'
    }
  }

  const getStreakMessage = () => {
    if (!insights.currentStreak) return null
    const { type, days } = insights.currentStreak
    switch (type) {
      case 'checking_in':
        return `${days}-day check-in streak!`
      case 'high_mood':
        return `${days} great days in a row!`
      case 'low_mood':
        return `${days} tough days—I'm here for you`
      case 'improving':
        return `${days} days of improvement!`
    }
  }

  const getTrendMessage = () => {
    if (insights.comparedToBaseline === 'better') {
      return { text: 'Trending up lately', color: 'text-green-600' }
    }
    if (insights.comparedToBaseline === 'worse') {
      return { text: 'Feeling a bit lower lately', color: 'text-amber-600' }
    }
    return { text: 'Staying steady', color: 'text-gray-600' }
  }

  const trend = getTrendMessage()

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-500">Your Journey</h3>
        <span className="text-xs text-gray-400">{insights.totalCheckIns} check-ins</span>
      </div>

      {/* Streak Display */}
      {insights.currentStreak && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">{getStreakEmoji()}</span>
          <span className="font-medium text-gray-800">{getStreakMessage()}</span>
        </div>
      )}

      {/* Stats Row */}
      <div className="flex items-center gap-4 text-sm">
        <div>
          <span className="text-gray-500">Average: </span>
          <span className="font-medium">{insights.averageMood}/10</span>
        </div>
        <div>
          <span className="text-gray-500">This week: </span>
          <span className="font-medium">{insights.recentAverageMood}/10</span>
        </div>
      </div>

      {/* Trend indicator */}
      <div className={`mt-2 text-sm ${trend.color}`}>
        {trend.text}
      </div>

      {/* Return reminder */}
      {insights.daysSinceLastCheckIn > 2 && (
        <div className="mt-3 text-sm text-[#1D9BF0]">
          Welcome back! It&apos;s been {insights.daysSinceLastCheckIn} days.
        </div>
      )}
    </div>
  )
}
