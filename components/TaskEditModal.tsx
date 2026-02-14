'use client'

import { useState, useEffect, useRef } from 'react'
import type { TaskWithCategory, Category } from '@/lib/types'
import { getTodayISO, getTomorrowISO, getWeekendISO, getNextWeekISO } from '@/lib/utils/dates'
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
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Reset form when task changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle(task.title)
      setDueDate(task.due_date)
      setDueTime(task.due_time)
      setPriority(task.priority)
      setCategoryId(task.category_id)
      setHasChanges(false)
      setTimeout(() => {
        titleRef.current?.focus()
        titleRef.current?.select()
      }, 50)
    }
  }, [isOpen, task])

  // Track changes
  useEffect(() => {
    const changed =
      title !== task.title ||
      dueDate !== task.due_date ||
      dueTime !== task.due_time ||
      priority !== task.priority ||
      categoryId !== task.category_id
    setHasChanges(changed)
  }, [title, dueDate, dueTime, priority, categoryId, task])

  const handleSave = async () => {
    if (!title.trim()) return

    setSaving(true)

    const updates: Partial<TaskWithCategory> = {}
    if (title.trim() !== task.title) updates.title = title.trim()
    if (dueDate !== task.due_date) updates.due_date = dueDate
    if (dueTime !== task.due_time) updates.due_time = dueTime
    if (priority !== task.priority) updates.priority = priority
    if (categoryId !== task.category_id) updates.category_id = categoryId

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
        </div>

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
