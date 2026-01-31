// Gamification system for check-in experience
// Handles XP calculation, achievement unlocking, and progress tracking

export interface SessionData {
  startTime: number
  breathingCompleted: boolean
  energyLevel: number | null
  moodScore: number | null
  note: string
  stepTimings: Record<string, number>
}

export interface Badge {
  id: string
  icon: string
  title: string
  description: string
  type: 'streak' | 'mood' | 'engagement'
}

export interface UserStats {
  total_xp: number
  current_level: number
  achievements_unlocked: string[]
  last_check_in_time: string | null
  preferred_check_in_time: string | null
}

export interface ProgressRingData {
  dailyProgress: number // 0-100
  weeklyStreakProgress: number // 0-100
  xpProgress: number // 0-100
}

// XP Calculation
export function calculateXP(
  sessionData: SessionData,
  currentStreak: number = 0,
  lastCheckInTime: string | null = null
): number {
  let xp = 10 // Base check-in

  // Bonus for adding note
  if (sessionData.note && sessionData.note.length > 10) {
    xp += 5
  }

  // Bonus for completing breathing
  if (sessionData.breathingCompleted) {
    xp += 3
  }

  // Streak multiplier
  if (currentStreak >= 7) {
    xp = Math.floor(xp * 2) // x2 for 7+ days
  } else if (currentStreak >= 3) {
    xp = Math.floor(xp * 1.5) // x1.5 for 3+ days
  }

  // Consistency bonus (same time daily ±1 hour)
  if (lastCheckInTime) {
    const lastTime = new Date(lastCheckInTime)
    const currentTime = new Date(sessionData.startTime)

    const lastHour = lastTime.getHours()
    const currentHour = currentTime.getHours()

    const hourDiff = Math.abs(currentHour - lastHour)
    if (hourDiff <= 1) {
      xp += 10 // Consistency bonus
    }
  }

  return xp
}

// Level calculation based on total XP
export function calculateLevel(totalXP: number): number {
  if (totalXP < 500) return Math.floor(totalXP / 100) + 1 // Levels 1-5
  if (totalXP < 1500) return Math.floor((totalXP - 500) / 200) + 6 // Levels 6-10
  if (totalXP < 5000) return Math.floor((totalXP - 1500) / 350) + 11 // Levels 11-20
  return Math.floor((totalXP - 5000) / 500) + 21 // Levels 21+
}

// XP needed for next level
export function getXPForNextLevel(currentLevel: number): number {
  if (currentLevel < 5) return (currentLevel + 1) * 100
  if (currentLevel < 10) return 500 + ((currentLevel - 5) + 1) * 200
  if (currentLevel < 20) return 1500 + ((currentLevel - 10) + 1) * 350
  return 5000 + ((currentLevel - 20) + 1) * 500
}

// Check for achievement unlocks
export async function checkAchievements(
  userId: string,
  sessionData: SessionData,
  currentStats: {
    currentStreak: number
    totalCheckIns: number
    moodHistory: Array<{ mood_score: number; created_at: string }>
    breathingCompletedCount: number
    notesWrittenCount: number
  },
  existingAchievements: string[]
): Promise<Badge[]> {
  const newBadges: Badge[] = []

  // Streak Badges
  if (currentStats.currentStreak === 3 && !existingAchievements.includes('fire_starter')) {
    newBadges.push({
      id: 'fire_starter',
      icon: '🔥',
      title: 'Fire Starter',
      description: '3-day check-in streak!',
      type: 'streak'
    })
  }

  if (currentStats.currentStreak === 7 && !existingAchievements.includes('burning_bright')) {
    newBadges.push({
      id: 'burning_bright',
      icon: '🔥🔥',
      title: 'Burning Bright',
      description: '7-day streak! You\'re on fire!',
      type: 'streak'
    })
  }

  if (currentStats.currentStreak === 14 && !existingAchievements.includes('unstoppable')) {
    newBadges.push({
      id: 'unstoppable',
      icon: '🔥🔥🔥',
      title: 'Unstoppable',
      description: '14-day streak! Nothing can stop you!',
      type: 'streak'
    })
  }

  if (currentStats.currentStreak === 30 && !existingAchievements.includes('month_champion')) {
    newBadges.push({
      id: 'month_champion',
      icon: '🏆',
      title: 'Month Champion',
      description: '30-day streak! You\'re a legend!',
      type: 'streak'
    })
  }

  // Mood Badges
  // Check for 3-day upward trend
  if (currentStats.moodHistory.length >= 3) {
    const last3 = currentStats.moodHistory.slice(0, 3).reverse()
    const isUpwardTrend = last3[0].mood_score < last3[1].mood_score && last3[1].mood_score < last3[2].mood_score

    if (isUpwardTrend && !existingAchievements.includes('climbing_up')) {
      newBadges.push({
        id: 'climbing_up',
        icon: '📈',
        title: 'Climbing Up',
        description: 'Your mood is improving!',
        type: 'mood'
      })
    }
  }

  // Check for 5 check-ins at 8+
  const highMoodCount = currentStats.moodHistory.filter(m => m.mood_score >= 8).length
  if (highMoodCount >= 5 && !existingAchievements.includes('mood_master')) {
    newBadges.push({
      id: 'mood_master',
      icon: '🌈',
      title: 'Mood Master',
      description: '5 check-ins at 8+ mood!',
      type: 'mood'
    })
  }

  // Check for checking in during low mood 3x
  const lowMoodCheckIns = currentStats.moodHistory.filter(m => m.mood_score <= 4).length
  if (lowMoodCheckIns >= 3 && !existingAchievements.includes('resilient')) {
    newBadges.push({
      id: 'resilient',
      icon: '💪',
      title: 'Resilient',
      description: 'You showed up even when it was hard',
      type: 'mood'
    })
  }

  // Engagement Badges
  if (currentStats.notesWrittenCount >= 10 && !existingAchievements.includes('storyteller')) {
    newBadges.push({
      id: 'storyteller',
      icon: '📝',
      title: 'Storyteller',
      description: '10 notes written!',
      type: 'engagement'
    })
  }

  if (currentStats.breathingCompletedCount >= 10 && !existingAchievements.includes('zen_master')) {
    newBadges.push({
      id: 'zen_master',
      icon: '🧘',
      title: 'Zen Master',
      description: '10 breathing exercises completed!',
      type: 'engagement'
    })
  }

  // Consistency King - checking in at same time 7 days in a row
  if (currentStats.currentStreak >= 7) {
    const last7 = currentStats.moodHistory.slice(0, 7)
    const hours = last7.map(m => new Date(m.created_at).getHours())

    // Check if all hours are within ±1 hour of each other
    const maxHour = Math.max(...hours)
    const minHour = Math.min(...hours)

    if (maxHour - minHour <= 2 && !existingAchievements.includes('consistency_king')) {
      newBadges.push({
        id: 'consistency_king',
        icon: '⏰',
        title: 'Consistency King',
        description: 'Same time for 7 days!',
        type: 'engagement'
      })
    }
  }

  return newBadges
}

