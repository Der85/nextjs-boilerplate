'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { apiFetch } from '@/lib/api-client'
import type { LocationState, Zone } from '@/lib/types'

const RESOLVE_INTERVAL_MS = 60_000        // Re-resolve zone every 60s
const MOVEMENT_THRESHOLD_M = 100          // Or on 100m+ movement

const LocationContext = createContext<LocationState & {
  requestPermission: () => void
  refreshZone: () => Promise<void>
}>({
  lat: null,
  lng: null,
  accuracy: null,
  currentZone: null,
  isLoading: true,
  error: null,
  permission: 'prompt',
  requestPermission: () => {},
  refreshZone: async () => {},
})

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // metres
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LocationState>({
    lat: null,
    lng: null,
    accuracy: null,
    currentZone: null,
    isLoading: true,
    error: null,
    permission: 'prompt',
  })

  const lastResolvedRef = useRef<{ lat: number; lng: number; time: number } | null>(null)
  const watchIdRef = useRef<number | null>(null)

  const resolveZone = useCallback(async (lat: number, lng: number) => {
    const last = lastResolvedRef.current
    if (last) {
      const distance = haversineDistance(last.lat, last.lng, lat, lng)
      const elapsed = Date.now() - last.time
      if (distance < MOVEMENT_THRESHOLD_M && elapsed < RESOLVE_INTERVAL_MS) return
    }

    lastResolvedRef.current = { lat, lng, time: Date.now() }

    try {
      const res = await apiFetch('/api/geo/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      })
      if (res.ok) {
        const data = await res.json()
        setState(prev => ({ ...prev, currentZone: data.zone as Zone }))
      }
    } catch {
      // Non-critical — keep last known zone
    }
  }, [])

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Geolocation not supported by your browser.',
        permission: 'unsupported',
      }))
      return
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords
        setState(prev => ({
          ...prev,
          lat: latitude,
          lng: longitude,
          accuracy,
          isLoading: false,
          error: null,
          permission: 'granted',
        }))
        resolveZone(latitude, longitude)
      },
      (err) => {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: err.code === 1 ? 'Location permission denied.' : 'Unable to get your location.',
          permission: err.code === 1 ? 'denied' : prev.permission,
        }))
      },
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: 10_000 }
    )
  }, [resolveZone])

  const requestPermission = useCallback(() => {
    startWatching()
  }, [startWatching])

  const refreshZone = useCallback(async () => {
    if (state.lat !== null && state.lng !== null) {
      lastResolvedRef.current = null // force re-resolve
      await resolveZone(state.lat, state.lng)
    }
  }, [state.lat, state.lng, resolveZone])

  useEffect(() => {
    // Check permission state if API is available
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setState(prev => ({
          ...prev,
          permission: result.state as LocationState['permission'],
        }))
        if (result.state === 'granted' || result.state === 'prompt') {
          startWatching()
        }
      }).catch(() => {
        // Permissions API not fully supported — just try watching
        startWatching()
      })
    } else {
      startWatching()
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [startWatching])

  return (
    <LocationContext.Provider value={{ ...state, requestPermission, refreshZone }}>
      {children}
    </LocationContext.Provider>
  )
}

export function useLocation() {
  return useContext(LocationContext)
}
