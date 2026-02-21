import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  daysAgo,
  fourteenDaysAgo,
  computeCategoryStats,
  computeExtendedCategoryStats,
  type TaskWithCategory,
} from '@/lib/utils/taskStats'

// ============================================
// Fixtures
// ============================================

const makeCategory = (id: string, name: string) => ({
  id,
  name,
  icon: '📋',
  color: '#000',
})

const makeTask = (overrides: Partial<TaskWithCategory>): TaskWithCategory => ({
  id: 'task-1',
  status: 'active',
  category_id: 'cat-1',
  completed_at: null,
  dropped_at: null,
  skipped_at: null,
  created_at: new Date('2024-01-01').toISOString(),
  category: makeCategory('cat-1', 'Work'),
  ...overrides,
})

// ============================================
// daysAgo
// ============================================

describe('daysAgo', () => {
  it('returns today for 0 days', () => {
    const result = daysAgo(0)
    const today = new Date().toISOString().split('T')[0]
    expect(result.startsWith(today)).toBe(true)
  })

  it('returns a date 7 days in the past', () => {
    const result = new Date(daysAgo(7))
    const expected = new Date()
    expected.setDate(expected.getDate() - 7)
    expect(result.toDateString()).toBe(expected.toDateString())
  })

  it('returns an ISO string', () => {
    const result = daysAgo(1)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

// ============================================
// fourteenDaysAgo
// ============================================

describe('fourteenDaysAgo', () => {
  it('returns a date 14 days in the past', () => {
    const result = new Date(fourteenDaysAgo())
    const expected = new Date()
    expected.setDate(expected.getDate() - 14)
    expect(result.toDateString()).toBe(expected.toDateString())
  })
})

// ============================================
// computeCategoryStats
// ============================================

describe('computeCategoryStats', () => {
  it('returns empty array for no tasks', () => {
    expect(computeCategoryStats([])).toEqual([])
  })

  it('skips tasks with no category', () => {
    const task = makeTask({ category_id: null, category: null })
    expect(computeCategoryStats([task])).toEqual([])
  })

  it('counts total tasks per category', () => {
    const tasks = [
      makeTask({ id: '1' }),
      makeTask({ id: '2' }),
    ]
    const stats = computeCategoryStats(tasks)
    expect(stats).toHaveLength(1)
    expect(stats[0].totalTasks).toBe(2)
  })

  it('counts completed tasks', () => {
    const tasks = [
      makeTask({ id: '1', status: 'done', completed_at: new Date('2024-01-03').toISOString() }),
      makeTask({ id: '2', status: 'active' }),
    ]
    const stats = computeCategoryStats(tasks)
    expect(stats[0].completedTasks).toBe(1)
  })

  it('counts dropped tasks', () => {
    const tasks = [makeTask({ status: 'dropped' })]
    const stats = computeCategoryStats(tasks)
    expect(stats[0].droppedCount).toBe(1)
    expect(stats[0].completedTasks).toBe(0)
  })

  it('counts skipped tasks', () => {
    const tasks = [makeTask({ status: 'skipped' })]
    const stats = computeCategoryStats(tasks)
    expect(stats[0].skippedCount).toBe(1)
  })

  it('calculates completion rate correctly', () => {
    const tasks = [
      makeTask({ id: '1', status: 'done', completed_at: new Date('2024-01-03').toISOString() }),
      makeTask({ id: '2', status: 'done', completed_at: new Date('2024-01-04').toISOString() }),
      makeTask({ id: '3', status: 'active' }),
      makeTask({ id: '4', status: 'active' }),
    ]
    const stats = computeCategoryStats(tasks)
    expect(stats[0].completionRate).toBe(0.5)
  })

  it('returns 0 completion rate when no tasks', () => {
    // Edge: category_id null skips, so pass a task with uncategorized
    expect(computeCategoryStats([])[0]).toBeUndefined()
  })

  it('calculates avgDaysToComplete', () => {
    const tasks = [
      makeTask({
        id: '1',
        status: 'done',
        created_at: new Date('2024-01-01').toISOString(),
        completed_at: new Date('2024-01-03').toISOString(), // 2 days
      }),
      makeTask({
        id: '2',
        status: 'done',
        created_at: new Date('2024-01-01').toISOString(),
        completed_at: new Date('2024-01-05').toISOString(), // 4 days
      }),
    ]
    const stats = computeCategoryStats(tasks)
    expect(stats[0].avgDaysToComplete).toBe(3) // (2 + 4) / 2
  })

  it('returns null avgDaysToComplete when no completed tasks', () => {
    const tasks = [makeTask({ status: 'active' })]
    const stats = computeCategoryStats(tasks)
    expect(stats[0].avgDaysToComplete).toBeNull()
  })

  it('groups tasks by category correctly', () => {
    const tasks = [
      makeTask({ id: '1', category_id: 'cat-1', category: makeCategory('cat-1', 'Work') }),
      makeTask({ id: '2', category_id: 'cat-2', category: makeCategory('cat-2', 'Health') }),
      makeTask({ id: '3', category_id: 'cat-1', category: makeCategory('cat-1', 'Work') }),
    ]
    const stats = computeCategoryStats(tasks)
    expect(stats).toHaveLength(2)
    const work = stats.find(s => s.categoryName === 'Work')
    const health = stats.find(s => s.categoryName === 'Health')
    expect(work?.totalTasks).toBe(2)
    expect(health?.totalTasks).toBe(1)
  })

  it('ignores done tasks with no completed_at date', () => {
    // status=done but completed_at=null should not count as completed
    const tasks = [makeTask({ status: 'done', completed_at: null })]
    const stats = computeCategoryStats(tasks)
    expect(stats[0].completedTasks).toBe(0)
  })
})

// ============================================
// computeExtendedCategoryStats
// ============================================

describe('computeExtendedCategoryStats', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns lastCompletedDaysAgo as null when no completed tasks', () => {
    const tasks = [makeTask({ status: 'active' })]
    const stats = computeExtendedCategoryStats(tasks)
    expect(stats[0].lastCompletedDaysAgo).toBeNull()
  })

  it('calculates lastCompletedDaysAgo correctly', () => {
    const tasks = [
      makeTask({
        status: 'done',
        completed_at: new Date('2024-01-10').toISOString(), // 5 days ago from Jan 15
      }),
    ]
    const stats = computeExtendedCategoryStats(tasks)
    expect(stats[0].lastCompletedDaysAgo).toBe(5)
  })

  it('uses the most recent completion date when there are multiple', () => {
    const tasks = [
      makeTask({
        id: '1',
        status: 'done',
        completed_at: new Date('2024-01-05').toISOString(), // 10 days ago
      }),
      makeTask({
        id: '2',
        status: 'done',
        completed_at: new Date('2024-01-12').toISOString(), // 3 days ago
      }),
    ]
    const stats = computeExtendedCategoryStats(tasks)
    expect(stats[0].lastCompletedDaysAgo).toBe(3)
  })

  it('includes standard CategoryStats fields', () => {
    const tasks = [makeTask({ status: 'active' })]
    const stats = computeExtendedCategoryStats(tasks)
    expect(stats[0]).toMatchObject({
      categoryId: 'cat-1',
      categoryName: 'Work',
      totalTasks: 1,
      completedTasks: 0,
      completionRate: 0,
      droppedCount: 0,
      skippedCount: 0,
      avgDaysToComplete: null,
    })
  })
})
