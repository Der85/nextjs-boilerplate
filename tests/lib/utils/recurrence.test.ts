import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getNextOccurrenceDate,
  isRecurrenceEnded,
  getRecurrenceDescription,
  getRecurrenceLabel,
  RECURRENCE_OPTIONS,
} from '@/lib/utils/recurrence'
import type { RecurrenceRule } from '@/lib/types'

// Pin to a known Monday so weekday logic is predictable
const FIXED_NOW = new Date('2024-03-11T12:00:00Z') // Monday

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED_NOW) })
afterEach(() => { vi.useRealTimers() })

// ─── getNextOccurrenceDate ────────────────────────────────────────────────────

describe('getNextOccurrenceDate', () => {
  describe('daily', () => {
    it('advances by 1 day when interval is 1', () => {
      const rule: RecurrenceRule = { frequency: 'daily', interval: 1 }
      expect(getNextOccurrenceDate('2024-03-11', rule)).toBe('2024-03-12')
    })

    it('advances by 3 days when interval is 3', () => {
      const rule: RecurrenceRule = { frequency: 'daily', interval: 3 }
      expect(getNextOccurrenceDate('2024-03-11', rule)).toBe('2024-03-14')
    })

    it('uses today as base when due_date is null', () => {
      const rule: RecurrenceRule = { frequency: 'daily', interval: 1 }
      // FIXED_NOW is 2024-03-11, so next = 2024-03-12
      expect(getNextOccurrenceDate(null, rule)).toBe('2024-03-12')
    })
  })

  describe('weekdays', () => {
    it('skips Saturday → returns Monday', () => {
      const rule: RecurrenceRule = { frequency: 'weekdays', interval: 1 }
      // 2024-03-15 is Friday → next weekday is Monday 2024-03-18
      expect(getNextOccurrenceDate('2024-03-15', rule)).toBe('2024-03-18')
    })

    it('skips Sunday → returns Monday', () => {
      const rule: RecurrenceRule = { frequency: 'weekdays', interval: 1 }
      // 2024-03-10 is Sunday → next weekday is Monday 2024-03-11
      expect(getNextOccurrenceDate('2024-03-10', rule)).toBe('2024-03-11')
    })

    it('Monday → Tuesday', () => {
      const rule: RecurrenceRule = { frequency: 'weekdays', interval: 1 }
      expect(getNextOccurrenceDate('2024-03-11', rule)).toBe('2024-03-12')
    })
  })

  describe('weekly', () => {
    it('advances by 7 days when interval is 1', () => {
      const rule: RecurrenceRule = { frequency: 'weekly', interval: 1 }
      expect(getNextOccurrenceDate('2024-03-11', rule)).toBe('2024-03-18')
    })

    it('advances by 14 days when interval is 2', () => {
      const rule: RecurrenceRule = { frequency: 'weekly', interval: 2 }
      expect(getNextOccurrenceDate('2024-03-11', rule)).toBe('2024-03-25')
    })
  })

  describe('biweekly', () => {
    it('always advances by 14 days', () => {
      const rule: RecurrenceRule = { frequency: 'biweekly', interval: 1 }
      expect(getNextOccurrenceDate('2024-03-11', rule)).toBe('2024-03-25')
    })
  })

  describe('monthly', () => {
    it('advances by 1 month when interval is 1', () => {
      const rule: RecurrenceRule = { frequency: 'monthly', interval: 1 }
      expect(getNextOccurrenceDate('2024-03-11', rule)).toBe('2024-04-11')
    })

    it('advances by 3 months when interval is 3', () => {
      const rule: RecurrenceRule = { frequency: 'monthly', interval: 3 }
      expect(getNextOccurrenceDate('2024-03-11', rule)).toBe('2024-06-11')
    })
  })

  describe('end_date enforcement', () => {
    it('returns empty string when next date exceeds end_date', () => {
      const rule: RecurrenceRule = { frequency: 'daily', interval: 1, end_date: '2024-03-11' }
      // Next from 2024-03-11 would be 2024-03-12, which is after end_date
      expect(getNextOccurrenceDate('2024-03-11', rule)).toBe('')
    })

    it('returns date when next date is before end_date', () => {
      const rule: RecurrenceRule = { frequency: 'daily', interval: 1, end_date: '2024-12-31' }
      expect(getNextOccurrenceDate('2024-03-11', rule)).toBe('2024-03-12')
    })

    it('returns date when next date equals end_date', () => {
      const rule: RecurrenceRule = { frequency: 'daily', interval: 1, end_date: '2024-03-12' }
      expect(getNextOccurrenceDate('2024-03-11', rule)).toBe('2024-03-12')
    })
  })
})

