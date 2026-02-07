'use client'

import { useEffect, useCallback } from 'react'

export interface ShortcutConfig {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
  handler: () => void
  description?: string
}

/**
 * Hook for registering global keyboard shortcuts
 */
export function useGlobalShortcuts(shortcuts: ShortcutConfig[]) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement
    const isInput = target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable

    for (const shortcut of shortcuts) {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
      const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : true
      const metaMatch = shortcut.meta ? event.metaKey : true
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey
      const altMatch = shortcut.alt ? event.altKey : !event.altKey

      // For Cmd/Ctrl+K, allow even in inputs
      const isCmdK = shortcut.key.toLowerCase() === 'k' && (shortcut.ctrl || shortcut.meta)

      if (keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch) {
        if (isInput && !isCmdK) {
          continue
        }

        event.preventDefault()
        shortcut.handler()
        return
      }
    }
  }, [shortcuts])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

/**
 * Hook specifically for the quick capture shortcut (Cmd/Ctrl + K)
 */
export function useQuickCaptureShortcut(onOpen: () => void) {
  useGlobalShortcuts([
    {
      key: 'k',
      ctrl: true,
      handler: onOpen,
      description: 'Open quick capture',
    },
  ])
}
