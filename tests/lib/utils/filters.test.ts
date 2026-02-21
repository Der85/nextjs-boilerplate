import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  applyFilters,
  filtersToSearchParams,
  searchParamsToFilters,
  addSavedView,
  deleteSavedView,
  updateSavedView,
  hasActiveFilters,
  countActiveFilters,
  filtersMatchView,
  DEFAULT_FILTERS,
  SYSTEM_VIEWS,
  MAX_CUSTOM_VIEWS,
  type TaskFilters,
  type SavedView,
} from '@/lib/utils/filters'
import type { TaskWithCategory } from '@/lib/types'

// ============================================
// Fixtures
// ============================================

const makeTask = (overrides: Partial<TaskWithCategory> = {}): TaskWithCategory => ({
  id: 'task-1',
  user_id: 'user-1',
  dump_id: null,
  category_id: 'cat-1',
  title: 'Test task',
  status: 'active',
  priority: 'medium',
  due_date: null,
  due_time: null,
  notes: null,
  is_recurring: false,
  recurrence_rule: null,
  position: 0,
  completed_at: null,
  dropped_at: null,
  skipped_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  category: { id: 'cat-1', name: 'Work', icon: '💼', color: '#000' },
  ...overrides,
})

const makeView = (overrides: Partial<SavedView> = {}): SavedView => ({
  id: 'view-1',
  name: 'My View',
  filters: { ...DEFAULT_FILTERS },
  isSystem: false,
  createdAt: new Date().toISOString(),
  ...overrides,
})

// ============================================
// applyFilters
// ============================================

