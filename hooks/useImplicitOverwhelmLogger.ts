'use client'

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Headless hook that silently logs a high-overwhelm entry to burnout_logs
 * when the user mounts a crisis page (Ally / Brake).
 *
 * No UI — fire-and-forget.  The mere act of visiting these pages is treated
 * as a signal that the user is overwhelmed (score 8 out of 10).
 */
export function useImplicitOverwhelmLogger() {
  const logged = useRef(false)

  useEffect(() => {
    // Prevent double-fire in React Strict Mode
    if (logged.current) return
    logged.current = true

    const log = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      await supabase.from('burnout_logs').insert({
        user_id: session.user.id,
        overwhelm: 8,
        source: 'rescue_inference',
      })
    }

    log()
  }, [])
}
