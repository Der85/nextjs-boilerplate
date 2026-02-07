// Adaptive Rule Engine for State-Based UX Adjustments
// This module evaluates daily check-in data and returns adaptive state

import {
  type DailyCheckin,
  type AdaptiveState,
  type AdaptiveTrigger,
  type AdaptiveRecommendation,
  THRESHOLDS,
  DEFAULT_ADAPTIVE_STATE,
} from './types/daily-checkin'

// ===================================================================
// TRIGGER EVALUATION
// ===================================================================

/**
 * Evaluate check-in data and determine which adaptive triggers are active
 */
export function evaluateTriggers(checkin: DailyCheckin | null): AdaptiveTrigger[] {
  if (!checkin) return []

  const triggers: AdaptiveTrigger[] = []

  if (checkin.overwhelm >= THRESHOLDS.HIGH_OVERWHELM) {
    triggers.push('high_overwhelm')
  }

  if (checkin.anxiety >= THRESHOLDS.HIGH_ANXIETY) {
    triggers.push('high_anxiety')
  }

  if (checkin.energy <= THRESHOLDS.LOW_ENERGY) {
    triggers.push('low_energy')
  }

  if (checkin.clarity <= THRESHOLDS.LOW_CLARITY) {
    triggers.push('low_clarity')
  }

  // Combined stress: multiple negative indicators
  if (
    triggers.includes('high_overwhelm') &&
    (triggers.includes('high_anxiety') || triggers.includes('low_energy'))
  ) {
    triggers.push('combined_stress')
  }

  return triggers
}

// ===================================================================
// RECOMMENDATIONS
// ===================================================================

/**
 * Generate personalized recommendations based on triggers
 */
export function generateRecommendations(triggers: AdaptiveTrigger[]): AdaptiveRecommendation[] {
  const recommendations: AdaptiveRecommendation[] = []

  // High overwhelm recommendations
  if (triggers.includes('high_overwhelm') || triggers.includes('combined_stress')) {
    recommendations.push({
      id: 'reduce_scope',
      type: 'action',
      title: 'Focus on just 1 thing',
      description: 'When overwhelmed, pick your single most important task. Everything else can wait.',
      priority: 'high',
      actionType: 'navigate',
      actionPath: '/focus?mode=single',
    })

    recommendations.push({
      id: 'brain_dump',
      type: 'action',
      title: 'Do a brain dump',
      description: 'Get everything out of your head and onto paper. You\'ll feel lighter.',
      priority: 'high',
      actionType: 'navigate',
      actionPath: '/focus',
    })
  }

  // High anxiety recommendations
  if (triggers.includes('high_anxiety')) {
    recommendations.push({
      id: 'breathing',
      type: 'resource',
      title: 'Take a breathing break',
      description: '4-7-8 breathing can help calm your nervous system in just 2 minutes.',
      priority: 'high',
      actionType: 'navigate',
      actionPath: '/brake',
    })

    recommendations.push({
      id: 'simplify_view',
      type: 'suggestion',
      title: 'Simplified view enabled',
      description: 'We\'ve hidden extra UI elements to reduce visual noise.',
      priority: 'medium',
    })
  }

  // Low energy recommendations
  if (triggers.includes('low_energy')) {
    recommendations.push({
      id: 'quick_wins',
      type: 'action',
      title: 'Start with quick wins',
      description: 'Low energy? Tackle 2-minute tasks first to build momentum.',
      priority: 'high',
      actionType: 'enable_feature',
      actionPath: 'sort_by_duration',
    })

    recommendations.push({
      id: 'admin_tasks',
      type: 'suggestion',
      title: 'Admin tasks prioritized',
      description: 'We\'re showing shorter, simpler tasks that match your energy.',
      priority: 'medium',
    })
  }

  // Low clarity recommendations
  if (triggers.includes('low_clarity')) {
    recommendations.push({
      id: 'planning_step',
      type: 'action',
      title: 'Start with planning',
      description: 'When foggy, spend 5 minutes clarifying before doing.',
      priority: 'high',
      actionType: 'navigate',
      actionPath: '/focus?step=context',
    })

    recommendations.push({
      id: 'ally_check',
      type: 'resource',
      title: 'Talk it through',
      description: 'Sometimes clarity comes from explaining your tasks to your Ally.',
      priority: 'medium',
      actionType: 'navigate',
      actionPath: '/ally',
    })
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 }
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  // Limit to top 3 recommendations to avoid overwhelm
  return recommendations.slice(0, 3)
}

// ===================================================================
// ADAPTIVE STATE COMPUTATION
// ===================================================================

/**
 * Compute full adaptive state from check-in data
 */
export function computeAdaptiveState(checkin: DailyCheckin | null): AdaptiveState {
  if (!checkin) {
    return DEFAULT_ADAPTIVE_STATE
  }

  const triggers = evaluateTriggers(checkin)
  const recommendations = generateRecommendations(triggers)

  // Determine mode flags based on triggers
  const hasHighStress = triggers.includes('high_overwhelm') || triggers.includes('high_anxiety')
  const hasLowEnergy = triggers.includes('low_energy')
  const hasLowClarity = triggers.includes('low_clarity')
  const hasCombinedStress = triggers.includes('combined_stress')

  return {
    simplifiedUIEnabled: hasHighStress || hasCombinedStress,
    reducedTasksMode: hasHighStress,
    suggestLowCognitiveLoad: hasHighStress || hasLowEnergy,
    prioritizeShortTasks: hasLowEnergy,
    showPlanningMicroStep: hasLowClarity,
    triggers,
    recommendations,
  }
}

