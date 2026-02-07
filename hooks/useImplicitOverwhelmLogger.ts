'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'

/**
 * TRANSPARENT Overwhelm Logger
 *
 * Instead of silently logging overwhelm data, this hook:
 * 1. Shows the user a notification that we noticed they need support
 * 2. Gives them the option to confirm, adjust, or dismiss the logging
 * 3. Only logs data with explicit user consent
 *
 * This respects user autonomy and builds trust.
 */

interface UseTransparentOverwhelmLoggerReturn {
  showNotification: boolean
  isLogged: boolean
  handleConfirm: () => Promise<void>
  handleAdjust: (score: number) => Promise<void>
  handleDismiss: () => void
}

export function useImplicitOverwhelmLogger(): UseTransparentOverwhelmLoggerReturn {
  const supabase = createClient()
  const initialized = useRef(false)
  const [showNotification, setShowNotification] = useState(false)
  const [isLogged, setIsLogged] = useState(false)

  useEffect(() => {
    // Prevent double-fire in React Strict Mode
    if (initialized.current) return
    initialized.current = true

    // Check if user is authenticated before showing notification
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // Show notification after a short delay (let page load first)
        setTimeout(() => setShowNotification(true), 1500)
      }
    }
    checkAuth()
  }, [])

  const logOverwhelm = useCallback(async (score: number) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    await supabase.from('burnout_logs').insert({
      user_id: session.user.id,
      overwhelm: score,
      source: 'support_page_visit', // More transparent source name
    })
    setIsLogged(true)
  }, [])

  const handleConfirm = useCallback(async () => {
    await logOverwhelm(8) // Default high overwhelm
    setShowNotification(false)
  }, [logOverwhelm])

  const handleAdjust = useCallback(async (score: number) => {
    await logOverwhelm(score)
    setShowNotification(false)
  }, [logOverwhelm])

  const handleDismiss = useCallback(() => {
    setShowNotification(false)
    // Don't log anything - user declined
  }, [])

  return {
    showNotification,
    isLogged,
    handleConfirm,
    handleAdjust,
    handleDismiss,
  }
}
