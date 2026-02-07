import { describe, it, expect } from 'vitest'
import {
  isValidOutcomeHorizon,
  isValidOutcomeStatus,
  isValidCommitmentStatus,
  isValidTaskLinkStatus,
  isValidUUID,
  HORIZON_LABELS,
  HORIZON_COLORS,
  STATUS_LABELS,
} from '@/lib/types/outcomes'

describe('Outcome Type Guards', () => {
  describe('isValidOutcomeHorizon', () => {
    it('accepts valid horizons', () => {
      expect(isValidOutcomeHorizon('weekly')).toBe(true)
      expect(isValidOutcomeHorizon('monthly')).toBe(true)
      expect(isValidOutcomeHorizon('quarterly')).toBe(true)
    })

    it('rejects invalid horizons', () => {
      expect(isValidOutcomeHorizon('daily')).toBe(false)
      expect(isValidOutcomeHorizon('yearly')).toBe(false)
      expect(isValidOutcomeHorizon('')).toBe(false)
      expect(isValidOutcomeHorizon(null)).toBe(false)
      expect(isValidOutcomeHorizon(undefined)).toBe(false)
      expect(isValidOutcomeHorizon(123)).toBe(false)
    })
  })

  describe('isValidOutcomeStatus', () => {
    it('accepts valid statuses', () => {
      expect(isValidOutcomeStatus('active')).toBe(true)
      expect(isValidOutcomeStatus('paused')).toBe(true)
      expect(isValidOutcomeStatus('completed')).toBe(true)
      expect(isValidOutcomeStatus('archived')).toBe(true)
    })

    it('rejects invalid statuses', () => {
      expect(isValidOutcomeStatus('deleted')).toBe(false)
      expect(isValidOutcomeStatus('draft')).toBe(false)
      expect(isValidOutcomeStatus('')).toBe(false)
      expect(isValidOutcomeStatus(null)).toBe(false)
    })
  })

  describe('isValidCommitmentStatus', () => {
    it('accepts valid commitment statuses', () => {
      expect(isValidCommitmentStatus('active')).toBe(true)
      expect(isValidCommitmentStatus('paused')).toBe(true)
      expect(isValidCommitmentStatus('completed')).toBe(true)
      expect(isValidCommitmentStatus('archived')).toBe(true)
    })

    it('rejects invalid commitment statuses', () => {
      expect(isValidCommitmentStatus('pending')).toBe(false)
      expect(isValidCommitmentStatus('')).toBe(false)
    })
  })

  describe('isValidTaskLinkStatus', () => {
    it('accepts all valid task link statuses including needs_linking', () => {
      expect(isValidTaskLinkStatus('active')).toBe(true)
      expect(isValidTaskLinkStatus('completed')).toBe(true)
      expect(isValidTaskLinkStatus('parked')).toBe(true)
      expect(isValidTaskLinkStatus('needs_linking')).toBe(true)
    })

    it('rejects invalid task statuses', () => {
      expect(isValidTaskLinkStatus('todo')).toBe(false)
      expect(isValidTaskLinkStatus('in_progress')).toBe(false)
      expect(isValidTaskLinkStatus('')).toBe(false)
    })
  })

  describe('isValidUUID', () => {
    it('accepts valid UUIDs', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
      expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true)
      expect(isValidUUID('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true)
    })

    it('rejects invalid UUIDs', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false)
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false)
      expect(isValidUUID('550e8400e29b41d4a716446655440000')).toBe(false)
      expect(isValidUUID('')).toBe(false)
      expect(isValidUUID(null)).toBe(false)
      expect(isValidUUID(123)).toBe(false)
    })
  })
})

describe('Outcome Constants', () => {
  describe('HORIZON_LABELS', () => {
    it('has labels for all horizons', () => {
      expect(HORIZON_LABELS.weekly).toBe('Weekly')
      expect(HORIZON_LABELS.monthly).toBe('Monthly')
      expect(HORIZON_LABELS.quarterly).toBe('Quarterly')
    })
  })

  describe('HORIZON_COLORS', () => {
    it('has colors for all horizons', () => {
      expect(HORIZON_COLORS.weekly).toBeDefined()
      expect(HORIZON_COLORS.monthly).toBeDefined()
      expect(HORIZON_COLORS.quarterly).toBeDefined()
    })

    it('colors are valid hex codes', () => {
      const hexColorRegex = /^#[0-9a-fA-F]{6}$/
      expect(hexColorRegex.test(HORIZON_COLORS.weekly)).toBe(true)
      expect(hexColorRegex.test(HORIZON_COLORS.monthly)).toBe(true)
      expect(hexColorRegex.test(HORIZON_COLORS.quarterly)).toBe(true)
    })
  })

  describe('STATUS_LABELS', () => {
    it('has labels for all statuses', () => {
      expect(STATUS_LABELS.active).toBe('Active')
      expect(STATUS_LABELS.paused).toBe('Paused')
      expect(STATUS_LABELS.completed).toBe('Completed')
      expect(STATUS_LABELS.archived).toBe('Archived')
    })
  })
})
