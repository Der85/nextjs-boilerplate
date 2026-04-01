'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { apiFetch } from '@/lib/api-client'
import { useLocation } from '@/lib/contexts/LocationContext'
import PostCard from '@/components/PostCard'
import ComposeBox from '@/components/ComposeBox'
import PostFeed from '@/components/PostFeed'
import ZoneBadge from '@/components/ZoneBadge'
import type { PostWithAuthor } from '@/lib/types'

export default function PostPage() {
  const params = useParams()
  const postId = params.id as string
  const { currentZone } = useLocation()

  const [post, setPost] = useState<PostWithAuthor | null>(null)
  const [replies, setReplies] = useState<PostWithAuthor[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const canReply = currentZone?.id === post?.zone_id

  const loadPost = useCallback(async () => {
    const res = await apiFetch(`/api/posts/${postId}`)
    if (res.ok) {
      const data = await res.json()
      setPost(data.post)
    }
  }, [postId])

  const loadReplies = useCallback(async () => {
    setIsLoading(true)
    const res = await apiFetch(`/api/posts?parent_id=${postId}&limit=50`)
    if (res.ok) {
      const data = await res.json()
      setReplies(data.data)
    }
    setIsLoading(false)
  }, [postId])

  const handleReplyCreated = () => {
    loadPost()   // refresh reply count
    loadReplies()
  }

  useEffect(() => {
    loadPost()
    loadReplies()
  }, [loadPost, loadReplies])

  if (!post && isLoading) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <div className="skeleton" style={{ height: '20px', width: '50%', marginBottom: '12px' }} />
        <div className="skeleton" style={{ height: '60px', width: '100%' }} />
      </div>
    )
  }

  if (!post) {
    return (
      <div style={{
        padding: '48px 16px',
        textAlign: 'center',
        color: 'var(--color-text-tertiary)',
      }}>
        Post not found.
      </div>
    )
  }

  return (
    <div>
      {/* Original post */}
      <PostCard post={post} />

      {/* Reply box — location gated */}
      {canReply ? (
        <ComposeBox
          parentId={postId}
          placeholder="Write a reply..."
          onPostCreated={handleReplyCreated}
        />
      ) : (
        <div style={{
          padding: '10px 16px',
          fontSize: 'var(--text-small)',
          color: 'var(--color-text-tertiary)',
          textAlign: 'center',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
        }}>
          You need to be in <ZoneBadge label={post.zone?.label || post.zone_id} /> to reply
        </div>
      )}

      {/* Replies */}
      <PostFeed
        posts={replies}
        isLoading={isLoading}
        emptyMessage="No replies yet."
      />
    </div>
  )
}
