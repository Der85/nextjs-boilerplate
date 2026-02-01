'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { getXPForNextLevel } from '@/lib/gamification'

export interface UserStats {
  total_xp: number
  current_level: number
  achievements_unlocked: string[]
  last_check_in_time: string | null
  preferred_check_in_time: string | null
}

interface UserStatsContextValue {
  userStats: UserStats | null
  loading: boolean
  refreshStats: () => Promise<void>
}

const UserStatsContext = createContext<UserStatsContextValue>({
  userStats: null,
  loading: true,
  refreshStats: async () => {},
})

export function useUserStats() {
  return useContext(UserStatsContext)
}

/**
 * Compute level-relative XP progress for display.
 * Returns { xpInLevel, xpNeeded, progress (0-100) }.
 */
export function getLevelProgress(stats: UserStats) {
  const { current_level, total_xp } = stats

  let xpAtLevelStart = 0
  if (current_level <= 5) {
    xpAtLevelStart = (current_level - 1) * 100
  } else if (current_level <= 10) {
    xpAtLevelStart = 500 + (current_level - 6) * 200
  } else if (current_level <= 20) {
    xpAtLevelStart = 1500 + (current_level - 11) * 350
  } else {
    xpAtLevelStart = 5000 + (current_level - 21) * 500
  }

  const xpForNext = getXPForNextLevel(current_level)
  const xpInLevel = total_xp - xpAtLevelStart
  const xpNeeded = xpForNext - xpAtLevelStart

  return {
    xpInLevel,
    xpNeeded,
    progress: xpNeeded > 0 ? Math.min((xpInLevel / xpNeeded) * 100, 100) : 0,
  }
}

export function UserStatsProvider({ children }: { children: ReactNode }) {
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setUserStats(null)
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('user_stats')
      .select('total_xp, current_level, achievements_unlocked, last_check_in_time, preferred_check_in_time')
      .eq('user_id', session.user.id)
      .single()

    if (data) {
      setUserStats(data as UserStats)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchStats()

    // Re-fetch when auth state changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchStats()
    })

    return () => subscription.unsubscribe()
  }, [fetchStats])

  const refreshStats = useCallback(async () => {
    await fetchStats()
  }, [fetchStats])

  return (
    <UserStatsContext.Provider value={{ userStats, loading, refreshStats }}>
      {children}
    </UserStatsContext.Provider>
  )
}
