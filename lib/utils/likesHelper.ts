import type { SupabaseClient } from '@supabase/supabase-js'

export async function fetchLikesForPosts(
  supabase: SupabaseClient,
  postIds: string[],
  userId: string
): Promise<{ likeCounts: Record<string, number>; likedPostIds: Set<string> }> {
  if (postIds.length === 0) {
    return { likeCounts: {}, likedPostIds: new Set() }
  }

  const [{ data: allLikes }, { data: myLikes }] = await Promise.all([
    supabase.from('post_likes').select('post_id').in('post_id', postIds),
    supabase.from('post_likes').select('post_id').in('post_id', postIds).eq('user_id', userId),
  ])

  const likeCounts: Record<string, number> = {}
  for (const row of allLikes ?? []) {
    if (row.post_id) likeCounts[row.post_id] = (likeCounts[row.post_id] ?? 0) + 1
  }

  const likedPostIds = new Set<string>((myLikes ?? []).map((r) => r.post_id as string).filter(Boolean))

  return { likeCounts, likedPostIds }
}
