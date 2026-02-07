'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import SplashScreen from '@/components/SplashScreen'
import {
  prefetchDashboardData,
  checkOnboardingStatus,
  getCachedPrefetchData,
} from '@/lib/prefetch'

type RoutingState = 'loading' | 'routing' | 'offline'

export default function SmartEntryRouter() {
  const supabase = createClient()
  const router = useRouter()
  const [state, setState] = useState<RoutingState>('loading')
  const [showSlowMessage, setShowSlowMessage] = useState(false)
  const startTimeRef = useRef(Date.now())
  const hasRoutedRef = useRef(false)

  useEffect(() => {
    // Minimum splash time to prevent jarring flash
    const MIN_SPLASH_TIME = 300

    const route = async () => {
      // Prevent double-routing
      if (hasRoutedRef.current) return
      hasRoutedRef.current = true

      try {
        // Check if we already have cached prefetch data (user navigated back to /)
        const cachedData = getCachedPrefetchData()
        if (cachedData) {
          // Fast path: Use cached data and route immediately
          await ensureMinSplashTime(MIN_SPLASH_TIME)
          router.replace('/dashboard')
          return
        }

        // Get session (reads from local token first - near instant)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Session error:', sessionError)
          await ensureMinSplashTime(MIN_SPLASH_TIME)
          router.replace('/onboarding')
          return
        }

        // No session = not authenticated
        if (!session) {
          await ensureMinSplashTime(MIN_SPLASH_TIME)
          router.replace('/onboarding')
          return
        }

        // User is authenticated - check onboarding status and prefetch in parallel
        setState('routing')

        const [hasOnboarded] = await Promise.all([
          checkOnboardingStatus(session.user.id),
          // Start prefetching data even before we know destination
          // If user needs onboarding, this is wasted but fast
          // If user is returning, we've saved time
          prefetchDashboardData(session.user.id).catch(() => null),
        ])

        if (!hasOnboarded) {
          // User hasn't completed onboarding
          await ensureMinSplashTime(MIN_SPLASH_TIME)
          router.replace('/onboarding')
          return
        }

        // Authenticated + onboarded = go to dashboard
        await ensureMinSplashTime(MIN_SPLASH_TIME)
        router.replace('/dashboard')

      } catch (error) {
        console.error('Routing error:', error)

        // Check if offline
        if (!navigator.onLine) {
          setState('offline')
          return
        }

        // Default to onboarding on error
        await ensureMinSplashTime(MIN_SPLASH_TIME)
        router.replace('/onboarding')
      }
    }

    // Helper to ensure minimum splash time
    const ensureMinSplashTime = async (minTime: number) => {
      const elapsed = Date.now() - startTimeRef.current
      if (elapsed < minTime) {
        await new Promise(resolve => setTimeout(resolve, minTime - elapsed))
      }
    }

    // Start routing
    route()

    // Show "Almost ready..." after 2 seconds
    const slowTimer = setTimeout(() => {
      setShowSlowMessage(true)
    }, 2000)

    return () => {
      clearTimeout(slowTimer)
    }
  }, [router])

  // Handle offline state
  if (state === 'offline') {
    return (
      <div className="offline-container">
        <div className="offline-content">
          <span className="offline-icon">📡</span>
          <h2 className="offline-title">Looks like you're offline</h2>
          <p className="offline-message">Some features may be limited.</p>
          <button
            className="offline-button"
            onClick={() => router.replace('/dashboard')}
          >
            Continue anyway →
          </button>
        </div>

        <style jsx>{`
          .offline-container {
            position: fixed;
            inset: 0;
            background: linear-gradient(135deg, #f7f9fa 0%, #e8f4fd 50%, #f0f9ff 100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 24px;
          }

          .offline-content {
            text-align: center;
            max-width: 320px;
          }

          .offline-icon {
            font-size: clamp(48px, 12vw, 64px);
            display: block;
            margin-bottom: clamp(16px, 4vw, 24px);
          }

          .offline-title {
            font-size: clamp(20px, 5vw, 24px);
            font-weight: 700;
            color: #0f1419;
            margin: 0 0 clamp(8px, 2vw, 12px) 0;
          }

          .offline-message {
            font-size: clamp(14px, 3.5vw, 16px);
            color: #536471;
            margin: 0 0 clamp(24px, 6vw, 32px) 0;
          }

          .offline-button {
            padding: clamp(12px, 3vw, 16px) clamp(24px, 6vw, 32px);
            background: #1D9BF0;
            color: white;
            border: none;
            border-radius: 100px;
            font-size: clamp(14px, 3.5vw, 16px);
            font-weight: 700;
            cursor: pointer;
            transition: background 0.2s ease;
          }

          .offline-button:hover {
            background: #1a8cd8;
          }
        `}</style>
      </div>
    )
  }

  // Show splash screen while routing
  return <SplashScreen showSecondaryMessage={showSlowMessage} />
}
