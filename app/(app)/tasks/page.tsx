'use client'

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import TaskList, { type SortMode } from '@/components/TaskList'
import FilterBar from '@/components/FilterBar'
import EmptyState from '@/components/EmptyState'
import TemplatePicker from '@/components/TemplatePicker'
import PriorityPrompt from '@/components/PriorityPrompt'
import NotificationBell from '@/components/NotificationBell'
import { useCategories } from '@/lib/contexts/CategoriesContext'
import type { TaskWithCategory, TaskTemplateWithCategory } from '@/lib/types'
import { isToday, isThisWeek, isOverdue } from '@/lib/utils/dates'
import {
  type TaskFilters,
  DEFAULT_FILTERS,
  applyFilters,
  searchParamsToFilters,
  filtersToSearchParams,
  hasActiveFilters,
} from '@/lib/utils/filters'
import { apiFetch } from '@/lib/api-client'

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'due_date', label: 'Due Date' },
  { value: 'created_date', label: 'Created' },
]

// Pure functions at file scope to enable stable useMemo references
function groupTasks(allTasks: TaskWithCategory[]) {
  const overdue: TaskWithCategory[] = []
  const today: TaskWithCategory[] = []
  const thisWeek: TaskWithCategory[] = []
  const noDate: TaskWithCategory[] = []
  const doneToday: TaskWithCategory[] = []

  for (const task of allTasks) {
    if (task.status === 'dropped' || task.status === 'skipped') continue

    if (task.status === 'done') {
      if (task.completed_at && isToday(task.completed_at.split('T')[0])) {
        doneToday.push(task)
      }
      continue
    }

    if (task.due_date && isOverdue(task.due_date)) {
      overdue.push(task)
    } else if (task.due_date && isToday(task.due_date)) {
      today.push(task)
    } else if (task.due_date && isThisWeek(task.due_date)) {
      thisWeek.push(task)
    } else {
      noDate.push(task)
    }
  }

  return [
    { label: 'Overdue', tasks: overdue, color: 'var(--color-danger)' },
    { label: 'Today', tasks: today, color: 'var(--color-accent)' },
    { label: 'This Week', tasks: thisWeek },
    { label: 'No Date', tasks: noDate },
    { label: 'Done Today', tasks: doneToday, color: 'var(--color-success)', collapsedByDefault: true },
  ]
}

function sortTasks(taskList: TaskWithCategory[], sortMode: SortMode): TaskWithCategory[] {
  const sorted = [...taskList]
  switch (sortMode) {
    case 'manual':
      return sorted.sort((a, b) => (a.position || 0) - (b.position || 0))
    case 'due_date':
      return sorted.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date)
      })
    case 'created_date':
      return sorted.sort((a, b) => b.created_at.localeCompare(a.created_at))
    default:
      return sorted
  }
}

// Wrapper to provide Suspense boundary for useSearchParams
export default function TasksPage() {
  return (
    <Suspense fallback={<TasksPageSkeleton />}>
      <TasksPageContent />
    </Suspense>
  )
}