// ===================================================================
// TASK FILTERING HELPERS
// ===================================================================

/**
 * Filter and sort tasks based on adaptive state
 */
export function filterTasksForAdaptiveState<T extends {
  estimated_minutes?: number | null
  energy_required?: string | null
  status?: string
}>(
  tasks: T[],
  adaptiveState: AdaptiveState,
  maxTasks: number = 10
): T[] {
  let filtered = [...tasks]

  // In reduced tasks mode, limit visible tasks
  if (adaptiveState.reducedTasksMode) {
    maxTasks = Math.min(maxTasks, 3)
  }

  // When suggesting low cognitive load, prioritize easy tasks
  if (adaptiveState.suggestLowCognitiveLoad) {
    filtered = filtered.filter((t) => {
      const energy = t.energy_required?.toLowerCase()
      return energy !== 'high'
    })
  }

  // When prioritizing short tasks, sort by duration
  if (adaptiveState.prioritizeShortTasks) {
    filtered.sort((a, b) => {
      const aDuration = a.estimated_minutes ?? 30
      const bDuration = b.estimated_minutes ?? 30
      return aDuration - bDuration
    })
  }

  return filtered.slice(0, maxTasks)
}

// ===================================================================
// CORRELATION INSIGHT GENERATION
// ===================================================================

export interface CorrelationInsight {
  id: string
  title: string
  description: string
  type: 'positive' | 'negative' | 'neutral'
  confidence: 'high' | 'medium' | 'low'
}

/**
 * Generate correlation insights from check-in data
 */
export function generateCorrelationInsights(correlations: {
  high_overwhelm_avg_untriaged: number | null
  low_overwhelm_avg_untriaged: number | null
  high_energy_tasks_completed: number | null
  low_energy_tasks_completed: number | null
  total_checkins: number
}): CorrelationInsight[] {
  const insights: CorrelationInsight[] = []

  if (correlations.total_checkins < 5) {
    // Not enough data for meaningful correlations
    return [{
      id: 'need_more_data',
      title: 'Building your pattern library',
      description: 'Keep checking in daily. After a week, we\'ll show you personalized insights.',
      type: 'neutral',
      confidence: 'low',
    }]
  }

  // Overwhelm vs untriaged captures correlation
  const highOverwhelmUntriaged = correlations.high_overwhelm_avg_untriaged ?? 0
  const lowOverwhelmUntriaged = correlations.low_overwhelm_avg_untriaged ?? 0

  if (highOverwhelmUntriaged > lowOverwhelmUntriaged + 3) {
    insights.push({
      id: 'overwhelm_untriaged',
      title: 'Inbox overflow = overwhelm',
      description: `High overwhelm days have ${Math.round(highOverwhelmUntriaged)} untriaged items on average vs ${Math.round(lowOverwhelmUntriaged)} on calm days.`,
      type: 'negative',
      confidence: 'high',
    })
  }

  // Energy vs task completion correlation
  const highEnergyCompleted = correlations.high_energy_tasks_completed ?? 0
  const lowEnergyCompleted = correlations.low_energy_tasks_completed ?? 0

  if (highEnergyCompleted > lowEnergyCompleted * 1.5 && highEnergyCompleted > 0) {
    insights.push({
      id: 'energy_productivity',
      title: 'Energy drives completion',
      description: `You complete ${Math.round(highEnergyCompleted * 100) / 100} tasks on high-energy days vs ${Math.round(lowEnergyCompleted * 100) / 100} on low-energy days.`,
      type: 'positive',
      confidence: 'high',
    })
  }

  // Add general insight if we found correlations
  if (insights.length > 0) {
    insights.push({
      id: 'pattern_found',
      title: 'Patterns are emerging',
      description: 'Your data is revealing what helps you thrive. Keep tracking!',
      type: 'positive',
      confidence: 'medium',
    })
  }

  return insights
}

// ===================================================================
// TODAY'S CHECK-IN STATUS
// ===================================================================

/**
 * Check if user has completed check-in today
 */
export function hasCheckedInToday(latestCheckin: { date: string } | null): boolean {
  if (!latestCheckin) return false

  const today = new Date().toISOString().split('T')[0]
  return latestCheckin.date === today
}

/**
 * Get time since last check-in for prompting
 */
export function getTimeSinceLastCheckin(latestCheckin: { date: string } | null): {
  hours: number
  shouldPrompt: boolean
} {
  if (!latestCheckin) {
    return { hours: Infinity, shouldPrompt: true }
  }

  const lastDate = new Date(latestCheckin.date)
  const now = new Date()
  const diffMs = now.getTime() - lastDate.getTime()
  const hours = diffMs / (1000 * 60 * 60)

  // Prompt if more than 20 hours since last check-in
  return {
    hours,
    shouldPrompt: hours >= 20,
  }
}
