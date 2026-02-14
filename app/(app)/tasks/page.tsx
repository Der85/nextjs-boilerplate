'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import TaskList from '@/components/TaskList'
import CategoryChip from '@/components/CategoryChip'
import EmptyState from '@/components/EmptyState'
import type { TaskWithCategory, Category } from '@/lib/types'
import { isToday, isThisWeek, isOverdue } from '@/lib/utils/dates'

export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<TaskWithCategory[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (selectedCategory) params.set('category_id', selectedCategory)

      const [tasksRes, catsRes] = await Promise.all([
        fetch(`/api/tasks?${params.toString()}`),
        fetch('/api/categories'),
      ])

      if (tasksRes.ok) {
        const data = await tasksRes.json()
        setTasks(data.tasks || [])
      }
      if (catsRes.ok) {
        const data = await catsRes.json()
        setCategories(data.categories || [])
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedCategory])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const groupTasks = (allTasks: TaskWithCategory[]) => {
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

      // Active tasks
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

  // Optimistic toggle
  const handleToggle = async (id: string, done: boolean) => {
    setTasks(prev => prev.map(t =>
      t.id === id
        ? { ...t, status: done ? 'done' : 'active', completed_at: done ? new Date().toISOString() : null }
        : t
    ))

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: done ? 'done' : 'active' }),
      })
      if (res.ok) {
        const data = await res.json()
        // If a next occurrence was created (recurring task), add it to the list
        if (data.nextOccurrence) {
          setTasks(prev => [...prev, data.nextOccurrence])
        }
      } else {
        // Revert on failure
        setTasks(prev => prev.map(t =>
          t.id === id
            ? { ...t, status: done ? 'active' : 'done', completed_at: done ? null : t.completed_at }
            : t
        ))
      }
    } catch {
      // Revert
      setTasks(prev => prev.map(t =>
        t.id === id
          ? { ...t, status: done ? 'active' : 'done', completed_at: done ? null : t.completed_at }
          : t
      ))
    }
  }

  // Optimistic update
  const handleUpdate = async (id: string, updates: Partial<TaskWithCategory>) => {
    const prev = tasks.find(t => t.id === id)
    setTasks(ts => ts.map(t => t.id === id ? { ...t, ...updates } : t))

    try {
      const res = await fetch(`/api/tasks/${id}`, {
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

    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'dropped' }),
    })
  }

  const groups = groupTasks(tasks)
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
      <h1 style={{
        fontSize: 'var(--text-heading)',
        fontWeight: 'var(--font-heading)',
        color: 'var(--color-text-primary)',
        marginBottom: '16px',
      }}>
        Tasks
      </h1>

      {/* Category filter chips */}
      {categories.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '12px',
          marginBottom: '8px',
          WebkitOverflowScrolling: 'touch',
        }}>
          <CategoryChip
            name="All"
            color="var(--color-text-secondary)"
            selected={!selectedCategory}
            onClick={() => setSelectedCategory(null)}
          />
          {categories.map(cat => (
            <CategoryChip
              key={cat.id}
              name={cat.name}
              color={cat.color}
              icon={cat.icon}
              selected={selectedCategory === cat.id}
              onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
            />
          ))}
        </div>
      )}

      {/* Task list or empty state */}
      {hasActiveTasks ? (
        <TaskList
          groups={groups}
          categories={categories}
          onToggle={handleToggle}
          onUpdate={handleUpdate}
          onDrop={handleDrop}
        />
      ) : (
        <EmptyState
          icon={String.fromCodePoint(0x1F4AD)}
          title="No tasks yet"
          message="Dump your thoughts to get started. I'll turn them into tasks."
          actionLabel="Brain dump"
          onAction={() => router.push('/dump')}
        />
      )}
    </div>
  )
}