describe('applyFilters', () => {
  it('returns all tasks when no filters are active', () => {
    const tasks = [makeTask({ id: '1' }), makeTask({ id: '2' })]
    expect(applyFilters(tasks, DEFAULT_FILTERS)).toHaveLength(2)
  })

  it('filters by category', () => {
    const tasks = [
      makeTask({ id: '1', category_id: 'cat-1' }),
      makeTask({ id: '2', category_id: 'cat-2' }),
    ]
    const filters: TaskFilters = { ...DEFAULT_FILTERS, categories: ['cat-1'] }
    const result = applyFilters(tasks, filters)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('treats null category_id as "uncategorized"', () => {
    const tasks = [makeTask({ category_id: null })]
    const filters: TaskFilters = { ...DEFAULT_FILTERS, categories: ['uncategorized'] }
    expect(applyFilters(tasks, filters)).toHaveLength(1)
  })

  it('filters by status', () => {
    const tasks = [
      makeTask({ id: '1', status: 'active' }),
      makeTask({ id: '2', status: 'done' }),
      makeTask({ id: '3', status: 'dropped' }),
    ]
    const filters: TaskFilters = { ...DEFAULT_FILTERS, statuses: ['done'] }
    const result = applyFilters(tasks, filters)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('2')
  })

  it('filters by multiple statuses (OR logic)', () => {
    const tasks = [
      makeTask({ id: '1', status: 'active' }),
      makeTask({ id: '2', status: 'done' }),
      makeTask({ id: '3', status: 'dropped' }),
    ]
    const filters: TaskFilters = { ...DEFAULT_FILTERS, statuses: ['done', 'dropped'] }
    expect(applyFilters(tasks, filters)).toHaveLength(2)
  })

  it('filters by priority', () => {
    const tasks = [
      makeTask({ id: '1', priority: 'high' }),
      makeTask({ id: '2', priority: 'low' }),
    ]
    const filters: TaskFilters = { ...DEFAULT_FILTERS, priorities: ['high'] }
    const result = applyFilters(tasks, filters)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('filters out tasks with null priority when priority filter is active', () => {
    const tasks = [makeTask({ priority: undefined })]
    const filters: TaskFilters = { ...DEFAULT_FILTERS, priorities: ['high'] }
    expect(applyFilters(tasks, filters)).toHaveLength(0)
  })

  it('filters by recurring = true', () => {
    const tasks = [
      makeTask({ id: '1', is_recurring: true }),
      makeTask({ id: '2', is_recurring: false }),
    ]
    const filters: TaskFilters = { ...DEFAULT_FILTERS, isRecurring: true }
    const result = applyFilters(tasks, filters)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('filters by recurring = false', () => {
    const tasks = [
      makeTask({ id: '1', is_recurring: true }),
      makeTask({ id: '2', is_recurring: false }),
    ]
    const filters: TaskFilters = { ...DEFAULT_FILTERS, isRecurring: false }
    expect(applyFilters(tasks, filters)).toHaveLength(1)
    expect(applyFilters(tasks, filters)[0].id).toBe('2')
  })

  it('does not filter recurring when isRecurring is null', () => {
    const tasks = [
      makeTask({ id: '1', is_recurring: true }),
      makeTask({ id: '2', is_recurring: false }),
    ]
    const filters: TaskFilters = { ...DEFAULT_FILTERS, isRecurring: null }
    expect(applyFilters(tasks, filters)).toHaveLength(2)
  })

  it('filters by dueRange = no_date', () => {
    const tasks = [
      makeTask({ id: '1', due_date: null }),
      makeTask({ id: '2', due_date: '2099-01-01' }),
    ]
    const filters: TaskFilters = { ...DEFAULT_FILTERS, dueRange: 'no_date' }
    const result = applyFilters(tasks, filters)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('combines multiple filters with AND logic', () => {
    const tasks = [
      makeTask({ id: '1', status: 'active', priority: 'high', category_id: 'cat-1' }),
      makeTask({ id: '2', status: 'done', priority: 'high', category_id: 'cat-1' }),
      makeTask({ id: '3', status: 'active', priority: 'low', category_id: 'cat-1' }),
    ]
    const filters: TaskFilters = {
      ...DEFAULT_FILTERS,
      statuses: ['active'],
      priorities: ['high'],
    }
    const result = applyFilters(tasks, filters)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })
})

// ============================================
// filtersToSearchParams / searchParamsToFilters
// ============================================

describe('filtersToSearchParams', () => {
  it('returns empty params for default filters', () => {
    const params = filtersToSearchParams(DEFAULT_FILTERS)
    expect(params.toString()).toBe('')
  })

  it('encodes categories', () => {
    const filters: TaskFilters = { ...DEFAULT_FILTERS, categories: ['cat-1', 'cat-2'] }
    expect(filtersToSearchParams(filters).get('category')).toBe('cat-1,cat-2')
  })

  it('encodes statuses', () => {
    const filters: TaskFilters = { ...DEFAULT_FILTERS, statuses: ['active', 'done'] }
    expect(filtersToSearchParams(filters).get('status')).toBe('active,done')
  })

  it('encodes priorities', () => {
    const filters: TaskFilters = { ...DEFAULT_FILTERS, priorities: ['high'] }
    expect(filtersToSearchParams(filters).get('priority')).toBe('high')
  })

  it('encodes dueRange', () => {
    const filters: TaskFilters = { ...DEFAULT_FILTERS, dueRange: 'today' }
    expect(filtersToSearchParams(filters).get('due')).toBe('today')
  })

  it('encodes isRecurring true as "1"', () => {
    const filters: TaskFilters = { ...DEFAULT_FILTERS, isRecurring: true }
    expect(filtersToSearchParams(filters).get('recurring')).toBe('1')
  })

  it('encodes isRecurring false as "0"', () => {
    const filters: TaskFilters = { ...DEFAULT_FILTERS, isRecurring: false }
    expect(filtersToSearchParams(filters).get('recurring')).toBe('0')
  })
})

describe('searchParamsToFilters', () => {
  it('returns default filters for empty params', () => {
    const params = new URLSearchParams()
    expect(searchParamsToFilters(params)).toEqual(DEFAULT_FILTERS)
  })

  it('parses categories', () => {
    const params = new URLSearchParams('category=cat-1,cat-2')
    expect(searchParamsToFilters(params).categories).toEqual(['cat-1', 'cat-2'])
  })

  it('parses statuses', () => {
    const params = new URLSearchParams('status=active,done')
    expect(searchParamsToFilters(params).statuses).toEqual(['active', 'done'])
  })

  it('parses dueRange', () => {
    const params = new URLSearchParams('due=overdue')
    expect(searchParamsToFilters(params).dueRange).toBe('overdue')
  })

  it('ignores invalid dueRange values', () => {
    const params = new URLSearchParams('due=invalid')
    expect(searchParamsToFilters(params).dueRange).toBeNull()
  })

  it('parses isRecurring from "1"', () => {
    const params = new URLSearchParams('recurring=1')
    expect(searchParamsToFilters(params).isRecurring).toBe(true)
  })

  it('parses isRecurring from "0"', () => {
    const params = new URLSearchParams('recurring=0')
    expect(searchParamsToFilters(params).isRecurring).toBe(false)
  })

  it('round-trips filters through params', () => {
    const original: TaskFilters = {
      categories: ['cat-1'],
      statuses: ['active'],
      priorities: ['high'],
      dueRange: 'today',
      isRecurring: true,
    }
    const params = filtersToSearchParams(original)
    const parsed = searchParamsToFilters(params)
    expect(parsed).toEqual(original)
  })
})

// ============================================
// Saved Views
// ============================================

describe('addSavedView', () => {
  it('adds a new view to the list', () => {
    const views: SavedView[] = []
    const result = addSavedView(views, 'My View', DEFAULT_FILTERS)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('My View')
    expect(result[0].isSystem).toBe(false)
  })

  it('throws when exceeding MAX_CUSTOM_VIEWS', () => {
    const views: SavedView[] = Array.from({ length: MAX_CUSTOM_VIEWS }, (_, i) =>
      makeView({ id: `view-${i}` })
    )
    expect(() => addSavedView(views, 'Extra', DEFAULT_FILTERS)).toThrow()
  })

  it('does not count system views toward the limit', () => {
    const views: SavedView[] = [
      ...SYSTEM_VIEWS,
      ...Array.from({ length: MAX_CUSTOM_VIEWS - 1 }, (_, i) =>
        makeView({ id: `view-${i}` })
      ),
    ]
    expect(() => addSavedView(views, 'One more', DEFAULT_FILTERS)).not.toThrow()
  })
})

describe('deleteSavedView', () => {
  it('removes the view with the given id', () => {
    const views = [makeView({ id: 'view-1' }), makeView({ id: 'view-2' })]
    const result = deleteSavedView(views, 'view-1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('view-2')
  })

  it('does not delete system views', () => {
    const views = [makeView({ id: 'all', isSystem: true })]
    const result = deleteSavedView(views, 'all')
    expect(result).toHaveLength(1)
  })
})

describe('updateSavedView', () => {
  it('updates the view name', () => {
    const views = [makeView({ id: 'view-1', name: 'Old' })]
    const result = updateSavedView(views, 'view-1', { name: 'New' })
    expect(result[0].name).toBe('New')
  })

  it('updates the view filters', () => {
    const views = [makeView({ id: 'view-1' })]
    const newFilters: TaskFilters = { ...DEFAULT_FILTERS, dueRange: 'today' }
    const result = updateSavedView(views, 'view-1', { filters: newFilters })
    expect(result[0].filters.dueRange).toBe('today')
  })

  it('does not update system views', () => {
    const views = [makeView({ id: 'all', name: 'All Tasks', isSystem: true })]
    const result = updateSavedView(views, 'all', { name: 'Hacked' })
    expect(result[0].name).toBe('All Tasks')
  })
})

// ============================================
// Filter State Helpers
// ============================================

describe('hasActiveFilters', () => {
  it('returns false for default filters', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false)
  })

  it('returns true when a category is selected', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, categories: ['cat-1'] })).toBe(true)
  })

  it('returns true when a status is selected', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, statuses: ['active'] })).toBe(true)
  })

  it('returns true when dueRange is set', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, dueRange: 'today' })).toBe(true)
  })

  it('returns true when isRecurring is set', () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, isRecurring: false })).toBe(true)
  })
})

