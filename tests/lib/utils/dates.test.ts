import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  formatLocalDate,
  formatUTCDate,
  isToday,
  isTomorrow,
  isThisWeek,
  isOverdue,
  formatRelativeDate,
  getTodayISO,
  getTomorrowISO,
  getNextWeekISO,
  getWeekendISO,
} from '@/lib/utils/dates'

// Pin "now" to a known date: Wednesday 2024-03-13
const FIXED_NOW = new Date('2024-03-13T12:00:00Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

// ============================================
// formatLocalDate / formatUTCDate
// ============================================

describe('formatLocalDate', () => {
  it('formats a date as YYYY-MM-DD using local components', () => {
    const d = new Date('2024-03-13T12:00:00')
    expect(formatLocalDate(d)).toBe('2024-03-13')
  })

  it('pads single-digit month and day', () => {
    const d = new Date('2024-01-05T12:00:00')
    expect(formatLocalDate(d)).toBe('2024-01-05')
  })
})

describe('formatUTCDate', () => {
  it('formats a date as YYYY-MM-DD using UTC components', () => {
    const d = new Date('2024-03-13T12:00:00Z')
    expect(formatUTCDate(d)).toBe('2024-03-13')
  })

  it('uses UTC date even near midnight', () => {
    // 2024-03-13 23:30 UTC
    const d = new Date('2024-03-13T23:30:00Z')
    expect(formatUTCDate(d)).toBe('2024-03-13')
  })
})

// ============================================
// isToday
// ============================================

describe('isToday', () => {
  it('returns true for today', () => {
    expect(isToday('2024-03-13')).toBe(true)
  })

  it('returns false for yesterday', () => {
    expect(isToday('2024-03-12')).toBe(false)
  })

  it('returns false for tomorrow', () => {
    expect(isToday('2024-03-14')).toBe(false)
  })
})

// ============================================
// isTomorrow
// ============================================

describe('isTomorrow', () => {
  it('returns true for tomorrow', () => {
    expect(isTomorrow('2024-03-14')).toBe(true)
  })

  it('returns false for today', () => {
    expect(isTomorrow('2024-03-13')).toBe(false)
  })

  it('returns false for day after tomorrow', () => {
    expect(isTomorrow('2024-03-15')).toBe(false)
  })
})

// ============================================
// isOverdue
// ============================================

describe('isOverdue', () => {
  it('returns true for yesterday', () => {
    expect(isOverdue('2024-03-12')).toBe(true)
  })

  it('returns false for today', () => {
    expect(isOverdue('2024-03-13')).toBe(false)
  })

  it('returns false for a future date', () => {
    expect(isOverdue('2024-03-20')).toBe(false)
  })
})

// ============================================
// isThisWeek
// ============================================

describe('isThisWeek', () => {
  // Fixed date: Wednesday 2024-03-13 (Wed)
  // End of week (Sunday) = 2024-03-17

  it('returns true for today', () => {
    expect(isThisWeek('2024-03-13')).toBe(true)
  })

  it('returns true for a date later this week', () => {
    expect(isThisWeek('2024-03-16')).toBe(true)
  })

  it('returns true for end of week (Sunday)', () => {
    expect(isThisWeek('2024-03-17')).toBe(true)
  })

  it('returns false for yesterday', () => {
    expect(isThisWeek('2024-03-12')).toBe(false)
  })

  it('returns false for next week', () => {
    expect(isThisWeek('2024-03-20')).toBe(false)
  })
})

// ============================================
// formatRelativeDate
// ============================================

describe('formatRelativeDate', () => {
  it('returns "Today" for today', () => {
    expect(formatRelativeDate('2024-03-13')).toBe('Today')
  })

  it('returns "Tomorrow" for tomorrow', () => {
    expect(formatRelativeDate('2024-03-14')).toBe('Tomorrow')
  })

  it('returns "Yesterday" for yesterday', () => {
    expect(formatRelativeDate('2024-03-12')).toBe('Yesterday')
  })

  it('returns days ago string for older dates', () => {
    expect(formatRelativeDate('2024-03-10')).toBe('3 days ago')
  })

  it('returns formatted date for future dates beyond tomorrow', () => {
    const result = formatRelativeDate('2024-03-20')
    expect(result).toBe('Mar 20')
  })
})

// ============================================
// ISO helpers
// ============================================

describe('getTodayISO', () => {
  it('returns today in YYYY-MM-DD format', () => {
    expect(getTodayISO()).toBe('2024-03-13')
  })
})

describe('getTomorrowISO', () => {
  it('returns tomorrow in YYYY-MM-DD format', () => {
    expect(getTomorrowISO()).toBe('2024-03-14')
  })
})

describe('getNextWeekISO', () => {
  it('returns 7 days from now in YYYY-MM-DD format', () => {
    expect(getNextWeekISO()).toBe('2024-03-20')
  })
})

describe('getWeekendISO', () => {
  // Fixed: Wednesday 2024-03-13, next Saturday is 2024-03-16
  it('returns the upcoming Saturday', () => {
    expect(getWeekendISO()).toBe('2024-03-16')
  })

  it('returns the next Saturday when today is Sunday', () => {
    vi.setSystemTime(new Date('2024-03-10T12:00:00Z')) // Sunday
    expect(getWeekendISO()).toBe('2024-03-16')
  })
})
