import { z } from 'zod'
import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'

// ============================
// Post schemas
// ============================

export const postCreateSchema = z.object({
  body: z.string().min(1, 'Post cannot be empty.').max(280, 'Post exceeds 280 characters.'),
  zone_id: z.string().min(1, 'Zone is required.'),
  parent_id: z.string().uuid().optional(),
  repost_of: z.string().uuid().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
})

// ============================
// Geo schemas
// ============================

export const geoResolveSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

// ============================
// Profile schemas
// ============================

export const profilePatchSchema = z.object({
  handle: z.string().regex(/^[a-z0-9_]{3,20}$/, 'Handle must be 3-20 chars: lowercase letters, numbers, underscores.').optional(),
  display_name: z.string().max(100).optional(),
  bio: z.string().max(160).optional(),
  timezone: z.string().max(100).optional(),
})

// ============================
// Location follow schemas
// ============================

export const locationFollowSchema = z.object({
  zone_id: z.string().min(1, 'Zone ID is required.'),
})

// ============================
// Validation helper
// ============================

/**
 * Parse and validate a request body with a Zod schema.
 * Returns the parsed data on success, or a NextResponse error on failure.
 */
export function parseBody<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }

  const firstIssue = result.error.issues[0]
  const message = firstIssue
    ? `${firstIssue.path.join('.')}: ${firstIssue.message}`.replace(/^: /, '')
    : 'Invalid request body.'

  return {
    success: false,
    response: apiError(message, 400, 'VALIDATION_ERROR') as NextResponse,
  }
}
