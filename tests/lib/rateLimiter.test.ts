import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RateLimiter } from '@/lib/rateLimiter'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('RateLimiter', () => {
  describe('isLimited', () => {
    it('allows the first request', () => {
      const limiter = new RateLimiter(60_000, 3)
      expect(limiter.isLimited('user-1')).toBe(false)
      limiter.stop()
    })

    it('allows requests up to the max', () => {
      const limiter = new RateLimiter(60_000, 3)
      expect(limiter.isLimited('user-1')).toBe(false) // 1
      expect(limiter.isLimited('user-1')).toBe(false) // 2
      expect(limiter.isLimited('user-1')).toBe(false) // 3
      limiter.stop()
    })

    it('blocks the request that exceeds the max', () => {
      const limiter = new RateLimiter(60_000, 3)
      limiter.isLimited('user-1') // 1
      limiter.isLimited('user-1') // 2
      limiter.isLimited('user-1') // 3
      expect(limiter.isLimited('user-1')).toBe(true)  // 4 — over limit
      limiter.stop()
    })

    it('tracks users independently', () => {
      const limiter = new RateLimiter(60_000, 2)
      limiter.isLimited('user-1') // 1
      limiter.isLimited('user-1') // 2
      expect(limiter.isLimited('user-1')).toBe(true)   // blocked
      expect(limiter.isLimited('user-2')).toBe(false)  // different user, fresh window
      limiter.stop()
    })

    it('resets after the window expires', () => {
      const limiter = new RateLimiter(60_000, 2)
      limiter.isLimited('user-1') // 1
      limiter.isLimited('user-1') // 2
      expect(limiter.isLimited('user-1')).toBe(true)   // blocked

      vi.advanceTimersByTime(60_001) // advance past window

      expect(limiter.isLimited('user-1')).toBe(false)  // fresh window
      limiter.stop()
    })

    it('does not block during the window before exceeding max', () => {
      const limiter = new RateLimiter(60_000, 5)
      for (let i = 0; i < 5; i++) {
        expect(limiter.isLimited('user-1')).toBe(false)
      }
      expect(limiter.isLimited('user-1')).toBe(true)
      limiter.stop()
    })
  })

  describe('getRemaining', () => {
    it('returns maxRequests for a fresh key', () => {
      const limiter = new RateLimiter(60_000, 10)
      expect(limiter.getRemaining('user-1')).toBe(10)
      limiter.stop()
    })

    it('decrements as requests are made', () => {
      const limiter = new RateLimiter(60_000, 10)
      limiter.isLimited('user-1') // count = 1
      expect(limiter.getRemaining('user-1')).toBe(9)
      limiter.isLimited('user-1') // count = 2
      expect(limiter.getRemaining('user-1')).toBe(8)
      limiter.stop()
    })

    it('returns 0 when limit is exceeded (not negative)', () => {
      const limiter = new RateLimiter(60_000, 2)
      limiter.isLimited('user-1') // 1
      limiter.isLimited('user-1') // 2
      limiter.isLimited('user-1') // 3 — over
      expect(limiter.getRemaining('user-1')).toBe(0)
      limiter.stop()
    })

    it('returns maxRequests after window reset', () => {
      const limiter = new RateLimiter(60_000, 5)
      limiter.isLimited('user-1') // 1
      vi.advanceTimersByTime(60_001)
      expect(limiter.getRemaining('user-1')).toBe(5)
      limiter.stop()
    })
  })

  describe('getBucketCount', () => {
    it('starts at 0', () => {
      const limiter = new RateLimiter(60_000, 10)
      expect(limiter.getBucketCount()).toBe(0)
      limiter.stop()
    })

    it('increments as new users make requests', () => {
      const limiter = new RateLimiter(60_000, 10)
      limiter.isLimited('user-1')
      expect(limiter.getBucketCount()).toBe(1)
      limiter.isLimited('user-2')
      expect(limiter.getBucketCount()).toBe(2)
      limiter.stop()
    })

    it('does not increment for repeated requests from same user', () => {
      const limiter = new RateLimiter(60_000, 10)
      limiter.isLimited('user-1')
      limiter.isLimited('user-1')
      expect(limiter.getBucketCount()).toBe(1)
      limiter.stop()
    })
  })

  describe('stop', () => {
    it('can be called without error', () => {
      const limiter = new RateLimiter(60_000, 10)
      expect(() => limiter.stop()).not.toThrow()
    })

    it('can be called multiple times without error', () => {
      const limiter = new RateLimiter(60_000, 10)
      limiter.stop()
      expect(() => limiter.stop()).not.toThrow()
    })
  })

  describe('window boundary behaviour', () => {
    it('requests in different windows are counted separately', () => {
      const limiter = new RateLimiter(60_000, 2)
      expect(limiter.isLimited('user-1')).toBe(false) // window 1, count 1
      expect(limiter.isLimited('user-1')).toBe(false) // window 1, count 2

      vi.advanceTimersByTime(60_001)

      expect(limiter.isLimited('user-1')).toBe(false) // window 2, count 1
      expect(limiter.isLimited('user-1')).toBe(false) // window 2, count 2
      expect(limiter.isLimited('user-1')).toBe(true)  // window 2, count 3 — blocked
      limiter.stop()
    })
  })
})