describe('countActiveFilters', () => {
  it('returns 0 for default filters', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0)
  })

  it('counts each active dimension separately', () => {
    const filters: TaskFilters = {
      categories: ['cat-1'],
      statuses: ['active'],
      priorities: ['high'],
      dueRange: 'today',
      isRecurring: true,
    }
    expect(countActiveFilters(filters)).toBe(5)
  })

  it('counts a multi-value dimension as 1', () => {
    const filters: TaskFilters = {
      ...DEFAULT_FILTERS,
      categories: ['cat-1', 'cat-2', 'cat-3'],
    }
    expect(countActiveFilters(filters)).toBe(1)
  })
})

describe('filtersMatchView', () => {
  it('returns true when filters match the view', () => {
    const view = makeView({ filters: { ...DEFAULT_FILTERS } })
    expect(filtersMatchView(DEFAULT_FILTERS, view)).toBe(true)
  })

  it('returns false when filters differ', () => {
    const view = makeView({ filters: { ...DEFAULT_FILTERS, dueRange: 'today' } })
    expect(filtersMatchView(DEFAULT_FILTERS, view)).toBe(false)
  })

  it('is order-independent for array fields', () => {
    const filters: TaskFilters = { ...DEFAULT_FILTERS, categories: ['b', 'a'] }
    const view = makeView({ filters: { ...DEFAULT_FILTERS, categories: ['a', 'b'] } })
    expect(filtersMatchView(filters, view)).toBe(true)
  })
})
