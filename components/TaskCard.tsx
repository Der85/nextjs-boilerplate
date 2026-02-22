'use client'

import { useState } from 'react'
import type { TaskWithCategory, Category } from '@/lib/types'
import { formatRelativeDate, isOverdue, isToday } from '@/lib/utils/dates'
import { getRecurrenceDescription } from '@/lib/utils/recurrence'
import { getTaskPriorityBorder } from '@/lib/theme'
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

const actionButtonStyle: React.CSSProperties = {
  height: '36px',
  borderRadius: 'var(--radius-sm)',
  border: 'none',
  background: 'none',
  color: 'var(--color-text-tertiary)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  padding: '0 8px',
  opacity: 0.7,
  transition: 'opacity 0.15s',
}

const handleActionHover = (e: React.MouseEvent<HTMLButtonElement>, opacity: string) => {
  e.currentTarget.style.opacity = opacity
}

export default function TaskCard({ task, categories = [], onToggle, onUpdate, onDrop }: TaskCardProps) {
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const handleToggle = () => {
    const newDone = task.status !== 'done'
    if (newDone) {
      setJustCompleted(true)
      // Show the checkmark + strikethrough in place, then move to Done group
      setTimeout(() => {
        setJustCompleted(false)
        onToggle(task.id, newDone)
      }, 600)
    } else {
      onToggle(task.id, newDone)
    }
  }

  const isDone = task.status === 'done' || justCompleted
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
      borderLeft: `3px solid ${!isDone ? getTaskPriorityBorder(task.priority) : 'transparent'}`,
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

      {/* Content — tap to expand actions */}
      <div
        style={{ flex: 1, minWidth: 0, cursor: !isDone ? 'pointer' : 'default' }}
        onClick={(e) => {
          if (isDone) return
          const target = e.target as HTMLElement
          if (target.closest('button') || target.closest('input') || target.closest('select')) return
          setExpanded(prev => !prev)
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
          <p style={{
            flex: 1,
            fontSize: 'var(--text-body)',
            color: 'var(--color-text-primary)',
            textDecoration: isDone ? 'line-through' : 'none',
            lineHeight: 1.4,
            wordBreak: 'break-word',
          }}>
            {task.title}
          </p>
          {!isDone && (
            <span style={{
              fontSize: '10px',
              color: 'var(--color-text-tertiary)',
              opacity: 0.5,
              flexShrink: 0,
              marginTop: '5px',
              transition: 'transform 0.15s',
              transform: expanded ? 'rotate(90deg)' : 'none',
            }}>
              ▸
            </span>
          )}
        </div>

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

        {/* Expanded action row */}
        {expanded && !isDone && (
          <div
            className="task-actions-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <button
              onClick={() => setShowEditModal(true)}
              aria-label="Edit task"
              style={actionButtonStyle}
              onMouseEnter={(e) => handleActionHover(e, '1')}
              onMouseLeave={(e) => handleActionHover(e, '0.7')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span style={{ fontSize: 'var(--text-small)', marginLeft: '4px', color: 'var(--color-text-secondary)' }}>Edit</span>
            </button>

            {task.is_recurring && (
              <button
                onClick={() => onUpdate(task.id, { status: 'skipped' })}
                aria-label="Skip this occurrence"
                title={task.recurring_streak > 0 ? `Skip (will reset ${task.recurring_streak} day streak)` : 'Skip this occurrence'}
                style={actionButtonStyle}
                onMouseEnter={(e) => handleActionHover(e, '1')}
                onMouseLeave={(e) => handleActionHover(e, '0.7')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 4 15 12 5 20 5 4" />
                  <line x1="19" y1="5" x2="19" y2="19" />
                </svg>
                <span style={{ fontSize: 'var(--text-small)', marginLeft: '4px', color: 'var(--color-text-secondary)' }}>Skip</span>
              </button>
            )}

            <button
              onClick={() => onDrop(task.id)}
              aria-label="Drop task"
              style={actionButtonStyle}
              onMouseEnter={(e) => handleActionHover(e, '1')}
              onMouseLeave={(e) => handleActionHover(e, '0.7')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span style={{ fontSize: 'var(--text-small)', marginLeft: '4px', color: 'var(--color-text-secondary)' }}>Drop</span>
            </button>
          </div>
        )}
      </div>

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

    </div>
  )
}
