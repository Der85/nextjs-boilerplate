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
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()))
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
  return new Date().toISOString().split('T')[0]
}

export function getTomorrowISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export function getNextWeekISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().split('T')[0]
}

export function getWeekendISO(): string {
  const d = new Date()
  const dayOfWeek = d.getDay()
  const daysUntilSaturday = dayOfWeek === 0 ? 6 : 6 - dayOfWeek
  d.setDate(d.getDate() + daysUntilSaturday)
  return d.toISOString().split('T')[0]
}
