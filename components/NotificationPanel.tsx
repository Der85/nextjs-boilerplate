'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ReminderWithTask, SnoozeDuration, ReminderPriority } from '@/lib/types'
import { getReminderPriorityColor } from '@/lib/theme'
import { useRemindersContext } from '@/lib/contexts/RemindersContext'

interface NotificationPanelProps {
  onClose: () => void
}

const SNOOZE_OPTIONS: { value: SnoozeDuration; label: string }[] = [
  { value: '10min', label: 'In 10 min' },
  { value: '30min', label: 'In 30 min' },
  { value: '1hour', label: 'In 1 hour' },
  { value: 'after_lunch', label: 'After lunch' },
  { value: 'tomorrow_morning', label: 'Tomorrow morning' },
]


function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60 * 1000) {
    return 'Just now'
  }
  if (diff < 60 * 60 * 1000) {
    const mins = Math.floor(diff / (60 * 1000))
    return `${mins} min ago`
  }
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000))
    return `${hours}h ago`
  }
  const days = Math.floor(diff / (24 * 60 * 60 * 1000))
  return `${days}d ago`
}

// Pending action type for exit animation callback
type PendingAction =
  | { type: 'dismiss'; id: string }
  | { type: 'snooze'; id: string; duration: SnoozeDuration }
  | { type: 'complete'; taskId: string }

interface ReminderItemProps {
  reminder: ReminderWithTask
  onMarkAsRead: (id: string) => Promise<void>
  onDismiss: (id: string) => Promise<void>
  onSnooze: (id: string, duration: SnoozeDuration) => Promise<void>
  onCompleteTask: (taskId: string) => Promise<void>
  onStartExit: (id: string) => void
  isExiting: boolean
}

