// Gamification utilities for recurring task streaks

export interface StreakBadge {
  id: string
  icon: string
  title: string
  description: string
  streakRequired: number
}

// XP values for task completions
export const TASK_XP = {
  base: 10,            // Base XP for completing any task
  recurring: 5,        // Bonus XP for recurring task
  streak_3: 5,         // Bonus at 3-day streak
  streak_7: 10,        // Bonus at 7-day streak
  streak_14: 15,       // Bonus at 14-day streak
  streak_30: 25,       // Bonus at 30-day streak
} as const

// Streak badges for recurring tasks
export const STREAK_BADGES: StreakBadge[] = [
  {
    id: 'streak_3',
    icon: '🔥',
    title: 'Getting Started',
    description: '3-day streak on a recurring task',
    streakRequired: 3,
  },
  {
    id: 'streak_7',
    icon: '🔥🔥',
    title: 'On Fire',
    description: '7-day streak - you\'re building momentum!',
    streakRequired: 7,
  },
  {
    id: 'streak_14',
    icon: '🔥🔥🔥',
    title: 'Unstoppable',
    description: '14-day streak - this is becoming a habit!',
    streakRequired: 14,
  },
  {
    id: 'streak_30',
    icon: '🏆',
    title: 'Habit Master',
    description: '30-day streak - you\'ve built a real habit!',
    streakRequired: 30,
  },
]

/**
 * Calculate XP earned for completing a recurring task
 */
export function calculateRecurringTaskXP(streak: number): number {
  let xp = TASK_XP.base + TASK_XP.recurring

  // Add streak bonuses (cumulative)
  if (streak >= 30) {
    xp += TASK_XP.streak_30 + TASK_XP.streak_14 + TASK_XP.streak_7 + TASK_XP.streak_3
  } else if (streak >= 14) {
    xp += TASK_XP.streak_14 + TASK_XP.streak_7 + TASK_XP.streak_3
  } else if (streak >= 7) {
    xp += TASK_XP.streak_7 + TASK_XP.streak_3
  } else if (streak >= 3) {
    xp += TASK_XP.streak_3
  }

  return xp
}

/**
 * Check if a streak milestone was just reached
 */
export function getNewlyUnlockedBadge(previousStreak: number, newStreak: number): StreakBadge | null {
  for (const badge of STREAK_BADGES) {
    if (previousStreak < badge.streakRequired && newStreak >= badge.streakRequired) {
      return badge
    }
  }
  return null
}

/**
 * Get the highest badge earned for a streak
 */
export function getHighestStreakBadge(streak: number): StreakBadge | null {
  let highestBadge: StreakBadge | null = null

  for (const badge of STREAK_BADGES) {
    if (streak >= badge.streakRequired) {
      highestBadge = badge
    }
  }

  return highestBadge
}

/**
 * Get progress to next badge (0-100)
 */
export function getProgressToNextBadge(streak: number): { progress: number; nextBadge: StreakBadge | null } {
  let previousMilestone = 0

  for (const badge of STREAK_BADGES) {
    if (streak < badge.streakRequired) {
      const progress = ((streak - previousMilestone) / (badge.streakRequired - previousMilestone)) * 100
      return { progress: Math.floor(progress), nextBadge: badge }
    }
    previousMilestone = badge.streakRequired
  }

  // Already at max badge
  return { progress: 100, nextBadge: null }
}

/**
 * Get streak message for display
 */
export function getStreakMessage(streak: number): string {
  if (streak === 0) return ''
  if (streak === 1) return 'First day! Keep it going!'
  if (streak < 3) return `${streak} days - almost at your first badge!`
  if (streak < 7) return `${streak} day streak! 🔥`
  if (streak < 14) return `${streak} day streak! 🔥🔥 You're on fire!`
  if (streak < 30) return `${streak} day streak! 🔥🔥🔥 Unstoppable!`
  return `${streak} day streak! 🏆 Habit Master!`
}
