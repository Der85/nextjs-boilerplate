import { describe, it, expect } from 'vitest'
import {
  RENEGOTIATION_ACTIONS,
  RENEGOTIATION_REASONS,
  QUICK_RESCHEDULE_OPTIONS,
  SUPPORTIVE_COPY,
  isValidRenegotiationAction,
  isValidRenegotiationReasonCode,
  getActionConfig,
  getReasonConfig,
  formatDaysOverdue,
  getTaskStatusLabel,
  shouldShowPatternWarning,
  getPatternSuggestion,
  generateDefaultSubtasks,
  validateSubtasks,
  getRandomEncouragement,
  RENEGOTIATION_PATTERN_THRESHOLD,
} from '@/lib/types/renegotiation'
import {
  isTaskOverdue,
  getDaysOverdue,
  filterOverdueTasks,
  prepareRescheduleAction,
  prepareParkAction,
  prepareDropAction,
  prepareSplitAction,
  analyzeRenegotiationPattern,
  validateRenegotiationRequest,
  formatDateForDisplay,
  formatDateForAPI,
  type TaskForRenegotiation,
} from '@/lib/renegotiation-engine'

describe('Renegotiation Types', () => {
  describe('Constants', () => {
    it('has correct number of actions', () => {
      expect(RENEGOTIATION_ACTIONS).toHaveLength(4)
    })

    it('has all required actions', () => {
      const actionIds = RENEGOTIATION_ACTIONS.map(a => a.id)
      expect(actionIds).toContain('reschedule')
      expect(actionIds).toContain('split')
      expect(actionIds).toContain('park')
      expect(actionIds).toContain('drop')
    })

    it('has correct number of reasons', () => {
      expect(RENEGOTIATION_REASONS).toHaveLength(8)
    })

    it('has supportive messaging', () => {
      // Verify no punitive language
      const allText = JSON.stringify(SUPPORTIVE_COPY).toLowerCase()
      expect(allText).not.toContain('overdue')
      expect(allText).not.toContain('failed')
      expect(allText).not.toContain('missed')
      expect(allText).not.toContain('late')
    })

    it('has quick reschedule options', () => {
      expect(QUICK_RESCHEDULE_OPTIONS).toHaveLength(3)
      expect(QUICK_RESCHEDULE_OPTIONS[0].id).toBe('tomorrow')
    })
  })

  describe('Type Guards', () => {
    describe('isValidRenegotiationAction', () => {
      it('returns true for valid actions', () => {
        expect(isValidRenegotiationAction('reschedule')).toBe(true)
        expect(isValidRenegotiationAction('split')).toBe(true)
        expect(isValidRenegotiationAction('park')).toBe(true)
        expect(isValidRenegotiationAction('drop')).toBe(true)
      })

      it('returns false for invalid values', () => {
        expect(isValidRenegotiationAction('delete')).toBe(false)
        expect(isValidRenegotiationAction('')).toBe(false)
        expect(isValidRenegotiationAction(null)).toBe(false)
        expect(isValidRenegotiationAction(undefined)).toBe(false)
      })
    })

    describe('isValidRenegotiationReasonCode', () => {
      it('returns true for valid reasons', () => {
        expect(isValidRenegotiationReasonCode('underestimated')).toBe(true)
        expect(isValidRenegotiationReasonCode('low_energy')).toBe(true)
        expect(isValidRenegotiationReasonCode('other')).toBe(true)
      })

      it('returns false for invalid values', () => {
        expect(isValidRenegotiationReasonCode('lazy')).toBe(false)
        expect(isValidRenegotiationReasonCode('')).toBe(false)
      })
    })
  })

  describe('Utility Functions', () => {
    describe('getActionConfig', () => {
      it('returns correct config for valid action', () => {
        const config = getActionConfig('reschedule')
        expect(config.id).toBe('reschedule')
        expect(config.label).toBeTruthy()
        expect(config.icon).toBeTruthy()
      })

      it('returns first action as fallback', () => {
        const config = getActionConfig('invalid' as any)
        expect(config).toBeDefined()
      })
    })

    describe('getReasonConfig', () => {
      it('returns correct config for valid reason', () => {
        const config = getReasonConfig('underestimated')
        expect(config.code).toBe('underestimated')
        expect(config.label).toBeTruthy()
      })
    })

    describe('formatDaysOverdue', () => {
      it('handles zero days', () => {
        expect(formatDaysOverdue(0)).toBe('Due today')
      })

      it('handles one day', () => {
        expect(formatDaysOverdue(1)).toBe('Since yesterday')
      })

      it('handles multiple days', () => {
        expect(formatDaysOverdue(3)).toBe('3 days ago')
      })

      it('handles weeks', () => {
        expect(formatDaysOverdue(10)).toContain('week')
      })

      it('handles over a month', () => {
        expect(formatDaysOverdue(35)).toContain('month')
      })
    })

    describe('getTaskStatusLabel', () => {
      it('returns supportive label for overdue tasks', () => {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const result = getTaskStatusLabel('active', yesterday.toISOString().split('T')[0], 0)

        expect(result.label).toBe('Needs attention')
        expect(result.supportive).toBe(true)
        expect(result.color).not.toBe('#ef4444') // Not red
      })

      it('returns "Replanned" for renegotiated overdue tasks', () => {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const result = getTaskStatusLabel('active', yesterday.toISOString().split('T')[0], 2)

        expect(result.label).toBe('Replanned')
        expect(result.supportive).toBe(true)
      })

      it('returns standard label for completed tasks', () => {
        const result = getTaskStatusLabel('completed', null, 0)
        expect(result.label).toBe('Completed')
        expect(result.supportive).toBe(false)
      })
    })

    describe('getRandomEncouragement', () => {
      it('returns a string', () => {
        const message = getRandomEncouragement()
        expect(typeof message).toBe('string')
        expect(message.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Pattern Detection', () => {
    describe('shouldShowPatternWarning', () => {
      it('returns false below threshold', () => {
        expect(shouldShowPatternWarning(1)).toBe(false)
        expect(shouldShowPatternWarning(2)).toBe(false)
      })

      it('returns true at or above threshold', () => {
        expect(shouldShowPatternWarning(RENEGOTIATION_PATTERN_THRESHOLD)).toBe(true)
        expect(shouldShowPatternWarning(5)).toBe(true)
      })
    })

    describe('getPatternSuggestion', () => {
      it('suggests breaking down for underestimated', () => {
        const suggestion = getPatternSuggestion('underestimated', 3)
        expect(suggestion.toLowerCase()).toContain('smaller')
      })

      it('suggests energy scheduling for low energy', () => {
        const suggestion = getPatternSuggestion('low_energy', 3)
        expect(suggestion.toLowerCase()).toContain('energy')
      })

      it('suggests dropping for high count', () => {
        const suggestion = getPatternSuggestion('other', 6)
        expect(suggestion.toLowerCase()).toContain('drop')
      })
    })
  })

  describe('Subtask Validation', () => {
    describe('generateDefaultSubtasks', () => {
      it('generates correct number of subtasks', () => {
        const subtasks = generateDefaultSubtasks('Original task', 3)
        expect(subtasks).toHaveLength(3)
      })

      it('includes original title in subtask titles', () => {
        const subtasks = generateDefaultSubtasks('Build feature')
        expect(subtasks[0].title).toContain('Build feature')
      })

      it('sets default estimated minutes', () => {
        const subtasks = generateDefaultSubtasks('Task')
        expect(subtasks[0].estimated_minutes).toBe(30)
      })
    })

    describe('validateSubtasks', () => {
      it('validates correct subtasks', () => {
        const result = validateSubtasks([
          { title: 'Step 1', estimated_minutes: 30 },
          { title: 'Step 2', estimated_minutes: 30 },
        ])
        expect(result.valid).toBe(true)
      })

      it('rejects empty array', () => {
        const result = validateSubtasks([])
        expect(result.valid).toBe(false)
        expect(result.error).toContain('At least one')
      })

      it('rejects too many subtasks', () => {
        const subtasks = Array(11).fill({ title: 'Step', estimated_minutes: 30 })
        const result = validateSubtasks(subtasks)
        expect(result.valid).toBe(false)
        expect(result.error).toContain('Maximum')
      })

      it('rejects empty titles', () => {
        const result = validateSubtasks([
          { title: '', estimated_minutes: 30 },
        ])
        expect(result.valid).toBe(false)
        expect(result.error).toContain('title')
      })

      it('rejects too long titles', () => {
        const result = validateSubtasks([
          { title: 'a'.repeat(501), estimated_minutes: 30 },
        ])
        expect(result.valid).toBe(false)
        expect(result.error).toContain('500')
      })
    })
  })
})

describe('Renegotiation Engine', () => {
  const createTask = (overrides: Partial<TaskForRenegotiation> = {}): TaskForRenegotiation => ({
    id: 'task-1',
    title: 'Test task',
    due_date: null,
    status: 'active',
    renegotiation_count: 0,
    outcome_id: null,
    commitment_id: null,
    estimated_minutes: 60,
    ...overrides,
  })

  describe('isTaskOverdue', () => {
    it('returns false for tasks without due date', () => {
      const task = createTask({ due_date: null })
      expect(isTaskOverdue(task)).toBe(false)
    })

    it('returns false for completed tasks', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const task = createTask({
        due_date: yesterday.toISOString().split('T')[0],
        status: 'completed',
      })
      expect(isTaskOverdue(task)).toBe(false)
    })

    it('returns true for overdue active tasks', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const task = createTask({
        due_date: yesterday.toISOString().split('T')[0],
        status: 'active',
      })
      expect(isTaskOverdue(task)).toBe(true)
    })

    it('returns false for future due dates', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const task = createTask({
        due_date: tomorrow.toISOString().split('T')[0],
        status: 'active',
      })
      expect(isTaskOverdue(task)).toBe(false)
    })
  })

  describe('getDaysOverdue', () => {
    it('calculates correct days', () => {
      const fiveDaysAgo = new Date()
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
      const days = getDaysOverdue(fiveDaysAgo.toISOString().split('T')[0])
      expect(days).toBe(5)
    })

    it('returns 0 for future dates', () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const days = getDaysOverdue(tomorrow.toISOString().split('T')[0])
      expect(days).toBe(0)
    })
  })

  describe('filterOverdueTasks', () => {
    it('filters and sorts overdue tasks', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const twoDaysAgo = new Date()
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

      const tasks = [
        createTask({
          id: 'task-1',
          due_date: yesterday.toISOString().split('T')[0],
          status: 'active',
        }),
        createTask({
          id: 'task-2',
          due_date: twoDaysAgo.toISOString().split('T')[0],
          status: 'active',
        }),
        createTask({
          id: 'task-3',
          due_date: null,
          status: 'active',
        }),
        createTask({
          id: 'task-4',
          due_date: yesterday.toISOString().split('T')[0],
          status: 'completed',
        }),
      ]

      const overdue = filterOverdueTasks(tasks)
      expect(overdue).toHaveLength(2)
      expect(overdue[0].id).toBe('task-2') // Most overdue first
      expect(overdue[1].id).toBe('task-1')
    })
  })

  describe('Action Handlers', () => {
    describe('prepareRescheduleAction', () => {
      it('validates future date', () => {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        const result = prepareRescheduleAction(tomorrow.toISOString().split('T')[0])
        expect(result.success).toBe(true)
        expect(result.newStatus).toBe('active')
      })

      it('rejects past date', () => {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const result = prepareRescheduleAction(yesterday.toISOString().split('T')[0])
        expect(result.success).toBe(false)
        expect(result.error).toContain('past')
      })

      it('rejects invalid date', () => {
        const result = prepareRescheduleAction('not-a-date')
        expect(result.success).toBe(false)
        expect(result.error).toContain('Invalid')
      })
    })

    describe('prepareParkAction', () => {
      it('returns correct status', () => {
        const result = prepareParkAction()
        expect(result.success).toBe(true)
        expect(result.newStatus).toBe('parked')
        expect(result.newDueDate).toBeNull()
      })
    })

    describe('prepareDropAction', () => {
      it('returns correct status', () => {
        const result = prepareDropAction()
        expect(result.success).toBe(true)
        expect(result.newStatus).toBe('dropped')
        expect(result.newDueDate).toBeNull()
      })
    })

    describe('prepareSplitAction', () => {
      it('validates subtasks', () => {
        const task = createTask()
        const result = prepareSplitAction(task, [
          { title: 'Step 1' },
          { title: 'Step 2' },
        ])
        expect(result.success).toBe(true)
        expect(result.newStatus).toBe('completed')
      })

      it('rejects invalid subtasks', () => {
        const task = createTask()
        const result = prepareSplitAction(task, [])
        expect(result.success).toBe(false)
      })
    })
  })

  describe('Pattern Analysis', () => {
    describe('analyzeRenegotiationPattern', () => {
      it('detects no pattern for low count', () => {
        const result = analyzeRenegotiationPattern('task-1', 'Test', 1, ['underestimated'])
        expect(result.hasPattern).toBe(false)
      })

      it('detects pattern for high count', () => {
        const result = analyzeRenegotiationPattern(
          'task-1',
          'Test',
          5,
          ['underestimated', 'underestimated', 'low_energy', 'underestimated']
        )
        expect(result.hasPattern).toBe(true)
        expect(result.pattern?.most_common_reason).toBe('underestimated')
      })

      it('suggests appropriate actions based on reason', () => {
        const result = analyzeRenegotiationPattern(
          'task-1',
          'Test',
          3,
          ['underestimated', 'underestimated', 'underestimated']
        )
        expect(result.recommendedActions[0]).toBe('split')
      })
    })
  })

  describe('Request Validation', () => {
    describe('validateRenegotiationRequest', () => {
      it('validates correct request', () => {
        const result = validateRenegotiationRequest(
          'reschedule',
          'underestimated',
          '2024-12-31',
          undefined
        )
        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('rejects missing action', () => {
        const result = validateRenegotiationRequest(
          null,
          'underestimated',
          '2024-12-31',
          undefined
        )
        expect(result.valid).toBe(false)
        expect(result.errors).toContain('Action is required')
      })

      it('requires due date for reschedule', () => {
        const result = validateRenegotiationRequest(
          'reschedule',
          'underestimated',
          null,
          undefined
        )
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => e.includes('due date'))).toBe(true)
      })

      it('requires subtasks for split', () => {
        const result = validateRenegotiationRequest(
          'split',
          'underestimated',
          undefined,
          null
        )
        expect(result.valid).toBe(false)
        expect(result.errors.some(e => e.includes('Subtasks'))).toBe(true)
      })
    })
  })

  describe('Date Formatting', () => {
    describe('formatDateForDisplay', () => {
      it('formats date correctly', () => {
        const formatted = formatDateForDisplay(new Date(2024, 5, 15)) // June 15, 2024
        expect(formatted).toContain('Jun')
        expect(formatted).toContain('15')
      })
    })

    describe('formatDateForAPI', () => {
      it('formats date for API', () => {
        const formatted = formatDateForAPI(new Date(2024, 5, 15))
        expect(formatted).toBe('2024-06-15')
      })
    })
  })
})

describe('Copy Audit - No Punitive Language', () => {
  it('action labels avoid shaming words', () => {
    RENEGOTIATION_ACTIONS.forEach(action => {
      const text = `${action.label} ${action.description} ${action.supportiveMessage}`.toLowerCase()
      expect(text).not.toContain('fail')
      expect(text).not.toContain('overdue')
      expect(text).not.toContain('late')
      expect(text).not.toContain('behind')
      expect(text).not.toContain('slack')
    })
  })

  it('reason labels avoid blame', () => {
    RENEGOTIATION_REASONS.forEach(reason => {
      const text = reason.label.toLowerCase()
      expect(text).not.toContain('lazy')
      expect(text).not.toContain('procrastin')
      expect(text).not.toContain('fault')
    })
  })

  it('encouragement messages are supportive', () => {
    SUPPORTIVE_COPY.encouragement.forEach(msg => {
      const text = msg.toLowerCase()
      expect(text).not.toContain('should')
      expect(text).not.toContain('must')
      expect(text).not.toContain('fail')
    })
  })
})
