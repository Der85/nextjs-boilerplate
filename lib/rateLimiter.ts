// Shared Rate Limiter
// Uses Upstash Redis when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set.
// Falls back to an in-process sliding-window map when env vars are absent (dev/test).
//
// All call sites use the async `limit(key)` API:
//   const { success } = await rateLimiter.limit(userId)
//   if (!success) return apiError('Too many requests', 429, 'RATE_LIMITED')

interface LimitResult {
  success: boolean
}

interface IRateLimiter {
  limit(key: string): Promise<LimitResult>
}

// -- In-memory fallback ---------------------------------------------------

interface RateBucket {
  count: number
  resetAt: number
}

class InMemoryRateLimiter implements IRateLimiter {
  private buckets = new Map<string, RateBucket>()
  private readonly windowMs: number
  private readonly maxRequests: number
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs
    this.maxRequests = maxRequests
    this.startCleanup()
  }

  async limit(key: string): Promise<LimitResult> {
    const now = Date.now()
    const bucket = this.buckets.get(key)

    if (!bucket || now > bucket.resetAt) {
      this.capMapSize()
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs })
      return { success: true }
    }

    bucket.count += 1
    return { success: bucket.count <= this.maxRequests }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      for (const [key, bucket] of this.buckets.entries()) {
        if (now > bucket.resetAt) this.buckets.delete(key)
      }
    }, 60_000)
    if (this.cleanupInterval.unref) this.cleanupInterval.unref()
  }

  private capMapSize(): void {
    const MAX_BUCKETS = 10_000
    if (this.buckets.size <= MAX_BUCKETS) return
    const toRemove = this.buckets.size - MAX_BUCKETS + 1000
    const iter = this.buckets.keys()
    for (let i = 0; i < toRemove; i++) {
      const key = iter.next().value
      if (key) this.buckets.delete(key)
    }
  }
}

// -- Upstash wrapper ------------------------------------------------------

async function tryBuildUpstashLimiter(windowMs: number, maxRequests: number): Promise<IRateLimiter | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null

  try {
    const { Ratelimit } = await import('@upstash/ratelimit')
    const { Redis } = await import('@upstash/redis')

    const redis = new Redis({ url, token })
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs} ms`),
      analytics: false,
    })

    return {
      async limit(key: string) {
        const { success } = await ratelimit.limit(key)
        return { success }
      },
    }
  } catch (err) {
    console.warn('[rateLimiter] Upstash init failed, using in-memory fallback:', err)
    return null
  }
}

// -- Lazy wrapper (resolves Upstash on first use, then caches) ------------

class LazyRateLimiter implements IRateLimiter {
  private inner: IRateLimiter | null = null
  private initPromise: Promise<void> | null = null
  private readonly fallback: InMemoryRateLimiter
  private readonly windowMs: number
  private readonly maxRequests: number

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs
    this.maxRequests = maxRequests
    this.fallback = new InMemoryRateLimiter(windowMs, maxRequests)
  }

  private async init(): Promise<void> {
    const upstash = await tryBuildUpstashLimiter(this.windowMs, this.maxRequests)
    this.inner = upstash ?? this.fallback
  }

  async limit(key: string): Promise<LimitResult> {
    if (!this.initPromise) {
      this.initPromise = this.init()
    }
    await this.initPromise
    return this.inner!.limit(key)
  }
}

// Geo resolve: 10 requests/min — location context calls this on movement >100 m
export const geoRateLimiter = new LazyRateLimiter(60_000, 10)

// General API routes
export const apiRateLimiter = new LazyRateLimiter(60_000, 60)
