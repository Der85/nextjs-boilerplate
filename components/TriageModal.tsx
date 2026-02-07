'use client'

import { useState, useEffect, useRef } from 'react'
import TriageItem from './TriageItem'

interface OverduePlan {
  id: string
  task_name: string
  due_date: string | null
  created_at: string
}

interface TriageModalProps {
  isOpen: boolean
  items: OverduePlan[]
  tasksDueTomorrow: number  // Count of tasks already due tomorrow
  onClose: () => void
  onArchiveAll: () => Promise<void>
  onArchiveSelected: (ids: string[]) => Promise<void>
  onRescheduleSelected: (ids: string[]) => Promise<void>
  onSpreadTasks: (ids: string[]) => Promise<void>  // Spread tasks across days
}

// Get friendly count text
const getCountText = (count: number): string => {
  if (count === 1) return '1 item'
  if (count <= 5) return `${count} items`
  return 'a few items'
}

export default function TriageModal({
  isOpen,
  items,
  tasksDueTomorrow,
  onClose,
  onArchiveAll,
  onArchiveSelected,
  onRescheduleSelected,
  onSpreadTasks,
}: TriageModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set())
  const [showUndo, setShowUndo] = useState(false)
  const [undoAction, setUndoAction] = useState<(() => void) | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showSafetyWarning, setShowSafetyWarning] = useState(false)
  const [pendingRescheduleIds, setPendingRescheduleIds] = useState<string[]>([])
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const SAFETY_CAP = 3 // Max tasks for tomorrow before showing warning

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set())
      setExitingIds(new Set())
      setShowUndo(false)
      setShowSuccess(false)
      setIsProcessing(false)
      setShowSafetyWarning(false)
      setPendingRescheduleIds([])
    }
  }, [isOpen])

  // Clean up undo timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    }
  }, [])

  const handleSelect = (id: string, selected: boolean) => {
    const newSelected = new Set(selectedIds)
    if (selected) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedIds(newSelected)
  }

  const handleFreshSlate = async () => {
    setIsProcessing(true)

    // Show undo option
    setShowUndo(true)

    // Set up undo timer - 5 seconds
    undoTimerRef.current = setTimeout(async () => {
      setShowUndo(false)
      await onArchiveAll()
      setShowSuccess(true)
      setTimeout(() => {
        onClose()
      }, 1000)
    }, 5000)

    setUndoAction(() => () => {
      // Cancel the pending archive
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current)
      }
      setShowUndo(false)
      setIsProcessing(false)
    })
  }

  const handleUndo = () => {
    if (undoAction) {
      undoAction()
    }
  }

  const handleArchiveSelected = async () => {
    if (selectedIds.size === 0) return

    // Animate out selected items
    setExitingIds(new Set(selectedIds))

    // Wait for animation
    setTimeout(async () => {
      await onArchiveSelected(Array.from(selectedIds))
      setSelectedIds(new Set())
      setExitingIds(new Set())

      // Check if all items are done
      const remainingCount = items.length - selectedIds.size
      if (remainingCount === 0) {
        setShowSuccess(true)
        setTimeout(() => onClose(), 1000)
      }
    }, 200)
  }

  const handleRescheduleSelected = async () => {
    if (selectedIds.size === 0) return

    const idsToReschedule = Array.from(selectedIds)
    const totalForTomorrow = tasksDueTomorrow + idsToReschedule.length

    // Safety cap check: if total > 3, show warning
    if (totalForTomorrow > SAFETY_CAP) {
      setPendingRescheduleIds(idsToReschedule)
      setShowSafetyWarning(true)
      return
    }

    // Proceed with reschedule
    await executeReschedule(idsToReschedule)
  }

  const executeReschedule = async (ids: string[]) => {
    // Animate out items
    setExitingIds(new Set(ids))

    // Wait for animation
    setTimeout(async () => {
      await onRescheduleSelected(ids)
      setSelectedIds(new Set())
      setExitingIds(new Set())

      // Check if all items are done
      const remainingCount = items.length - ids.length
      if (remainingCount === 0) {
        setShowSuccess(true)
        setTimeout(() => onClose(), 1000)
      }
    }, 200)
  }

  const handleSpreadTasks = async () => {
    // Animate out items
    setExitingIds(new Set(pendingRescheduleIds))

    setTimeout(async () => {
      await onSpreadTasks(pendingRescheduleIds)
      setSelectedIds(new Set())
      setExitingIds(new Set())
      setShowSafetyWarning(false)
      setPendingRescheduleIds([])

      // Check if all items are done
      const remainingCount = items.length - pendingRescheduleIds.length
      if (remainingCount === 0) {
        setShowSuccess(true)
        setTimeout(() => onClose(), 1000)
      }
    }, 200)
  }

  const handleProceedAnyway = async () => {
    setShowSafetyWarning(false)
    await executeReschedule(pendingRescheduleIds)
    setPendingRescheduleIds([])
  }

  const handleSwipeReschedule = async (id: string) => {
    // Check safety cap for single item
    const totalForTomorrow = tasksDueTomorrow + 1
    if (totalForTomorrow > SAFETY_CAP) {
      setPendingRescheduleIds([id])
      setShowSafetyWarning(true)
      return
    }

    setExitingIds(new Set([id]))
    setTimeout(async () => {
      await onRescheduleSelected([id])
      setExitingIds(new Set())
      // Remove from selection if selected
      const newSelected = new Set(selectedIds)
      newSelected.delete(id)
      setSelectedIds(newSelected)
    }, 200)
  }

  const handleSwipeArchive = async (id: string) => {
    setExitingIds(new Set([id]))
    setTimeout(async () => {
      await onArchiveSelected([id])
      setExitingIds(new Set())
      // Remove from selection if selected
      const newSelected = new Set(selectedIds)
      newSelected.delete(id)
      setSelectedIds(newSelected)
    }, 200)
  }

  // Filter out exiting items for display
  const visibleItems = items.filter(item => !exitingIds.has(item.id) || exitingIds.has(item.id))

  if (!isOpen) return null

  return (
    <div className="triage-overlay" onClick={onClose}>
      <div className="triage-modal" onClick={(e) => e.stopPropagation()}>
        {/* Handle for dragging */}
        <div className="modal-handle" />

        {showSuccess ? (
          <div className="success-state">
            <span className="success-icon">✓</span>
            <p className="success-text">All sorted</p>
          </div>
        ) : showUndo ? (
          <div className="undo-state">
            <p className="undo-text">Archiving all items...</p>
            <button className="undo-btn" onClick={handleUndo}>
              Undo
            </button>
            <div className="undo-progress" />
          </div>
        ) : showSafetyWarning ? (
          <div className="safety-warning-state">
            <div className="safety-icon">⚠️</div>
            <h3 className="safety-title">
              That's {tasksDueTomorrow + pendingRescheduleIds.length} things for tomorrow
            </h3>
            <p className="safety-message">
              Want to spread some across the week instead?
            </p>
            <div className="safety-actions">
              <button className="safety-btn spread" onClick={handleSpreadTasks}>
                Spread them out
              </button>
              <button className="safety-btn proceed" onClick={handleProceedAnyway}>
                I can handle it
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="modal-header">
              <h2 className="modal-title">
                {getCountText(items.length)} from before
              </h2>
              <button className="close-btn" onClick={onClose}>
                ✕
              </button>
            </div>

            {/* Bulk action - primary, dominant */}
            <div className="bulk-section">
              <p className="bulk-hint">
                The quickest option: archive everything and start fresh.
              </p>
              <button
                className="fresh-slate-btn"
                onClick={handleFreshSlate}
                disabled={isProcessing}
              >
                ✨ Fresh slate — archive all
              </button>
            </div>

            {/* Divider */}
            <div className="divider">
              <span>or review one by one</span>
            </div>

            {/* Items list */}
            <div className="items-list">
              {visibleItems.map((item) => (
                <TriageItem
                  key={item.id}
                  id={item.id}
                  title={item.task_name}
                  createdAt={item.created_at}
                  isSelected={selectedIds.has(item.id)}
                  onSelect={handleSelect}
                  onSwipeReschedule={handleSwipeReschedule}
                  onSwipeArchive={handleSwipeArchive}
                  isExiting={exitingIds.has(item.id)}
                />
              ))}
            </div>

            {/* Selection actions - only visible when items selected */}
            {selectedIds.size > 0 && (
              <div className="selection-actions">
                <button
                  className="action-btn reschedule"
                  onClick={handleRescheduleSelected}
                >
                  Reschedule ({selectedIds.size})
                </button>
                <button
                  className="action-btn archive"
                  onClick={handleArchiveSelected}
                >
                  Archive ({selectedIds.size})
                </button>
              </div>
            )}
          </>
        )}

        <style jsx>{`
          .triage-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.4);
            z-index: 300;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            animation: fadeIn 0.2s ease-out;
          }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          .triage-modal {
            background: white;
            border-radius: clamp(20px, 5vw, 28px) clamp(20px, 5vw, 28px) 0 0;
            width: 100%;
            max-width: 500px;
            max-height: 85vh;
            overflow-y: auto;
            padding: clamp(8px, 2vw, 12px) clamp(20px, 5vw, 28px) clamp(28px, 7vw, 36px);
            animation: slideUp 0.3s ease-out;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }

          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(100%);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .modal-handle {
            width: 40px;
            height: 4px;
            background: #e5e7eb;
            border-radius: 2px;
            margin: 0 auto clamp(16px, 4vw, 24px);
          }

          .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: clamp(16px, 4vw, 24px);
          }

          .modal-title {
            font-size: clamp(18px, 4.5vw, 22px);
            font-weight: 700;
            color: #1f2937;
            margin: 0;
          }

          .close-btn {
            width: 32px;
            height: 32px;
            border: none;
            background: #f3f4f6;
            border-radius: 50%;
            font-size: 16px;
            color: #6b7280;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s ease;
          }

          .close-btn:hover {
            background: #e5e7eb;
          }

          .bulk-section {
            margin-bottom: clamp(20px, 5vw, 28px);
          }

          .bulk-hint {
            font-size: clamp(14px, 3.5vw, 15px);
            color: #6b7280;
            margin: 0 0 clamp(12px, 3vw, 16px) 0;
            line-height: 1.5;
          }

          .fresh-slate-btn {
            width: 100%;
            padding: clamp(16px, 4vw, 20px);
            background: linear-gradient(135deg, #1D9BF0 0%, #1a8cd8 100%);
            color: white;
            border: none;
            border-radius: clamp(12px, 3vw, 16px);
            font-size: clamp(16px, 4vw, 18px);
            font-weight: 700;
            cursor: pointer;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
            box-shadow: 0 4px 16px rgba(29, 155, 240, 0.3);
          }

          .fresh-slate-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(29, 155, 240, 0.4);
          }

          .fresh-slate-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
          }

          .divider {
            display: flex;
            align-items: center;
            gap: clamp(12px, 3vw, 16px);
            margin-bottom: clamp(16px, 4vw, 20px);
          }

          .divider::before,
          .divider::after {
            content: '';
            flex: 1;
            height: 1px;
            background: #e5e7eb;
          }

          .divider span {
            font-size: clamp(12px, 3vw, 13px);
            color: #9ca3af;
            white-space: nowrap;
          }

          .items-list {
            display: flex;
            flex-direction: column;
            gap: clamp(8px, 2vw, 10px);
            margin-bottom: clamp(16px, 4vw, 20px);
          }

          .selection-actions {
            display: flex;
            gap: clamp(10px, 2.5vw, 14px);
            padding-top: clamp(12px, 3vw, 16px);
            border-top: 1px solid #e5e7eb;
            animation: fadeIn 0.2s ease-out;
          }

          .action-btn {
            flex: 1;
            padding: clamp(12px, 3vw, 16px);
            border-radius: clamp(10px, 2.5vw, 12px);
            font-size: clamp(14px, 3.5vw, 16px);
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .action-btn.reschedule {
            background: rgba(29, 155, 240, 0.1);
            border: 1px solid rgba(29, 155, 240, 0.2);
            color: #1D9BF0;
          }

          .action-btn.reschedule:hover {
            background: rgba(29, 155, 240, 0.15);
          }

          .action-btn.archive {
            background: rgba(100, 116, 139, 0.1);
            border: 1px solid rgba(100, 116, 139, 0.2);
            color: #64748b;
          }

          .action-btn.archive:hover {
            background: rgba(100, 116, 139, 0.15);
          }

          /* Success state */
          .success-state {
            text-align: center;
            padding: clamp(40px, 10vw, 60px) 0;
            animation: scaleIn 0.3s ease-out;
          }

          @keyframes scaleIn {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }

          .success-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 64px;
            height: 64px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            font-size: 32px;
            font-weight: 700;
            border-radius: 50%;
            margin-bottom: 16px;
          }

          .success-text {
            font-size: clamp(18px, 4.5vw, 22px);
            font-weight: 600;
            color: #1f2937;
            margin: 0;
          }

          /* Undo state */
          .undo-state {
            text-align: center;
            padding: clamp(30px, 7vw, 40px) 0;
          }

          .undo-text {
            font-size: clamp(16px, 4vw, 18px);
            color: #6b7280;
            margin: 0 0 clamp(16px, 4vw, 20px) 0;
          }

          .undo-btn {
            padding: clamp(12px, 3vw, 16px) clamp(32px, 8vw, 48px);
            background: white;
            border: 2px solid #1D9BF0;
            color: #1D9BF0;
            font-size: clamp(15px, 3.8vw, 17px);
            font-weight: 600;
            border-radius: 100px;
            cursor: pointer;
            transition: all 0.2s ease;
            margin-bottom: clamp(20px, 5vw, 28px);
          }

          .undo-btn:hover {
            background: rgba(29, 155, 240, 0.08);
          }

          .undo-progress {
            height: 4px;
            background: #e5e7eb;
            border-radius: 2px;
            overflow: hidden;
            position: relative;
          }

          .undo-progress::after {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            height: 100%;
            width: 100%;
            background: #1D9BF0;
            animation: shrink 5s linear forwards;
          }

          @keyframes shrink {
            from { width: 100%; }
            to { width: 0%; }
          }

          /* Safety warning state */
          .safety-warning-state {
            text-align: center;
            padding: clamp(30px, 7vw, 40px) 0;
            animation: scaleIn 0.3s ease-out;
          }

          .safety-icon {
            font-size: clamp(48px, 12vw, 64px);
            margin-bottom: clamp(12px, 3vw, 18px);
          }

          .safety-title {
            font-size: clamp(18px, 4.5vw, 22px);
            font-weight: 700;
            color: #d97706;
            margin: 0 0 clamp(8px, 2vw, 12px) 0;
          }

          .safety-message {
            font-size: clamp(14px, 3.5vw, 16px);
            color: #6b7280;
            margin: 0 0 clamp(24px, 6vw, 32px) 0;
            line-height: 1.5;
          }

          .safety-actions {
            display: flex;
            flex-direction: column;
            gap: clamp(10px, 2.5vw, 14px);
          }

          .safety-btn {
            padding: clamp(14px, 3.5vw, 18px);
            border-radius: clamp(12px, 3vw, 16px);
            font-size: clamp(15px, 4vw, 17px);
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }

          .safety-btn.spread {
            background: linear-gradient(135deg, #1D9BF0 0%, #1a8cd8 100%);
            color: white;
            border: none;
            box-shadow: 0 4px 16px rgba(29, 155, 240, 0.3);
          }

          .safety-btn.spread:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(29, 155, 240, 0.4);
          }

          .safety-btn.proceed {
            background: white;
            color: #6b7280;
            border: 2px solid #e5e7eb;
          }

          .safety-btn.proceed:hover {
            border-color: #d1d5db;
            background: #f9fafb;
          }
        `}</style>
      </div>
    </div>
  )
}
