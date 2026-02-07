'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import ParentSelector from './ParentSelector'

interface ActiveTask {
  id: string
  task_name: string
}

interface RelinkModalProps {
  isOpen: boolean
  activeTasks: ActiveTask[]
  sourceType: 'outcome' | 'commitment'
  sourceName: string
  onClose: () => void
  onRelinked: () => void
}

export default function RelinkModal({
  isOpen,
  activeTasks,
  sourceType,
  sourceName,
  onClose,
  onRelinked,
}: RelinkModalProps) {
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(null)
  const [selectedCommitmentId, setSelectedCommitmentId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedOutcomeId(null)
      setSelectedCommitmentId(null)
      setIsProcessing(false)
      setError(null)
    }
  }, [isOpen])

  const handleSelect = (outcomeId: string | null, commitmentId: string | null) => {
    setSelectedOutcomeId(outcomeId)
    setSelectedCommitmentId(commitmentId)
    setError(null)
  }

  const handleRelink = async () => {
    if (!selectedOutcomeId && !selectedCommitmentId) {
      setError('Please select a destination')
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Not authenticated')
        return
      }

      const response = await fetch('/api/tasks/bulk-relink', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          task_ids: activeTasks.map(t => t.id),
          target_outcome_id: selectedCommitmentId ? null : selectedOutcomeId,
          target_commitment_id: selectedCommitmentId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to relink tasks')
      }

      onRelinked()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to relink tasks')
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Relink Tasks</h2>
          <button className="close-btn" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="warning-box">
            <span className="warning-icon">⚠️</span>
            <div className="warning-text">
              <p className="warning-title">
                Cannot delete {sourceType} "{sourceName}"
              </p>
              <p className="warning-message">
                {activeTasks.length} active task{activeTasks.length !== 1 ? 's' : ''} must be
                relinked to a new {sourceType} first.
              </p>
            </div>
          </div>

          <div className="tasks-preview">
            <p className="tasks-label">Tasks to relink:</p>
            <ul className="tasks-list">
              {activeTasks.slice(0, 5).map(task => (
                <li key={task.id} className="task-item">
                  {task.task_name}
                </li>
              ))}
              {activeTasks.length > 5 && (
                <li className="task-item more">
                  + {activeTasks.length - 5} more
                </li>
              )}
            </ul>
          </div>

          <div className="selector-section">
            <p className="selector-label">Select new destination:</p>
            <ParentSelector
              selectedOutcomeId={selectedOutcomeId}
              selectedCommitmentId={selectedCommitmentId}
              onSelect={handleSelect}
              disabled={isProcessing}
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="cancel-btn"
            onClick={onClose}
            type="button"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            className="relink-btn"
            onClick={handleRelink}
            type="button"
            disabled={isProcessing || (!selectedOutcomeId && !selectedCommitmentId)}
          >
            {isProcessing ? 'Relinking...' : `Relink ${activeTasks.length} Task${activeTasks.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
        }

        .modal-content {
          background: white;
          border-radius: 16px;
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-title {
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
          margin: 0;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 18px;
          color: #9ca3af;
          cursor: pointer;
          padding: 4px;
          line-height: 1;
        }

        .close-btn:hover {
          color: #6b7280;
        }

        .modal-body {
          padding: 20px;
        }

        .warning-box {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: #fef3c7;
          border-radius: 10px;
          margin-bottom: 16px;
        }

        .warning-icon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .warning-text {
          flex: 1;
        }

        .warning-title {
          font-size: 14px;
          font-weight: 600;
          color: #92400e;
          margin: 0 0 4px 0;
        }

        .warning-message {
          font-size: 13px;
          color: #a16207;
          margin: 0;
        }

        .tasks-preview {
          margin-bottom: 16px;
        }

        .tasks-label {
          font-size: 13px;
          font-weight: 500;
          color: #6b7280;
          margin: 0 0 8px 0;
        }

        .tasks-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .task-item {
          font-size: 13px;
          color: #374151;
          padding: 6px 10px;
          background: #f9fafb;
          border-radius: 6px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .task-item.more {
          color: #6b7280;
          font-style: italic;
        }

        .selector-section {
          margin-bottom: 16px;
        }

        .selector-label {
          font-size: 13px;
          font-weight: 500;
          color: #6b7280;
          margin: 0 0 8px 0;
        }

        .error-message {
          padding: 10px 12px;
          background: #fef2f2;
          border-radius: 8px;
          color: #dc2626;
          font-size: 13px;
        }

        .modal-footer {
          display: flex;
          gap: 12px;
          padding: 16px 20px;
          border-top: 1px solid #e5e7eb;
        }

        .cancel-btn {
          flex: 1;
          padding: 12px;
          background: #f3f4f6;
          color: #374151;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
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

        .relink-btn {
          flex: 1;
          padding: 12px;
          background: #1D9BF0;
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .relink-btn:hover:not(:disabled) {
          background: #1a8cd8;
        }

        .relink-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}
