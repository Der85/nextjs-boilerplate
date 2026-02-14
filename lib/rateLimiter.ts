// Shared Rate Limiter Utility
// Used by all API routes to prevent abuse
// Includes automatic cleanup to prevent memory leaks

interface RateBucket {
  count: number
  resetAt: number
}

class RateLimiter {
  private buckets = new Map<string, RateBucket>()
  private windowMs: number
  private maxRequests: number
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(windowMs: number = 60_000, maxRequests: number = 20) {
    this.windowMs = windowMs
    this.maxRequests = maxRequests
    this.startCleanup()
  }

  /**
   * Check if a key (userId or IP) is rate limited
   * @param key - Unique identifier (prefer userId over IP)
   * @returns true if rate limited, false if allowed
   */
  isLimited(key: string): boolean {
    const now = Date.now()
    const bucket = this.buckets.get(key)

    if (!bucket || now > bucket.resetAt) {
      this.capMapSize()
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs })
      return false
    }

    bucket.count += 1
    return bucket.count > this.maxRequests
  }

  /**
   * Get remaining requests for a key
   */
  getRemaining(key: string): number {
    const bucket = this.buckets.get(key)
    if (!bucket || Date.now() > bucket.resetAt) {
      return this.maxRequests
    }
    return Math.max(0, this.maxRequests - bucket.count)
  }

  /**
   * Start periodic cleanup of expired buckets
   */
  private startCleanup(): void {
    // Clean up every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      let cleaned = 0
      
      for (const [key, bucket] of this.buckets.entries()) {
        if (now > bucket.resetAt) {
          this.buckets.delete(key)
          cleaned++
        }
      }

      // Log if we cleaned up a significant number
      if (cleaned > 100) {
        console.log(`Rate limiter cleanup: removed ${cleaned} expired buckets`)
      }
    }, 60_000)

    // Prevent the interval from keeping Node.js alive
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref()
    }
  }

  /**
   * Cap the map size as additional safety
   * Called automatically when checking limits
   */
  private capMapSize(): void {
    const MAX_BUCKETS = 10_000
    
    if (this.buckets.size > MAX_BUCKETS) {
      // Remove oldest entries (those closest to expiring).
      // Since Map preserves insertion order and we use fixed windows,
      // the oldest entries are at the beginning. We avoid the expensive sort.
      const toRemoveCount = this.buckets.size - MAX_BUCKETS + 1000
      const keysIterator = this.buckets.keys()
      
      for (let i = 0; i < toRemoveCount; i++) {
        const key = keysIterator.next().value
        if (key) this.buckets.delete(key)
      }
      
      console.log(`Rate limiter: capped map size, removed ${toRemoveCount} entries`)
    }
  }

  /**
   * Get current bucket count (for monitoring)
   */
  getBucketCount(): number {
    return this.buckets.size
  }

  /**
   * Stop the cleanup interval (for testing/shutdown)
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

// v2 API Rate Limiters

// Dump API: 10 requests per minute (AI calls)
export const dumpRateLimiter = new RateLimiter(60_000, 10)

// Tasks API: 60 requests per minute (frequent CRUD)
export const tasksRateLimiter = new RateLimiter(60_000, 60)

// Categories API: 30 requests per minute
export const categoriesRateLimiter = new RateLimiter(60_000, 30)

// AI API: 10 requests per minute (Gemini calls)
export const aiRateLimiter = new RateLimiter(60_000, 10)

// Insights API: 15 requests per minute
export const insightsRateLimiter = new RateLimiter(60_000, 15)

// Templates API: 30 requests per minute
export const templatesRateLimiter = new RateLimiter(60_000, 30)

// Priorities API: 20 requests per minute (low frequency, questionnaire-based)
export const prioritiesRateLimiter = new RateLimiter(60_000, 20)

// Suggestions API: 10 requests per minute (AI-powered, expensive)
export const suggestionsRateLimiter = new RateLimiter(60_000, 10)

// Reminders API: 30 requests per minute (frequent polling + actions)
export const remindersRateLimiter = new RateLimiter(60_000, 30)

// Export the class for custom instances
export { RateLimiter }
