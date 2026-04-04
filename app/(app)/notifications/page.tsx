export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NotificationsClient } from './NotificationsClient'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch notifications server-side
  const { data: rows } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const notifRows = rows ?? []

  // Batch-fetch actors
  const actorIds = [...new Set(notifRows.map((r) => r.actor_id))]
  let actorMap: Record<string, { handle: string; display_name: string }> = {}
  if (actorIds.length > 0) {
    const { data: actors } = await supabase
      .from('profiles')
      .select('id, handle, display_name')
      .in('id', actorIds)
    actorMap = Object.fromEntries((actors ?? []).map((a) => [a.id, { handle: a.handle, display_name: a.display_name }]))
  }

  // Batch-fetch posts
  const postIds = [...new Set(notifRows.map((r) => r.post_id).filter(Boolean))] as string[]
  let postMap: Record<string, { content: string; zone_label: string }> = {}
  if (postIds.length > 0) {
    const { data: posts } = await supabase
      .from('posts')
      .select('id, content, zone_label')
      .in('id', postIds)
    postMap = Object.fromEntries((posts ?? []).map((p) => [p.id, { content: p.content, zone_label: p.zone_label }]))
  }

  const notifications = notifRows.map((r) => ({
    id: r.id as string,
    recipient_id: r.recipient_id as string,
    actor_id: r.actor_id as string,
    type: r.type as 'reply' | 'repost' | 'mention' | 'like',
    post_id: r.post_id as string | null,
    read: r.read as boolean,
    created_at: r.created_at as string,
    actor: actorMap[r.actor_id] ?? null,
    post: r.post_id ? (postMap[r.post_id] ?? null) : null,
  }))

  return (
    <div style={{ maxWidth: 'var(--content-max-width)', margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <Link
          href="/local"
          style={{
            color: 'var(--color-text-secondary)',
            textDecoration: 'none',
            fontSize: '0.875rem',
          }}
        >
          ← Back
        </Link>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          Notifications
        </h1>
      </div>
      <NotificationsClient notifications={notifications} />
    </div>
  )
}
