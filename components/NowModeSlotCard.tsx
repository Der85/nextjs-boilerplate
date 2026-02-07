'use client'

import { useState } from 'react'
import type { NowSlot, NowModeTask } from '@/lib/types/now-mode'
import OutcomeChip from './OutcomeChip'

interface NowModeSlotCardProps {
  slot: NowSlot
  task: NowModeTask | null
  onStart?: (taskId: string) => void
  onComplete?: (taskId: string) => void
  onUnpin?: (taskId: string) => void
  onSwap?: (taskId: string) => void
  isActive?: boolean
  disabled?: boolean
}

export default function NowModeSlotCard({
  slot,
  task,
  onStart,
  onComplete,
  onUnpin,
  onSwap,
  isActive = false,
  disabled = false,
}: NowModeSlotCardProps) {
  const [showActions, setShowActions] = useState(false)

  const isEmpty = task === null
  const isCompleted = task?.status === 'completed'

  // Calculate step progress if task has steps
  const stepProgress = task?.steps
    ? {
        completed: task.steps.filter((s) => s.completed).length,
        total: task.steps.length,
      }
    : null

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return

    if (e.key === 'Enter' && task && onStart && !isCompleted) {
      e.preventDefault()
      onStart(task.id)
    }
    if (e.key === 'c' && task && onComplete && !isCompleted) {
      e.preventDefault()
      onComplete(task.id)
    }
    if (e.key === 's' && task && onSwap) {
      e.preventDefault()
      onSwap(task.id)
    }
  }

  return (
    <div
      className={`now-slot-card ${isEmpty ? 'empty' : ''} ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
      tabIndex={0}
      role="button"
      aria-label={isEmpty ? `Empty slot ${slot}. Choose next best step.` : `Slot ${slot}: ${task.task_name}`}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onFocus={() => setShowActions(true)}
      onBlur={() => setShowActions(false)}
    >
      <div className="slot-header">
        <span className="slot-number" aria-hidden="true">{slot}</span>
        {isCompleted && <span className="completed-badge">Done</span>}
      </div>

      {isEmpty ? (
        <div className="empty-slot-content">
          <div className="empty-icon">+</div>
          <p className="empty-text">Choose next best step</p>
          <p className="empty-hint">Press {slot} to add a task</p>
        </div>
      ) : (
        <div className="task-content">
          <h3 className="task-name">{task.task_name}</h3>

          {(task.outcome_title || task.commitment_title) && (
            <OutcomeChip
              title={task.outcome_title || task.commitment_title || ''}
              size="small"
            />
          )}

          <div className="task-meta">
            {task.estimated_minutes && (
              <span className="time-estimate">
                {task.estimated_minutes} min
              </span>
            )}
            {stepProgress && stepProgress.total > 0 && (
              <span className="step-progress">
                {stepProgress.completed}/{stepProgress.total} steps
              </span>
            )}
          </div>

          {(showActions || isActive) && !disabled && (
            <div className="slot-actions">
              {!isCompleted && onStart && (
                <button
                  className="action-btn start"
                  onClick={() => onStart(task.id)}
                  aria-label="Start task"
                >
                  Start
                </button>
              )}
              {!isCompleted && onComplete && (
                <button
                  className="action-btn complete"
                  onClick={() => onComplete(task.id)}
                  aria-label="Mark as complete"
                >
                  Done
                </button>
              )}
              {onSwap && (
                <button
                  className="action-btn swap"
                  onClick={() => onSwap(task.id)}
                  aria-label="Swap task"
                >
                  Swap
                </button>
              )}
              {onUnpin && (
                <button
                  className="action-btn unpin"
                  onClick={() => onUnpin(task.id)}
                  aria-label="Remove from Now Mode"
                >
                  Unpin
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .now-slot-card {
          background: #1a1a2e;
          border: 2px solid #2a2a4e;
          border-radius: 16px;
          padding: 20px;
          min-height: 180px;
          display: flex;
          flex-direction: column;
          transition: all 0.2s ease;
          cursor: pointer;
          position: relative;
        }

        .now-slot-card:hover,
        .now-slot-card:focus {
          border-color: #1D9BF0;
          outline: none;
        }

        .now-slot-card.active {
          border-color: #10b981;
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);
        }

        .now-slot-card.completed {
          border-color: #22c55e;
          background: linear-gradient(135deg, #1a1a2e, #1a2e1f);
        }

        .now-slot-card.empty {
          border-style: dashed;
          cursor: pointer;
        }

        .now-slot-card.empty:hover {
          border-color: #1D9BF0;
          background: rgba(29, 155, 240, 0.05);
        }

        .slot-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .slot-number {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #2a2a4e;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 14px;
          color: #8b8ba7;
        }

        .completed-badge {
          background: #22c55e;
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }

        .empty-slot-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .empty-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 2px dashed #4a4a6e;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          color: #6b6b8e;
          margin-bottom: 12px;
        }

        .empty-text {
          color: #a0a0be;
          font-size: 15px;
          margin: 0 0 4px;
        }

        .empty-hint {
          color: #6b6b8e;
          font-size: 12px;
          margin: 0;
        }

        .task-content {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .task-name {
          color: #e4e4f0;
          font-size: 16px;
          font-weight: 500;
          margin: 0 0 8px;
          line-height: 1.4;
        }

        .task-meta {
          display: flex;
          gap: 12px;
          margin-top: auto;
          padding-top: 12px;
        }

        .time-estimate,
        .step-progress {
          font-size: 13px;
          color: #8b8ba7;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .slot-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          flex-wrap: wrap;
        }

        .action-btn {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .action-btn.start {
          background: #1D9BF0;
          color: white;
        }

        .action-btn.start:hover {
          background: #0d8ae0;
        }

        .action-btn.complete {
          background: #22c55e;
          color: white;
        }

        .action-btn.complete:hover {
          background: #16a34a;
        }

        .action-btn.swap {
          background: #f59e0b;
          color: white;
        }

        .action-btn.swap:hover {
          background: #d97706;
        }

        .action-btn.unpin {
          background: transparent;
          border: 1px solid #4a4a6e;
          color: #8b8ba7;
        }

        .action-btn.unpin:hover {
          border-color: #ef4444;
          color: #ef4444;
        }

        @media (max-width: 640px) {
          .now-slot-card {
            min-height: 140px;
            padding: 16px;
          }

          .slot-actions {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #1a1a2e;
            padding: 16px;
            border-top: 1px solid #2a2a4e;
            justify-content: center;
            z-index: 100;
          }
        }
      `}</style>
    </div>
  )
}
