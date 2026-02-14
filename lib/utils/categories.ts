import type { Category } from '@/lib/types'

// Default system categories for new users
export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] = [
  { name: 'Work', color: '#4F46E5', icon: '💼', position: 0, is_ai_generated: false, is_system: true },
  { name: 'Health', color: '#10B981', icon: '🏃', position: 1, is_ai_generated: false, is_system: true },
  { name: 'Home', color: '#F59E0B', icon: '🏠', position: 2, is_ai_generated: false, is_system: true },
  { name: 'Finance', color: '#6366F1', icon: '💰', position: 3, is_ai_generated: false, is_system: true },
  { name: 'Social', color: '#EC4899', icon: '👥', position: 4, is_ai_generated: false, is_system: true },
  { name: 'Personal Growth', color: '#8B5CF6', icon: '🌱', position: 5, is_ai_generated: false, is_system: true },
  { name: 'Admin', color: '#6B7280', icon: '📋', position: 6, is_ai_generated: false, is_system: true },
  { name: 'Family', color: '#EF4444', icon: '❤️', position: 7, is_ai_generated: false, is_system: true },
]

// Category name to match AI output to user categories
export const DEFAULT_CATEGORY_NAMES = DEFAULT_CATEGORIES.map(c => c.name)

// Color palette for custom categories
export const CATEGORY_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#4F46E5', // indigo
  '#6366F1', // violet
  '#84CC16', // lime
  '#6B7280', // gray
]

// Emoji palette for custom categories
export const CATEGORY_ICONS = [
  '📁', '💼', '🏃', '🏠', '💰', '👥', '🌱', '📋', '❤️',
  '📚', '🎯', '⚡', '🔧', '🎨', '✈️', '🎮', '🎵', '📱',
  '🛒', '🍎', '💊', '🐕', '🚗', '📧', '💡', '🌍', '⭐',
  '🏋️', '📝', '🎂', '☕', '🔑', '📦', '🎓', '🏥', '🌸',
]

/**
 * Find a category by name (case-insensitive)
 */
export function findCategoryByName(categories: Category[], name: string): Category | undefined {
  const normalized = name.toLowerCase().trim()
  return categories.find(c => c.name.toLowerCase() === normalized)
}

/**
 * Get fallback category (Admin) for uncategorized tasks
 */
export function getFallbackCategory(categories: Category[]): Category | undefined {
  return findCategoryByName(categories, 'Admin') || categories[0]
}
