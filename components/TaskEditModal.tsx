'use client'

import { useState, useEffect, useRef } from 'react'
import type { TaskWithCategory, Category, RecurrenceRule, RecurrenceFrequency } from '@/lib/types'
import { getTodayISO, getTomorrowISO, getWeekendISO, getNextWeekISO } from '@/lib/utils/dates'
import { RECURRENCE_OPTIONS, getRecurrenceDescription } from '@/lib/utils/recurrence'
import CategoryChip from './CategoryChip'

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
  const titleRef = useRef<HTMLInputElement>(null)

  // Form state
  const [title, setTitle] = useState(task.title)
  const [dueDate, setDueDate] = useState(task.due_date)
  const [dueTime, setDueTime] = useState(task.due_time)
  const [priority, setPriority] = useState(task.priority)
  const [categoryId, setCategoryId] = useState(task.category_id)
  const [isRecurring, setIsRecurring] = useState(task.is_recurring || false)
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency | null>(
    task.recurrence_rule?.frequency || null
  )
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string | null>(
    task.recurrence_rule?.end_date || null
  )
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateError, setTemplateError] = useState('')
  const [templateSuccess, setTemplateSuccess] = useState(false)

  // Reset form when task changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle(task.title)
      setDueDate(task.due_date)
      setDueTime(task.due_time)
      setPriority(task.priority)
      setCategoryId(task.category_id)
      setIsRecurring(task.is_recurring || false)
      setRecurrenceFrequency(task.recurrence_rule?.frequency || null)
      setRecurrenceEndDate(task.recurrence_rule?.end_date || null)
      setHasChanges(false)
      setTimeout(() => {
        titleRef.current?.focus()
        titleRef.current?.select()
      }, 50)
    }
  }, [isOpen, task])

  // Track changes
  useEffect(() => {
    const currentRule = task.recurrence_rule
    const recurrenceChanged =
      isRecurring !== (task.is_recurring || false) ||
      recurrenceFrequency !== (currentRule?.frequency || null) ||
      recurrenceEndDate !== (currentRule?.end_date || null)

    const changed =
      title !== task.title ||
      dueDate !== task.due_date ||
      dueTime !== task.due_time ||
      priority !== task.priority ||
      categoryId !== task.category_id ||
      recurrenceChanged
    setHasChanges(changed)
  }, [title, dueDate, dueTime, priority, categoryId, isRecurring, recurrenceFrequency, recurrenceEndDate, task])

  const handleSave = async () => {
    if (!title.trim()) return

    setSaving(true)

    const updates: Partial<TaskWithCategory> = {}
    if (title.trim() !== task.title) updates.title = title.trim()
    if (dueDate !== task.due_date) updates.due_date = dueDate
    if (dueTime !== task.due_time) updates.due_time = dueTime
    if (priority !== task.priority) updates.priority = priority
    if (categoryId !== task.category_id) updates.category_id = categoryId

    // Handle recurrence updates
    const currentRule = task.recurrence_rule
    const recurrenceChanged =
      isRecurring !== (task.is_recurring || false) ||
      recurrenceFrequency !== (currentRule?.frequency || null) ||
      recurrenceEndDate !== (currentRule?.end_date || null)

    if (recurrenceChanged) {
      updates.is_recurring = isRecurring
      if (isRecurring && recurrenceFrequency) {
        const newRule: RecurrenceRule = { frequency: recurrenceFrequency }
        if (recurrenceEndDate) newRule.end_date = recurrenceEndDate
        updates.recurrence_rule = newRule
      } else {
        updates.recurrence_rule = null
      }
    }

    if (Object.keys(updates).length > 0) {
      await onSave(task.id, updates)
    }

    setSaving(false)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
    if (e.key === 'Enter' && e.metaKey) {
      handleSave()
    }
  }

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) {
      setTemplateError('Please enter a template name.')
      return
    }

    setSavingTemplate(true)
    setTemplateError('')

    try {
      const res = await fetch('/api/templates/from-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: task.id,
          template_name: templateName.trim(),
        }),
      })

      if (res.ok) {
        setTemplateSuccess(true)
        setTimeout(() => {
          setShowSaveAsTemplate(false)
          setTemplateName('')
          setTemplateSuccess(false)
        }, 1500)
      } else {
        const data = await res.json()
        setTemplateError(data.error || 'Failed to save template.')
      }
    } catch {
      setTemplateError('Something went wrong.')
    } finally {
      setSavingTemplate(false)
    }
  }

  if (!isOpen) return null

  const selectedCategory = categories.find(c => c.id === categoryId)

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
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
                const isSelected = dueDate === presetValue
                return (
                  <button
                    key={preset.label}
                    onClick={() => setDueDate(presetValue)}
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
              value={dueDate || ''}
              onChange={(e) => setDueDate(e.target.value || null)}
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
              value={dueTime || ''}
              onChange={(e) => setDueTime(e.target.value || null)}
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
                const isSelected = priority === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setPriority(isSelected ? null : opt.value)}
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
                  selected={!categoryId}
                  onClick={() => setCategoryId(null)}
                />
                {categories.map((cat) => (
                  <CategoryChip
                    key={cat.id}
                    name={cat.name}
                    color={cat.color}
                    icon={cat.icon}
                    selected={categoryId === cat.id}
                    onClick={() => setCategoryId(categoryId === cat.id ? null : cat.id)}
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
                  setIsRecurring(!isRecurring)
                  if (!isRecurring && !recurrenceFrequency) {
                    setRecurrenceFrequency('daily')
                  }
                }}
                style={{
                  width: '48px',
                  height: '28px',
                  borderRadius: '14px',
                  border: 'none',
                  background: isRecurring ? 'var(--color-accent)' : 'var(--color-border)',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute',
                  top: '3px',
                  left: isRecurring ? '23px' : '3px',
                  width: '22px',
                  height: '22px',
                  borderRadius: '11px',
                  background: '#fff',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </button>
            </div>

            {isRecurring && (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {RECURRENCE_OPTIONS.map((opt) => {
                    const isSelected = recurrenceFrequency === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setRecurrenceFrequency(opt.value)}
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
                    value={recurrenceEndDate || ''}
                    onChange={(e) => setRecurrenceEndDate(e.target.value || null)}
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

        {/* Save as Template Section */}
        {showSaveAsTemplate ? (
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              <span style={{
                fontSize: 'var(--text-small)',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}>
                Save as Template
              </span>
            </div>

            {templateSuccess ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-success-subtle, rgba(34, 197, 94, 0.1))',
                color: 'var(--color-success)',
                fontSize: 'var(--text-small)',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Template saved!
              </div>
            ) : (
              <>
                {templateError && (
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-danger-light, #fef2f2)',
                    color: 'var(--color-danger)',
                    fontSize: 'var(--text-small)',
                    marginBottom: '8px',
                  }}>
                    {templateError}
                  </div>
                )}
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name (e.g., Weekly Report)"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--text-body)',
                    color: 'var(--color-text-primary)',
                    background: 'var(--color-bg)',
                    marginBottom: '8px',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveAsTemplate()
                    if (e.key === 'Escape') setShowSaveAsTemplate(false)
                  }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                      setShowSaveAsTemplate(false)
                      setTemplateName('')
                      setTemplateError('')
                    }}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text-secondary)',
                      fontSize: 'var(--text-small)',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAsTemplate}
                    disabled={savingTemplate || !templateName.trim()}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      background: 'var(--color-accent)',
                      color: '#fff',
                      fontSize: 'var(--text-small)',
                      fontWeight: 600,
                      cursor: savingTemplate ? 'not-allowed' : 'pointer',
                      opacity: savingTemplate || !templateName.trim() ? 0.7 : 1,
                    }}
                  >
                    {savingTemplate ? 'Saving...' : 'Create Template'}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowSaveAsTemplate(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              width: '100%',
              padding: '10px',
              border: 'none',
              borderTop: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-text-tertiary)',
              fontSize: 'var(--text-small)',
              cursor: 'pointer',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            Save as Template
          </button>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex',
          gap: '12px',
          padding: '16px 20px',
          borderTop: '1px solid var(--color-border)',
        }}>
          <button
            onClick={onClose}
            disabled={saving}
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
              opacity: saving ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
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
              opacity: saving || !title.trim() ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
