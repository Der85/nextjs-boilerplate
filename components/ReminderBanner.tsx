'use client'

import { useRemindersContext } from '@/lib/contexts/RemindersContext'

interface ReminderBannerProps {
  onViewAll: () => void
}

export default function ReminderBanner({ onViewAll }: ReminderBannerProps) {
  const { reminders, dismiss, snooze, completeTask } = useRemindersContext()
  // Only show important/overdue reminders as banners, max 2
  const importantReminders = reminders
    .filter(r => r.reminder_type === 'overdue' || r.priority === 'important')
    .slice(0, 2)

  if (importantReminders.length === 0) {
    return null
  }

  // If there are more important reminders, show "View all" prompt
  const hasMore = reminders.filter(r => r.reminder_type === 'overdue' || r.priority === 'important').length > 2

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      marginBottom: '16px',
    }}>
      {importantReminders.map(reminder => {
        const isOverdue = reminder.reminder_type === 'overdue'
        const bgColor = isOverdue ? 'var(--color-danger)' : 'var(--color-warning)'
        const categoryIcon = reminder.task?.category?.icon || '⏰'

        return (
          <div
            key={reminder.id}
            style={{
              background: `${bgColor}15`,
              border: `1px solid ${bgColor}40`,
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              {/* Icon */}
              <span style={{ fontSize: '18px' }}>
                {categoryIcon}
              </span>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 'var(--text-small)',
                  fontWeight: 600,
                  color: bgColor,
                  marginBottom: '2px',
                }}>
                  {isOverdue ? 'Overdue' : 'Due soon'}
                </div>
                <div style={{
                  fontSize: 'var(--text-body)',
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {reminder.task?.title || 'Task'}
                </div>
              </div>

              {/* Actions */}
              <div style={{
                display: 'flex',
                gap: '6px',
                flexShrink: 0,
              }}>
                <button
                  onClick={() => completeTask(reminder.task_id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: 'var(--color-success)',
                    color: '#fff',
                    fontSize: 'var(--text-small)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Done
                </button>
                <button
                  onClick={() => snooze(reminder.id, '30min')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${bgColor}40`,
                    background: 'var(--color-bg)',
                    color: 'var(--color-text-secondary)',
                    fontSize: 'var(--text-small)',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Later
                </button>
                <button
                  onClick={() => dismiss(reminder.id)}
                  aria-label="Dismiss"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--color-text-tertiary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )
      })}

      {/* View all link */}
      {hasMore && (
        <button
          onClick={onViewAll}
          style={{
            padding: '8px',
            background: 'transparent',
            border: 'none',
            color: 'var(--color-accent)',
            fontSize: 'var(--text-small)',
            fontWeight: 500,
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          View all reminders →
        </button>
      )}
    </div>
  )
}
