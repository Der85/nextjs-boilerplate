'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import ParentSelector from './ParentSelector'

interface UnlinkedTask {
  id: string
  task_name: string
  created_at: string
}

interface NeedsLinkingViewProps {
  onTaskLinked?: () => void
}

export default function NeedsLinkingView({ onTaskLinked }: NeedsLinkingViewProps) {
  const [tasks, setTasks] = useState<UnlinkedTask[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [linkingTaskId, setLinkingTaskId] = useState<string | null>(null)

  const loadUnlinkedTasks = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('focus_plans')
        .select('id, task_name, created_at')
        .eq('user_id', session.user.id)
        .eq('status', 'needs_linking')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Failed to load unlinked tasks:', error)
        return
      }

      setTasks(data || [])
    } catch (error) {
      console.error('Failed to load unlinked tasks:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUnlinkedTasks()
  }, [loadUnlinkedTasks])

  const handleLink = async (
    taskId: string,
    outcomeId: string | null,
    commitmentId: string | null
  ) => {
    if (!outcomeId && !commitmentId) return

    setLinkingTaskId(taskId)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/tasks/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          task_id: taskId,
          outcome_id: outcomeId,
          commitment_id: commitmentId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to link task')
      }

      // Remove from list and reset selection
      setTasks(prev => prev.filter(t => t.id !== taskId))
      setSelectedTaskId(null)
      onTaskLinked?.()
    } catch (error) {
      console.error('Failed to link task:', error)
    } finally {
      setLinkingTaskId(null)
    }
  }

  const formatRelativeTime = (dateStr: string): string => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="needs-linking-view">
        <div className="loading">Loading...</div>
        <style jsx>{`
          .needs-linking-view {
            padding: 20px;
          }
          .loading {
            text-align: center;
            color: #6b7280;
          }
        `}</style>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="needs-linking-view">
        <div className="empty-state">
          <span className="emoji">✅</span>
          <p className="message">All tasks are linked!</p>
          <p className="submessage">Every task has a parent outcome or commitment.</p>
        </div>

        <style jsx>{`
          .needs-linking-view {
            padding: 24px;
          }
          .empty-state {
            text-align: center;
            padding: 32px 16px;
          }
          .emoji {
            font-size: 48px;
            display: block;
            margin-bottom: 12px;
          }
          .message {
            font-size: 16px;
            font-weight: 600;
            color: #1f2937;
            margin: 0 0 4px 0;
          }
          .submessage {
            font-size: 14px;
            color: #6b7280;
            margin: 0;
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="needs-linking-view">
      <div className="header">
        <h2 className="title">Needs Linking</h2>
        <span className="count">{tasks.length}</span>
      </div>
      <p className="subtitle">
        These tasks need a parent outcome or commitment before you can work on them.
      </p>

      <div className="task-list">
        {tasks.map(task => (
          <div key={task.id} className="task-item">
            <div className="task-info">
              <p className="task-name">{task.task_name}</p>
              <p className="task-date">{formatRelativeTime(task.created_at)}</p>
            </div>

            {selectedTaskId === task.id ? (
              <div className="selector-wrapper">
                <ParentSelector
                  selectedOutcomeId={null}
                  selectedCommitmentId={null}
                  onSelect={(outcomeId, commitmentId) =>
                    handleLink(task.id, outcomeId, commitmentId)
                  }
                  disabled={linkingTaskId === task.id}
                />
                <button
                  className="cancel-btn"
                  onClick={() => setSelectedTaskId(null)}
                  type="button"
                  disabled={linkingTaskId === task.id}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="link-btn"
                onClick={() => setSelectedTaskId(task.id)}
                type="button"
              >
                Link
              </button>
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        .needs-linking-view {
          padding: 16px;
        }

        .header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .title {
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
          margin: 0;
        }

        .count {
          background: #fef3c7;
          color: #92400e;
          font-size: 12px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 100px;
        }

        .subtitle {
          font-size: 14px;
          color: #6b7280;
          margin: 0 0 16px 0;
        }

        .task-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .task-item {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 12px 16px;
        }

        .task-info {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 12px;
        }

        .task-name {
          font-size: 14px;
          font-weight: 500;
          color: #1f2937;
          margin: 0;
          flex: 1;
        }

        .task-date {
          font-size: 12px;
          color: #9ca3af;
          margin: 0;
          white-space: nowrap;
        }

        .selector-wrapper {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .link-btn {
          width: 100%;
          padding: 10px;
          background: #1D9BF0;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .link-btn:hover {
          background: #1a8cd8;
        }

        .cancel-btn {
          width: 100%;
          padding: 8px;
          background: #f3f4f6;
          color: #6b7280;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .cancel-btn:hover:not(:disabled) {
          background: #e5e7eb;
        }

        .cancel-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}
