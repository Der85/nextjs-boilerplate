'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface GamificationPrefs {
  showXP: boolean
  showBadges: boolean
  showStreaks: boolean
}

interface GamificationPrefsContextType {
  prefs: GamificationPrefs
  setPrefs: (prefs: GamificationPrefs) => void
  toggleXP: () => void
  toggleBadges: () => void
  toggleStreaks: () => void
  toggleAll: (enabled: boolean) => void
  isAnyEnabled: boolean
  // Maintenance Days
  maintenanceDays: string[]
  addMaintenanceDay: () => boolean
  isMaintenanceDay: (date: Date) => boolean
  canAddMaintenanceDay: () => boolean
  maintenanceDaysThisWeek: number
}

const defaultPrefs: GamificationPrefs = {
  showXP: true,
  showBadges: true,
  showStreaks: true,
}

// Helper: Get date string in YYYY-MM-DD format
const getDateString = (date: Date): string => {
  return date.toISOString().split('T')[0]
}

// Helper: Get start of current week (Sunday)
const getWeekStart = (date: Date): Date => {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

const GamificationPrefsContext = createContext<GamificationPrefsContextType | undefined>(undefined)

export function GamificationPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<GamificationPrefs>(defaultPrefs)
  const [maintenanceDays, setMaintenanceDays] = useState<string[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gamification_prefs')
      if (saved) {
        const parsed = JSON.parse(saved)
        setPrefsState({ ...defaultPrefs, ...parsed })
      }
      const savedMaintenance = localStorage.getItem('maintenance_days')
      if (savedMaintenance) {
        setMaintenanceDays(JSON.parse(savedMaintenance))
      }
    } catch {
      // Use defaults if localStorage fails
    }
    setIsLoaded(true)
  }, [])

  // Save to localStorage when prefs change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem('gamification_prefs', JSON.stringify(prefs))
      } catch {
        // Silently fail if localStorage unavailable
      }
    }
  }, [prefs, isLoaded])

  // Save maintenance days to localStorage
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem('maintenance_days', JSON.stringify(maintenanceDays))
      } catch {
        // Silently fail if localStorage unavailable
      }
    }
  }, [maintenanceDays, isLoaded])

  const setPrefs = (newPrefs: GamificationPrefs) => {
    setPrefsState(newPrefs)
  }

  const toggleXP = () => {
    setPrefsState(prev => ({ ...prev, showXP: !prev.showXP }))
  }

  const toggleBadges = () => {
    setPrefsState(prev => ({ ...prev, showBadges: !prev.showBadges }))
  }

  const toggleStreaks = () => {
    setPrefsState(prev => ({ ...prev, showStreaks: !prev.showStreaks }))
  }

  const toggleAll = (enabled: boolean) => {
    setPrefsState({
      showXP: enabled,
      showBadges: enabled,
      showStreaks: enabled,
    })
  }

  const isAnyEnabled = prefs.showXP || prefs.showBadges || prefs.showStreaks

  // Maintenance Days: Check if a date is a maintenance day
  const isMaintenanceDay = (date: Date): boolean => {
    const dateStr = getDateString(date)
    return maintenanceDays.includes(dateStr)
  }

  // Count maintenance days in current week
  const maintenanceDaysThisWeek = (() => {
    const weekStart = getWeekStart(new Date())
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    return maintenanceDays.filter(dayStr => {
      const day = new Date(dayStr)
      return day >= weekStart && day < weekEnd
    }).length
  })()

  // Can add a maintenance day? (limit: 2 per week)
  const canAddMaintenanceDay = (): boolean => {
    const today = getDateString(new Date())
    // Can't add if today is already a maintenance day
    if (maintenanceDays.includes(today)) return false
    // Limit to 2 per week
    return maintenanceDaysThisWeek < 2
  }

  // Add today as a maintenance day
  const addMaintenanceDay = (): boolean => {
    if (!canAddMaintenanceDay()) return false
    const today = getDateString(new Date())
    setMaintenanceDays(prev => [...prev, today])
    return true
  }

  return (
    <GamificationPrefsContext.Provider
      value={{
        prefs,
        setPrefs,
        toggleXP,
        toggleBadges,
        toggleStreaks,
        toggleAll,
        isAnyEnabled,
        maintenanceDays,
        addMaintenanceDay,
        isMaintenanceDay,
        canAddMaintenanceDay,
        maintenanceDaysThisWeek,
      }}
    >
      {children}
    </GamificationPrefsContext.Provider>
  )
}

export function useGamificationPrefs() {
  const context = useContext(GamificationPrefsContext)
  if (context === undefined) {
    throw new Error('useGamificationPrefs must be used within a GamificationPrefsProvider')
  }
  return context
}

// Hook that returns defaults if context not available (for components that may render outside provider)
export function useGamificationPrefsSafe(): GamificationPrefsContextType {
  const context = useContext(GamificationPrefsContext)
  if (context === undefined) {
    return {
      prefs: defaultPrefs,
      setPrefs: () => {},
      toggleXP: () => {},
      toggleBadges: () => {},
      toggleStreaks: () => {},
      toggleAll: () => {},
      isAnyEnabled: true,
      maintenanceDays: [],
      addMaintenanceDay: () => false,
      isMaintenanceDay: () => false,
      canAddMaintenanceDay: () => true,
      maintenanceDaysThisWeek: 0,
    }
  }
  return context
}
