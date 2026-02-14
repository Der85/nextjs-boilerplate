'use client'

import { useState } from 'react'
import type { TaskWithCategory, Category } from '@/lib/types'
import TaskCard from './TaskCard'

interface TaskGroup {
  label: string
  tasks: TaskWithCategory[]
  color?: string
  collapsedByDefault?: boolean
}

interface TaskListProps {
  groups: TaskGroup[]
  categories?: Category[]
  onToggle: (id: string, done: boolean) => void
  onUpdate: (id: string, updates: Partial<TaskWithCategory>) => void
  onDrop: (id: string) => void
}

export default function TaskList({ groups, categories = [], onToggle, onUpdate, onDrop }: TaskListProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    groups.forEach(g => {
      if (g.collapsedByDefault) initial[g.label] = true
    })
    return initial
  })

  const toggleCollapse = (label: string) => {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }))
  }

  const visibleGroups = groups.filter(g => g.tasks.length > 0)

  if (visibleGroups.length === 0) return null

  return (
    <div>
      {visibleGroups.map((group) => (
        <div key={group.label} style={{ marginBottom: '8px' }}>
          <button
            onClick={() => toggleCollapse(group.label)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '10px 0',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{
              fontSize: 'var(--text-small)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: group.color || 'var(--color-text-secondary)',
            }}>
              {group.label}
            </span>
            <span style={{
              fontSize: 'var(--text-small)',
              color: 'var(--color-text-tertiary)',
              fontWeight: 400,
            }}>
              {group.tasks.length}
            </span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                color: 'var(--color-text-tertiary)',
                transform: collapsed[group.label] ? 'rotate(-90deg)' : 'rotate(0)',
                transition: 'transform 0.15s',
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {!collapsed[group.label] && (
            <div style={{
              borderTop: '1px solid var(--color-border)',
            }}>
              {group.tasks.map((task) => (
                <div key={task.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <TaskCard
                    task={task}
                    categories={categories}
                    onToggle={onToggle}
                    onUpdate={onUpdate}
                    onDrop={onDrop}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