function ReminderItem({
  reminder,
  onMarkAsRead,
  onDismiss,
  onSnooze,
  onCompleteTask,
  onStartExit,
  isExiting,
}: ReminderItemProps) {
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false)
  const pendingActionRef = useRef<PendingAction | null>(null)

  const categoryIcon = reminder.task?.category?.icon || '📋'
  const categoryColor = reminder.task?.category?.color || 'var(--color-accent)'
  const isUnread = !reminder.read_at
  const isSnoozed = !!reminder.snoozed_until

  const handleClick = () => {
    if (isUnread) {
      onMarkAsRead(reminder.id)
    }
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    pendingActionRef.current = { type: 'dismiss', id: reminder.id }
    onStartExit(reminder.id)
  }

  const handleSnooze = (duration: SnoozeDuration) => {
    setShowSnoozeOptions(false)
    pendingActionRef.current = { type: 'snooze', id: reminder.id, duration }
    onStartExit(reminder.id)
  }

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation()
    pendingActionRef.current = { type: 'complete', taskId: reminder.task_id }
    onStartExit(reminder.id)
  }

  // Called by AnimatePresence when exit animation completes
  const handleExitComplete = () => {
    const action = pendingActionRef.current
    if (!action) return

    switch (action.type) {
      case 'dismiss':
        onDismiss(action.id)
        break
      case 'snooze':
        onSnooze(action.id, action.duration)
        break
      case 'complete':
        onCompleteTask(action.taskId)
        break
    }
    pendingActionRef.current = null
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 1, x: 0, height: 'auto' }}
      animate={{ opacity: isExiting ? 0 : 1, x: isExiting ? 20 : 0 }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onAnimationComplete={() => {
        if (isExiting) handleExitComplete()
      }}
      onClick={handleClick}
      style={{
        padding: '12px',
        borderBottom: '1px solid var(--color-border)',
        background: isUnread ? `${categoryColor}08` : 'transparent',
        cursor: 'pointer',
        opacity: isSnoozed ? 0.6 : 1,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', gap: '10px' }}>
        {/* Priority dot + Category icon */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: getReminderPriorityColor(reminder.priority),
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: '16px',
            width: '24px',
            height: '24px',
            borderRadius: 'var(--radius-sm)',
            background: `${categoryColor}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {categoryIcon}
          </span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '8px',
            marginBottom: '4px',
          }}>
            <h4 style={{
              fontSize: 'var(--text-body)',
              fontWeight: isUnread ? 600 : 500,
              color: 'var(--color-text-primary)',
              margin: 0,
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {reminder.title}
            </h4>

            {/* Dismiss X */}
            <button
              onClick={handleDismiss}
              aria-label="Dismiss"
              style={{
                width: '20px',
                height: '20px',
                border: 'none',
                background: 'transparent',
                color: 'var(--color-text-tertiary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <p style={{
            fontSize: 'var(--text-small)',
            color: 'var(--color-text-secondary)',
            margin: '0 0 8px 0',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {reminder.message}
          </p>

          {/* Time + Actions */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
          }}>
            <span style={{
              fontSize: 'var(--text-caption)',
              color: 'var(--color-text-tertiary)',
            }}>
              {isSnoozed
                ? `Snoozed until ${new Date(reminder.snoozed_until!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : formatTimeAgo(reminder.delivered_at || reminder.scheduled_for)}
            </span>

            <div style={{ flex: 1 }} />

            {/* Mark Done */}
            <button
              onClick={handleComplete}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'var(--color-success)',
                color: '#fff',
                fontSize: 'var(--text-caption)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Done
            </button>

            {/* Snooze dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowSnoozeOptions(!showSnoozeOptions)
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--text-caption)',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                Snooze
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {showSnoozeOptions && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    right: 0,
                    marginBottom: '4px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    overflow: 'hidden',
                    zIndex: 10,
                    minWidth: '160px',
                  }}
                >
                  {SNOOZE_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      onClick={() => handleSnooze(option.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--color-text-primary)',
                        fontSize: 'var(--text-small)',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function NotificationPanel({ onClose }: NotificationPanelProps) {
  const {
    reminders,
    loading,
    markAsRead,
    dismiss,
    snooze,
    clearAll,
    completeTask,
  } = useRemindersContext()

  // Track which items are in the process of exiting
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set())

  const handleStartExit = (id: string) => {
    setExitingIds(prev => new Set(prev).add(id))
  }

  const handleClearAll = async () => {
    await clearAll()
    onClose()
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: 'min(360px, calc(100vw - 32px))',
        maxHeight: '70vh',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        zIndex: 100,
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg)',
      }}>
        <h3 style={{
          fontSize: 'var(--text-body)',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          margin: 0,
        }}>
          Reminders
        </h3>

        {reminders.length > 0 && (
          <button
            onClick={handleClearAll}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'transparent',
              color: 'var(--color-text-tertiary)',
              fontSize: 'var(--text-caption)',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Clear All
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{
        maxHeight: 'calc(70vh - 50px)',
        overflowY: 'auto',
      }}>
        {loading ? (
          <div style={{ padding: '12px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
                <div className="skeleton" style={{ height: '14px', width: '70%', marginBottom: '8px', borderRadius: 'var(--radius-sm)' }} />
                <div className="skeleton" style={{ height: '12px', width: '90%', marginBottom: '6px', borderRadius: 'var(--radius-sm)' }} />
                <div className="skeleton" style={{ height: '10px', width: '40%', borderRadius: 'var(--radius-sm)' }} />
              </div>
            ))}
          </div>
        ) : reminders.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {reminders.map(reminder => (
              <ReminderItem
                key={reminder.id}
                reminder={reminder}
                onMarkAsRead={markAsRead}
                onDismiss={dismiss}
                onSnooze={snooze}
                onCompleteTask={completeTask}
                onStartExit={handleStartExit}
                isExiting={exitingIds.has(reminder.id)}
              />
            ))}
          </AnimatePresence>
        ) : (
          <div style={{
            padding: '40px 24px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>
              🎯
            </div>
            <p style={{
              fontSize: 'var(--text-body)',
              color: 'var(--color-text-secondary)',
              margin: 0,
            }}>
              No reminders right now.
            </p>
            <p style={{
              fontSize: 'var(--text-small)',
              color: 'var(--color-text-tertiary)',
              margin: '8px 0 0 0',
            }}>
              Stay focused!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
