// User Context Service - Fetches and analyzes mood history for context-aware coaching
import { SupabaseClient } from '@supabase/supabase-js'
import {
  MoodEntry,
  MoodPattern,
  TimePattern,
  RecurringTheme,
  UserContext,
  ContextualPrompt,
  BurnoutSnapshot
} from './types/context'

// ============================================
// CONSTANTS
// ============================================

// Common ADHD-related themes to look for
const THEME_PATTERNS: { pattern: RegExp, theme: string, sentiment: 'positive' | 'negative' | 'neutral' }[] = [
  // Work/Productivity
  { pattern: /work|job|boss|coworker|office|deadline|project|meeting/i, theme: 'work stress', sentiment: 'negative' },
  { pattern: /productive|accomplished|finished|completed|done/i, theme: 'productivity wins', sentiment: 'positive' },
  { pattern: /procrastinat|avoid|putting off|can't start/i, theme: 'procrastination', sentiment: 'negative' },
  { pattern: /overwhelm|too much|swamp|buried/i, theme: 'feeling overwhelmed', sentiment: 'negative' },
  { pattern: /focus|concentrate|distract/i, theme: 'focus challenges', sentiment: 'negative' },
  
  // Emotional
  { pattern: /anxi|worry|nervous|stress/i, theme: 'anxiety', sentiment: 'negative' },
  { pattern: /sad|depress|down|low|hopeless/i, theme: 'low mood', sentiment: 'negative' },
  { pattern: /happy|joy|excit|great|amazing/i, theme: 'positive emotions', sentiment: 'positive' },
  { pattern: /frustrat|angry|annoyed|irritat/i, theme: 'frustration', sentiment: 'negative' },
  { pattern: /reject|rsd|sensitive|hurt/i, theme: 'rejection sensitivity', sentiment: 'negative' },
  
  // Physical/Self-care
  { pattern: /tired|exhaust|fatigue|sleep|insomnia/i, theme: 'fatigue/sleep issues', sentiment: 'negative' },
  { pattern: /exercise|workout|gym|run|walk/i, theme: 'physical activity', sentiment: 'positive' },
  { pattern: /eat|food|meal|hungry/i, theme: 'eating patterns', sentiment: 'neutral' },
  { pattern: /medic|pill|dose|forgot.*med/i, theme: 'medication', sentiment: 'neutral' },
  
  // Relationships
  { pattern: /friend|social|family|partner|relationship/i, theme: 'relationships', sentiment: 'neutral' },
  { pattern: /alone|lonely|isolat/i, theme: 'loneliness', sentiment: 'negative' },
  { pattern: /support|help|understood/i, theme: 'feeling supported', sentiment: 'positive' },
  
  // ADHD-specific
  { pattern: /hyperfocus|in the zone|flow/i, theme: 'hyperfocus', sentiment: 'positive' },
  { pattern: /forget|forgot|memory|remember/i, theme: 'memory issues', sentiment: 'negative' },
  { pattern: /late|time blind|running behind/i, theme: 'time management', sentiment: 'negative' },
  { pattern: /impuls|bought|spent|decision/i, theme: 'impulsivity', sentiment: 'negative' },
]

const STOP_WORDS = new Set(['this', 'that', 'with', 'have', 'been', 'were', 'they', 'their', 'about', 'would', 'could', 'should', 'really', 'today', 'feeling', 'felt', 'just', 'like', 'some', 'more', 'very', 'much', 'what', 'when', 'where', 'which', 'while'])

// ============================================
// FETCH USER MOOD HISTORY
// ============================================
export async function fetchUserMoodHistory(
  supabase: SupabaseClient,
  userId: string,
  limit: number = 30
): Promise<MoodEntry[]> {
  const { data, error } = await supabase
    .from('mood_entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching mood history:', error)
    return []
  }

  return data || []
}

