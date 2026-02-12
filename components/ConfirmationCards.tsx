'use client'

import { useState } from 'react'
import type { ParsedTask } from '@/lib/types'

interface ConfirmationCardsProps {
  tasks: ParsedTask[]
  dumpId: string
  onConfirm: (tasks: ParsedTask[]) => Promise<void>
  onCancel: () => void
  loading: boolean
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'var(--color-warning)',
  medium: 'var(--color-accent)',
  low: 'var(--color-text-tertiary)',
}

const PRIORITY_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Med',
  low: 'Low',
}

export default function ConfirmationCards({
  tasks: initialTasks,
  dumpId: _dumpId,
  onConfirm,
  onCancel,
  loading,
}: ConfirmationCardsProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const updateTask = (index: number, updates: Partial<ParsedTask>) => {
    setTasks(prev => prev.map((t, i) => i === index ? { ...t, ...updates } : t))
  }

  const removeTask = (index: number) => {
    setTasks(prev => prev.filter((_, i) => i !== index))
  }

  const cyclePriority = (index: number) => {
    const current = tasks[index].priority
    const next = current === 'low' ? 'medium' : current === 'medium' ? 'high' : 'low'
    updateTask(index, { priority: next })
  }

  if (tasks.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
          All tasks removed. Start over?
        </p>
        <button
          onClick={onCancel}
          style={{
            height: '40px',
            padding: '0 20px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--text-caption)',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Back to dump
        </button>
      </div>
    )
  }

  return (
    <div>
      <div style={{
        background: 'var(--color-accent-light)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{ fontSize: '20px' }}>&#x2728;</span>
        <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-accent)', fontWeight: 500 }}>
          Found {tasks.length} task{tasks.length !== 1 ? 's' : ''}. Review and confirm.
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {tasks.map((task, index) => (
          <div
            key={index}
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              animation: `fade-in 0.2s ease ${index * 0.05}s both`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                {editingIndex === index ? (
                  <input
                    type="text"
                    value={task.title}
                    onChange={(e) => updateTask(index, { title: e.target.value })}
                    onBlur={() => setEditingIndex(null)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditingIndex(null)}
                    autoFocus
                    style={{
                      width: '100%',
                      border: 'none',
                      outline: 'none',
                      fontSize: 'var(--text-body)',
                      color: 'var(--color-text-primary)',
                      background: 'var(--color-surface)',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'inherit',
                    }}
                  />
                ) : (
                  <p
                    onClick={() => setEditingIndex(index)}
                    style={{
                      fontSize: 'var(--text-body)',
                      color: 'var(--color-text-primary)',
                      cursor: 'text',
                      lineHeight: 1.4,
                    }}
                  >
                    {task.title}
                  </p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => cyclePriority(index)}
                    style={{
                      fontSize: 'var(--text-small)',
                      color: PRIORITY_COLORS[task.priority],
                      background: 'none',
                      border: `1px solid ${PRIORITY_COLORS[task.priority]}`,
                      borderRadius: 'var(--radius-full)',
                      padding: '2px 10px',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    {PRIORITY_LABELS[task.priority]}
                  </button>

                  {task.due_date && (
                    <span style={{
                      fontSize: 'var(--text-small)',
                      color: 'var(--color-text-secondary)',
                      background: 'var(--color-surface)',
                      borderRadius: 'var(--radius-full)',
                      padding: '2px 10px',
                    }}>
                      {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {task.due_time ? ` ${task.due_time}` : ''}
                    </span>
                  )}

                  {task.confidence < 0.7 && (
                    <span style={{
                      fontSize: 'var(--text-small)',
                      color: 'var(--color-warning)',
                    }}>
                      unsure
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => removeTask(index)}
                aria-label="Remove task"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  background: 'none',
                  color: 'var(--color-text-tertiary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        display: 'flex',
        gap: '12px',
        marginTop: '20px',
        position: 'sticky',
        bottom: 'calc(var(--tab-bar-height) + var(--safe-area-bottom) + 16px)',
        padding: '12px 0',
        background: 'var(--color-bg)',
      }}>
        <button
          onClick={onCancel}
          disabled={loading}
          style={{
            flex: 1,
            height: '48px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--text-body)',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm(tasks)}
          disabled={loading || tasks.length === 0}
          style={{
            flex: 2,
            height: '48px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'var(--color-accent)',
            color: '#fff',
            fontSize: 'var(--text-body)',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Saving...' : `Add ${tasks.length} task${tasks.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
