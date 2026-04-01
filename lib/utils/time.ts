/**
 * Format a date string as a relative time label.
 * "2m", "1h", "3d", "2w", etc.
 */
export function relativeTime(dateString: string): string {
  const now = Date.now()
  const then = new Date(dateString).getTime()
  const diffSec = Math.floor((now - then) / 1000)

  if (diffSec < 60) return 'now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d`
  const diffWeek = Math.floor(diffDay / 7)
  if (diffWeek < 52) return `${diffWeek}w`
  const diffYear = Math.floor(diffDay / 365)
  return `${diffYear}y`
}
