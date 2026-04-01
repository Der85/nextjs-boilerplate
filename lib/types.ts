// ============================
// ADHDer.io — Microblogging Types
// ============================

export interface UserProfile {
  id: string
  handle: string | null
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  timezone: string
  created_at: string
  updated_at: string
}

export interface Zone {
  id: string           // H3 cell index string
  label: string        // Human-readable name, e.g. "Temple Bar, Dublin"
  h3_resolution: number
  lat: number
  lng: number
  post_count: number
  follower_count: number
  created_at: string
}

export interface Post {
  id: string
  user_id: string
  zone_id: string
  body: string
  parent_id: string | null   // null = top-level, set = reply
  repost_of: string | null   // null = original, set = repost
  reply_count: number
  repost_count: number
  lat: number | null
  lng: number | null
  created_at: string
}

export interface PostWithAuthor extends Post {
  author: Pick<UserProfile, 'id' | 'handle' | 'display_name' | 'avatar_url'>
  zone: Pick<Zone, 'id' | 'label'> | null
}

export interface LocationFollow {
  id: string
  user_id: string
  zone_id: string
  zone_label: string
  created_at: string
}

export type LocationPermission = 'granted' | 'denied' | 'prompt' | 'unsupported'

export interface LocationState {
  lat: number | null
  lng: number | null
  accuracy: number | null
  currentZone: Zone | null
  isLoading: boolean
  error: string | null
  permission: LocationPermission
}

export type FeedType = 'local' | 'following' | 'explore'

export interface GeoResolveResponse {
  zone: Zone
  h3_index: string
}

// Cursor-based pagination
export interface PaginatedResponse<T> {
  data: T[]
  next_cursor: string | null
  has_more: boolean
}