function TasksPageSkeleton() {
  return (
    <div style={{ paddingTop: '24px' }}>
      <div className="skeleton" style={{ height: '28px', width: '100px', marginBottom: '24px' }} />
      {[1, 2, 3].map(i => (
        <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div className="skeleton" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: '18px', width: `${60 + i * 15}%`, marginBottom: '6px' }} />
              <div className="skeleton" style={{ height: '14px', width: '80px' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function TasksPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tasks, setTasks] = useState<TaskWithCategory[]>([])
  const { categories } = useCategories()
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(true)
  const [sortMode, setSortMode] = useState<SortMode>('manual')
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // Load filters from URL on mount
  useEffect(() => {
    const urlFilters = searchParamsToFilters(searchParams)
    setFilters(urlFilters)
    if (hasActiveFilters(urlFilters)) {
      setShowFilters(true)
    }
  }, [searchParams])

  // Load sort preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('taskSortMode') as SortMode | null
    if (saved && SORT_OPTIONS.some(o => o.value === saved)) {
      setSortMode(saved)
    }
  }, [])

  // Update URL when filters change
  const handleFilterChange = useCallback((newFilters: TaskFilters) => {
    setFilters(newFilters)
    const params = filtersToSearchParams(newFilters)
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
    window.history.replaceState({}, '', newUrl)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const tasksRes = await fetch('/api/tasks')
      if (tasksRes.ok) {
        const data = await tasksRes.json()
        setTasks(data.tasks || [])
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Optimistic toggle — capture pre-toggle state for accurate revert
  const handleToggle = async (id: string, done: boolean) => {
    let previousTask: TaskWithCategory | undefined
    setTasks(prev => {
      previousTask = prev.find(t => t.id === id)
      return prev.map(t =>
        t.id === id
          ? { ...t, status: done ? 'done' : 'active', completed_at: done ? new Date().toISOString() : null }
          : t
      )
    })

    try {
      const res = await apiFetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: done ? 'done' : 'active' }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.nextOccurrence) {
          setTasks(prev => [...prev, data.nextOccurrence])
        }
      } else if (previousTask) {
        setTasks(prev => prev.map(t => t.id === id ? previousTask! : t))
      }
    } catch {
      if (previousTask) {
        setTasks(prev => prev.map(t => t.id === id ? previousTask! : t))
      }
    }
  }

  // Optimistic update
  const handleUpdate = async (id: string, updates: Partial<TaskWithCategory>) => {
    const prev = tasks.find(t => t.id === id)
    setTasks(ts => ts.map(t => t.id === id ? { ...t, ...updates } : t))

    try {
      const res = await apiFetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const data = await res.json()
        // If a next occurrence was created (recurring task skipped), add it to the list
        if (data.nextOccurrence) {
          setTasks(ts => [...ts, data.nextOccurrence])
        }
      } else if (prev) {
        setTasks(ts => ts.map(t => t.id === id ? prev : t))
      }
    } catch {
      if (prev) setTasks(ts => ts.map(t => t.id === id ? prev : t))
    }
  }

  // Drop (soft delete)
  const handleDrop = async (id: string) => {
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, status: 'dropped' as const } : t
    ))

    await apiFetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'dropped' }),
    })
  }

  // Handle sort mode change
  const handleSortChange = (mode: SortMode) => {
    setSortMode(mode)
    localStorage.setItem('taskSortMode', mode)
  }

  // Handle creating task from template
  const handleTemplateSelect = async (template: TaskTemplateWithCategory) => {
    try {
      const res = await apiFetch(`/api/templates/${template.id}/create-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        const data = await res.json()
        setTasks(prev => [data.task, ...prev])
      }
    } catch (err) {
      console.error('Failed to create task from template:', err)
    }
  }

  // Handle reorder (drag-and-drop) — capture previous positions for revert
  const handleReorder = async (_groupLabel: string, orderedIds: string[]) => {
    const positionMap = new Map(orderedIds.map((id, idx) => [id, idx * 1000]))

    // Capture previous positions before optimistic update
    let previousPositions: Map<string, number> | undefined
    setTasks(prev => {
      previousPositions = new Map(
        prev.filter(t => positionMap.has(t.id)).map(t => [t.id, t.position])
      )
      return prev.map(t => {
        const newPosition = positionMap.get(t.id)
        return newPosition !== undefined ? { ...t, position: newPosition } : t
      })
    })

    try {
      const tasksToUpdate = orderedIds.map((id, idx) => ({ id, position: idx * 1000 }))
      await apiFetch('/api/tasks/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: tasksToUpdate }),
      })
    } catch (err) {
      console.error('Failed to reorder tasks:', err)
      // Revert to previous positions
      if (previousPositions) {
        const prevPos = previousPositions
        setTasks(prev => prev.map(t => {
          const oldPosition = prevPos.get(t.id)
          return oldPosition !== undefined ? { ...t, position: oldPosition } : t
        }))
      }
    }
  }

  // Memoize the filter → group → sort pipeline
  const filteredCount = useMemo(() => applyFilters(tasks, filters).length, [tasks, filters])
  const groups = useMemo(() => {
    const filtered = applyFilters(tasks, filters)
    return groupTasks(filtered).map(g => ({ ...g, tasks: sortTasks(g.tasks, sortMode) }))
  }, [tasks, filters, sortMode])
  const hasActiveTasks = groups.some(g => g.tasks.length > 0)

  if (loading) {
    return (
      <div style={{ paddingTop: '24px' }}>
        <div className="skeleton" style={{ height: '28px', width: '100px', marginBottom: '24px' }} />
        {[1, 2, 3].map(i => (
          <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div className="skeleton" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: '18px', width: `${60 + i * 15}%`, marginBottom: '6px' }} />
                <div className="skeleton" style={{ height: '14px', width: '80px' }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ paddingTop: '20px', paddingBottom: '24px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
      }}>
        <h1 style={{
          fontSize: 'var(--text-heading)',
          fontWeight: 'var(--font-heading)',
          color: 'var(--color-text-primary)',
          margin: 0,
        }}>
          Tasks
        </h1>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Notification bell */}
          <div>
            <NotificationBell />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(prev => !prev)}
            aria-label={showFilters ? 'Hide filters' : 'Show filters'}
            aria-expanded={showFilters}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              border: `1px solid ${hasActiveFilters(filters) ? 'var(--color-accent)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius-sm)',
              background: hasActiveFilters(filters) ? 'var(--color-accent-light)' : 'var(--color-bg)',
              color: hasActiveFilters(filters) ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            {hasActiveFilters(filters) && (
              <span style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--color-accent)',
              }} />
            )}
          </button>

          {/* Template button */}
          <button
            onClick={() => setShowTemplatePicker(true)}
            title="Create from template"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </button>

          {/* Sort dropdown */}
          <div style={{ position: 'relative' }}>
            <select
              value={sortMode}
              onChange={(e) => handleSortChange(e.target.value as SortMode)}
              aria-label="Sort tasks by"
              style={{
                appearance: 'none',
                padding: '6px 28px 6px 10px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg)',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--text-small)',
                cursor: 'pointer',
              }}
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: 'var(--color-text-tertiary)',
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </div>

      {/* Filter Bar — collapsed by default */}
      {showFilters && (
        <FilterBar
          categories={categories}
          filters={filters}
          onFilterChange={handleFilterChange}
          totalCount={tasks.length}
          filteredCount={filteredCount}
        />
      )}

      {/* Priority prompt */}
      <PriorityPrompt taskCount={tasks.length} variant="banner" />

      {/* Task list or empty state */}
      {hasActiveTasks ? (
        <TaskList
          groups={groups}
          categories={categories}
          onToggle={handleToggle}
          onUpdate={handleUpdate}
          onDrop={handleDrop}
          onReorder={handleReorder}
          sortMode={sortMode}
        />
      ) : tasks.length > 0 ? (
        // Has tasks but filters return no results
        <EmptyState
          icon={String.fromCodePoint(0x1F50D)}
          title="No matching tasks"
          message="Try adjusting your filters to see more tasks."
          actionLabel="Clear filters"
          onAction={() => handleFilterChange(DEFAULT_FILTERS)}
        />
      ) : (
        // No tasks at all
        <EmptyState
          icon={String.fromCodePoint(0x1F4AD)}
          title="No tasks yet"
          message="Dump your thoughts to get started. I'll turn them into tasks."
          actionLabel="Brain dump"
          onAction={() => router.push('/dump')}
        />
      )}

      {/* Template Picker Modal */}
      {showTemplatePicker && (
        <TemplatePicker
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}
    </div>
  )
}
