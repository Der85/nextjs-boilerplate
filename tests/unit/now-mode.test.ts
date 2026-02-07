import { describe, it, expect } from 'vitest'
import {
  isValidNowSlot,
  validatePinToNowMode,
  areAllSlotsCompleted,
  NOW_MODE_MAX_SLOTS,
  NOW_MODE_MAX_MINUTES,
  type NowSlot,
  type NowModeSlotState,
  type NowModePreferences,
} from '@/lib/types/now-mode'

describe('Now Mode Types', () => {
  describe('isValidNowSlot', () => {
    it('returns true for valid slots (1, 2, 3)', () => {
      expect(isValidNowSlot(1)).toBe(true)
      expect(isValidNowSlot(2)).toBe(true)
      expect(isValidNowSlot(3)).toBe(true)
    })

    it('returns false for invalid slots', () => {
      expect(isValidNowSlot(0)).toBe(false)
      expect(isValidNowSlot(4)).toBe(false)
      expect(isValidNowSlot(-1)).toBe(false)
      expect(isValidNowSlot('1')).toBe(false)
      expect(isValidNowSlot(null)).toBe(false)
      expect(isValidNowSlot(undefined)).toBe(false)
    })
  })

  describe('validatePinToNowMode', () => {
    const defaultPrefs: NowModePreferences = {
      now_mode_enabled: true,
      now_mode_strict_limit: true,
    }

    const validTask = {
      status: 'active',
      outcome_id: 'outcome-123',
      commitment_id: null,
      estimated_minutes: 30,
      now_slot: null,
    }

    it('allows pinning a valid linked task', () => {
      const result = validatePinToNowMode(validTask, 0, defaultPrefs)
      expect(result.canPin).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.warning).toBeUndefined()
    })

    it('rejects task already in Now Mode', () => {
      const task = { ...validTask, now_slot: 1 }
      const result = validatePinToNowMode(task, 1, defaultPrefs)
      expect(result.canPin).toBe(false)
      expect(result.error).toBe('Task is already in Now Mode')
    })

    it('rejects when all 3 slots are occupied (strict mode)', () => {
      const result = validatePinToNowMode(validTask, 3, defaultPrefs)
      expect(result.canPin).toBe(false)
      expect(result.error).toContain('All 3 Now Mode slots are occupied')
    })

    it('allows when all slots occupied but non-strict mode', () => {
      const nonStrictPrefs = { ...defaultPrefs, now_mode_strict_limit: false }
      const result = validatePinToNowMode(validTask, 3, nonStrictPrefs)
      expect(result.canPin).toBe(false) // Still can't pin, but warning instead of hard error
      expect(result.warning).toBeDefined()
    })

    it('rejects unlinked tasks', () => {
      const unlinkedTask = { ...validTask, outcome_id: null, commitment_id: null }
      const result = validatePinToNowMode(unlinkedTask, 0, defaultPrefs)
      expect(result.canPin).toBe(false)
      expect(result.error).toContain('linked to an Outcome or Commitment')
    })

    it('rejects completed tasks', () => {
      const completedTask = { ...validTask, status: 'completed' }
      const result = validatePinToNowMode(completedTask, 0, defaultPrefs)
      expect(result.canPin).toBe(false)
      expect(result.error).toBe('Cannot pin a completed task')
    })

    it('warns but allows tasks exceeding time limit', () => {
      const longTask = { ...validTask, estimated_minutes: 120 }
      const result = validatePinToNowMode(longTask, 0, defaultPrefs)
      expect(result.canPin).toBe(true)
      expect(result.warning).toContain(`exceeds ${NOW_MODE_MAX_MINUTES} min`)
    })

    it('allows tasks linked via commitment only', () => {
      const commitmentTask = { ...validTask, outcome_id: null, commitment_id: 'commit-123' }
      const result = validatePinToNowMode(commitmentTask, 0, defaultPrefs)
      expect(result.canPin).toBe(true)
    })
  })

  describe('areAllSlotsCompleted', () => {
    it('returns false for empty slots', () => {
      const slots: NowModeSlotState[] = [
        { slot: 1, task: null, isEmpty: true },
        { slot: 2, task: null, isEmpty: true },
        { slot: 3, task: null, isEmpty: true },
      ]
      expect(areAllSlotsCompleted(slots)).toBe(false)
    })

    it('returns false when some tasks are not completed', () => {
      const slots: NowModeSlotState[] = [
        {
          slot: 1,
          task: {
            id: '1',
            user_id: 'u1',
            task_name: 'Task 1',
            status: 'completed',
            now_slot: 1,
            estimated_minutes: null,
            due_date: null,
            outcome_id: 'o1',
            commitment_id: null,
          },
          isEmpty: false,
        },
        {
          slot: 2,
          task: {
            id: '2',
            user_id: 'u1',
            task_name: 'Task 2',
            status: 'active',
            now_slot: 2,
            estimated_minutes: null,
            due_date: null,
            outcome_id: 'o1',
            commitment_id: null,
          },
          isEmpty: false,
        },
        { slot: 3, task: null, isEmpty: true },
      ]
      expect(areAllSlotsCompleted(slots)).toBe(false)
    })

    it('returns true when all occupied slots are completed', () => {
      const slots: NowModeSlotState[] = [
        {
          slot: 1,
          task: {
            id: '1',
            user_id: 'u1',
            task_name: 'Task 1',
            status: 'completed',
            now_slot: 1,
            estimated_minutes: null,
            due_date: null,
            outcome_id: 'o1',
            commitment_id: null,
          },
          isEmpty: false,
        },
        {
          slot: 2,
          task: {
            id: '2',
            user_id: 'u1',
            task_name: 'Task 2',
            status: 'completed',
            now_slot: 2,
            estimated_minutes: null,
            due_date: null,
            outcome_id: 'o1',
            commitment_id: null,
          },
          isEmpty: false,
        },
        { slot: 3, task: null, isEmpty: true },
      ]
      expect(areAllSlotsCompleted(slots)).toBe(true)
    })
  })

  describe('Constants', () => {
    it('has correct max slots', () => {
      expect(NOW_MODE_MAX_SLOTS).toBe(3)
    })

    it('has correct max minutes', () => {
      expect(NOW_MODE_MAX_MINUTES).toBe(90)
    })
  })
})
