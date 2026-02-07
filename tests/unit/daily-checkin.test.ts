import { describe, it, expect } from 'vitest'
import {
  isValidCheckinScale,
  validateCheckinData,
  calculateSparklineData,
  type CheckinTrendPoint,
  THRESHOLDS,
} from '@/lib/types/daily-checkin'
import {
  evaluateTriggers,
  computeAdaptiveState,
  generateRecommendations,
  hasCheckedInToday,
  generateCorrelationInsights,
} from '@/lib/adaptive-engine'

describe('Daily Check-in Types', () => {
  describe('isValidCheckinScale', () => {
    it('returns true for valid scales (1-5)', () => {
      expect(isValidCheckinScale(1)).toBe(true)
      expect(isValidCheckinScale(2)).toBe(true)
      expect(isValidCheckinScale(3)).toBe(true)
      expect(isValidCheckinScale(4)).toBe(true)
      expect(isValidCheckinScale(5)).toBe(true)
    })

    it('returns false for invalid values', () => {
      expect(isValidCheckinScale(0)).toBe(false)
      expect(isValidCheckinScale(6)).toBe(false)
      expect(isValidCheckinScale(1.5)).toBe(false)
      expect(isValidCheckinScale(-1)).toBe(false)
      expect(isValidCheckinScale('3')).toBe(false)
      expect(isValidCheckinScale(null)).toBe(false)
      expect(isValidCheckinScale(undefined)).toBe(false)
    })
  })

  describe('validateCheckinData', () => {
    it('validates correct check-in data', () => {
      const result = validateCheckinData({
        overwhelm: 3,
        anxiety: 2,
        energy: 4,
        clarity: 5,
      })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('rejects invalid scale values', () => {
      const result = validateCheckinData({
        overwhelm: 0,
        anxiety: 6,
        energy: 4,
        clarity: 5,
      })
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('validates date format', () => {
      const validResult = validateCheckinData({
        overwhelm: 3,
        anxiety: 3,
        energy: 3,
        clarity: 3,
        date: '2024-01-15',
      })
      expect(validResult.valid).toBe(true)

      const invalidResult = validateCheckinData({
        overwhelm: 3,
        anxiety: 3,
        energy: 3,
        clarity: 3,
        date: '01-15-2024',
      })
      expect(invalidResult.valid).toBe(false)
    })
  })

  describe('calculateSparklineData', () => {
    const sampleTrend: CheckinTrendPoint[] = [
      { date: '2024-01-01', overwhelm: 2, anxiety: 3, energy: 4, clarity: 4 },
      { date: '2024-01-02', overwhelm: 3, anxiety: 3, energy: 3, clarity: 3 },
      { date: '2024-01-03', overwhelm: 4, anxiety: 4, energy: 2, clarity: 2 },
      { date: '2024-01-04', overwhelm: 3, anxiety: 2, energy: 3, clarity: 4 },
    ]

    it('calculates correct statistics', () => {
      const data = calculateSparklineData(sampleTrend, 'energy')
      expect(data.values).toEqual([4, 3, 2, 3])
      expect(data.min).toBe(2)
      expect(data.max).toBe(4)
      expect(data.average).toBe(3)
    })

    it('handles empty data', () => {
      const data = calculateSparklineData([], 'energy')
      expect(data.values).toEqual([])
      expect(data.trend).toBe('stable')
    })

    it('detects trends correctly', () => {
      const upTrend: CheckinTrendPoint[] = [
        { date: '2024-01-01', overwhelm: 1, anxiety: 1, energy: 2, clarity: 2 },
        { date: '2024-01-02', overwhelm: 1, anxiety: 1, energy: 3, clarity: 3 },
        { date: '2024-01-03', overwhelm: 1, anxiety: 1, energy: 4, clarity: 4 },
        { date: '2024-01-04', overwhelm: 1, anxiety: 1, energy: 5, clarity: 5 },
      ]
      expect(calculateSparklineData(upTrend, 'energy').trend).toBe('up')
    })
  })
})

describe('Adaptive Engine', () => {
  describe('evaluateTriggers', () => {
    it('detects high overwhelm trigger', () => {
      const triggers = evaluateTriggers({
        id: '1',
        user_id: 'u1',
        date: '2024-01-01',
        overwhelm: 4,
        anxiety: 2,
        energy: 4,
        clarity: 4,
        note: null,
        created_at: '',
        updated_at: '',
      })
      expect(triggers).toContain('high_overwhelm')
    })

    it('detects high anxiety trigger', () => {
      const triggers = evaluateTriggers({
        id: '1',
        user_id: 'u1',
        date: '2024-01-01',
        overwhelm: 2,
        anxiety: 5,
        energy: 4,
        clarity: 4,
        note: null,
        created_at: '',
        updated_at: '',
      })
      expect(triggers).toContain('high_anxiety')
    })

    it('detects low energy trigger', () => {
      const triggers = evaluateTriggers({
        id: '1',
        user_id: 'u1',
        date: '2024-01-01',
        overwhelm: 2,
        anxiety: 2,
        energy: 2,
        clarity: 4,
        note: null,
        created_at: '',
        updated_at: '',
      })
      expect(triggers).toContain('low_energy')
    })

    it('detects low clarity trigger', () => {
      const triggers = evaluateTriggers({
        id: '1',
        user_id: 'u1',
        date: '2024-01-01',
        overwhelm: 2,
        anxiety: 2,
        energy: 4,
        clarity: 1,
        note: null,
        created_at: '',
        updated_at: '',
      })
      expect(triggers).toContain('low_clarity')
    })

    it('detects combined stress', () => {
      const triggers = evaluateTriggers({
        id: '1',
        user_id: 'u1',
        date: '2024-01-01',
        overwhelm: 5,
        anxiety: 4,
        energy: 2,
        clarity: 2,
        note: null,
        created_at: '',
        updated_at: '',
      })
      expect(triggers).toContain('combined_stress')
    })

    it('returns empty array for null checkin', () => {
      expect(evaluateTriggers(null)).toEqual([])
    })

    it('returns empty array for neutral values', () => {
      const triggers = evaluateTriggers({
        id: '1',
        user_id: 'u1',
        date: '2024-01-01',
        overwhelm: 3,
        anxiety: 3,
        energy: 3,
        clarity: 3,
        note: null,
        created_at: '',
        updated_at: '',
      })
      expect(triggers).toEqual([])
    })
  })

  describe('computeAdaptiveState', () => {
    it('enables simplified UI for high stress', () => {
      const state = computeAdaptiveState({
        id: '1',
        user_id: 'u1',
        date: '2024-01-01',
        overwhelm: 5,
        anxiety: 4,
        energy: 2,
        clarity: 2,
        note: null,
        created_at: '',
        updated_at: '',
      })
      expect(state.simplifiedUIEnabled).toBe(true)
      expect(state.reducedTasksMode).toBe(true)
    })

    it('prioritizes short tasks for low energy', () => {
      const state = computeAdaptiveState({
        id: '1',
        user_id: 'u1',
        date: '2024-01-01',
        overwhelm: 2,
        anxiety: 2,
        energy: 1,
        clarity: 4,
        note: null,
        created_at: '',
        updated_at: '',
      })
      expect(state.prioritizeShortTasks).toBe(true)
    })

    it('shows planning micro-step for low clarity', () => {
      const state = computeAdaptiveState({
        id: '1',
        user_id: 'u1',
        date: '2024-01-01',
        overwhelm: 2,
        anxiety: 2,
        energy: 4,
        clarity: 1,
        note: null,
        created_at: '',
        updated_at: '',
      })
      expect(state.showPlanningMicroStep).toBe(true)
    })

    it('returns default state for null checkin', () => {
      const state = computeAdaptiveState(null)
      expect(state.simplifiedUIEnabled).toBe(false)
      expect(state.triggers).toEqual([])
    })
  })

  describe('generateRecommendations', () => {
    it('generates recommendations for high overwhelm', () => {
      const recommendations = generateRecommendations(['high_overwhelm'])
      expect(recommendations.length).toBeGreaterThan(0)
      expect(recommendations.some(r => r.id === 'reduce_scope')).toBe(true)
    })

    it('generates breathing recommendation for high anxiety', () => {
      const recommendations = generateRecommendations(['high_anxiety'])
      expect(recommendations.some(r => r.id === 'breathing')).toBe(true)
    })

    it('limits recommendations to 3', () => {
      const recommendations = generateRecommendations([
        'high_overwhelm',
        'high_anxiety',
        'low_energy',
        'low_clarity',
      ])
      expect(recommendations.length).toBeLessThanOrEqual(3)
    })
  })

  describe('hasCheckedInToday', () => {
    it('returns true for today\'s check-in', () => {
      const today = new Date().toISOString().split('T')[0]
      expect(hasCheckedInToday({ date: today })).toBe(true)
    })

    it('returns false for yesterday\'s check-in', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]
      expect(hasCheckedInToday({ date: yesterdayStr })).toBe(false)
    })

    it('returns false for null', () => {
      expect(hasCheckedInToday(null)).toBe(false)
    })
  })

  describe('generateCorrelationInsights', () => {
    it('requires minimum data for insights', () => {
      const insights = generateCorrelationInsights({
        high_overwhelm_avg_untriaged: 10,
        low_overwhelm_avg_untriaged: 3,
        high_energy_tasks_completed: 5,
        low_energy_tasks_completed: 1,
        total_checkins: 3, // Less than 5
      })
      expect(insights.some(i => i.id === 'need_more_data')).toBe(true)
    })

    it('detects overwhelm-untriaged correlation', () => {
      const insights = generateCorrelationInsights({
        high_overwhelm_avg_untriaged: 12,
        low_overwhelm_avg_untriaged: 5,
        high_energy_tasks_completed: 3,
        low_energy_tasks_completed: 2,
        total_checkins: 10,
      })
      expect(insights.some(i => i.id === 'overwhelm_untriaged')).toBe(true)
    })

    it('detects energy-productivity correlation', () => {
      const insights = generateCorrelationInsights({
        high_overwhelm_avg_untriaged: 5,
        low_overwhelm_avg_untriaged: 5,
        high_energy_tasks_completed: 6,
        low_energy_tasks_completed: 2,
        total_checkins: 10,
      })
      expect(insights.some(i => i.id === 'energy_productivity')).toBe(true)
    })
  })
})

describe('Threshold Constants', () => {
  it('has correct threshold values', () => {
    expect(THRESHOLDS.HIGH_OVERWHELM).toBe(4)
    expect(THRESHOLDS.HIGH_ANXIETY).toBe(4)
    expect(THRESHOLDS.LOW_ENERGY).toBe(2)
    expect(THRESHOLDS.LOW_CLARITY).toBe(2)
  })
})
