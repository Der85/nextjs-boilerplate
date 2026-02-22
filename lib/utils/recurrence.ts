import type { RecurrenceRule, RecurrenceFrequency } from '@/lib/types'
import { formatLocalDate } from '@/lib/utils/dates'

/**
 * Calculate the next occurrence date based on recurrence rule
 */
export function getNextOccurrenceDate(
  currentDueDate: string | null,
  rule: RecurrenceRule
): string {
  const baseDate = currentDueDate ? new Date(currentDueDate + 'T00:00:00') : new Date()
  const interval = rule.interval || 1
  const nextDate = new Date(baseDate)

  switch (rule.frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + interval)
      break

    case 'weekdays':
      // Move to next weekday
      do {
        nextDate.setDate(nextDate.getDate() + 1)
      } while (nextDate.getDay() === 0 || nextDate.getDay() === 6)
      break

    case 'weekly':
      nextDate.setDate(nextDate.getDate() + (7 * interval))
      break

    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14)
      break

    case 'monthly': {
      // Clamp to last day of target month to avoid overflow
      // (e.g. Jan 31 + 1 month → Feb 28, not Mar 3)
      const targetMonth = nextDate.getMonth() + interval
      const day = nextDate.getDate()
      nextDate.setDate(1) // avoid overflow during setMonth
      nextDate.setMonth(targetMonth)
      const lastDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()
      nextDate.setDate(Math.min(day, lastDay))
      break
    }
  }

  // Check if past end_date
  if (rule.end_date) {
    const endDate = new Date(rule.end_date + 'T23:59:59')
    if (nextDate > endDate) {
      return '' // Signal that recurrence has ended
    }
  }

  return formatLocalDate(nextDate)
}

/**
 * Check if a recurrence has ended
 */
export function isRecurrenceEnded(rule: RecurrenceRule): boolean {
  if (!rule.end_date) return false
  const endDate = new Date(rule.end_date + 'T23:59:59')
  return new Date() > endDate
}

/**
 * Get human-readable recurrence description
 */
export function getRecurrenceDescription(rule: RecurrenceRule): string {
  const interval = rule.interval || 1

  switch (rule.frequency) {
    case 'daily':
      return interval === 1 ? 'Every day' : `Every ${interval} days`
    case 'weekdays':
      return 'Every weekday'
    case 'weekly':
      return interval === 1 ? 'Every week' : `Every ${interval} weeks`
    case 'biweekly':
      return 'Every 2 weeks'
    case 'monthly':
      return interval === 1 ? 'Every month' : `Every ${interval} months`
    default:
      return 'Recurring'
  }
}

/**
 * Get short recurrence label for display
 */
export function getRecurrenceLabel(frequency: RecurrenceFrequency): string {
  switch (frequency) {
    case 'daily': return 'Daily'
    case 'weekdays': return 'Weekdays'
    case 'weekly': return 'Weekly'
    case 'biweekly': return 'Biweekly'
    case 'monthly': return 'Monthly'
    default: return 'Custom'
  }
}

/**
 * Recurrence frequency options for UI
 */
export const RECURRENCE_OPTIONS: Array<{
  value: RecurrenceFrequency
  label: string
  description: string
}> = [
  { value: 'daily', label: 'Daily', description: 'Every day' },
  { value: 'weekdays', label: 'Weekdays', description: 'Mon-Fri' },
  { value: 'weekly', label: 'Weekly', description: 'Same day each week' },
  { value: 'biweekly', label: 'Biweekly', description: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly', description: 'Same date each month' },
]
