'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { TaskWithCategory, Category } from '@/lib/types'
import SortableTaskItem from './SortableTaskItem'
import TaskCard from './TaskCard'

/**
 * Reorders items in an array by moving an item from one index to another.
 * Returns a new array without mutating the original.
 */
function reorderItems<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const result = [...items]
  const [movedItem] = result.splice(fromIndex, 1)
  result.splice(toIndex, 0, movedItem)
  return result
}

interface TaskGroup {
  label: string
  tasks: TaskWithCategory[]
  color?: string
  collapsedByDefault?: boolean
}

export type SortMode = 'manual' | 'due_date' | 'created_date'

interface TaskListProps {
  groups: TaskGroup[]
  categories?: Category[]
  onToggle: (id: string, done: boolean) => void
  onUpdate: (id: string, updates: Partial<TaskWithCategory>) => void
  onDrop: (id: string) => void
  onReorder?: (groupLabel: string, orderedIds: string[]) => void
  sortMode?: SortMode
  newOccurrenceIds?: Set<string>
}

export default function TaskList({
  groups,
  categories = [],
  onToggle,
  onUpdate,
  onDrop,
  onReorder,
  sortMode = 'manual',
  newOccurrenceIds,
}: TaskListProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    groups.forEach(g => {
      if (g.collapsedByDefault) initial[g.label] = true
    })
    return initial
  })

  const [activeId, setActiveId] = useState<string | null>(null)

  // Configure sensors for pointer (mouse), touch, and keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px drag before activating (prevents accidental drags)
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const toggleCollapse = (label: string) => {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }))
  }

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent, groupLabel: string, groupTasks: TaskWithCategory[]) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id || !onReorder) return

    const oldIndex = groupTasks.findIndex(t => t.id === active.id)
    const newIndex = groupTasks.findIndex(t => t.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const reordered = reorderItems(groupTasks, oldIndex, newIndex)
    onReorder(groupLabel, reordered.map(t => t.id))
  }, [onReorder])

  // Handle keyboard-based reordering (Shift+Arrow keys)
  const handleKeyboardMove = useCallback((groupLabel: string, groupTasks: TaskWithCategory[], taskId: string, direction: 'up' | 'down') => {
    if (!onReorder) return

    const currentIndex = groupTasks.findIndex(t => t.id === taskId)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= groupTasks.length) return

    const reordered = reorderItems(groupTasks, currentIndex, newIndex)
    onReorder(groupLabel, reordered.map(t => t.id))
  }, [onReorder])

  // Find the active task for the drag overlay
  const activeTask = activeId
    ? groups.flatMap(g => g.tasks).find(t => t.id === activeId)
    : null

  const visibleGroups = groups.filter(g => g.tasks.length > 0)

  if (visibleGroups.length === 0) return null

  const isDragEnabled = sortMode === 'manual' && !!onReorder
  const showHeaders = visibleGroups.length > 1

  const renderGroupTasks = (group: TaskGroup) => (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={(e) => handleDragEnd(e, group.label, group.tasks)}
    >
      <SortableContext
        items={group.tasks.map(t => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          style={{
            borderTop: showHeaders ? '1px solid var(--color-border)' : undefined,
          }}
          role="list"
          aria-label={`${group.label} tasks`}
        >
          {group.tasks.map((task, index) => (
            <div
              key={task.id}
              className={newOccurrenceIds?.has(task.id) ? 'new-occurrence' : undefined}
            >
              <SortableTaskItem
                task={task}
                categories={categories}
                onToggle={onToggle}
                onUpdate={onUpdate}
                onDrop={onDrop}
                isDragDisabled={!isDragEnabled || task.status === 'done'}
                onMoveUp={
                  isDragEnabled && index > 0
                    ? () => handleKeyboardMove(group.label, group.tasks, task.id, 'up')
                    : undefined
                }
                onMoveDown={
                  isDragEnabled && index < group.tasks.length - 1
                    ? () => handleKeyboardMove(group.label, group.tasks, task.id, 'down')
                    : undefined
                }
              />
            </div>
          ))}
        </div>
      </SortableContext>

      {/* Drag Overlay - shows the dragged item */}
      <DragOverlay>
        {activeTask ? (
          <div style={{
            background: 'var(--color-bg)',
            boxShadow: 'var(--shadow-lg)',
            borderRadius: 'var(--radius-md)',
            opacity: 0.95,
          }}>
            <TaskCard
              task={activeTask}
              categories={categories}
              onToggle={() => {}}
              onUpdate={() => {}}
              onDrop={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )

  // When only one group has tasks, render flat without headers
  if (!showHeaders) {
    return <div>{renderGroupTasks(visibleGroups[0])}</div>
  }

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

          {!collapsed[group.label] && renderGroupTasks(group)}
        </div>
      ))}
    </div>
  )
}