// ============================================
// ANALYZE MOOD PATTERNS
// ============================================
function analyzeMoodPatterns(entries: MoodEntry[]): MoodPattern | null {
  if (entries.length < 3) return null

  const recentScores = entries.slice(0, 7).map(e => e.mood_score)
  const avgRecent = recentScores.reduce((a, b) => a + b, 0) / recentScores.length

  // Check for low mood streak (3+ days at 4 or below)
  const lowStreak = countConsecutive(recentScores, score => score <= 4)
  if (lowStreak >= 3) {
    return {
      type: 'streak_low',
      description: `${lowStreak} consecutive days with mood at 4 or below`,
      severity: lowStreak >= 5 ? 'significant' : lowStreak >= 4 ? 'moderate' : 'mild',
      daysAffected: lowStreak
    }
  }

  // Check for high mood streak (3+ days at 7 or above)
  const highStreak = countConsecutive(recentScores, score => score >= 7)
  if (highStreak >= 3) {
    return {
      type: 'streak_high',
      description: `${highStreak} consecutive days with mood at 7 or above`,
      severity: 'mild', // High mood streaks are positive
      daysAffected: highStreak
    }
  }

  // Check for declining trend
  if (recentScores.length >= 3) {
    const isDecline = recentScores[0] < recentScores[1] && recentScores[1] < recentScores[2]
    if (isDecline && recentScores[0] <= 5) {
      return {
        type: 'declining',
        description: 'Mood has been declining over the past few days',
        severity: recentScores[0] <= 3 ? 'significant' : 'moderate',
        daysAffected: 3
      }
    }
  }

  // Check for improving trend
  if (recentScores.length >= 3) {
    const isImproving = recentScores[0] > recentScores[1] && recentScores[1] > recentScores[2]
    if (isImproving) {
      return {
        type: 'improving',
        description: 'Mood has been improving over the past few days',
        severity: 'mild',
        daysAffected: 3
      }
    }
  }

  // Check for volatility (high variance)
  const variance = calculateVariance(recentScores)
  if (variance > 4) {
    return {
      type: 'volatile',
      description: 'Mood has been fluctuating significantly',
      severity: variance > 6 ? 'significant' : 'moderate',
      daysAffected: recentScores.length
    }
  }

  // Stable pattern
  if (variance < 2) {
    return {
      type: 'stable',
      description: `Mood has been consistently around ${Math.round(avgRecent)}`,
      severity: 'mild',
      daysAffected: recentScores.length
    }
  }

  return null
}

// ============================================
// ANALYZE TIME PATTERNS
// ============================================
function analyzeTimePatterns(entries: MoodEntry[], timeZone?: string): TimePattern {
  if (entries.length < 7) {
    return { bestTimeOfDay: null, worstTimeOfDay: null, bestDayOfWeek: null, worstDayOfWeek: null }
  }

  const timeOfDayScores: Record<string, number[]> = {
    morning: [],    // 5am - 12pm
    afternoon: [],  // 12pm - 5pm
    evening: [],    // 5pm - 9pm
    night: []       // 9pm - 5am
  }

  const dayOfWeekScores: Record<string, number[]> = {
    Sunday: [], Monday: [], Tuesday: [], Wednesday: [],
    Thursday: [], Friday: [], Saturday: []
  }

  entries.forEach(entry => {
    const date = new Date(entry.created_at)
    const { hour, weekday } = getZonedDateParts(date, timeZone)
    const dayName = weekday

    // Categorize by time of day
    if (hour >= 5 && hour < 12) timeOfDayScores.morning.push(entry.mood_score)
    else if (hour >= 12 && hour < 17) timeOfDayScores.afternoon.push(entry.mood_score)
    else if (hour >= 17 && hour < 21) timeOfDayScores.evening.push(entry.mood_score)
    else timeOfDayScores.night.push(entry.mood_score)

    // Categorize by day of week
    dayOfWeekScores[dayName].push(entry.mood_score)
  })

  // Find best/worst time of day
  const timeAvgs = Object.entries(timeOfDayScores)
    .filter(([_, scores]) => scores.length >= 2)
    .map(([time, scores]) => ({
      time: time as 'morning' | 'afternoon' | 'evening' | 'night',
      avg: scores.reduce((a, b) => a + b, 0) / scores.length
    }))
    .sort((a, b) => b.avg - a.avg)

  // Find best/worst day of week
  const dayAvgs = Object.entries(dayOfWeekScores)
    .filter(([_, scores]) => scores.length >= 2)
    .map(([day, scores]) => ({
      day,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length
    }))
    .sort((a, b) => b.avg - a.avg)

  return {
    bestTimeOfDay: timeAvgs.length > 0 ? timeAvgs[0].time : null,
    worstTimeOfDay: timeAvgs.length > 0 ? timeAvgs[timeAvgs.length - 1].time : null,
    bestDayOfWeek: dayAvgs.length > 0 ? dayAvgs[0].day : null,
    worstDayOfWeek: dayAvgs.length > 0 ? dayAvgs[dayAvgs.length - 1].day : null
  }
}

