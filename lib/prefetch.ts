import { supabase } from '@/lib/supabase'

// Types for prefetched data
export interface PrefetchedInsights {
  totalCheckIns: number
  currentStreak: { type: string; days: number } | null
  lastMood: number | null
  lastNote: string | null
  daysSinceLastCheckIn: number
  recentAverage: number | null
  trend: 'up' | 'down' | 'stable' | null
}

export interface PrefetchedGoal {
  id: string
  title: string
  progress_percent: number
  plant_type: string | null
}

export interface PrefetchedData {
  insights: PrefetchedInsights | null
  activeGoal: PrefetchedGoal | null
  hasCheckedInToday: boolean
  todaysWinsCount: number
  hasMoodEntries: boolean
  timestamp: number
}

// Cache key for sessionStorage
const PREFETCH_CACHE_KEY = 'adhder_prefetch_cache'
const CACHE_TTL = 60000 // 1 minute TTL

// Check if cached data is still valid
export function getCachedPrefetchData(): PrefetchedData | null {
  try {
    const cached = sessionStorage.getItem(PREFETCH_CACHE_KEY)
    if (!cached) return null

    const data = JSON.parse(cached) as PrefetchedData
    const age = Date.now() - data.timestamp

    // Cache is valid for 1 minute
    if (age < CACHE_TTL) {
      return data
    }

    // Expired, clear it
    sessionStorage.removeItem(PREFETCH_CACHE_KEY)
    return null
  } catch {
    return null
  }
}

// Save prefetched data to cache
function cachePrefetchData(data: PrefetchedData): void {
  try {
    sessionStorage.setItem(PREFETCH_CACHE_KEY, JSON.stringify(data))
  } catch {
    // Silently fail if sessionStorage is unavailable
  }
}

// Clear the prefetch cache
export function clearPrefetchCache(): void {
  try {
    sessionStorage.removeItem(PREFETCH_CACHE_KEY)
  } catch {
    // Silently fail
  }
}

// Main prefetch function - runs during splash screen
export async function prefetchDashboardData(userId: string): Promise<PrefetchedData> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // Parallel fetch all data we need
  const [moodResult, goalResult, winsResult] = await Promise.all([
    // 1. Fetch mood entries (for insights + check-in status)
    supabase
      .from('mood_entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(14),

    // 2. Fetch active goal
    supabase
      .from('goals')
      .select('id, title, progress_percent, plant_type')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1),

    // 3. Fetch today's wins count
    supabase
      .from('goal_progress_logs')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .gte('created_at', todayStart.toISOString()),
  ])

  // Process mood data
  let insights: PrefetchedInsights | null = null
  let hasCheckedInToday = false
  const hasMoodEntries = !!(moodResult.data && moodResult.data.length > 0)

  if (moodResult.data && moodResult.data.length > 0) {
    const data = moodResult.data
    const lastEntry = data[0]

    // Check if checked in today
    const lastEntryDate = new Date(lastEntry.created_at)
    hasCheckedInToday = lastEntryDate >= todayStart

    // Calculate days since last check-in
    const daysSince = Math.floor(
      (Date.now() - new Date(lastEntry.created_at).getTime()) / (1000 * 60 * 60 * 24)
    )

    // Calculate streak
    let streak = 1
    for (let i = 1; i < data.length; i++) {
      const curr = new Date(data[i - 1].created_at)
      const prev = new Date(data[i].created_at)
      const diff = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
      if (diff <= 1) {
        streak++
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

    insights = {
      totalCheckIns: data.length,
      currentStreak: streak >= 2 ? { type: 'checking_in', days: streak } : null,
      lastMood: lastEntry.mood_score,
      lastNote: lastEntry.note,
      daysSinceLastCheckIn: daysSince,
      recentAverage: Math.round(recentAvg * 10) / 10,
      trend,
    }
  }

  // Process goal data
  const activeGoal: PrefetchedGoal | null =
    goalResult.data && goalResult.data.length > 0
      ? (goalResult.data[0] as PrefetchedGoal)
      : null

  // Process wins count
  const todaysWinsCount = winsResult.count || 0

  const prefetchedData: PrefetchedData = {
    insights,
    activeGoal,
    hasCheckedInToday,
    todaysWinsCount,
    hasMoodEntries,
    timestamp: Date.now(),
  }

  // Cache the data
  cachePrefetchData(prefetchedData)

  return prefetchedData
}

// Check if user has completed onboarding
// Uses localStorage flag + fallback to checking for mood entries
export function hasCompletedOnboarding(): boolean {
  try {
    const flag = localStorage.getItem('onboarding_completed')
    if (flag === 'true') return true
  } catch {
    // localStorage unavailable
  }
  return false
}

// Set onboarding as completed
export function setOnboardingCompleted(): void {
  try {
    localStorage.setItem('onboarding_completed', 'true')
  } catch {
    // localStorage unavailable
  }
}

// Check onboarding status with Supabase fallback
export async function checkOnboardingStatus(userId: string): Promise<boolean> {
  // First check localStorage
  if (hasCompletedOnboarding()) {
    return true
  }

  // Fallback: Check if user has any mood entries (created during onboarding)
  const { data, error } = await supabase
    .from('mood_entries')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (!error && data && data.length > 0) {
    // User has mood entries, mark as onboarded
    setOnboardingCompleted()
    return true
  }

  return false
}
