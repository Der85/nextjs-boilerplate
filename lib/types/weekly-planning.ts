// ===================================================================
// Weekly Planning Types
// ===================================================================

// ===========================================
// Constants
// ===========================================

export const MAX_WEEKLY_OUTCOMES = 3
export const DEFAULT_CAPACITY_MINUTES = 480 // 8 hours
export const OVERCOMMITMENT_THRESHOLD = 1.2 // 120% of capacity
export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

// ===========================================
// Enums / Union Types
// ===========================================

export type WeeklyPlanStatus = 'draft' | 'committed' | 'completed' | 'abandoned'
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Monday, 6 = Sunday

// ===========================================
// Core Interfaces
// ===========================================

export interface WeeklyPlan {
  id: string
  user_id: string
  week_number: number
  year: number
  version: number
  status: WeeklyPlanStatus
  available_capacity_minutes: number
  planned_capacity_minutes: number
  previous_week_reflection: string | null
  wins: string[] | null
  learnings: string[] | null
  summary_markdown: string | null
  committed_at: string | null
  created_at: string
  updated_at: string
}

export interface WeeklyPlanOutcome {
  id: string
  weekly_plan_id: string
  outcome_id: string
  priority_rank: number
  notes: string | null
  created_at: string
  // Joined fields
  outcome?: {
    id: string
    title: string
    description: string | null
    horizon: string
    status: string
  }
}

export interface WeeklyPlanTask {
  id: string
  weekly_plan_id: string
  task_id: string
  scheduled_day: DayOfWeek | null
  estimated_minutes: number
  priority_rank: number
  created_at: string
  // Joined fields
  task?: {
    id: string
    title: string
    status: string
    outcome_id: string | null
    commitment_id: string | null
  }
}

// ===========================================
// Wizard Step Types
// ===========================================

export type WizardStep = 'review' | 'outcomes' | 'capacity' | 'commit' | 'summary'

export const WIZARD_STEPS: WizardStep[] = ['review', 'outcomes', 'capacity', 'commit', 'summary']

export interface WizardStepConfig {
  id: WizardStep
  title: string
  description: string
  icon: string
}

export const WIZARD_STEP_CONFIG: Record<WizardStep, WizardStepConfig> = {
  review: {
    id: 'review',
    title: 'Review',
    description: 'Reflect on last week',
    icon: '📊',
  },
  outcomes: {
    id: 'outcomes',
    title: 'Choose Outcomes',
    description: 'Select top 3 priorities',
    icon: '🎯',
  },
  capacity: {
    id: 'capacity',
    title: 'Plan Capacity',
    description: 'Assign tasks to days',
    icon: '📅',
  },
  commit: {
    id: 'commit',
    title: 'Commit',
    description: 'Finalize your plan',
    icon: '✅',
  },
  summary: {
    id: 'summary',
    title: 'Summary',
    description: 'Your week at a glance',
    icon: '📋',
  },
}

// ===========================================
// Previous Week Summary
// ===========================================

export interface PreviousWeekSummary {
  completed_tasks: number
  total_planned_tasks: number
  total_minutes_completed: number
  top_outcomes: Array<{
    title: string
    completed_tasks: number
  }>
  completion_rate: number // Calculated
}

// ===========================================
// Capacity Planning
// ===========================================

export interface DayCapacity {
  day: DayOfWeek
  dayName: string
  tasks: WeeklyPlanTask[]
  totalMinutes: number
}

export interface CapacityWarning {
  type: 'overcommitted' | 'unbalanced' | 'no_buffer'
  severity: 'warning' | 'error'
  message: string
  details?: string
}

export interface CapacityAnalysis {
  totalPlannedMinutes: number
  availableMinutes: number
  utilizationPercent: number
  isOvercommitted: boolean
  dayBreakdown: DayCapacity[]
  warnings: CapacityWarning[]
}

// ===========================================
// Request/Response Types
// ===========================================

export interface CreateWeeklyPlanRequest {
  week_number?: number
  year?: number
  available_capacity_minutes?: number
}

export interface UpdateWeeklyPlanRequest {
  available_capacity_minutes?: number
  previous_week_reflection?: string
  wins?: string[]
  learnings?: string[]
  status?: WeeklyPlanStatus
}