// ============================================
// EXTRACT RECURRING THEMES FROM NOTES
// ============================================
function extractRecurringThemes(entries: MoodEntry[]): RecurringTheme[] {
  const entriesWithNotes = entries.filter(e => e.note && e.note.trim().length > 0)
  if (entriesWithNotes.length < 3) return []

  const themeCount: Record<string, { count: number, sentiment: 'positive' | 'negative' | 'neutral', lastMentioned: string }> = {}

  entriesWithNotes.forEach(entry => {
    const note = entry.note!.toLowerCase()
    THEME_PATTERNS.forEach(({ pattern, theme, sentiment }) => {
      if (pattern.test(note)) {
        if (!themeCount[theme]) {
          themeCount[theme] = { count: 0, sentiment, lastMentioned: entry.created_at }
        }
        themeCount[theme].count++
        // Update lastMentioned if this entry is more recent
        if (new Date(entry.created_at) > new Date(themeCount[theme].lastMentioned)) {
          themeCount[theme].lastMentioned = entry.created_at
        }
      }
    })
  })

  // Return themes that appear at least twice, sorted by frequency
  return Object.entries(themeCount)
    .filter(([_, data]) => data.count >= 2)
    .map(([theme, data]) => ({
      theme,
      frequency: data.count,
      sentiment: data.sentiment,
      lastMentioned: data.lastMentioned
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 5) // Top 5 themes
}

// ============================================
// CALCULATE STREAK
// ============================================
function calculateStreak(entries: MoodEntry[], timeZone?: string): UserContext['currentStreak'] {
  if (entries.length < 2) return null

  // Check-in streak (consecutive days with entries)
  let checkInStreak = 1

  for (let i = 1; i < entries.length; i++) {
    const currentDay = getDayKey(entries[i - 1].created_at, timeZone)
    const previousDay = getDayKey(entries[i].created_at, timeZone)
    const diffTime = currentDay - previousDay
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      checkInStreak++
    } else if (diffDays > 1) {
      break
    }
    // If diffDays === 0, it's the same day; continue to next entry without breaking
  }

  // Low mood streak
  const lowMoodStreak = countConsecutive(entries.map(e => e.mood_score), score => score <= 4)

  // High mood streak  
  const highMoodStreak = countConsecutive(entries.map(e => e.mood_score), score => score >= 7)

  // Return the most significant streak
  if (lowMoodStreak >= 3) {
    return { type: 'low_mood', days: lowMoodStreak }
  }
  if (highMoodStreak >= 3) {
    return { type: 'high_mood', days: highMoodStreak }
  }
  if (checkInStreak >= 3) {
    return { type: 'checking_in', days: checkInStreak }
  }

  return null
}

// ============================================
// AGGREGATE PARTIAL BURNOUT LOGS (Trojan Horse)
// ============================================
const BURNOUT_FIELDS = [
  'sleep_quality', 'energy_level', 'physical_tension', 'irritability',
  'overwhelm', 'motivation', 'focus_difficulty', 'forgetfulness', 'decision_fatigue'
] as const

async function aggregateBurnoutSnapshot(
  supabase: SupabaseClient,
  userId: string
): Promise<BurnoutSnapshot> {
  // Fetch burnout logs from the last 24 hours
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: logs } = await supabase
    .from('burnout_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })

  const snapshot: BurnoutSnapshot = {
    sleep_quality: null,
    energy_level: null,
    physical_tension: null,
    irritability: null,
    overwhelm: null,
    motivation: null,
    focus_difficulty: null,
    forgetfulness: null,
    decision_fatigue: null,
    battery_level: null,
    completeness: 0,
  }

  if (!logs || logs.length === 0) return snapshot

  // Take the most recent non-null value for each field
  for (const field of BURNOUT_FIELDS) {
    for (const log of logs) {
      if (log[field] != null) {
        snapshot[field] = log[field]
        break
      }
    }
  }

  // Battery level from most recent smart_battery entry
  for (const log of logs) {
    if (log.battery_level != null) {
      snapshot.battery_level = log.battery_level
      break
    }
  }

  // Calculate completeness (how many of 9 fields have values)
  const filled = BURNOUT_FIELDS.filter(f => snapshot[f] != null).length
  snapshot.completeness = Math.round((filled / BURNOUT_FIELDS.length) * 100)

  return snapshot
}

// ============================================
// BUILD COMPLETE USER CONTEXT
// ============================================
export async function buildUserContext(
  supabase: SupabaseClient,
  userId: string,
  timeZone?: string
): Promise<UserContext> {
  const entries = await fetchUserMoodHistory(supabase, userId, 30)

  // Default context for new users
  if (entries.length === 0) {
    return {
      totalCheckIns: 0,
      averageMood: 0,
      lastCheckIn: null,
      daysSinceLastCheckIn: -1,
      recentEntries: [],
      recentAverageMood: 0,
      currentPattern: null,
      timePatterns: { bestTimeOfDay: null, worstTimeOfDay: null, bestDayOfWeek: null, worstDayOfWeek: null },
      recurringThemes: [],
      comparedToBaseline: 'same',
      baselineDifference: 0,
      currentStreak: null,
      preferredCopingStrategies: [],
      triggersIdentified: []
    }
  }

  const lastCheckIn = entries[0]
  const recentEntries = entries.slice(0, 7)
  const allScores = entries.map(e => e.mood_score)
  const recentScores = recentEntries.map(e => e.mood_score)
  
  const averageMood = allScores.reduce((a, b) => a + b, 0) / allScores.length
  const recentAverageMood = recentScores.reduce((a, b) => a + b, 0) / recentScores.length
  
  // Calculate days since last check-in
  const daysSinceLastCheckIn = Math.floor(
    (Date.now() - new Date(lastCheckIn.created_at).getTime()) / (1000 * 60 * 60 * 24)
  )

  // Compare recent to baseline
  const baselineDifference = recentAverageMood - averageMood
  const comparedToBaseline: UserContext['comparedToBaseline'] = 
    baselineDifference > 0.5 ? 'better' : 
    baselineDifference < -0.5 ? 'worse' : 'same'

  // Extract triggers and coping strategies from positive entries
  const positiveEntries = entries.filter(e => e.mood_score >= 7 && e.note)
  const negativeEntries = entries.filter(e => e.mood_score <= 4 && e.note)
  
  const triggersIdentified = extractKeywords(negativeEntries.map(e => e.note!))
  const preferredCopingStrategies = extractKeywords(positiveEntries.map(e => e.note!))

  // Aggregate partial burnout logs (Trojan Horse data)
  const burnoutSnapshot = await aggregateBurnoutSnapshot(supabase, userId)

  return {
    totalCheckIns: entries.length,
    averageMood: Math.round(averageMood * 10) / 10,
    lastCheckIn,
    daysSinceLastCheckIn,
    recentEntries,
    recentAverageMood: Math.round(recentAverageMood * 10) / 10,
    currentPattern: analyzeMoodPatterns(entries),
    timePatterns: analyzeTimePatterns(entries, timeZone),
    recurringThemes: extractRecurringThemes(entries),
    comparedToBaseline,
    baselineDifference: Math.round(baselineDifference * 10) / 10,
    currentStreak: calculateStreak(entries, timeZone),
    preferredCopingStrategies,
    triggersIdentified,
    burnoutSnapshot
  }
}

// ============================================
// GENERATE CONTEXTUAL PROMPT FOR AI
// ============================================
export function generateContextualPrompt(
  context: UserContext,
  currentMoodScore: number,
  currentNote: string
): ContextualPrompt {
  const insights: string[] = []
  let suggestedApproach = 'standard'

  // Build historical insights
  if (context.totalCheckIns === 0) {
    insights.push("This is the user's first check-in. Welcome them warmly and explain what you can help with.")
    suggestedApproach = 'onboarding'
  } else {
    // Streak information
    if (context.currentStreak) {
      if (context.currentStreak.type === 'low_mood' && context.currentStreak.days >= 3) {
        insights.push(`IMPORTANT: User has marked low mood (≤4) for ${context.currentStreak.days} consecutive days.`)
        suggestedApproach = 'gentle_support'
      } else if (context.currentStreak.type === 'high_mood') {
        insights.push(`User has been feeling good (≥7) for ${context.currentStreak.days} consecutive days.`)
        suggestedApproach = 'celebrate_maintain'
      } else if (context.currentStreak.type === 'checking_in') {
        insights.push(`Great consistency: ${context.currentStreak.days}-day check-in streak!`)
      }
    }

    // Pattern insights
    if (context.currentPattern) {
      switch (context.currentPattern.type) {
        case 'streak_low':
          insights.push(`Pattern detected: ${context.currentPattern.description}. Approach with extra care.`)
          break
        case 'declining':
          insights.push(`Trend alert: ${context.currentPattern.description}. May need proactive support.`)
          suggestedApproach = 'proactive_check'
          break
        case 'improving':
          insights.push(`Positive trend: ${context.currentPattern.description}. Reinforce what's working.`)
          break
        case 'volatile':
          insights.push(`Volatility noted: ${context.currentPattern.description}. Focus on stability strategies.`)
          break
      }
    }

    // Comparison to baseline
    if (context.comparedToBaseline !== 'same') {
      const direction = context.comparedToBaseline === 'better' ? 'above' : 'below'
      insights.push(`Recent mood is ${Math.abs(context.baselineDifference)} points ${direction} their usual baseline of ${context.averageMood}.`)
    }

    // Recurring themes
    const negativeThemes = context.recurringThemes.filter(t => t.sentiment === 'negative').slice(0, 2)
    if (negativeThemes.length > 0) {
      const themeList = negativeThemes.map(t => t.theme).join(' and ')
      insights.push(`Recurring challenges: ${themeList}.`)
    }

    // Time patterns
    if (context.timePatterns.worstTimeOfDay) {
      insights.push(`They tend to struggle more in the ${context.timePatterns.worstTimeOfDay}.`)
    }

    // Days since last check-in
    if (context.daysSinceLastCheckIn > 3) {
      insights.push(`It's been ${context.daysSinceLastCheckIn} days since their last check-in.`)
    }

    // Last check-in context
    if (context.lastCheckIn && context.lastCheckIn.note) {
      const lastNote = context.lastCheckIn.note.slice(0, 100)
      insights.push(`Last check-in (${formatTimeAgo(context.lastCheckIn.created_at)}): "${lastNote}${context.lastCheckIn.note.length > 100 ? '...' : ''}" (mood: ${context.lastCheckIn.mood_score}/10)`)
    }
  }

  // Build the system context
  const systemContext = `You are a warm, experienced ADHD coach who KNOWS this person's history. You remember their patterns, struggles, and wins. Never ask generic questions like "How have you been?" - you already know.

YOUR KNOWLEDGE ABOUT THIS USER:
- Total check-ins: ${context.totalCheckIns}
- Average mood: ${context.averageMood}/10
- Recent average (7 days): ${context.recentAverageMood}/10
${insights.map(i => `- ${i}`).join('\n')}`

  // Current situation analysis
  const moodChange = context.lastCheckIn 
    ? currentMoodScore - context.lastCheckIn.mood_score 
    : 0
  
  let currentSituation = `
CURRENT CHECK-IN:
- Mood score: ${currentMoodScore}/10
- What they shared: "${currentNote || '(no note provided)'}"
${context.lastCheckIn ? `- Change from last time: ${moodChange > 0 ? '+' : ''}${moodChange} points` : ''}
${currentMoodScore <= 3 ? '- ⚠️ LOW MOOD ALERT: Be extra gentle and supportive' : ''}
${currentMoodScore >= 8 ? '- 🎉 HIGH MOOD: Celebrate and help them capture what\'s working' : ''}`

  // Suggested approach instructions
  const approachInstructions: Record<string, string> = {
    standard: 'Provide personalized support based on their specific situation.',
    onboarding: 'Welcome them warmly! Explain you\'ll learn their patterns over time. Focus on this moment.',
    gentle_support: 'This person has been struggling. Be extra gentle. Suggest SMALLER steps than usual. Acknowledge the difficulty of consecutive hard days.',
    celebrate_maintain: 'They\'re doing well! Help them identify and maintain what\'s working. Don\'t fix what isn\'t broken.',
    proactive_check: 'Mood is trending down. Gently acknowledge the pattern without being alarmist. Offer concrete, tiny support.'
  }

  return {
    systemContext,
    historicalInsights: insights.join(' '),
    currentSituation,
    suggestedApproach: approachInstructions[suggestedApproach] || approachInstructions.standard
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================
function countConsecutive(arr: number[], predicate: (n: number) => boolean): number {
  let count = 0
  for (const val of arr) {
    if (predicate(val)) count++
    else break
  }
  return count
}

function calculateVariance(arr: number[]): number {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  const squaredDiffs = arr.map(x => Math.pow(x - mean, 2))
  return squaredDiffs.reduce((a, b) => a + b, 0) / arr.length
}

function extractKeywords(notes: string[]): string[] {
  const allText = notes.join(' ').toLowerCase()
  const words = allText.match(/\b[a-z]{4,}\b/g) || []
  const wordCount: Record<string, number> = {}
  
  words.forEach(word => {
    if (!STOP_WORDS.has(word)) {
      wordCount[word] = (wordCount[word] || 0) + 1
    }
  })

  return Object.entries(wordCount)
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word)
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffHours < 1) return 'just now'
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return `${Math.floor(diffDays / 7)} week${diffDays >= 14 ? 's' : ''} ago`
}

// ============================================
// TIME ZONE HELPERS
// ============================================
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function getZonedDateParts(date: Date, timeZone?: string): { year: number; month: number; day: number; hour: number; weekday: string } {
  if (!timeZone) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      weekday: WEEKDAYS[date.getDay()]
    }
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
      weekday: 'long'
    })

    const parts = formatter.formatToParts(date)
    const lookup: Record<string, string> = {}
    for (const part of parts) {
      if (part.type !== 'literal') {
        lookup[part.type] = part.value
      }
    }

    return {
      year: Number(lookup.year),
      month: Number(lookup.month),
      day: Number(lookup.day),
      hour: Number(lookup.hour),
      weekday: lookup.weekday || WEEKDAYS[date.getDay()]
    }
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      weekday: WEEKDAYS[date.getDay()]
    }
  }
}

function getDayKey(dateInput: string | Date, timeZone?: string): number {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  const { year, month, day } = getZonedDateParts(date, timeZone)
  return Date.UTC(year, month - 1, day)
}
