import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'
import type { Notification } from '@/lib/types'

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401, 'UNAUTHORIZED')

  const { data: rows, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[GET /api/notifications] error:', error.message, error.details, error.hint)
    return apiError('Failed to fetch notifications', 500, 'DB_ERROR')
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ notifications: [], unreadCount: 0 })
  }

  // Batch-fetch actor profiles
  const actorIds = [...new Set(rows.map((r) => r.actor_id))]
  const { data: actors } = await supabase
    .from('profiles')
    .select('id, handle, display_name')
    .in('id', actorIds)
  const actorMap = Object.fromEntries((actors ?? []).map((a) => [a.id, a]))

  // Batch-fetch posts
  const postIds = [...new Set(rows.map((r) => r.post_id).filter(Boolean))] as string[]
  let postMap: Record<string, { content: string; zone_label: string }> = {}
  if (postIds.length > 0) {
    const { data: posts } = await supabase
      .from('posts')
      .select('id, content, zone_label')
      .in('id', postIds)
    postMap = Object.fromEntries((posts ?? []).map((p) => [p.id, { content: p.content, zone_label: p.zone_label }]))
  }

  const notifications: Notification[] = rows.map((r) => ({
    id: r.id,
    recipient_id: r.recipient_id,
    actor_id: r.actor_id,
    type: r.type,
    post_id: r.post_id,
    read: r.read,
    created_at: r.created_at,
    actor: actorMap[r.actor_id] ?? null,
    post: r.post_id ? (postMap[r.post_id] ?? null) : null,
  }))

  const unreadCount = notifications.filter((n) => !n.read).length

  return NextResponse.json({ notifications, unreadCount })
}

export async function PATCH(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return apiError('Unauthorized', 401, 'UNAUTHORIZED')

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('recipient_id', user.id)
    .eq('read', false)

  if (error) {
    console.error('[PATCH /api/notifications] error:', error.message, error.details, error.hint)
    return apiError('Failed to mark notifications as read', 500, 'DB_ERROR')
  }

  return NextResponse.json({ updated: true })
}