export interface AddOutcomeRequest {
  outcome_id: string
  priority_rank: number
  notes?: string
}

export interface AddTaskRequest {
  task_id: string
  scheduled_day?: DayOfWeek | null
  estimated_minutes?: number
  priority_rank?: number
}

export interface UpdateTaskScheduleRequest {
  scheduled_day: DayOfWeek | null
  estimated_minutes?: number
}

export interface CommitPlanRequest {
  generate_summary?: boolean
}

// ===========================================
// Full Plan Response (with joined data)
// ===========================================

export interface WeeklyPlanFull extends WeeklyPlan {
  outcomes: WeeklyPlanOutcome[]
  tasks: WeeklyPlanTask[]
  capacity_analysis: CapacityAnalysis
}

// ===========================================
// ISO Week Utilities
// ===========================================

export interface ISOWeekInfo {
  week_number: number
  year: number
  week_start: Date
  week_end: Date
}

export function getISOWeekInfo(date: Date = new Date()): ISOWeekInfo {
  // Calculate ISO week number
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  const year = d.getUTCFullYear()

  // Calculate week start (Monday) and end (Sunday)
  const weekStart = new Date(date)
  weekStart.setDate(date.getDate() - (date.getDay() || 7) + 1)
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  return { week_number: weekNumber, year, week_start: weekStart, week_end: weekEnd }
}

export function formatWeekRange(weekInfo: ISOWeekInfo): string {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const startStr = weekInfo.week_start.toLocaleDateString('en-US', options)
  const endStr = weekInfo.week_end.toLocaleDateString('en-US', options)
  return `${startStr} - ${endStr}`
}

export function formatWeekLabel(weekInfo: ISOWeekInfo): string {
  return `Week ${weekInfo.week_number}, ${weekInfo.year}`
}

// ===========================================
// Type Guards
// ===========================================

export function isValidWeeklyPlanStatus(value: unknown): value is WeeklyPlanStatus {
  return typeof value === 'string' && ['draft', 'committed', 'completed', 'abandoned'].includes(value)
}

export function isValidDayOfWeek(value: unknown): value is DayOfWeek {
  return typeof value === 'number' && value >= 0 && value <= 6 && Number.isInteger(value)
}

export function isValidWizardStep(value: unknown): value is WizardStep {
  return typeof value === 'string' && WIZARD_STEPS.includes(value as WizardStep)
}

// ===========================================
// Capacity Calculation
// ===========================================

export function calculateCapacityAnalysis(
  tasks: WeeklyPlanTask[],
  availableMinutes: number
): CapacityAnalysis {
  const totalPlannedMinutes = tasks.reduce((sum, t) => sum + t.estimated_minutes, 0)
  const utilizationPercent = availableMinutes > 0
    ? Math.round((totalPlannedMinutes / availableMinutes) * 100)
    : 0

  // Group tasks by day
  const dayBreakdown: DayCapacity[] = DAYS_OF_WEEK.map((dayName, index) => {
    const dayTasks = tasks.filter(t => t.scheduled_day === index)
    return {
      day: index as DayOfWeek,
      dayName,
      tasks: dayTasks,
      totalMinutes: dayTasks.reduce((sum, t) => sum + t.estimated_minutes, 0),
    }
  })

  // Calculate warnings
  const warnings: CapacityWarning[] = []

  // Overcommitment warning
  if (totalPlannedMinutes > availableMinutes * OVERCOMMITMENT_THRESHOLD) {
    warnings.push({
      type: 'overcommitted',
      severity: 'error',
      message: 'You are significantly overcommitted',
      details: `Planned ${Math.round(totalPlannedMinutes / 60)}h but only ${Math.round(availableMinutes / 60)}h available`,
    })
  } else if (totalPlannedMinutes > availableMinutes) {
    warnings.push({
      type: 'overcommitted',
      severity: 'warning',
      message: 'Slightly over capacity',
      details: `Consider reducing by ${Math.round((totalPlannedMinutes - availableMinutes) / 60)}h`,
    })
  }

  // Unbalanced days warning
  const daysWithTasks = dayBreakdown.filter(d => d.totalMinutes > 0)
  if (daysWithTasks.length > 0) {
    const avgMinutesPerDay = totalPlannedMinutes / daysWithTasks.length
    const maxDay = dayBreakdown.reduce((max, d) => d.totalMinutes > max.totalMinutes ? d : max)
    if (maxDay.totalMinutes > avgMinutesPerDay * 2) {
      warnings.push({
        type: 'unbalanced',
        severity: 'warning',
        message: `${maxDay.dayName} is heavily loaded`,
        details: `Consider spreading tasks more evenly`,
      })
    }
  }

  // No buffer warning
  if (utilizationPercent >= 95 && utilizationPercent <= 100) {
    warnings.push({
      type: 'no_buffer',
      severity: 'warning',
      message: 'No buffer time',
      details: 'Consider leaving 10-20% buffer for unexpected tasks',
    })
  }

  return {
    totalPlannedMinutes,
    availableMinutes,
    utilizationPercent,
    isOvercommitted: totalPlannedMinutes > availableMinutes,
    dayBreakdown,
    warnings,
  }
}

