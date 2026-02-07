'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { NowSlot } from '@/lib/types/now-mode'

interface PickableTask {
  id: string
  task_name: string
  estimated_minutes: number | null
  outcome_title: string | null
  commitment_title: string | null
  due_date: string | null
  status: string
}

interface TaskPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (taskId: string) => void
  slot: NowSlot | null
  excludeTaskIds: string[]
}

export default function TaskPickerModal({
  isOpen,
  onClose,
  onSelect,
  slot,
  excludeTaskIds,
}: TaskPickerModalProps) {
  const supabase = createClient()
  const [tasks, setTasks] = useState<PickableTask[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Fetch tasks that are linked and not already in Now Mode
      const { data, error } = await supabase
        .from('focus_plans')
        .select(`
          id,
          task_name,
          estimated_minutes,
          due_date,
          status,
          outcome_id,
          commitment_id,
          outcomes:outcome_id (title),
          commitments:commitment_id (title)
        `)
        .eq('user_id', session.user.id)
        .in('status', ['active', 'needs_linking'])
        .is('now_slot', null)
        .or('outcome_id.not.is.null,commitment_id.not.is.null')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('Error fetching tasks:', error)
        return
      }

      const pickableTasks: PickableTask[] = (data || [])
        .filter((t: any) => !excludeTaskIds.includes(t.id))
        .map((t: any) => ({
          id: t.id,
          task_name: t.task_name,
          estimated_minutes: t.estimated_minutes,
          due_date: t.due_date,
          status: t.status,
          outcome_title: t.outcomes?.title || null,
          commitment_title: t.commitments?.title || null,
        }))

      setTasks(pickableTasks)
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setLoading(false)
    }
  }, [excludeTaskIds])

  useEffect(() => {
    if (isOpen) {
      fetchTasks()
      setSelectedId(null)
      setSearchQuery('')
    }
  }, [isOpen, fetchTasks])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        e.preventDefault()
      }
      if (e.key === 'Enter' && selectedId) {
        onSelect(selectedId)
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, onSelect, selectedId])

  if (!isOpen) return null

  const filteredTasks = searchQuery.trim()
    ? tasks.filter((t) =>
        t.task_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.outcome_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.commitment_title?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tasks

  const getDueDateLabel = (dueDate: string | null): string => {
    if (!dueDate) return ''
    const labels: Record<string, string> = {
      today: 'Today',
      tomorrow: 'Tomorrow',
      this_week: 'This week',
      no_rush: 'No rush',
    }
    return labels[dueDate] || dueDate
  }

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="picker-modal-title"
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="picker-modal-title">
            {slot ? `Add task to slot ${slot}` : 'Choose a task'}
          </h2>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="search-section">
          <input
            type="text"
            className="search-input"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className="tasks-section">
          {loading ? (
            <div className="loading">
              <div className="spinner" />
              <span>Loading tasks...</span>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="empty-state">
              {searchQuery ? (
                <p>No tasks match &quot;{searchQuery}&quot;</p>
              ) : (
                <>
                  <p>No linked tasks available.</p>
                  <p className="hint">
                    Tasks must be linked to an Outcome or Commitment to be added to Now Mode.
                  </p>
                </>
              )}
            </div>
          ) : (
            <ul className="task-list" role="listbox" aria-label="Available tasks">
              {filteredTasks.map((task) => (
                <li
                  key={task.id}
                  className={`task-item ${selectedId === task.id ? 'selected' : ''}`}
                  onClick={() => setSelectedId(task.id)}
                  onDoubleClick={() => onSelect(task.id)}
                  role="option"
                  aria-selected={selectedId === task.id}
                  tabIndex={0}
                >
                  <div className="task-info">
                    <span className="task-name">{task.task_name}</span>
                    <div className="task-meta">
                      {task.outcome_title && (
                        <span className="outcome">{task.outcome_title}</span>
                      )}
                      {task.commitment_title && (
                        <span className="commitment">{task.commitment_title}</span>
                      )}
                      {task.estimated_minutes && (
                        <span className="time">{task.estimated_minutes} min</span>
                      )}
                      {task.due_date && (
                        <span className="due-date">{getDueDateLabel(task.due_date)}</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => selectedId && onSelect(selectedId)}
            disabled={!selectedId}
          >
            Add to Now Mode
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 300;
          padding: 20px;
        }

        .modal-content {
          background: #1a1a2e;
          border-radius: 20px;
          width: 100%;
          max-width: 560px;
          max-height: 80vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #2a2a4e;
        }

        .modal-header h2 {
          font-size: 18px;
          color: #e4e4f0;
          margin: 0;
        }

        .close-btn {
          background: none;
          border: none;
          color: #8b8ba7;
          font-size: 28px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }

        .close-btn:hover {
          color: #e4e4f0;
        }

        .search-section {
          padding: 16px 24px;
          border-bottom: 1px solid #2a2a4e;
        }

        .search-input {
          width: 100%;
          padding: 12px 16px;
          background: #12121f;
          border: 1px solid #3a3a5e;
          border-radius: 10px;
          color: #e4e4f0;
          font-size: 15px;
        }

        .search-input::placeholder {
          color: #6b6b8e;
        }

        .search-input:focus {
          outline: none;
          border-color: #1D9BF0;
        }

        .tasks-section {
          flex: 1;
          overflow-y: auto;
          padding: 16px 24px;
        }

        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 40px 20px;
          color: #8b8ba7;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid #3a3a5e;
          border-top-color: #1D9BF0;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #8b8ba7;
        }

        .empty-state p {
          margin: 0 0 8px;
        }

        .empty-state .hint {
          font-size: 13px;
          color: #6b6b8e;
        }

        .task-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .task-item {
          display: flex;
          align-items: flex-start;
          padding: 14px 16px;
          background: #12121f;
          border: 2px solid transparent;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .task-item:hover {
          border-color: #3a3a5e;
        }

        .task-item.selected {
          border-color: #1D9BF0;
          background: rgba(29, 155, 240, 0.1);
        }

        .task-info {
          flex: 1;
          min-width: 0;
        }

        .task-info .task-name {
          display: block;
          color: #e4e4f0;
          font-size: 15px;
          margin-bottom: 6px;
        }

        .task-meta {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .task-meta span {
          font-size: 12px;
          color: #6b6b8e;
        }

        .task-meta .outcome {
          color: #1D9BF0;
        }

        .task-meta .commitment {
          color: #8b5cf6;
        }

        .task-meta .due-date {
          color: #f59e0b;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding: 16px 24px;
          border-top: 1px solid #2a2a4e;
        }

        .btn-primary,
        .btn-secondary {
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-primary {
          background: #1D9BF0;
          color: white;
          border: none;
        }

        .btn-primary:hover:not(:disabled) {
          background: #0d8ae0;
        }

        .btn-primary:disabled {
          background: #3a3a5e;
          color: #6b6b8e;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: transparent;
          color: #a0a0be;
          border: 1px solid #3a3a5e;
        }

        .btn-secondary:hover {
          border-color: #5a5a7e;
          color: #e4e4f0;
        }
      `}</style>
    </div>
  )
}