// ─── isRecurrenceEnded ────────────────────────────────────────────────────────

describe('isRecurrenceEnded', () => {
  it('returns false when no end_date', () => {
    expect(isRecurrenceEnded({ frequency: 'daily', interval: 1 })).toBe(false)
  })

  it('returns true when end_date is in the past', () => {
    const rule: RecurrenceRule = { frequency: 'daily', interval: 1, end_date: '2024-01-01' }
    expect(isRecurrenceEnded(rule)).toBe(true)
  })

  it('returns false when end_date is in the future', () => {
    const rule: RecurrenceRule = { frequency: 'daily', interval: 1, end_date: '2024-12-31' }
    expect(isRecurrenceEnded(rule)).toBe(false)
  })

  it('returns true when end_date is today (now is past T23:59:59)', () => {
    // FIXED_NOW is 2024-03-11T12:00Z, end_date T23:59:59 is still in future
    const rule: RecurrenceRule = { frequency: 'daily', interval: 1, end_date: '2024-03-11' }
    expect(isRecurrenceEnded(rule)).toBe(false)
  })
})

// ─── getRecurrenceDescription ─────────────────────────────────────────────────

describe('getRecurrenceDescription', () => {
  it('daily interval 1 → "Every day"', () => {
    expect(getRecurrenceDescription({ frequency: 'daily', interval: 1 })).toBe('Every day')
  })

  it('daily interval 3 → "Every 3 days"', () => {
    expect(getRecurrenceDescription({ frequency: 'daily', interval: 3 })).toBe('Every 3 days')
  })

  it('weekdays → "Every weekday"', () => {
    expect(getRecurrenceDescription({ frequency: 'weekdays', interval: 1 })).toBe('Every weekday')
  })

  it('weekly interval 1 → "Every week"', () => {
    expect(getRecurrenceDescription({ frequency: 'weekly', interval: 1 })).toBe('Every week')
  })

  it('weekly interval 2 → "Every 2 weeks"', () => {
    expect(getRecurrenceDescription({ frequency: 'weekly', interval: 2 })).toBe('Every 2 weeks')
  })

  it('biweekly → "Every 2 weeks"', () => {
    expect(getRecurrenceDescription({ frequency: 'biweekly', interval: 1 })).toBe('Every 2 weeks')
  })

  it('monthly interval 1 → "Every month"', () => {
    expect(getRecurrenceDescription({ frequency: 'monthly', interval: 1 })).toBe('Every month')
  })

  it('monthly interval 3 → "Every 3 months"', () => {
    expect(getRecurrenceDescription({ frequency: 'monthly', interval: 3 })).toBe('Every 3 months')
  })

  it('missing interval defaults to 1', () => {
    expect(getRecurrenceDescription({ frequency: 'daily' } as RecurrenceRule)).toBe('Every day')
  })

  it('unknown frequency → "Recurring"', () => {
    expect(getRecurrenceDescription({ frequency: 'unknown' as never, interval: 1 })).toBe('Recurring')
  })
})

// ─── getRecurrenceLabel ───────────────────────────────────────────────────────

describe('getRecurrenceLabel', () => {
  it.each([
    ['daily', 'Daily'],
    ['weekdays', 'Weekdays'],
    ['weekly', 'Weekly'],
    ['biweekly', 'Biweekly'],
    ['monthly', 'Monthly'],
  ] as const)('%s → %s', (freq, label) => {
    expect(getRecurrenceLabel(freq)).toBe(label)
  })

  it('unknown frequency → "Custom"', () => {
    expect(getRecurrenceLabel('unknown' as never)).toBe('Custom')
  })
})

// ─── RECURRENCE_OPTIONS ───────────────────────────────────────────────────────

describe('RECURRENCE_OPTIONS', () => {
  it('contains all 5 frequency options', () => {
    expect(RECURRENCE_OPTIONS).toHaveLength(5)
    const values = RECURRENCE_OPTIONS.map(o => o.value)
    expect(values).toContain('daily')
    expect(values).toContain('weekdays')
    expect(values).toContain('weekly')
    expect(values).toContain('biweekly')
    expect(values).toContain('monthly')
  })

  it('each option has value, label, and description', () => {
    for (const opt of RECURRENCE_OPTIONS) {
      expect(opt.value).toBeTruthy()
      expect(opt.label).toBeTruthy()
      expect(opt.description).toBeTruthy()
    }
  })
})
