export interface Profile {
  id: string
  handle: string
  display_name: string
  created_at: string
}

export interface Zone {
  zone_id: string        // H3 cell index
  label: string          // Human-readable e.g. "Shoreditch, London"
  resolution: number     // H3 resolution (8 = neighbourhood in Phase 1)
  active_user_count: number
  updated_at: string
}

export interface Post {
  id: string
  author_id: string
  content: string        // max 280 chars
  latitude: number
  longitude: number
  h3_index: string       // H3 cell at resolution 8
  zone_label: string
  zone_id: string
  parent_id: string | null   // set = reply, null = top-level post
  repost_of: string | null   // set = repost
  created_at: string
  is_ai_generated: boolean   // true = posted by Local Pulse bot
  source_url: string | null  // provenance link for AI-generated posts
}

export interface LocationFollow {
  id: string
  user_id: string
  zone_id: string
  zone_label: string
  created_at: string
}

export interface PostWithAuthor extends Post {
  author: { handle: string; display_name: string } | null
  reply_count: number
  repost_count: number
}

export interface ZoneWithMeta extends Zone {
  post_count: number
  is_followed: boolean
}

/** Client-side anomaly flags surfaced by LocationProvider.
 *  These are informational — the app logs them and can later gate behaviour on them. */
export interface SpoofFlags {
  /** Last GPS transition was physically impossible (speed > 300 m/s) */
  velocityAnomaly: boolean
  /** All recent readings are pixel-perfect identical — likely a static fake position */
  noJitter: boolean
}

export interface LocationState {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  currentZoneId: string | null
  zoneLabel: string | null
  isLoading: boolean
  error: string | null
  permissionDenied: boolean
  spoofFlags: SpoofFlags
}
