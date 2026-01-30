'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

// ============================================
// Types
// ============================================
interface PresenceState {
  id: string
  online_at: string
  is_focusing: boolean
  // Optional: spirit animal for visual representation
  spirit_animal?: string
}

interface UsePresenceOptions {
  isFocusing?: boolean
  roomName?: string
}

interface UsePresenceReturn {
  onlineCount: number
  focusingCount: number
  otherUsers: PresenceState[]
  isConnected: boolean
  updateFocusStatus: (isFocusing: boolean) => void
}

// Spirit animals for anonymous user visualization
const SPIRIT_ANIMALS = [
  '🦊', '🦁', '🐼', '🦉', '🐯', '🦋', '🐺', '🦄', '🐨', '🦈',
  '🐙', '🦜', '🐬', '🦩', '🐘', '🦔', '🐝', '🦥', '🐳', '🦧',
  '🐢', '🦚', '🐻', '🐲', '🦅', '🐸', '🦎', '🐾', '🦭', '🐿️'
]

// Generate consistent spirit animal from user ID
const getSpiritAnimal = (userId: string): string => {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return SPIRIT_ANIMALS[Math.abs(hash) % SPIRIT_ANIMALS.length]
}

// ============================================
// Hook
// ============================================
export function usePresence(options: UsePresenceOptions = {}): UsePresenceReturn {
  const { 
    isFocusing = false, 
    roomName = 'room_global' 
  } = options

  const [onlineCount, setOnlineCount] = useState(0)
  const [focusingCount, setFocusingCount] = useState(0)
  const [otherUsers, setOtherUsers] = useState<PresenceState[]>([])
  const [isConnected, setIsConnected] = useState(false)
  
  const channelRef = useRef<RealtimeChannel | null>(null)
  const userIdRef = useRef<string | null>(null)
  const isFocusingRef = useRef(isFocusing)

  // Keep ref in sync with prop
  useEffect(() => {
    isFocusingRef.current = isFocusing
  }, [isFocusing])

  // Update focus status without re-subscribing
  const updateFocusStatus = useCallback(async (newFocusStatus: boolean) => {
    isFocusingRef.current = newFocusStatus
    
    if (channelRef.current && userIdRef.current) {
      await channelRef.current.track({
        id: userIdRef.current,
        online_at: new Date().toISOString(),
        is_focusing: newFocusStatus,
        spirit_animal: getSpiritAnimal(userIdRef.current)
      })
    }
  }, [])

  useEffect(() => {
    let channel: RealtimeChannel | null = null
    let mounted = true

    const setupPresence = async () => {
      try {
        // Get current user
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user || !mounted) return

        const userId = session.user.id
        userIdRef.current = userId
        const spiritAnimal = getSpiritAnimal(userId)

        // Create presence channel
        channel = supabase.channel(roomName, {
          config: {
            presence: {
              key: userId,
            },
          },
        })

        channelRef.current = channel

        // Handle presence sync events
        channel.on('presence', { event: 'sync' }, () => {
          if (!mounted) return

          const presenceState = channel?.presenceState() || {}
          
          // Extract all users from presence state
          const allUsers: PresenceState[] = []
          
          Object.entries(presenceState).forEach(([key, presences]) => {
            // Each key can have multiple presence objects (same user, multiple tabs)
            // We take the most recent one
            const latestPresence = (presences as any[])[0]
            if (latestPresence) {
              allUsers.push({
                id: key,
                online_at: latestPresence.online_at || new Date().toISOString(),
                is_focusing: latestPresence.is_focusing || false,
                spirit_animal: latestPresence.spirit_animal || getSpiritAnimal(key)
              })
            }
          })

          // Filter out current user for "other users" list
          const others = allUsers.filter(u => u.id !== userId)
          
          // Calculate counts
          const total = allUsers.length
          const focusing = allUsers.filter(u => u.is_focusing).length

          setOnlineCount(total)
          setFocusingCount(focusing)
          setOtherUsers(others)
        })

        // Handle join events (optional - for real-time notifications)
        channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
          if (!mounted) return
          console.log(`[Presence] User joined: ${key}`, newPresences)
        })

        // Handle leave events (optional - for real-time notifications)
        channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          if (!mounted) return
          console.log(`[Presence] User left: ${key}`, leftPresences)
        })

        // Subscribe to channel
        await channel.subscribe(async (status) => {
          if (!mounted) return

          if (status === 'SUBSCRIBED') {
            setIsConnected(true)
            
            // Track our presence
            await channel?.track({
              id: userId,
              online_at: new Date().toISOString(),
              is_focusing: isFocusingRef.current,
              spirit_animal: spiritAnimal
            })
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setIsConnected(false)
          }
        })

      } catch (error) {
        console.error('[Presence] Error setting up presence:', error)
        if (mounted) {
          setIsConnected(false)
        }
      }
    }

    setupPresence()

    // Cleanup function
    return () => {
      mounted = false
      
      if (channel) {
        // Untrack presence before unsubscribing
        channel.untrack().then(() => {
          supabase.removeChannel(channel!)
        }).catch((err) => {
          console.error('[Presence] Error during cleanup:', err)
          supabase.removeChannel(channel!)
        })
      }
      
      channelRef.current = null
      userIdRef.current = null
    }
  }, [roomName]) // Only re-run if roomName changes

  return {
    onlineCount,
    focusingCount,
    otherUsers,
    isConnected,
    updateFocusStatus
  }
}

// ============================================
// Helper Hook: usePresenceWithFallback
// Uses real presence when available, falls back to simulated data
// ============================================
export function usePresenceWithFallback(options: UsePresenceOptions = {}): UsePresenceReturn & { isSimulated: boolean } {
  const presence = usePresence(options)
  const [fallbackData, setFallbackData] = useState<{
    onlineCount: number
    focusingCount: number
    otherUsers: PresenceState[]
  } | null>(null)

  // Generate fallback data on mount (for when real presence isn't working)
  useEffect(() => {
    const generateFallback = () => {
      const count = Math.floor(Math.random() * 41) + 12 // 12-52 users
      const users: PresenceState[] = []
      
      for (let i = 0; i < count - 1; i++) { // -1 because we're one of them
        const id = `simulated-${i}`
        users.push({
          id,
          online_at: new Date().toISOString(),
          is_focusing: Math.random() > 0.6,
          spirit_animal: SPIRIT_ANIMALS[i % SPIRIT_ANIMALS.length]
        })
      }

      setFallbackData({
        onlineCount: count,
        focusingCount: users.filter(u => u.is_focusing).length + (options.isFocusing ? 1 : 0),
        otherUsers: users
      })
    }

    generateFallback()
  }, [options.isFocusing])

  // Use real data if connected and has users, otherwise fallback
  const useRealData = presence.isConnected && presence.onlineCount > 0
  
  return {
    onlineCount: useRealData ? presence.onlineCount : (fallbackData?.onlineCount || 1),
    focusingCount: useRealData ? presence.focusingCount : (fallbackData?.focusingCount || 0),
    otherUsers: useRealData ? presence.otherUsers : (fallbackData?.otherUsers || []),
    isConnected: presence.isConnected,
    isSimulated: !useRealData,
    updateFocusStatus: presence.updateFocusStatus
  }
}

export default usePresence