// ===========================================
// Summary Generation
// ===========================================

export function generatePlanSummary(
  plan: WeeklyPlan,
  outcomes: WeeklyPlanOutcome[],
  tasks: WeeklyPlanTask[],
  weekInfo: ISOWeekInfo
): string {
  const capacityAnalysis = calculateCapacityAnalysis(tasks, plan.available_capacity_minutes)

  let summary = `# Week ${weekInfo.week_number} Plan\n\n`
  summary += `**${formatWeekRange(weekInfo)}**\n\n`

  // Outcomes section
  summary += `## Focus Outcomes\n\n`
  if (outcomes.length === 0) {
    summary += `_No outcomes selected_\n\n`
  } else {
    outcomes
      .sort((a, b) => a.priority_rank - b.priority_rank)
      .forEach((o, i) => {
        summary += `${i + 1}. **${o.outcome?.title || 'Unknown'}**`
        if (o.notes) summary += ` - ${o.notes}`
        summary += `\n`
      })
    summary += `\n`
  }

  // Capacity section
  summary += `## Capacity\n\n`
  summary += `- Available: ${Math.round(capacityAnalysis.availableMinutes / 60)}h\n`
  summary += `- Planned: ${Math.round(capacityAnalysis.totalPlannedMinutes / 60)}h (${capacityAnalysis.utilizationPercent}%)\n`
  summary += `- Tasks: ${tasks.length}\n\n`

  // Daily breakdown
  summary += `## Daily Plan\n\n`
  capacityAnalysis.dayBreakdown.forEach(day => {
    if (day.totalMinutes > 0) {
      summary += `### ${day.dayName}\n`
      day.tasks.forEach(t => {
        summary += `- ${t.task?.title || 'Unknown'} (${t.estimated_minutes}min)\n`
      })
      summary += `\n`
    }
  })

  // Unscheduled tasks
  const unscheduledTasks = tasks.filter(t => t.scheduled_day === null)
  if (unscheduledTasks.length > 0) {
    summary += `### Flexible (Unscheduled)\n`
    unscheduledTasks.forEach(t => {
      summary += `- ${t.task?.title || 'Unknown'} (${t.estimated_minutes}min)\n`
    })
    summary += `\n`
  }

  // Warnings
  if (capacityAnalysis.warnings.length > 0) {
    summary += `## Warnings\n\n`
    capacityAnalysis.warnings.forEach(w => {
      summary += `- ${w.severity === 'error' ? '❌' : '⚠️'} ${w.message}\n`
    })
  }

  return summary
}

// ===========================================
// Analytics Event Types
// ===========================================

export type WeeklyPlanningEventType =
  | 'planning_started'
  | 'review_completed'
  | 'outcomes_selected'
  | 'capacity_set'
  | 'plan_committed'
  | 'plan_completed'
  | 'plan_abandoned'
  | 'plan_revised'
  | 'overcommitment_warning_shown'
  | 'overcommitment_warning_dismissed'

export interface WeeklyPlanningEvent {
  id: string
  user_id: string
  event_type: WeeklyPlanningEventType
  weekly_plan_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}
