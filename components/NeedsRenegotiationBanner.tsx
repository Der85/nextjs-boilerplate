'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { type TaskNeedingRenegotiation, formatDaysOverdue } from '@/lib/types/renegotiation'
import RenegotiationModal from './RenegotiationModal'

interface NeedsRenegotiationBannerProps {
  className?: string
  onTaskUpdated?: () => void
}

export default function NeedsRenegotiationBanner({
  className = '',
  onTaskUpdated,
}: NeedsRenegotiationBannerProps) {
  const supabase = createClient()
  const [tasks, setTasks] = useState<TaskNeedingRenegotiation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<TaskNeedingRenegotiation | null>(null)

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }, [])

  const fetchTasks = useCallback(async () => {
    try {
      const token = await getAuthToken()
      if (!token) {
        setLoading(false)
        return
      }

      const res = await fetch('/api/renegotiations', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setTasks(data.tasks || [])
      }
    } catch (err) {
      console.error('Error fetching tasks needing renegotiation:', err)
    } finally {
      setLoading(false)
    }
  }, [getAuthToken])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const handleComplete = () => {
    setSelectedTask(null)
    fetchTasks()
    onTaskUpdated?.()
  }

  if (loading || tasks.length === 0) {
    return null
  }

  return (
    <>
      <div className={`renegotiation-banner ${className}`}>
        <div className="banner-icon">🔄</div>
        <div className="banner-content">
          <h4>
            {tasks.length === 1
              ? '1 task needs your attention'
              : `${tasks.length} tasks need your attention`}
          </h4>
          <p>No pressure — let&apos;s figure out what works best.</p>
        </div>
        <div className="banner-tasks">
          {tasks.slice(0, 3).map((task) => (
            <button
              key={task.id}
              className="task-chip"
              onClick={() => setSelectedTask(task)}
            >
              <span className="task-name">{task.title}</span>
              <span className="task-time">{formatDaysOverdue(task.days_overdue)}</span>
            </button>
          ))}
          {tasks.length > 3 && (
            <span className="more-tasks">+{tasks.length - 3} more</span>
          )}
        </div>

        <style jsx>{`
          .renegotiation-banner {
            background: rgba(245, 158, 11, 0.1);
            border: 1px solid #f59e0b;
            border-radius: 16px;
            padding: 16px 20px;
            display: flex;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 20px;
          }

          .banner-icon {
            font-size: 24px;
            flex-shrink: 0;
          }

          .banner-content {
            flex: 1;
            min-width: 0;
          }

          .banner-content h4 {
            font-size: 15px;
            font-weight: 600;
            color: #e4e4f0;
            margin: 0 0 4px;
          }

          .banner-content p {
            font-size: 13px;
            color: #a0a0be;
            margin: 0;
          }

          .banner-tasks {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 12px;
          }

          .task-chip {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: rgba(0, 0, 0, 0.2);
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .task-chip:hover {
            background: rgba(0, 0, 0, 0.3);
          }

          .task-name {
            font-size: 13px;
            color: #e4e4f0;
            max-width: 150px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .task-time {
            font-size: 11px;
            color: #f59e0b;
          }

          .more-tasks {
            font-size: 12px;
            color: #8b8ba7;
            padding: 8px 0;
          }

          @media (max-width: 480px) {
            .renegotiation-banner {
              flex-direction: column;
            }
          }
        `}</style>
      </div>

      {selectedTask && (
        <RenegotiationModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onComplete={handleComplete}
        />
      )}
    </>
  )
}
