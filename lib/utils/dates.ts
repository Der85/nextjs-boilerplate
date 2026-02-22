/**
 * Format a Date as YYYY-MM-DD using local timezone components.
 * Unlike toISOString().split('T')[0] which returns UTC date,
 * this returns the date in the user's local timezone.
 */
export function formatLocalDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format a Date as YYYY-MM-DD using UTC components.
 * Use this on the server side where dates should be consistently UTC.
 */
export function formatUTCDate(d: Date): string {
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isToday(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  return d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
}

export function isTomorrow(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00')
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate()
}

export function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(today)
  // getDay() returns 0 for Sunday — treat Sunday as end of week (7)
  const dayOfWeek = endOfWeek.getDay() || 7
  endOfWeek.setDate(endOfWeek.getDate() + (7 - dayOfWeek))
  return d >= today && d <= endOfWeek
}

export function isOverdue(dateStr: string): boolean {
  const d = new Date(dateStr + 'T23:59:59')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return d < now
}

export function formatRelativeDate(dateStr: string): string {
  if (isToday(dateStr)) return 'Today'
  if (isTomorrow(dateStr)) return 'Tomorrow'

  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    if (diffDays === -1) return 'Yesterday'
    return `${Math.abs(diffDays)} days ago`
  }

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function getTodayISO(): string {
  return formatLocalDate(new Date())
}

export function getTomorrowISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return formatLocalDate(d)
}

export function getNextWeekISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return formatLocalDate(d)
}

export function getWeekendISO(): string {
  const d = new Date()
  const dayOfWeek = d.getDay()
  const daysUntilSaturday = dayOfWeek === 0 ? 6 : 6 - dayOfWeek
  d.setDate(d.getDate() + daysUntilSaturday)
  return formatLocalDate(d)
}
