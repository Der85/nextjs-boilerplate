'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TaskWithCategory, Category } from '@/lib/types'
import TaskCard from './TaskCard'

interface SortableTaskItemProps {
  task: TaskWithCategory
  categories: Category[]
  onToggle: (id: string, done: boolean) => void
  onUpdate: (id: string, updates: Partial<TaskWithCategory>) => void
  onDrop: (id: string) => void
  isDragDisabled?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
}

export default function SortableTaskItem({
  task,
  categories,
  onToggle,
  onUpdate,
  onDrop,
  isDragDisabled = false,
  onMoveUp,
  onMoveDown,
}: SortableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: isDragDisabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isDragDisabled) return

    if (e.shiftKey && e.key === 'ArrowUp' && onMoveUp) {
      e.preventDefault()
      onMoveUp()
    } else if (e.shiftKey && e.key === 'ArrowDown' && onMoveDown) {
      e.preventDefault()
      onMoveDown()
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onKeyDown={handleKeyDown}
      tabIndex={isDragDisabled ? -1 : 0}
      role="listitem"
      aria-label={`Task: ${task.title}. ${!isDragDisabled ? 'Press Shift+Up or Shift+Down to reorder.' : ''}`}
    >
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        borderBottom: '1px solid var(--color-border)',
      }}>
        {/* Drag Handle */}
        {!isDragDisabled && (
          <button
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '44px',
              minWidth: '44px',
              background: 'none',
              border: 'none',
              cursor: isDragging ? 'grabbing' : 'grab',
              color: 'var(--color-text-tertiary)',
              padding: 0,
              touchAction: 'none',
              opacity: 0.4,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.4'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="6" r="2" />
              <circle cx="15" cy="6" r="2" />
              <circle cx="9" cy="12" r="2" />
              <circle cx="15" cy="12" r="2" />
              <circle cx="9" cy="18" r="2" />
              <circle cx="15" cy="18" r="2" />
            </svg>
          </button>
        )}

        <div style={{ flex: 1 }}>
          <TaskCard
            task={task}
            categories={categories}
            onToggle={onToggle}
            onUpdate={onUpdate}
            onDrop={onDrop}
          />
        </div>
      </div>
    </div>
  )
}
