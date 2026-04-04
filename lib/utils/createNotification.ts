import type { SupabaseClient } from '@supabase/supabase-js'

export async function createNotification(
  supabase: SupabaseClient,
  {
    recipientId,
    actorId,
    type,
    postId,
  }: {
    recipientId: string
    actorId: string
    type: 'reply' | 'repost' | 'mention' | 'like'
    postId?: string
  }
): Promise<void> {
  // No self-notifications
  if (recipientId === actorId) return

  try {
    await supabase.from('notifications').insert({
      recipient_id: recipientId,
      actor_id: actorId,
      type,
      post_id: postId ?? null,
    })
  } catch (err) {
    console.warn('[createNotification] silently failed:', err)
  }
}
