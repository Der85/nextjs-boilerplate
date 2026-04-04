import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'
import { apiRateLimiter } from '@/lib/rateLimiter'

const FollowSchema = z.object({
  zoneLabel: z.string().min(1),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ zoneId: string }> }
) {
  const { zoneId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401, 'UNAUTHORIZED')

  const { success: allowed } = await apiRateLimiter.limit(user.id)
  if (!allowed) return apiError('Too many requests', 429, 'RATE_LIMITED')

  let body: unknown
  try { body = await request.json() } catch { return apiError('Invalid JSON', 400, 'BAD_REQUEST') }

  const parsed = FollowSchema.safeParse(body)
  if (!parsed.success) return apiError('Invalid request', 400, 'VALIDATION_ERROR')

  // Verify zone exists
  const { data: zone } = await supabase.from('zones').select('zone_id').eq('zone_id', zoneId).maybeSingle()
  if (!zone) return apiError('Zone not found', 404, 'NOT_FOUND')

  const { error } = await supabase
    .from('location_follows')
    .upsert({ user_id: user.id, zone_id: zoneId, zone_label: parsed.data.zoneLabel }, { onConflict: 'user_id,zone_id' })

  if (error) {
    console.error('[POST /api/zones/follow] upsert error:', error.message, error.details, error.hint, { userId: user.id, zoneId })
    return apiError('Failed to follow zone', 500, 'DB_ERROR')
  }

  return NextResponse.json({ followed: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ zoneId: string }> }
) {
  const { zoneId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401, 'UNAUTHORIZED')

  const { success: deleteAllowed } = await apiRateLimiter.limit(user.id)
  if (!deleteAllowed) return apiError('Too many requests', 429, 'RATE_LIMITED')

  const { error } = await supabase
    .from('location_follows')
    .delete()
    .eq('user_id', user.id)
    .eq('zone_id', zoneId)

  if (error) return apiError('Failed to unfollow zone', 500, 'DB_ERROR')

  return NextResponse.json({ followed: false })
}
