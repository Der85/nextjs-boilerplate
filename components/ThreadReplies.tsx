'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PostCard } from '@/components/PostCard'
import { ReplyCompose } from '@/components/ReplyCompose'
import type { PostWithAuthor } from '@/lib/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

const supabase = createClient()

interface ThreadRepliesProps {
  initialReplies: PostWithAuthor[]
  postId: string
  postZoneId: string
  postZoneLabel: string
  currentUserId: string | null
}

export function ThreadReplies({
  initialReplies,
  postId,
  postZoneId,
  postZoneLabel,
  currentUserId,
}: ThreadRepliesProps) {
  const [replies, setReplies] = useState<PostWithAuthor[]>(initialReplies)
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Realtime: append new replies from other users as they arrive
  useEffect(() => {
    const channel = supabase
      .channel(`thread:${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
          filter: `parent_id=eq.${postId}`,
        },
        async (payload) => {
          const raw = payload.new as Record<string, unknown>

          const { data: author } = await supabase
            .from('profiles')
            .select('handle, display_name')
            .eq('id', raw.author_id as string)
            .maybeSingle()

          const reply = { ...raw, author, reply_count: 0, repost_count: 0 } as PostWithAuthor

          setReplies((prev) => {
            if (prev.some((r) => r.id === reply.id)) return prev
            return [...prev, reply]
          })
        }
      )
      .subscribe()

    channelRef.current = channel
    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [postId])

  function handleReply(reply: PostWithAuthor) {
    setReplies((prev) => {
      // Deduplicate: Realtime may also fire for this reply
      if (prev.some((r) => r.id === reply.id)) return prev
      return [...prev, reply]
    })
  }

  function handleDelete(id: string) {
    setReplies((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <>
      {replies.length > 0 && (
        <div style={{ borderTop: '2px solid var(--color-border)' }}>
          {replies.map((reply) => (
            <PostCard
              key={reply.id}
              post={reply}
              currentUserId={currentUserId}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
      <ReplyCompose
        postId={postId}
        postZoneId={postZoneId}
        postZoneLabel={postZoneLabel}
        onReply={handleReply}
      />
    </>
  )
}
