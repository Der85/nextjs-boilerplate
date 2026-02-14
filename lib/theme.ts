/**
 * Centralized theme constants for type-safe CSS variable access.
 *
 * This file maps CSS custom properties from globals.css to TypeScript constants.
 * If CSS variable names change, update them here to catch all usages at compile time.
 */

// CSS variable references (the actual var() calls)
export const cssVars = {
  // Colors
  bg: 'var(--color-bg)',
  surface: 'var(--color-surface)',
  textPrimary: 'var(--color-text-primary)',
  textSecondary: 'var(--color-text-secondary)',
  textTertiary: 'var(--color-text-tertiary)',
  accent: 'var(--color-accent)',
  accentHover: 'var(--color-accent-hover)',
  accentLight: 'var(--color-accent-light)',
  success: 'var(--color-success)',
  successLight: 'var(--color-success-light)',
  warning: 'var(--color-warning)',
  warningLight: 'var(--color-warning-light)',
  danger: 'var(--color-danger)',
  dangerLight: 'var(--color-danger-light)',
  border: 'var(--color-border)',

  // Typography
  fontBody: 'var(--font-body)',
  fontHeading: 'var(--font-heading)',
  textHeading: 'var(--text-heading)',
  textBody: 'var(--text-body)',
  textCaption: 'var(--text-caption)',
  textSmall: 'var(--text-small)',

  // Spacing & Radius
  radiusSm: 'var(--radius-sm)',
  radiusMd: 'var(--radius-md)',
  radiusLg: 'var(--radius-lg)',
  radiusFull: 'var(--radius-full)',

  // Shadows
  shadowSm: 'var(--shadow-sm)',
  shadowMd: 'var(--shadow-md)',
  shadowLg: 'var(--shadow-lg)',

  // Layout
  safeAreaBottom: 'var(--safe-area-bottom)',
  tabBarHeight: 'var(--tab-bar-height)',
  contentMaxWidth: 'var(--content-max-width)',
} as const

// Type for CSS variable keys
export type CssVarKey = keyof typeof cssVars

// Semantic color mappings for specific use cases
export const priorityColors = {
  high: cssVars.warning,
  medium: cssVars.accent,
  low: 'transparent',
} as const

export type TaskPriority = keyof typeof priorityColors

export const reminderPriorityColors = {
  gentle: cssVars.accent,   // Blue - soft
  normal: cssVars.warning,  // Yellow
  important: cssVars.danger, // Red
} as const

export type ReminderPriorityLevel = keyof typeof reminderPriorityColors

// Status colors for consistent feedback
export const statusColors = {
  success: cssVars.success,
  warning: cssVars.warning,
  error: cssVars.danger,
  info: cssVars.accent,
} as const

export type StatusType = keyof typeof statusColors

// Helper to get reminder priority color with fallback
export function getReminderPriorityColor(priority: string): string {
  return reminderPriorityColors[priority as ReminderPriorityLevel] ?? cssVars.warning
}

// Helper to get task priority border color
export function getTaskPriorityBorder(priority: string | null | undefined): string {
  if (!priority) return 'transparent'
  return priorityColors[priority as TaskPriority] ?? 'transparent'
}
