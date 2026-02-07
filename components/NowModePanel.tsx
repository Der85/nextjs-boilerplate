'use client'

import { useState, useEffect, useCallback } from 'react'
import NowModeSlotCard from './NowModeSlotCard'
import SwapTaskModal from './SwapTaskModal'
import type {
  NowModeState,
  NowSlot,
  NowModeTask,
} from '@/lib/types/now-mode'

interface NowModePanelProps {
  state: NowModeState
  onPinTask: (taskId: string, slot?: NowSlot) => Promise<void>
  onUnpinTask: (taskId: string) => Promise<void>
  onStartTask: (taskId: string) => void
  onCompleteTask: (taskId: string) => Promise<void>
  onSwapTask: (currentTaskId: string, replacementTaskId: string) => Promise<void>
  onRevealBacklog: () => void
  onSelectEmptySlot: (slot: NowSlot) => void
  backlogVisible: boolean
  loading?: boolean
}

export default function NowModePanel({
  state,
  onPinTask,
  onUnpinTask,
  onStartTask,
  onCompleteTask,
  onSwapTask,
  onRevealBacklog,
  onSelectEmptySlot,
  backlogVisible,
  loading = false,
}: NowModePanelProps) {
  const [activeSlot, setActiveSlot] = useState<NowSlot | null>(null)
  const [swapModalOpen, setSwapModalOpen] = useState(false)
  const [swapTaskId, setSwapTaskId] = useState<string | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)

  // Handle all slots completed celebration
  useEffect(() => {
    if (state.allCompleted && state.occupiedCount > 0) {
      setShowCelebration(true)
      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => setShowCelebration(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [state.allCompleted, state.occupiedCount])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if in input
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      // Slot selection (1, 2, 3)
      if (e.key === '1' || e.key === '2' || e.key === '3') {
        const slot = parseInt(e.key) as NowSlot
        const slotState = state.slots[slot - 1]
        if (slotState.isEmpty) {
          onSelectEmptySlot(slot)
        } else {
          setActiveSlot(slot)
        }
        e.preventDefault()
      }

      // Reveal backlog (b)
      if (e.key === 'b' || e.key === 'B') {
        onRevealBacklog()
        e.preventDefault()
      }

      // Start active slot task (Enter)
      if (e.key === 'Enter' && activeSlot) {
        const task = state.slots[activeSlot - 1].task
        if (task && task.status !== 'completed') {
          onStartTask(task.id)
        }
        e.preventDefault()
      }

      // Complete active slot task (c)
      if ((e.key === 'c' || e.key === 'C') && activeSlot) {
        const task = state.slots[activeSlot - 1].task
        if (task && task.status !== 'completed') {
          onCompleteTask(task.id)
        }
        e.preventDefault()
      }

      // Swap active slot task (s)
      if ((e.key === 's' || e.key === 'S') && activeSlot) {
        const task = state.slots[activeSlot - 1].task
        if (task) {
          setSwapTaskId(task.id)
          setSwapModalOpen(true)
        }
        e.preventDefault()
      }

      // Escape clears active slot
      if (e.key === 'Escape') {
        setActiveSlot(null)
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state, activeSlot, onSelectEmptySlot, onRevealBacklog, onStartTask, onCompleteTask])

  const handleSwap = useCallback((taskId: string) => {
    setSwapTaskId(taskId)
    setSwapModalOpen(true)
  }, [])

  const handleSwapConfirm = useCallback(async (replacementId: string) => {
    if (swapTaskId) {
      await onSwapTask(swapTaskId, replacementId)
      setSwapModalOpen(false)
      setSwapTaskId(null)
    }
  }, [swapTaskId, onSwapTask])

  const currentSwapTask = swapTaskId
    ? state.slots.find((s) => s.task?.id === swapTaskId)?.task || null
    : null

  return (
    <div className="now-mode-panel">
      <div className="panel-header">
        <div className="header-left">
          <h2 className="panel-title">Now Mode</h2>
          <span className="slot-count">
            {state.occupiedCount}/3 slots
          </span>
        </div>
        <div className="header-actions">
          <button
            className={`backlog-toggle ${backlogVisible ? 'active' : ''}`}
            onClick={onRevealBacklog}
            aria-expanded={backlogVisible}
            aria-label={backlogVisible ? 'Hide backlog' : 'Reveal backlog'}
          >
            {backlogVisible ? 'Hide Backlog' : 'Reveal Backlog'}
            <span className="shortcut-hint">B</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner" aria-hidden="true" />
          <span>Loading Now Mode...</span>
        </div>
      ) : (
        <div className="slots-grid" role="list" aria-label="Now Mode slots">
          {state.slots.map((slotState) => (
            <div key={slotState.slot} role="listitem">
              <NowModeSlotCard
                slot={slotState.slot}
                task={slotState.task}
                onStart={onStartTask}
                onComplete={onCompleteTask}
                onUnpin={onUnpinTask}
                onSwap={handleSwap}
                isActive={activeSlot === slotState.slot}
              />
            </div>
          ))}
        </div>
      )}

      {/* Celebration overlay when all slots completed */}
      {showCelebration && (
        <div className="celebration-overlay" role="alert" aria-live="polite">
          <div className="celebration-content">
            <span className="celebration-icon" aria-hidden="true">
              <span className="checkmark">✓</span>
            </span>
            <h3>All tasks complete!</h3>
            <p>Take a moment to breathe. Ready for more?</p>
            <div className="celebration-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowCelebration(false)}
              >
                Take a break
              </button>
              <button
                className="btn-primary"
                onClick={() => {
                  setShowCelebration(false)
                  onSelectEmptySlot(1)
                }}
              >
                Add one more
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Swap modal */}
      <SwapTaskModal
        isOpen={swapModalOpen}
        onClose={() => {
          setSwapModalOpen(false)
          setSwapTaskId(null)
        }}
        onSelect={handleSwapConfirm}
        currentTask={currentSwapTask}
        excludeTaskIds={state.slots.filter((s) => s.task).map((s) => s.task!.id)}
      />

      <style jsx>{`
        .now-mode-panel {
          background: #12121f;
          border-radius: 20px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .panel-title {
          font-size: 20px;
          font-weight: 600;
          color: #e4e4f0;
          margin: 0;
        }

        .slot-count {
          background: #2a2a4e;
          color: #8b8ba7;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 13px;
        }

        .backlog-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          border: 1px solid #3a3a5e;
          color: #a0a0be;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .backlog-toggle:hover {
          border-color: #1D9BF0;
          color: #1D9BF0;
        }

        .backlog-toggle.active {
          background: rgba(29, 155, 240, 0.1);
          border-color: #1D9BF0;
          color: #1D9BF0;
        }

        .shortcut-hint {
          background: #2a2a4e;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 11px;
          font-family: monospace;
        }

        .slots-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 60px 20px;
          color: #8b8ba7;
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 2px solid #3a3a5e;
          border-top-color: #1D9BF0;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .celebration-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .celebration-content {
          background: #1a1a2e;
          border-radius: 20px;
          padding: 40px;
          text-align: center;
          max-width: 400px;
        }

        .celebration-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: linear-gradient(135deg, #22c55e, #10b981);
          margin-bottom: 20px;
        }

        .checkmark {
          font-size: 40px;
          color: white;
        }

        .celebration-content h3 {
          font-size: 24px;
          color: #e4e4f0;
          margin: 0 0 8px;
        }

        .celebration-content p {
          color: #8b8ba7;
          margin: 0 0 24px;
        }

        .celebration-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .btn-primary,
        .btn-secondary {
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-primary {
          background: #1D9BF0;
          color: white;
          border: none;
        }

        .btn-primary:hover {
          background: #0d8ae0;
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

        @media (max-width: 768px) {
          .slots-grid {
            grid-template-columns: 1fr;
          }

          .panel-header {
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  )
}
