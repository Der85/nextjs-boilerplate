'use client'

import { useState, useRef, useEffect } from 'react'
import type { TaskWithCategory, Category } from '@/lib/types'
import { formatRelativeDate, isOverdue, isToday } from '@/lib/utils/dates'
import { getRecurrenceDescription } from '@/lib/utils/recurrence'
import CategoryChip from './CategoryChip'
import CategoryDropdown from './CategoryDropdown'
import DatePicker from './DatePicker'
import TaskEditModal from './TaskEditModal'

interface TaskCardProps {
  task: TaskWithCategory
  categories?: Category[]
  onToggle: (id: string, done: boolean) => void
  onUpdate: (id: string, updates: Partial<TaskWithCategory>) => void
  onDrop: (id: string) => void
}

const PRIORITY_BORDER: Record<string, string> = {
  high: 'var(--color-warning)',
  medium: 'var(--color-accent)',
  low: 'transparent',
}

export default function TaskCard({ task, categories = [], onToggle, onUpdate, onDrop }: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  const handleToggle = () => {
    const newDone = task.status !== 'done'
    if (newDone) {
      setJustCompleted(true)
      setTimeout(() => setJustCompleted(false), 500)
    }
    onToggle(task.id, newDone)
  }

  const handleTitleSave = () => {
    const trimmed = editTitle.trim()
    if (trimmed && trimmed !== task.title) {
      onUpdate(task.id, { title: trimmed })
    } else {
      setEditTitle(task.title)
    }
    setIsEditing(false)
  }

  const isDone = task.status === 'done'
  const dateColor = task.due_date && isOverdue(task.due_date) && !isDone
    ? 'var(--color-danger)'
    : task.due_date && isToday(task.due_date)
      ? 'var(--color-accent)'
      : 'var(--color-text-tertiary)'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      padding: '12px 0',
      borderLeft: `3px solid ${!isDone && task.priority ? PRIORITY_BORDER[task.priority] || 'transparent' : 'transparent'}`,
      paddingLeft: '12px',
      opacity: isDone ? 0.6 : 1,
      transition: 'opacity 0.2s',
    }}>
      {/* Checkbox */}
      <button
        onClick={handleToggle}
        aria-label={isDone ? 'Mark as active' : 'Mark as done'}
        aria-checked={isDone}
        role="checkbox"
        style={{
          width: '44px',
          height: '44px',
          borderRadius: 'var(--radius-full)',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          padding: 0,
          margin: '-10px -10px -10px 0',
        }}
      >
        <span style={{
          width: '24px',
          height: '24px',
          borderRadius: 'var(--radius-full)',
          border: isDone ? 'none' : '2px solid var(--color-border)',
          background: isDone ? 'var(--color-success)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.15s',
          animation: justCompleted ? 'check-pop 0.3s ease' : 'none',
        }}>
          {isDone && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSave()
              if (e.key === 'Escape') { setEditTitle(task.title); setIsEditing(false) }
            }}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: 'var(--text-body)',
              color: 'var(--color-text-primary)',
              background: 'var(--color-surface)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'inherit',
            }}
          />
        ) : (
          <p
            onClick={() => !isDone && setIsEditing(true)}
            style={{
              fontSize: 'var(--text-body)',
              color: 'var(--color-text-primary)',
              textDecoration: isDone ? 'line-through' : 'none',
              cursor: isDone ? 'default' : 'text',
              lineHeight: 1.4,
              wordBreak: 'break-word',
            }}
          >
            {task.title}
          </p>
        )}

        {/* Metadata row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
          {/* Recurring indicator - icon always visible, text hidden on mobile */}
          {task.is_recurring && task.recurrence_rule && (
            <div
              className="recurrence-indicator"
              title={getRecurrenceDescription(task.recurrence_rule)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 2.1l4 4-4 4" />
                <path d="M3 12.2v-2a4 4 0 0 1 4-4h12.8" />
                <path d="M7 21.9l-4-4 4-4" />
                <path d="M21 11.8v2a4 4 0 0 1-4 4H4.2" />
              </svg>
              <span
                className="recurrence-text"
                style={{
                  fontSize: 'var(--text-small)',
                  color: 'var(--color-accent)',
                  fontWeight: 500,
                }}
              >
                {getRecurrenceDescription(task.recurrence_rule)}
              </span>
            </div>
          )}

          {/* Streak badge */}
          {task.is_recurring && task.recurring_streak > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              padding: '2px 6px',
              background: 'var(--color-warning-subtle, rgba(245, 158, 11, 0.1))',
              borderRadius: 'var(--radius-full)',
            }}>
              <span style={{ fontSize: '12px' }}>🔥</span>
              <span style={{
                fontSize: 'var(--text-small)',
                color: 'var(--color-warning)',
                fontWeight: 600,
              }}>
                {task.recurring_streak}
              </span>
            </div>
          )}

          {task.due_date && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => !isDone && setShowDatePicker(!showDatePicker)}
                style={{
                  fontSize: 'var(--text-small)',
                  color: dateColor,
                  background: 'none',
                  border: 'none',
                  padding: '8px 4px',
                  margin: '-8px -4px',
                  cursor: isDone ? 'default' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {formatRelativeDate(task.due_date)}
                {task.due_time ? ` ${task.due_time}` : ''}
              </button>
              {showDatePicker && (
                <DatePicker
                  value={task.due_date}
                  onChange={(date) => onUpdate(task.id, { due_date: date })}
                  onClose={() => setShowDatePicker(false)}
                />
              )}
            </div>
          )}

          {!task.due_date && !isDone && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                style={{
                  fontSize: 'var(--text-small)',
                  color: 'var(--color-text-tertiary)',
                  background: 'none',
                  border: 'none',
                  padding: '8px 4px',
                  margin: '-8px -4px',
                  cursor: 'pointer',
                }}
              >
                + date
              </button>
              {showDatePicker && (
                <DatePicker
                  value={null}
                  onChange={(date) => onUpdate(task.id, { due_date: date })}
                  onClose={() => setShowDatePicker(false)}
                />
              )}
            </div>
          )}

          {/* Category - interactive dropdown for active tasks, static chip for done */}
          {isDone ? (
            task.category && (
              <CategoryChip
                name={task.category.name}
                color={task.category.color}
                icon={task.category.icon}
                size="small"
              />
            )
          ) : (
            <CategoryDropdown
              categories={categories}
              selectedId={task.category_id}
              confidence={task.category_confidence}
              onSelect={(categoryId) => onUpdate(task.id, { category_id: categoryId })}
            />
          )}
        </div>
      </div>

      {/* Edit button */}
      {!isDone && (
        <button
          onClick={() => setShowEditModal(true)}
          aria-label="Edit task"
          style={{
            width: '44px',
            height: '44px',
            borderRadius: 'var(--radius-full)',
            border: 'none',
            background: 'none',
            color: 'var(--color-text-tertiary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            margin: '-10px 0 -10px 0',
            padding: 0,
            opacity: 0.4,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.4'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
      )}

      {/* Skip button (for recurring tasks only) */}
      {!isDone && task.is_recurring && (
        <button
          onClick={() => onUpdate(task.id, { status: 'skipped' })}
          aria-label="Skip this occurrence"
          title={task.recurring_streak > 0 ? `Skip (will reset ${task.recurring_streak} day streak)` : 'Skip this occurrence'}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: 'var(--radius-full)',
            border: 'none',
            background: 'none',
            color: 'var(--color-text-tertiary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            margin: '-10px 0 -10px 0',
            padding: 0,
            opacity: 0.4,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.4'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="5 4 15 12 5 20 5 4" />
            <line x1="19" y1="5" x2="19" y2="19" />
          </svg>
        </button>
      )}

      {/* Drop (soft delete) button */}
      {!isDone && (
        <button
          onClick={() => onDrop(task.id)}
          aria-label="Drop task"
          style={{
            width: '44px',
            height: '44px',
            borderRadius: 'var(--radius-full)',
            border: 'none',
            background: 'none',
            color: 'var(--color-text-tertiary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            margin: '-10px -10px -10px 0',
            padding: 0,
            opacity: 0.4,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.4'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      {/* Edit Modal */}
      <TaskEditModal
        task={task}
        categories={categories}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={(id, updates) => {
          onUpdate(id, updates)
          setShowEditModal(false)
        }}
      />

      {/* Responsive styles for cleaner mobile view */}
      <style>{`
        @keyframes check-pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }

        /* Hide verbose recurrence text on mobile - icon + tooltip is enough */
        @media (max-width: 480px) {
          .recurrence-text {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
