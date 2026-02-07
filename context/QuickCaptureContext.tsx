'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import QuickCapture from '@/components/QuickCapture'
import { useQuickCaptureShortcut } from '@/hooks/useGlobalShortcuts'

interface QuickCaptureContextType {
  openCapture: () => void
  closeCapture: () => void
  isOpen: boolean
}

const QuickCaptureContext = createContext<QuickCaptureContextType | null>(null)

interface QuickCaptureProviderProps {
  children: ReactNode
}

export function QuickCaptureProvider({ children }: QuickCaptureProviderProps) {
  const [isOpen, setIsOpen] = useState(false)

  const openCapture = useCallback(() => {
    setIsOpen(true)
  }, [])

  const closeCapture = useCallback(() => {
    setIsOpen(false)
  }, [])

  // Register global shortcut (Cmd/Ctrl + K)
  useQuickCaptureShortcut(openCapture)

  return (
    <QuickCaptureContext.Provider value={{ openCapture, closeCapture, isOpen }}>
      {children}
      <QuickCapture
        isOpen={isOpen}
        onClose={closeCapture}
        source="quick_capture"
      />
    </QuickCaptureContext.Provider>
  )
}

export function useQuickCapture(): QuickCaptureContextType {
  const context = useContext(QuickCaptureContext)
  if (!context) {
    throw new Error('useQuickCapture must be used within QuickCaptureProvider')
  }
  return context
}

/**
 * Safe version that returns a no-op if not within provider
 */
export function useQuickCaptureSafe(): QuickCaptureContextType {
  const context = useContext(QuickCaptureContext)
  return context || {
    openCapture: () => {},
    closeCapture: () => {},
    isOpen: false,
  }
}
