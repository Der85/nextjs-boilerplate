'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import UnifiedHeader from '@/components/UnifiedHeader'
import NowModePanel from '@/components/NowModePanel'
import type {
  NowModeState,
  NowModeSlotState,
  NowSlot,
  NowModeTask,
} from '@/lib/types/now-mode'

// Loading skeleton
function NowModeSkeleton() {
  return (
    <div className="skeleton-container">
      <div className="skeleton-header">
        <div className="skeleton-line w-40" />
        <div className="skeleton-line w-20" />
      </div>
      <div className="skeleton-slots">
        <div className="skeleton-slot" />
        <div className="skeleton-slot" />
        <div className="skeleton-slot" />
      </div>
      <style jsx>{`
        .skeleton-container {
          background: #12121f;
          border-radius: 20px;
          padding: 24px;
        }
        .skeleton-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .skeleton-line {
          height: 20px;
          background: #2a2a4e;
          border-radius: 8px;
          animation: pulse 1.5s ease-in-out infinite;
        }
        .skeleton-line.w-40 { width: 160px; }
        .skeleton-line.w-20 { width: 80px; }
        .skeleton-slots {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .skeleton-slot {
          height: 160px;
          background: #2a2a4e;
          border-radius: 16px;
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.3; }
        }
        @media (max-width: 768px) {
          .skeleton-slots {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

// Backlog task item
interface BacklogTask {
  id: string
  task_name: string
  estimated_minutes: number | null
  outcome_title: string | null
  commitment_title: string | null
  due_date: string | null
}

export default function NowModePage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nowModeState, setNowModeState] = useState<NowModeState | null>(null)
  const [backlogVisible, setBacklogVisible] = useState(false)
  const [backlogTasks, setBacklogTasks] = useState<BacklogTask[]>([])
  const [selectedSlot, setSelectedSlot] = useState<NowSlot | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Check auth and fetch initial state
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      await fetchNowModeState(session.access_token)
    }
    init()
  }, [router, supabase])

  // Fetch Now Mode state
  const fetchNowModeState = async (token?: string) => {
    try {
      let accessToken = token
      if (!accessToken) {
        const { data: { session } } = await supabase.auth.getSession()
        accessToken = session?.access_token
      }

      const res = await fetch('/api/now-mode', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!res.ok) {
        throw new Error('Failed to fetch Now Mode state')
      }

      const data = await res.json()
      setNowModeState(data.state)
      setError(null)
    } catch (err) {
      console.error('Error fetching Now Mode:', err)
      setError('Could not load Now Mode. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Fetch backlog tasks (tasks not in Now Mode)
  const fetchBacklog = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Step 1: Fetch focus_plans without joins (more robust)
      const { data: tasks, error: fetchError } = await supabase
        .from('focus_plans')
        .select('id, task_name, estimated_minutes, due_date, outcome_id, commitment_id')
        .eq('user_id', session.user.id)
        .is('now_slot', null)
        .in('status', ['active', 'needs_linking'])
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(20)

      if (fetchError) {
        console.error('Error fetching backlog:', fetchError)
        return
      }

      if (!tasks || tasks.length === 0) {
        setBacklogTasks([])
        return
      }

      // Step 2: Collect unique outcome/commitment IDs
      const outcomeIds = [...new Set(tasks.map(t => t.outcome_id).filter(Boolean))] as string[]
      const commitmentIds = [...new Set(tasks.map(t => t.commitment_id).filter(Boolean))] as string[]

      // Step 3: Fetch outcomes and commitments separately (if any exist)
      let outcomesMap: Record<string, string> = {}
      let commitmentsMap: Record<string, string> = {}

      if (outcomeIds.length > 0) {
        const { data: outcomes } = await supabase
          .from('outcomes')
          .select('id, title')
          .in('id', outcomeIds)

        if (outcomes) {
          outcomesMap = Object.fromEntries(outcomes.map(o => [o.id, o.title]))
        }
      }

      if (commitmentIds.length > 0) {
        const { data: commitments } = await supabase
          .from('commitments')
          .select('id, title')
          .in('id', commitmentIds)

        if (commitments) {
          commitmentsMap = Object.fromEntries(commitments.map(c => [c.id, c.title]))
        }
      }

      // Step 4: Map tasks with safe property access
      const formattedTasks: BacklogTask[] = tasks.map((task) => {
        try {
          return {
            id: task.id,
            task_name: task.task_name || 'Untitled Task',
            estimated_minutes: task.estimated_minutes ?? null,
            due_date: task.due_date ?? null,
            outcome_title: task.outcome_id ? (outcomesMap[task.outcome_id] ?? null) : null,
            commitment_title: task.commitment_id ? (commitmentsMap[task.commitment_id] ?? null) : null,
          }
        } catch {
          // If any task fails to map, return a safe default
          return {
            id: task.id,
            task_name: task.task_name || 'Untitled Task',
            estimated_minutes: null,
            due_date: null,
            outcome_title: null,
            commitment_title: null,
          }
        }
      })

      setBacklogTasks(formattedTasks)
    } catch (err) {
      console.error('Error fetching backlog:', err)
      setBacklogTasks([])
    }
  }

  // Pin a task to Now Mode
  const handlePinTask = useCallback(async (taskId: string, slot?: NowSlot) => {
    setActionLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/now-mode/pin', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ task_id: taskId, slot }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to pin task')
      }

      await fetchNowModeState(session.access_token)
      setBacklogVisible(false)
      setSelectedSlot(null)
    } catch (err) {
      console.error('Error pinning task:', err)
      alert(err instanceof Error ? err.message : 'Failed to pin task')
    } finally {
      setActionLoading(false)
    }
  }, [supabase])

  // Unpin a task from Now Mode
  const handleUnpinTask = useCallback(async (taskId: string) => {
    setActionLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/now-mode/unpin', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ task_id: taskId }),
      })

      if (!res.ok) {
        throw new Error('Failed to unpin task')
      }

      await fetchNowModeState(session.access_token)
    } catch (err) {
      console.error('Error unpinning task:', err)
    } finally {
      setActionLoading(false)
    }
  }, [supabase])

  // Start focusing on a task
  const handleStartTask = useCallback((taskId: string) => {
    router.push(`/focus?task=${taskId}`)
  }, [router])

  // Complete a task
  const handleCompleteTask = useCallback(async (taskId: string) => {
    setActionLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      // Update task status to completed
      const { error: updateError } = await supabase
        .from('focus_plans')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('user_id', session.user.id)

      if (updateError) {
        throw new Error('Failed to complete task')
      }

      await fetchNowModeState(session.access_token)
    } catch (err) {
      console.error('Error completing task:', err)
    } finally {
      setActionLoading(false)
    }
  }, [supabase])

  // Swap a task with another
  const handleSwapTask = useCallback(async (currentTaskId: string, replacementTaskId: string) => {
    setActionLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/now-mode/swap', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_task_id: currentTaskId,
          replacement_task_id: replacementTaskId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to swap task')
      }

      await fetchNowModeState(session.access_token)
    } catch (err) {
      console.error('Error swapping task:', err)
      alert(err instanceof Error ? err.message : 'Failed to swap task')
    } finally {
      setActionLoading(false)
    }
  }, [supabase])

  // Toggle backlog visibility
  const handleRevealBacklog = useCallback(() => {
    if (!backlogVisible) {
      fetchBacklog()
    }
    setBacklogVisible(!backlogVisible)
  }, [backlogVisible])

  // Handle empty slot selection
  const handleSelectEmptySlot = useCallback((slot: NowSlot) => {
    setSelectedSlot(slot)
    setBacklogVisible(true)
    fetchBacklog()
  }, [])

  // Default empty state
  const emptyState: NowModeState = {
    slots: [
      { slot: 1, task: null, isEmpty: true },
      { slot: 2, task: null, isEmpty: true },
      { slot: 3, task: null, isEmpty: true },
    ],
    occupiedCount: 0,
    allCompleted: false,
    enabled: true,
    strictLimit: true,
  }

  return (
    <div className="now-mode-page">
      <UnifiedHeader subtitle="Now Mode" />

      <main className="main-content">
        {loading ? (
          <NowModeSkeleton />
        ) : error ? (
          <div className="error-card">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
            <button onClick={() => fetchNowModeState()} className="btn-retry">
              Try again
            </button>
          </div>
        ) : (
          <>
            <div className="intro-section">
              <h1 className="page-title">Focus on 3 things</h1>
              <p className="page-subtitle">
                Limit your active tasks to reduce overwhelm. Complete or swap before adding more.
              </p>
            </div>

            <NowModePanel
              state={nowModeState || emptyState}
              onPinTask={handlePinTask}
              onUnpinTask={handleUnpinTask}
              onStartTask={handleStartTask}
              onCompleteTask={handleCompleteTask}
              onSwapTask={handleSwapTask}
              onRevealBacklog={handleRevealBacklog}
              onSelectEmptySlot={handleSelectEmptySlot}
              backlogVisible={backlogVisible}
              loading={actionLoading}
            />

            {/* Backlog Panel */}
            {backlogVisible && (
              <div className="backlog-panel">
                <div className="backlog-header">
                  <h3 className="backlog-title">
                    {selectedSlot ? `Select task for Slot ${selectedSlot}` : 'Available Tasks'}
                  </h3>
                  <button
                    className="backlog-close"
                    onClick={() => {
                      setBacklogVisible(false)
                      setSelectedSlot(null)
                    }}
                  >
                    ×
                  </button>
                </div>

                {backlogTasks.length === 0 ? (
                  <div className="backlog-empty">
                    <span className="empty-icon">📝</span>
                    <p>No available tasks</p>
                    <button
                      className="btn-create-task"
                      onClick={() => router.push('/focus')}
                    >
                      Create a new task
                    </button>
                  </div>
                ) : (
                  <div className="backlog-list">
                    {backlogTasks.map((task) => (
                      <button
                        key={task.id}
                        className="backlog-item"
                        onClick={() => handlePinTask(task.id, selectedSlot || undefined)}
                        disabled={actionLoading}
                      >
                        <div className="task-info">
                          <span className="task-name">{task.task_name}</span>
                          {(task.outcome_title || task.commitment_title) && (
                            <span className="task-parent">
                              {task.commitment_title || task.outcome_title}
                            </span>
                          )}
                        </div>
                        {task.estimated_minutes && (
                          <span className="task-time">
                            {task.estimated_minutes}m
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Keyboard shortcuts hint */}
            <div className="shortcuts-hint">
              <span>Keyboard:</span>
              <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> slots
              <kbd>B</kbd> backlog
              <kbd>C</kbd> complete
            </div>
          </>
        )}
      </main>

      <style jsx>{`
        .now-mode-page {
          min-height: 100vh;
          min-height: 100dvh;
          background: linear-gradient(180deg, #0a0a14 0%, #12121f 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .main-content {
          max-width: 900px;
          margin: 0 auto;
          padding: clamp(16px, 4vw, 24px);
        }

        .intro-section {
          text-align: center;
          margin-bottom: clamp(20px, 5vw, 32px);
        }

        .page-title {
          font-size: clamp(24px, 6vw, 32px);
          font-weight: 700;
          color: #e4e4f0;
          margin: 0 0 8px 0;
        }

        .page-subtitle {
          font-size: clamp(14px, 3.8vw, 16px);
          color: #8b8ba7;
          margin: 0;
          line-height: 1.5;
        }

        .error-card {
          background: #1a1a2e;
          border-radius: 16px;
          padding: clamp(32px, 8vw, 48px);
          text-align: center;
        }

        .error-icon {
          font-size: 48px;
          display: block;
          margin-bottom: 16px;
        }

        .error-card p {
          color: #8b8ba7;
          margin: 0 0 24px 0;
          font-size: 16px;
        }

        .btn-retry {
          background: #1D9BF0;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .btn-retry:hover {
          background: #0d8ae0;
        }

        /* Backlog Panel */
        .backlog-panel {
          background: #1a1a2e;
          border-radius: 16px;
          margin-top: 24px;
          overflow: hidden;
          animation: slideUp 0.2s ease;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .backlog-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #2a2a4e;
        }

        .backlog-title {
          font-size: 16px;
          font-weight: 600;
          color: #e4e4f0;
          margin: 0;
        }

        .backlog-close {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: none;
          background: #2a2a4e;
          color: #8b8ba7;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease;
        }

        .backlog-close:hover {
          background: #3a3a5e;
          color: #e4e4f0;
        }

        .backlog-empty {
          padding: 40px 20px;
          text-align: center;
        }

        .empty-icon {
          font-size: 40px;
          display: block;
          margin-bottom: 12px;
        }

        .backlog-empty p {
          color: #8b8ba7;
          margin: 0 0 20px 0;
        }

        .btn-create-task {
          background: transparent;
          border: 1px solid #3a3a5e;
          color: #a0a0be;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-create-task:hover {
          border-color: #1D9BF0;
          color: #1D9BF0;
        }

        .backlog-list {
          max-height: 320px;
          overflow-y: auto;
        }

        .backlog-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
          padding: 14px 20px;
          background: transparent;
          border: none;
          border-bottom: 1px solid #2a2a4e;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s ease;
        }

        .backlog-item:hover {
          background: rgba(29, 155, 240, 0.08);
        }

        .backlog-item:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .backlog-item:last-child {
          border-bottom: none;
        }

        .task-info {
          flex: 1;
          min-width: 0;
        }

        .task-name {
          display: block;
          font-size: 15px;
          font-weight: 500;
          color: #e4e4f0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .task-parent {
          display: block;
          font-size: 13px;
          color: #8b8ba7;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .task-time {
          flex-shrink: 0;
          font-size: 13px;
          color: #1D9BF0;
          background: rgba(29, 155, 240, 0.12);
          padding: 4px 8px;
          border-radius: 6px;
        }

        /* Keyboard shortcuts hint */
        .shortcuts-hint {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 32px;
          font-size: 12px;
          color: #5a5a7e;
        }

        .shortcuts-hint kbd {
          background: #2a2a4e;
          padding: 3px 8px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 11px;
        }

        @media (max-width: 768px) {
          .shortcuts-hint {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
