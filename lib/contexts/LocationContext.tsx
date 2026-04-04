'use client'

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import type { LocationState, SpoofFlags } from '@/lib/types'
import { CSRF_COOKIE_NAME } from '@/lib/csrf'
import {
  haversineDistance,
  isVelocityPlausible,
  hasNaturalJitter,
  POSITION_HISTORY_SIZE,
  MIN_JITTER_SAMPLES,
  MAX_PLAUSIBLE_SPEED_MS,
  type PositionSample,
} from '@/lib/location'

const CLEAN_SPOOF_FLAGS: SpoofFlags = { velocityAnomaly: false, noJitter: false }

const initialState: LocationState = {
  latitude: null,
  longitude: null,
  accuracy: null,
  currentZoneId: null,
  zoneLabel: null,
  isLoading: true,
  error: null,
  permissionDenied: false,
  spoofFlags: CLEAN_SPOOF_FLAGS,
}

const LocationContext = createContext<LocationState>(initialState)

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

  // Rolling window of recent GPS samples — used for velocity and jitter checks
  const positionHistoryRef = useRef<PositionSample[]>([])

  // Last coords/time that triggered a zone resolution — used to debounce API calls
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

      if (res.status === 401) return  // user logged out mid-session
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
      // Network errors shouldn't crash the app
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
        const now = Date.now()
        const newSample: PositionSample = { lat: latitude, lng: longitude, timestamp: now }
        const history = positionHistoryRef.current

        // ── Velocity check ────────────────────────────────────────────────────
        // Compare against the most recent sample. Flag transitions that are
        // faster than a commercial jet — physically impossible for a real user.
        const lastSample = history[history.length - 1] ?? null
        const velocityAnomaly = lastSample ? !isVelocityPlausible(lastSample, newSample) : false

        if (velocityAnomaly && lastSample) {
          const elapsedSecs = (now - lastSample.timestamp) / 1_000
          const distMetres = haversineDistance(lastSample.lat, lastSample.lng, latitude, longitude)
          const speedMs = elapsedSecs > 0 ? Math.round(distMetres / elapsedSecs) : 0
          console.warn('[LocationProvider] velocity anomaly — possible spoof or bad GPS fix', {
            speedMs,
            maxAllowedMs: MAX_PLAUSIBLE_SPEED_MS,
            from: { lat: lastSample.lat, lng: lastSample.lng },
            to: { lat: latitude, lng: longitude },
            elapsedSecs: Math.round(elapsedSecs),
          })
        }

        // ── Update rolling history ────────────────────────────────────────────
        positionHistoryRef.current = [...history, newSample].slice(-POSITION_HISTORY_SIZE)

        // ── Jitter check ──────────────────────────────────────────────────────
        // Real GPS always has sub-metre noise. Perfectly static readings across
        // multiple samples indicate a synthetic/emulated position.
        const noJitter = !hasNaturalJitter(positionHistoryRef.current)

        if (noJitter && positionHistoryRef.current.length >= MIN_JITTER_SAMPLES) {
          console.warn('[LocationProvider] no-jitter detected — possible static spoof', {
            sampleCount: positionHistoryRef.current.length,
            position: { latitude, longitude },
          })
        }

        // ── Update state ──────────────────────────────────────────────────────
        setState((prev) => ({
          ...prev,
          latitude,
          longitude,
          accuracy,
          isLoading: false,
          error: null,
          spoofFlags: { velocityAnomaly, noJitter },
        }))

        // ── Zone resolution (debounced) ───────────────────────────────────────
        const last = lastResolvedCoords.current
        const distMoved = last
          ? haversineDistance(last.lat, last.lng, latitude, longitude)
          : Infinity
        const timeSince = now - lastResolvedAt.current

        if (distMoved > 100 || timeSince > 60_000) {
          if (resolveTimeoutRef.current) clearTimeout(resolveTimeoutRef.current)
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
      },
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
