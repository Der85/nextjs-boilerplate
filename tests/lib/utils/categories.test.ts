import { describe, it, expect } from 'vitest'
import {
  DEFAULT_CATEGORIES,
  DEFAULT_CATEGORY_NAMES,
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  findCategoryByName,
  getFallbackCategory,
} from '@/lib/utils/categories'
import type { Category } from '@/lib/types'

// Helper to build a minimal Category object
function makeCategory(name: string, overrides: Partial<Category> = {}): Category {
  return {
    id: `id-${name}`,
    user_id: 'user-1',
    name,
    color: '#000000',
    icon: '📁',
    position: 0,
    is_ai_generated: false,
    is_system: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

// ─── DEFAULT_CATEGORIES ───────────────────────────────────────────────────────

describe('DEFAULT_CATEGORIES', () => {
  it('contains exactly 8 categories', () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(8)
  })

  it('includes all expected domain names', () => {
    const names = DEFAULT_CATEGORIES.map(c => c.name)
    expect(names).toContain('Work')
    expect(names).toContain('Health')
    expect(names).toContain('Home')
    expect(names).toContain('Finance')
    expect(names).toContain('Social')
    expect(names).toContain('Personal Growth')
    expect(names).toContain('Admin')
    expect(names).toContain('Family')
  })

  it('all categories are marked as system categories', () => {
    for (const cat of DEFAULT_CATEGORIES) {
      expect(cat.is_system).toBe(true)
    }
  })

  it('all categories are not AI generated', () => {
    for (const cat of DEFAULT_CATEGORIES) {
      expect(cat.is_ai_generated).toBe(false)
    }
  })

  it('positions are 0-7 in order', () => {
    const positions = DEFAULT_CATEGORIES.map(c => c.position)
    expect(positions).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('each category has a non-empty color and icon', () => {
    for (const cat of DEFAULT_CATEGORIES) {
      expect(cat.color).toBeTruthy()
      expect(cat.icon).toBeTruthy()
    }
  })
})

// ─── DEFAULT_CATEGORY_NAMES ───────────────────────────────────────────────────

describe('DEFAULT_CATEGORY_NAMES', () => {
  it('is derived from DEFAULT_CATEGORIES names', () => {
    expect(DEFAULT_CATEGORY_NAMES).toEqual(DEFAULT_CATEGORIES.map(c => c.name))
  })

  it('has 8 names', () => {
    expect(DEFAULT_CATEGORY_NAMES).toHaveLength(8)
  })

  it('contains Admin (used as AI fallback)', () => {
    expect(DEFAULT_CATEGORY_NAMES).toContain('Admin')
  })
})

// ─── CATEGORY_COLORS ─────────────────────────────────────────────────────────

describe('CATEGORY_COLORS', () => {
  it('contains at least 10 colors', () => {
    expect(CATEGORY_COLORS.length).toBeGreaterThanOrEqual(10)
  })

  it('all colors are valid hex codes', () => {
    for (const color of CATEGORY_COLORS) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('has no duplicates', () => {
    expect(new Set(CATEGORY_COLORS).size).toBe(CATEGORY_COLORS.length)
  })
})

// ─── CATEGORY_ICONS ───────────────────────────────────────────────────────────

describe('CATEGORY_ICONS', () => {
  it('contains at least 20 icons', () => {
    expect(CATEGORY_ICONS.length).toBeGreaterThanOrEqual(20)
  })

  it('has no duplicates', () => {
    expect(new Set(CATEGORY_ICONS).size).toBe(CATEGORY_ICONS.length)
  })
})

// ─── findCategoryByName ───────────────────────────────────────────────────────

describe('findCategoryByName', () => {
  const categories = [
    makeCategory('Work'),
    makeCategory('Health'),
    makeCategory('Admin'),
  ]

  it('finds by exact name', () => {
    const result = findCategoryByName(categories, 'Work')
    expect(result?.name).toBe('Work')
  })

  it('finds case-insensitively', () => {
    expect(findCategoryByName(categories, 'work')?.name).toBe('Work')
    expect(findCategoryByName(categories, 'WORK')?.name).toBe('Work')
    expect(findCategoryByName(categories, 'wOrK')?.name).toBe('Work')
  })

  it('trims whitespace before comparing', () => {
    expect(findCategoryByName(categories, '  Work  ')?.name).toBe('Work')
  })

  it('returns undefined when not found', () => {
    expect(findCategoryByName(categories, 'Finance')).toBeUndefined()
  })

  it('returns undefined on empty array', () => {
    expect(findCategoryByName([], 'Work')).toBeUndefined()
  })
})

// ─── getFallbackCategory ──────────────────────────────────────────────────────

describe('getFallbackCategory', () => {
  it('returns Admin when present', () => {
    const categories = [makeCategory('Work'), makeCategory('Admin'), makeCategory('Health')]
    expect(getFallbackCategory(categories)?.name).toBe('Admin')
  })

  it('returns first category when Admin is absent', () => {
    const categories = [makeCategory('Work'), makeCategory('Health')]
    expect(getFallbackCategory(categories)?.name).toBe('Work')
  })

  it('returns undefined on empty array', () => {
    expect(getFallbackCategory([])).toBeUndefined()
  })

  it('is case-insensitive for Admin lookup', () => {
    const categories = [makeCategory('Work'), makeCategory('admin')]
    expect(getFallbackCategory(categories)?.name).toBe('admin')
  })
})
