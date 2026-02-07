'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import {
  type DailyCheckinWithMetadata,
  type AdaptiveState,
  DEFAULT_ADAPTIVE_STATE,
} from '@/lib/types/daily-checkin'

interface DailyCheckinContextType {
  checkin: DailyCheckinWithMetadata | null
  adaptiveState: AdaptiveState
  needsCheckinToday: boolean
  loading: boolean
  showCheckinModal: boolean
  openCheckinModal: () => void
  closeCheckinModal: () => void
  dismissCheckinPrompt: () => void
  refreshCheckin: () => Promise<void>
  updateAdaptiveState: (state: AdaptiveState) => void
}

const DailyCheckinContext = createContext<DailyCheckinContextType | null>(null)

const DISMISS_KEY = 'daily_checkin_dismissed'

export function DailyCheckinProvider({ children }: { children: ReactNode }) {
  const [checkin, setCheckin] = useState<DailyCheckinWithMetadata | null>(null)
  const [adaptiveState, setAdaptiveState] = useState<AdaptiveState>(DEFAULT_ADAPTIVE_STATE)
  const [needsCheckinToday, setNeedsCheckinToday] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showCheckinModal, setShowCheckinModal] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }, [])

  const refreshCheckin = useCallback(async () => {
    try {
      const token = await getAuthToken()
      if (!token) {
        setLoading(false)
        return
      }

      const res = await fetch('/api/daily-checkin', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setCheckin(data.checkin)
        setAdaptiveState(data.adaptive_state)
        setNeedsCheckinToday(data.needs_checkin_today)
      }
    } catch (err) {
      console.error('Error fetching check-in:', err)
    } finally {
      setLoading(false)
    }
  }, [getAuthToken])

  // Check if dismissed today
  useEffect(() => {
    const dismissedDate = localStorage.getItem(DISMISS_KEY)
    const today = new Date().toISOString().split('T')[0]
    setDismissed(dismissedDate === today)
  }, [])

  // Initial fetch
  useEffect(() => {
    refreshCheckin()
  }, [refreshCheckin])

  // Auto-show modal if needed and not dismissed
  useEffect(() => {
    if (!loading && needsCheckinToday && !dismissed && !showCheckinModal) {
      // Small delay for better UX
      const timer = setTimeout(() => {
        setShowCheckinModal(true)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [loading, needsCheckinToday, dismissed, showCheckinModal])

  const openCheckinModal = useCallback(() => {
    setShowCheckinModal(true)
  }, [])

  const closeCheckinModal = useCallback(() => {
    setShowCheckinModal(false)
  }, [])

  const dismissCheckinPrompt = useCallback(() => {
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem(DISMISS_KEY, today)
    setDismissed(true)
    setShowCheckinModal(false)
  }, [])

  const updateAdaptiveState = useCallback((state: AdaptiveState) => {
    setAdaptiveState(state)
    setNeedsCheckinToday(false)
    setShowCheckinModal(false)
  }, [])

  return (
    <DailyCheckinContext.Provider
      value={{
        checkin,
        adaptiveState,
        needsCheckinToday,
        loading,
        showCheckinModal,
        openCheckinModal,
        closeCheckinModal,
        dismissCheckinPrompt,
        refreshCheckin,
        updateAdaptiveState,
      }}
    >
      {children}
    </DailyCheckinContext.Provider>
  )
}

export function useDailyCheckin(): DailyCheckinContextType {
  const context = useContext(DailyCheckinContext)
  if (!context) {
    throw new Error('useDailyCheckin must be used within DailyCheckinProvider')
  }
  return context
}

export function useDailyCheckinSafe(): DailyCheckinContextType {
  const context = useContext(DailyCheckinContext)
  return context || {
    checkin: null,
    adaptiveState: DEFAULT_ADAPTIVE_STATE,
    needsCheckinToday: false,
    loading: false,
    showCheckinModal: false,
    openCheckinModal: () => {},
    closeCheckinModal: () => {},
    dismissCheckinPrompt: () => {},
    refreshCheckin: async () => {},
    updateAdaptiveState: () => {},
  }
}
