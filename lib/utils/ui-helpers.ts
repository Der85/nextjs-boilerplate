/**
 * Shared UI utility functions
 * Centralized to avoid duplication and ensure consistent behavior across the app
 */

/**
 * Get emoji representation of mood score
 * @param score - Mood score from 1-10
 */
export const getMoodEmoji = (score: number): string => {
  if (score <= 2) return '😢'
  if (score <= 4) return '😔'
  if (score <= 6) return '😐'
  if (score <= 8) return '🙂'
  return '😄'
}

/**
 * Convert mood/energy score to energy parameter for routing
 * @param score - Score from 1-10, or null
 */
export const getEnergyParam = (score: number | null): 'low' | 'medium' | 'high' => {
  if (score === null) return 'medium'
  if (score <= 3) return 'low'
  if (score <= 6) return 'medium'
  return 'high'
}

/**
 * Get time-of-day appropriate pulse check-in label
 */
export const getPulseLabel = (): string => {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 11) return '🌅 Morning Check-in: How did you sleep?'
  if (hour >= 11 && hour < 18) return '⚡ Daily Pulse: How is your energy?'
  return '🌙 Evening Wind Down: Carrying any tension?'
}

/**
 * Get time-of-day appropriate greeting
 */
export const getGreeting = (): string => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Get plant growth emoji based on progress percentage
 * @param progress - Progress percentage from 0-100
 */
export const getPlantEmoji = (progress: number): string => {
  if (progress >= 100) return '🌸'
  if (progress >= 75) return '🌷'
  if (progress >= 50) return '🪴'
  if (progress >= 25) return '🌿'
  return '🌱'
}
