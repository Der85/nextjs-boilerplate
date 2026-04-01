// Shared Rate Limiter Utility
// Used by all API routes to prevent abuse
//
// ⚠️  IN-MEMORY LIMITATION: This rate limiter stores state in process memory.
//    - State is lost on every server restart or deploy
//    - Each serverless function instance has its own independent state
//    - For production multi-instance deployments, migrate to Redis

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

  getRemaining(key: string): number {
    const bucket = this.buckets.get(key)
    if (!bucket || Date.now() > bucket.resetAt) {
      return this.maxRequests
    }
    return Math.max(0, this.maxRequests - bucket.count)
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      for (const [key, bucket] of this.buckets.entries()) {
        if (now > bucket.resetAt) {
          this.buckets.delete(key)
        }
      }
    }, 60_000)

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref()
    }
  }

  private capMapSize(): void {
    const MAX_BUCKETS = 10_000
    if (this.buckets.size > MAX_BUCKETS) {
      const toRemoveCount = this.buckets.size - MAX_BUCKETS + 1000
      const keysIterator = this.buckets.keys()
      for (let i = 0; i < toRemoveCount; i++) {
        const key = keysIterator.next().value
        if (key) this.buckets.delete(key)
      }
    }
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

// ADHDer.io Rate Limiters
export const postsRateLimiter = new RateLimiter(60_000, 30)
export const feedRateLimiter = new RateLimiter(60_000, 60)
export const geoRateLimiter = new RateLimiter(60_000, 30)
export const profileRateLimiter = new RateLimiter(60_000, 20)
export const followRateLimiter = new RateLimiter(60_000, 30)
export const zonesRateLimiter = new RateLimiter(60_000, 60)

export { RateLimiter }
