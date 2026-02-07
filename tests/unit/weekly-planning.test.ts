import { describe, it, expect } from 'vitest'
import {
  getISOWeekInfo,
  formatWeekRange,
  formatWeekLabel,
  isValidWeeklyPlanStatus,
  isValidDayOfWeek,
  isValidWizardStep,
  calculateCapacityAnalysis,
  generatePlanSummary,
  MAX_WEEKLY_OUTCOMES,
  DEFAULT_CAPACITY_MINUTES,
  OVERCOMMITMENT_THRESHOLD,
  WIZARD_STEPS,
  DAYS_OF_WEEK,
  type WeeklyPlan,
  type WeeklyPlanTask,
  type WeeklyPlanOutcome,
  type ISOWeekInfo,
} from '@/lib/types/weekly-planning'

describe('Weekly Planning Types', () => {
  describe('Constants', () => {
    it('has correct constant values', () => {
      expect(MAX_WEEKLY_OUTCOMES).toBe(3)
      expect(DEFAULT_CAPACITY_MINUTES).toBe(480)
      expect(OVERCOMMITMENT_THRESHOLD).toBe(1.2)
      expect(WIZARD_STEPS).toHaveLength(5)
      expect(DAYS_OF_WEEK).toHaveLength(7)
    })

    it('has correct wizard steps order', () => {
      expect(WIZARD_STEPS).toEqual(['review', 'outcomes', 'capacity', 'commit', 'summary'])
    })

    it('has correct days of week', () => {
      expect(DAYS_OF_WEEK[0]).toBe('Monday')
      expect(DAYS_OF_WEEK[6]).toBe('Sunday')
    })
  })

  describe('Type Guards', () => {
    describe('isValidWeeklyPlanStatus', () => {
      it('returns true for valid statuses', () => {
        expect(isValidWeeklyPlanStatus('draft')).toBe(true)
        expect(isValidWeeklyPlanStatus('committed')).toBe(true)
        expect(isValidWeeklyPlanStatus('completed')).toBe(true)
        expect(isValidWeeklyPlanStatus('abandoned')).toBe(true)
      })

      it('returns false for invalid values', () => {
        expect(isValidWeeklyPlanStatus('pending')).toBe(false)
        expect(isValidWeeklyPlanStatus('active')).toBe(false)
        expect(isValidWeeklyPlanStatus('')).toBe(false)
        expect(isValidWeeklyPlanStatus(null)).toBe(false)
        expect(isValidWeeklyPlanStatus(undefined)).toBe(false)
        expect(isValidWeeklyPlanStatus(123)).toBe(false)
      })
    })

    describe('isValidDayOfWeek', () => {
      it('returns true for valid days (0-6)', () => {
        expect(isValidDayOfWeek(0)).toBe(true)
        expect(isValidDayOfWeek(1)).toBe(true)
        expect(isValidDayOfWeek(6)).toBe(true)
      })

      it('returns false for invalid values', () => {
        expect(isValidDayOfWeek(-1)).toBe(false)
        expect(isValidDayOfWeek(7)).toBe(false)
        expect(isValidDayOfWeek(0.5)).toBe(false)
        expect(isValidDayOfWeek('0')).toBe(false)
        expect(isValidDayOfWeek(null)).toBe(false)
      })
    })

    describe('isValidWizardStep', () => {
      it('returns true for valid steps', () => {
        expect(isValidWizardStep('review')).toBe(true)
        expect(isValidWizardStep('outcomes')).toBe(true)
        expect(isValidWizardStep('capacity')).toBe(true)
        expect(isValidWizardStep('commit')).toBe(true)
        expect(isValidWizardStep('summary')).toBe(true)
      })

      it('returns false for invalid values', () => {
        expect(isValidWizardStep('start')).toBe(false)
        expect(isValidWizardStep('finish')).toBe(false)
        expect(isValidWizardStep('')).toBe(false)
        expect(isValidWizardStep(null)).toBe(false)
      })
    })
  })

  describe('ISO Week Utilities', () => {
    describe('getISOWeekInfo', () => {
      it('returns correct structure', () => {
        const info = getISOWeekInfo()
        expect(info).toHaveProperty('week_number')
        expect(info).toHaveProperty('year')
        expect(info).toHaveProperty('week_start')
        expect(info).toHaveProperty('week_end')
        expect(typeof info.week_number).toBe('number')
        expect(typeof info.year).toBe('number')
        expect(info.week_start).toBeInstanceOf(Date)
        expect(info.week_end).toBeInstanceOf(Date)
      })

      it('week_number is between 1 and 53', () => {
        const info = getISOWeekInfo()
        expect(info.week_number).toBeGreaterThanOrEqual(1)
        expect(info.week_number).toBeLessThanOrEqual(53)
      })

      it('week_start is a Monday', () => {
        const info = getISOWeekInfo()
        expect(info.week_start.getDay()).toBe(1) // 1 = Monday
      })

      it('week_end is 6 days after week_start', () => {
        const info = getISOWeekInfo()
        const diff = info.week_end.getTime() - info.week_start.getTime()
        const daysDiff = Math.round(diff / (1000 * 60 * 60 * 24))
        expect(daysDiff).toBe(6)
      })

      it('handles specific dates correctly', () => {
        // Test a known date: Jan 1, 2024 is Week 1 of 2024
        const jan1 = new Date(2024, 0, 1)
        const info = getISOWeekInfo(jan1)
        expect(info.week_number).toBe(1)
        expect(info.year).toBe(2024)
      })
    })

    describe('formatWeekRange', () => {
      it('formats week range correctly', () => {
        const info: ISOWeekInfo = {
          week_number: 10,
          year: 2024,
          week_start: new Date(2024, 2, 4), // Mar 4
          week_end: new Date(2024, 2, 10), // Mar 10
        }
        const range = formatWeekRange(info)
        expect(range).toContain('Mar')
        expect(range).toContain('4')
        expect(range).toContain('10')
      })
    })

    describe('formatWeekLabel', () => {
      it('formats week label correctly', () => {
        const info: ISOWeekInfo = {
          week_number: 10,
          year: 2024,
          week_start: new Date(2024, 2, 4),
          week_end: new Date(2024, 2, 10),
        }
        const label = formatWeekLabel(info)
        expect(label).toBe('Week 10, 2024')
      })
    })
  })

  describe('Capacity Analysis', () => {
    const createTask = (minutes: number, day: number | null = null): WeeklyPlanTask => ({
      id: crypto.randomUUID(),
      weekly_plan_id: 'plan-1',
      task_id: crypto.randomUUID(),
      scheduled_day: day as 0 | 1 | 2 | 3 | 4 | 5 | 6 | null,
      estimated_minutes: minutes,
      priority_rank: 0,
      created_at: new Date().toISOString(),
    })

    describe('calculateCapacityAnalysis', () => {
      it('calculates total planned minutes', () => {
        const tasks = [
          createTask(60),
          createTask(90),
          createTask(30),
        ]
        const analysis = calculateCapacityAnalysis(tasks, 480)
        expect(analysis.totalPlannedMinutes).toBe(180)
      })

      it('calculates utilization percentage correctly', () => {
        const tasks = [createTask(240)] // 4 hours
        const analysis = calculateCapacityAnalysis(tasks, 480) // 8 hours available
        expect(analysis.utilizationPercent).toBe(50)
      })

      it('detects overcommitment', () => {
        const tasks = [createTask(600)] // 10 hours
        const analysis = calculateCapacityAnalysis(tasks, 480) // 8 hours available
        expect(analysis.isOvercommitted).toBe(true)
      })

      it('handles empty task list', () => {
        const analysis = calculateCapacityAnalysis([], 480)
        expect(analysis.totalPlannedMinutes).toBe(0)
        expect(analysis.utilizationPercent).toBe(0)
        expect(analysis.isOvercommitted).toBe(false)
      })

      it('handles zero available minutes', () => {
        const tasks = [createTask(60)]
        const analysis = calculateCapacityAnalysis(tasks, 0)
        expect(analysis.utilizationPercent).toBe(0)
      })

      it('groups tasks by day correctly', () => {
        const tasks = [
          createTask(60, 0), // Monday
          createTask(90, 0), // Monday
          createTask(30, 2), // Wednesday
        ]
        const analysis = calculateCapacityAnalysis(tasks, 480)

        expect(analysis.dayBreakdown[0].totalMinutes).toBe(150) // Monday
        expect(analysis.dayBreakdown[1].totalMinutes).toBe(0)   // Tuesday
        expect(analysis.dayBreakdown[2].totalMinutes).toBe(30)  // Wednesday
      })

      it('generates overcommitment warning', () => {
        const tasks = [createTask(600)] // 10 hours
        const analysis = calculateCapacityAnalysis(tasks, 480) // 8 hours

        const overWarning = analysis.warnings.find(w => w.type === 'overcommitted')
        expect(overWarning).toBeDefined()
        expect(overWarning?.severity).toBe('error')
      })

      it('generates slight overcommitment warning', () => {
        const tasks = [createTask(500)] // Just over 8 hours but under 120%
        const analysis = calculateCapacityAnalysis(tasks, 480)

        const overWarning = analysis.warnings.find(w => w.type === 'overcommitted')
        expect(overWarning).toBeDefined()
        expect(overWarning?.severity).toBe('warning')
      })

      it('generates unbalanced day warning', () => {
        const tasks = [
          createTask(300, 0), // 5 hours on Monday
          createTask(30, 1),  // 30 min on Tuesday
          createTask(30, 2),  // 30 min on Wednesday
        ]
        const analysis = calculateCapacityAnalysis(tasks, 480)

        const unbalancedWarning = analysis.warnings.find(w => w.type === 'unbalanced')
        expect(unbalancedWarning).toBeDefined()
        expect(unbalancedWarning?.message).toContain('Monday')
      })

      it('generates no buffer warning', () => {
        const tasks = [createTask(460)] // 96% of 480
        const analysis = calculateCapacityAnalysis(tasks, 480)

        const bufferWarning = analysis.warnings.find(w => w.type === 'no_buffer')
        expect(bufferWarning).toBeDefined()
      })
    })
  })

  describe('Summary Generation', () => {
    const mockPlan: WeeklyPlan = {
      id: 'plan-1',
      user_id: 'user-1',
      week_number: 10,
      year: 2024,
      version: 1,
      status: 'committed',
      available_capacity_minutes: 480,
      planned_capacity_minutes: 240,
      previous_week_reflection: null,
      wins: null,
      learnings: null,
      summary_markdown: null,
      committed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const mockOutcomes: WeeklyPlanOutcome[] = [
      {
        id: 'po-1',
        weekly_plan_id: 'plan-1',
        outcome_id: 'o-1',
        priority_rank: 1,
        notes: null,
        created_at: new Date().toISOString(),
        outcome: {
          id: 'o-1',
          title: 'Launch MVP',
          description: null,
          horizon: 'monthly',
          status: 'active',
        },
      },
    ]

    const mockTasks: WeeklyPlanTask[] = [
      {
        id: 'pt-1',
        weekly_plan_id: 'plan-1',
        task_id: 't-1',
        scheduled_day: 0,
        estimated_minutes: 120,
        priority_rank: 1,
        created_at: new Date().toISOString(),
        task: {
          id: 't-1',
          title: 'Complete API design',
          status: 'active',
          outcome_id: 'o-1',
          commitment_id: null,
        },
      },
    ]

    const mockWeekInfo: ISOWeekInfo = {
      week_number: 10,
      year: 2024,
      week_start: new Date(2024, 2, 4),
      week_end: new Date(2024, 2, 10),
    }

    describe('generatePlanSummary', () => {
      it('generates markdown summary', () => {
        const summary = generatePlanSummary(mockPlan, mockOutcomes, mockTasks, mockWeekInfo)

        expect(typeof summary).toBe('string')
        expect(summary.length).toBeGreaterThan(0)
      })

      it('includes week information', () => {
        const summary = generatePlanSummary(mockPlan, mockOutcomes, mockTasks, mockWeekInfo)

        expect(summary).toContain('Week 10')
      })

      it('includes outcomes section', () => {
        const summary = generatePlanSummary(mockPlan, mockOutcomes, mockTasks, mockWeekInfo)

        expect(summary).toContain('Focus Outcomes')
        expect(summary).toContain('Launch MVP')
      })

      it('includes capacity section', () => {
        const summary = generatePlanSummary(mockPlan, mockOutcomes, mockTasks, mockWeekInfo)

        expect(summary).toContain('Capacity')
        expect(summary).toContain('Available')
        expect(summary).toContain('Planned')
      })

      it('includes daily plan section', () => {
        const summary = generatePlanSummary(mockPlan, mockOutcomes, mockTasks, mockWeekInfo)

        expect(summary).toContain('Daily Plan')
        expect(summary).toContain('Monday')
        expect(summary).toContain('Complete API design')
      })

      it('handles empty outcomes', () => {
        const summary = generatePlanSummary(mockPlan, [], mockTasks, mockWeekInfo)

        expect(summary).toContain('No outcomes selected')
      })

      it('handles unscheduled tasks', () => {
        const unscheduledTasks: WeeklyPlanTask[] = [
          {
            ...mockTasks[0],
            scheduled_day: null,
          },
        ]
        const summary = generatePlanSummary(mockPlan, mockOutcomes, unscheduledTasks, mockWeekInfo)

        expect(summary).toContain('Flexible')
      })
    })
  })
})

describe('Week Number Edge Cases', () => {
  it('handles year boundary correctly (Dec 31 might be Week 1 of next year)', () => {
    // Dec 31, 2024 is actually in ISO week 1 of 2025
    const dec31 = new Date(2024, 11, 31)
    const info = getISOWeekInfo(dec31)
    // This should be week 1 of 2025, not week 53 of 2024
    expect(info.week_number).toBe(1)
    expect(info.year).toBe(2025)
  })

  it('handles year boundary correctly (Jan 1 might be Week 52/53 of previous year)', () => {
    // Jan 1, 2021 was a Friday, so it's in week 53 of 2020
    const jan1_2021 = new Date(2021, 0, 1)
    const info = getISOWeekInfo(jan1_2021)
    expect(info.week_number).toBe(53)
    expect(info.year).toBe(2020)
  })
})
