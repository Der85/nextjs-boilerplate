// Types for Context-Aware RAG System

export interface MoodEntry {
  id: string
  user_id: string
  mood_score: number
  note: string | null
  coach_advice: string | null
  created_at: string
}

export interface MoodPattern {
  type: 'streak_low' | 'streak_high' | 'declining' | 'improving' | 'volatile' | 'stable'
  description: string
  severity: 'mild' | 'moderate' | 'significant'
  daysAffected: number
}

export interface TimePattern {
  bestTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | null
  worstTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | null
  bestDayOfWeek: string | null
  worstDayOfWeek: string | null
}

export interface RecurringTheme {
  theme: string
  frequency: number
  sentiment: 'positive' | 'negative' | 'neutral'
  lastMentioned: string
}

export interface UserContext {
  // Basic stats
  totalCheckIns: number
  averageMood: number
  lastCheckIn: MoodEntry | null
  daysSinceLastCheckIn: number
  
  // Recent history (last 7 days)
  recentEntries: MoodEntry[]
  recentAverageMood: number
  
  // Patterns detected
  currentPattern: MoodPattern | null
  timePatterns: TimePattern
  
  // Recurring themes from notes
  recurringThemes: RecurringTheme[]
  
  // Comparison to baseline
  comparedToBaseline: 'better' | 'worse' | 'same'
  baselineDifference: number
  
  // Streak information
  currentStreak: {
    type: 'checking_in' | 'low_mood' | 'high_mood' | 'improving'
    days: number
  } | null
  
  // Personalization
  preferredCopingStrategies: string[]
  triggersIdentified: string[]
}

export interface ContextualPrompt {
  systemContext: string
  historicalInsights: string
  currentSituation: string
  suggestedApproach: string
}
