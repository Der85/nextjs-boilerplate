'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import type { LocationState } from '@/lib/types'
import { CSRF_COOKIE_NAME } from '@/lib/csrf'

const initialState: LocationState = {
  latitude: null,
  longitude: null,
  accuracy: null,
  currentZoneId: null,
  zoneLabel: null,
  isLoading: true,
  error: null,
  permissionDenied: false,
}

const LocationContext = createContext<LocationState>(initialState)

// Haversine formula — returns distance between two coords in metres
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000
  const toRad = (x: number) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getCsrfToken(): string {
  return (
    document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${CSRF_COOKIE_NAME}=`))
      ?.split('=')[1] ?? ''
  )
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LocationState>(initialState)

  // Track last resolved coords + time to debounce zone resolution
  const lastResolvedCoords = useRef<{ lat: number; lng: number } | null>(null)
  const lastResolvedAt = useRef<number>(0)
  const resolveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resolveZone = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch('/api/geo/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
      })

      if (res.status === 401) return  // User logged out mid-session — ignore silently
      if (!res.ok) return

      const data = await res.json() as { zoneId: string; zoneLabel: string }
      setState((prev) => ({
        ...prev,
        currentZoneId: data.zoneId,
        zoneLabel: data.zoneLabel,
      }))
      lastResolvedCoords.current = { lat, lng }
      lastResolvedAt.current = Date.now()
    } catch {
      // Network errors shouldn't crash the app — silently skip
    }
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Geolocation is not supported by this browser',
      }))
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        setState((prev) => ({ ...prev, latitude, longitude, accuracy, isLoading: false, error: null }))

        const now = Date.now()
        const last = lastResolvedCoords.current
        const distMoved = last
          ? haversineDistance(last.lat, last.lng, latitude, longitude)
          : Infinity
        const timeSince = now - lastResolvedAt.current

        // Resolve zone if moved >100m or >60s since last resolve
        if (distMoved > 100 || timeSince > 60_000) {
          if (resolveTimeoutRef.current) clearTimeout(resolveTimeoutRef.current)
          // Small debounce so rapid GPS updates don't fire multiple requests
          resolveTimeoutRef.current = setTimeout(() => resolveZone(latitude, longitude), 500)
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState((prev) => ({ ...prev, isLoading: false, permissionDenied: true }))
        } else {
          setState((prev) => ({ ...prev, isLoading: false, error: err.message }))
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 30_000,
      }
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
      if (resolveTimeoutRef.current) clearTimeout(resolveTimeoutRef.current)
    }
  }, [resolveZone])

  return (
    <LocationContext.Provider value={state}>
      {children}
    </LocationContext.Provider>
  )
}

export function useLocation(): LocationState {
  return useContext(LocationContext)
}
