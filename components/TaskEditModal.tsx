'use client'

import type { TaskWithCategory, Category } from '@/lib/types'
import { getTodayISO, getTomorrowISO, getWeekendISO, getNextWeekISO } from '@/lib/utils/dates'
import { RECURRENCE_OPTIONS } from '@/lib/utils/recurrence'
import CategoryChip from './CategoryChip'
import SaveAsTemplateSection from './SaveAsTemplateSection'
import { useTaskEditForm } from '@/lib/hooks/useTaskEditForm'

interface TaskEditModalProps {
  task: TaskWithCategory
  categories: Category[]
  isOpen: boolean
  onClose: () => void
  onSave: (id: string, updates: Partial<TaskWithCategory>) => void
}

const PRIORITY_OPTIONS: Array<{ value: 'low' | 'medium' | 'high'; label: string; color: string }> = [
  { value: 'low', label: 'Low', color: 'var(--color-text-tertiary)' },
  { value: 'medium', label: 'Medium', color: 'var(--color-accent)' },
  { value: 'high', label: 'High', color: 'var(--color-warning)' },
]

const DATE_PRESETS = [
  { label: 'Today', getValue: getTodayISO },
  { label: 'Tomorrow', getValue: getTomorrowISO },
  { label: 'Weekend', getValue: getWeekendISO },
  { label: 'Next week', getValue: getNextWeekISO },
  { label: 'No date', getValue: () => null },
]

export default function TaskEditModal({
  task,
  categories,
  isOpen,
  onClose,
  onSave,
}: TaskEditModalProps) {
  const form = useTaskEditForm({ task, isOpen, onSave, onClose })

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
    if (e.key === 'Enter' && e.metaKey) {
      form.handleSave()
    }
  }

  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '16px',
        animation: 'fade-in 0.15s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-bg)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '420px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <h2 style={{
            fontSize: 'var(--text-subheading)',
            fontWeight: 'var(--font-heading)',
            color: 'var(--color-text-primary)',
            margin: 0,
          }}>
            Edit Task
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              background: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
            }}
          >
            x
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px' }}>
          {/* Title */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: 'var(--text-small)',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Task
            </label>
            <input
              ref={form.titleRef}
              type="text"
              value={form.title}
              onChange={(e) => form.setTitle(e.target.value)}
              placeholder="What needs to be done?"
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-body)',
                color: 'var(--color-text-primary)',
                background: 'var(--color-bg)',
              }}
            />
          </div>

          {/* Due Date */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: 'var(--text-small)',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Due Date
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {DATE_PRESETS.map((preset) => {
                const presetValue = preset.getValue()
                const isSelected = form.dueDate === presetValue
                return (
                  <button
                    key={preset.label}
                    onClick={() => form.setDueDate(presetValue)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-full)',
                      border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                      background: isSelected ? 'var(--color-accent-subtle)' : 'var(--color-bg)',
                      color: isSelected ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                      fontSize: 'var(--text-caption)',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
            <input
              type="date"
              value={form.dueDate || ''}
              onChange={(e) => form.setDueDate(e.target.value || null)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-primary)',
                background: 'var(--color-bg)',
              }}
            />
          </div>

          {/* Due Time (optional) */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: 'var(--text-small)',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Time (optional)
            </label>
            <input
              type="time"
              value={form.dueTime || ''}
              onChange={(e) => form.setDueTime(e.target.value || null)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-primary)',
                background: 'var(--color-bg)',
              }}
            />
          </div>

          {/* Priority */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: 'var(--text-small)',
              fontWeight: 600,
              color: 'var(--color-text-secondary)',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Priority
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {PRIORITY_OPTIONS.map((opt) => {
                const isSelected = form.priority === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => form.setPriority(isSelected ? null : opt.value)}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected ? `2px solid ${opt.color}` : '1px solid var(--color-border)',
                      background: isSelected ? `${opt.color}15` : 'var(--color-bg)',
                      color: isSelected ? opt.color : 'var(--color-text-secondary)',
                      fontSize: 'var(--text-caption)',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Category */}
          {categories.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: 'var(--text-small)',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Category
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <CategoryChip
                  name="None"
                  color="var(--color-text-tertiary)"
                  selected={!form.categoryId}
                  onClick={() => form.setCategoryId(null)}
                />
                {categories.map((cat) => (
                  <CategoryChip
                    key={cat.id}
                    name={cat.name}
                    color={cat.color}
                    icon={cat.icon}
                    selected={form.categoryId === cat.id}
                    onClick={() => form.setCategoryId(form.categoryId === cat.id ? null : cat.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recurrence */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}>
              <label style={{
                fontSize: 'var(--text-small)',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Repeat
              </label>
              <button
                onClick={() => {
                  form.setIsRecurring(!form.isRecurring)
                  if (!form.isRecurring && !form.recurrenceFrequency) {
                    form.setRecurrenceFrequency('daily')
                  }
                }}
                style={{
                  width: '48px',
                  height: '28px',
                  borderRadius: '14px',
                  border: 'none',
                  background: form.isRecurring ? 'var(--color-accent)' : 'var(--color-border)',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute',
                  top: '3px',
                  left: form.isRecurring ? '23px' : '3px',
                  width: '22px',
                  height: '22px',
                  borderRadius: '11px',
                  background: '#fff',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </button>
            </div>

            {form.isRecurring && (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {RECURRENCE_OPTIONS.map((opt) => {
                    const isSelected = form.recurrenceFrequency === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => form.setRecurrenceFrequency(opt.value)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 'var(--radius-full)',
                          border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                          background: isSelected ? 'var(--color-accent-subtle)' : 'var(--color-bg)',
                          color: isSelected ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                          fontSize: 'var(--text-caption)',
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>

                {/* Streak display */}
                {task.recurring_streak > 0 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    background: 'var(--color-success-subtle, rgba(34, 197, 94, 0.1))',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '12px',
                  }}>
                    <span style={{ fontSize: '16px' }}>🔥</span>
                    <span style={{
                      fontSize: 'var(--text-caption)',
                      color: 'var(--color-success)',
                      fontWeight: 600,
                    }}>
                      {task.recurring_streak} day streak
                    </span>
                  </div>
                )}

                {/* End date (optional) */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 'var(--text-caption)',
                    color: 'var(--color-text-tertiary)',
                    marginBottom: '6px',
                  }}>
                    End date (optional)
                  </label>
                  <input
                    type="date"
                    value={form.recurrenceEndDate || ''}
                    onChange={(e) => form.setRecurrenceEndDate(e.target.value || null)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--text-caption)',
                      color: 'var(--color-text-primary)',
                      background: 'var(--color-bg)',
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        <SaveAsTemplateSection taskId={task.id} />

        {/* Footer */}
        <div style={{
          display: 'flex',
          gap: '12px',
          padding: '16px 20px',
          borderTop: '1px solid var(--color-border)',
        }}>
          <button
            onClick={onClose}
            disabled={form.saving}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--text-body)',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: form.saving ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={form.handleSave}
            disabled={form.saving || !form.title.trim()}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'var(--color-accent)',
              color: '#fff',
              fontSize: 'var(--text-body)',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: form.saving || !form.title.trim() ? 0.5 : 1,
            }}
          >
            {form.saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
