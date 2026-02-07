'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { NowModeTask } from '@/lib/types/now-mode'

interface RecommendedTask {
  id: string
  task_name: string
  estimated_minutes: number | null
  outcome_title: string | null
  commitment_title: string | null
  due_date: string | null
  score: number
}

interface SwapTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (taskId: string) => void
  currentTask: NowModeTask | null
  excludeTaskIds: string[]
}

export default function SwapTaskModal({
  isOpen,
  onClose,
  onSelect,
  currentTask,
  excludeTaskIds,
}: SwapTaskModalProps) {
  const [recommendations, setRecommendations] = useState<RecommendedTask[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const fetchRecommendations = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const excludeParam = excludeTaskIds.length > 0 ? `&exclude=${excludeTaskIds.join(',')}` : ''
      const res = await fetch(`/api/now-mode/recommended?limit=6${excludeParam}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (res.ok) {
        const data = await res.json()
        setRecommendations(data.tasks || [])
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error)
    } finally {
      setLoading(false)
    }
  }, [excludeTaskIds])

  useEffect(() => {
    if (isOpen) {
      fetchRecommendations()
      setSelectedId(null)
    }
  }, [isOpen, fetchRecommendations])

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
      // Number keys for quick selection
      const num = parseInt(e.key)
      if (num >= 1 && num <= recommendations.length) {
        const task = recommendations[num - 1]
        if (task) {
          setSelectedId(task.id)
        }
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, onSelect, selectedId, recommendations])

  if (!isOpen) return null

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
      aria-labelledby="swap-modal-title"
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 id="swap-modal-title">Swap Task</h2>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {currentTask && (
          <div className="current-task">
            <span className="label">Currently in slot:</span>
            <span className="task-name">{currentTask.task_name}</span>
          </div>
        )}

        <div className="recommendations-section">
          <h3>Choose replacement</h3>

          {loading ? (
            <div className="loading">
              <div className="spinner" />
              <span>Finding best options...</span>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="empty-state">
              <p>No tasks available to swap in.</p>
              <p className="hint">Make sure you have linked tasks in your backlog.</p>
            </div>
          ) : (
            <ul className="task-list" role="listbox" aria-label="Recommended tasks">
              {recommendations.map((task, index) => (
                <li
                  key={task.id}
                  className={`task-item ${selectedId === task.id ? 'selected' : ''}`}
                  onClick={() => setSelectedId(task.id)}
                  onDoubleClick={() => onSelect(task.id)}
                  role="option"
                  aria-selected={selectedId === task.id}
                  tabIndex={0}
                >
                  <span className="shortcut-key">{index + 1}</span>
                  <div className="task-info">
                    <span className="task-name">{task.task_name}</span>
                    <div className="task-meta">
                      {task.outcome_title && (
                        <span className="outcome">{task.outcome_title}</span>
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
            Swap Task
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
          max-width: 500px;
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

        .current-task {
          padding: 16px 24px;
          background: #12121f;
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .current-task .label {
          color: #6b6b8e;
          font-size: 13px;
        }

        .current-task .task-name {
          color: #a0a0be;
          font-size: 14px;
        }

        .recommendations-section {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
        }

        .recommendations-section h3 {
          font-size: 14px;
          color: #8b8ba7;
          margin: 0 0 16px;
          font-weight: 500;
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
          gap: 12px;
          padding: 12px 16px;
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

        .shortcut-key {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: #2a2a4e;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          color: #8b8ba7;
          flex-shrink: 0;
        }

        .task-info {
          flex: 1;
          min-width: 0;
        }

        .task-info .task-name {
          display: block;
          color: #e4e4f0;
          font-size: 14px;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
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