// Get progress ring data for visualization
export function getProgressRingData(
  userStats: UserStats,
  currentStreak: number,
  hasCheckedInToday: boolean
): ProgressRingData {
  const currentLevel = userStats.current_level
  const totalXP = userStats.total_xp

  // Calculate XP at current level start
  let xpAtLevelStart = 0
  if (currentLevel > 5) xpAtLevelStart = 500
  if (currentLevel > 10) xpAtLevelStart = 1500
  if (currentLevel > 20) xpAtLevelStart = 5000

  // Add XP from previous levels within tier
  if (currentLevel <= 5) {
    xpAtLevelStart = (currentLevel - 1) * 100
  } else if (currentLevel <= 10) {
    xpAtLevelStart = 500 + (currentLevel - 6) * 200
  } else if (currentLevel <= 20) {
    xpAtLevelStart = 1500 + (currentLevel - 11) * 350
  } else {
    xpAtLevelStart = 5000 + (currentLevel - 21) * 500
  }

  const xpForNextLevel = getXPForNextLevel(currentLevel)
  const xpInCurrentLevel = totalXP - xpAtLevelStart
  const xpNeeded = xpForNextLevel - xpAtLevelStart

  return {
    dailyProgress: hasCheckedInToday ? 100 : 0,
    weeklyStreakProgress: Math.min((currentStreak / 7) * 100, 100),
    xpProgress: Math.min((xpInCurrentLevel / xpNeeded) * 100, 100)
  }
}

// Get mood-based color gradient
export function getMoodGradient(moodScore: number): string {
  if (moodScore <= 2) return 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
  if (moodScore <= 4) return 'linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)'
  if (moodScore <= 6) return 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
  if (moodScore <= 8) return 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
  return 'linear-gradient(135deg, #a7f3d0 0%, #6ee7b7 100%)'
}

// Get energy level color
export function getEnergyColor(energyLevel: number): string {
  const colors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e']
  return colors[energyLevel] || colors[0]
}

// Get energy level label
export function getEnergyLabel(energyLevel: number): string {
  const labels = ['Depleted', 'Low', 'Moderate', 'High', 'Overflowing']
  return labels[energyLevel] || labels[0]
}

// Get energy level emoji
export function getEnergyEmoji(energyLevel: number): string {
  const emojis = ['🪫', '💤', '⚡', '🔋', '⚡⚡']
  return emojis[energyLevel] || emojis[0]
}

// Get smart note placeholder based on energy + mood
export function getNotePlaceholder(energyLevel: number | null, moodScore: number | null): string {
  if (energyLevel === null || moodScore === null) {
    return "What's on your mind? (helps me give better advice)"
  }

  // Low energy + low mood
  if (energyLevel <= 1 && moodScore <= 4) {
    return "What's draining you today?"
  }

  // Low energy + high mood
  if (energyLevel <= 1 && moodScore >= 7) {
    return "You're happy but tired - what's going on?"
  }

  // High energy + low mood
  if (energyLevel >= 3 && moodScore <= 4) {
    return "You have energy but feel down - tell me more..."
  }

  // High energy + high mood
  if (energyLevel >= 3 && moodScore >= 7) {
    return "What's fueling you today?"
  }

  // Moderate
  return "How are things going for you?"
}
