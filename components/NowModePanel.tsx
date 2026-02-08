'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  const [activeSlot, setActiveSlot] = useState<NowSlot | null>(null)
  const [swapModalOpen, setSwapModalOpen] = useState(false)
  const [swapTaskId, setSwapTaskId] = useState<string | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)

  // Handle all slots completed celebration
  useEffect(() => {
    if (state.allCompleted && state.occupiedCount > 0) {
      setShowCelebration(true)
      // Auto-dismiss after 8 seconds to savor the dopamine hit
      const timer = setTimeout(() => setShowCelebration(false), 8000)
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
          {/* Confetti particles */}
          <div className="confetti-container" aria-hidden="true">
            {['🎉', '⭐', '✨', '🌟', '💫', '🎊', '🏆', '💪', '🎉', '⭐', '✨', '🌟'].map((emoji, i) => (
              <span
                key={i}
                className="confetti-particle"
                style={{
                  left: `${8 + (i * 7.5)}%`,
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: `${2 + (i % 3) * 0.5}s`,
                }}
              >
                {emoji}
              </span>
            ))}
          </div>
          <div className="celebration-content">
            <span className="celebration-icon" aria-hidden="true">
              <span className="checkmark">✓</span>
            </span>
            <h3>All {state.occupiedCount} tasks complete!</h3>
            <p className="celebration-subtitle">You crushed it! Take a moment to feel that win.</p>
            <div className="celebration-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowCelebration(false)}
              >
                Take a break
              </button>
              <button
                className="btn-wins"
                onClick={() => {
                  setShowCelebration(false)
                  router.push('/wins')
                }}
              >
                View your wins 🏆
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
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          animation: fadeIn 0.3s ease;
          overflow: hidden;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* Confetti particles */
        .confetti-container {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .confetti-particle {
          position: absolute;
          top: -40px;
          font-size: 24px;
          animation: confetti-fall linear forwards;
        }

        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg) scale(1);
            opacity: 1;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg) scale(0.5);
            opacity: 0;
          }
        }

        .celebration-content {
          background: #1a1a2e;
          border-radius: 24px;
          padding: 40px;
          text-align: center;
          max-width: 400px;
          position: relative;
          z-index: 1;
          animation: celebration-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes celebration-pop {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        .celebration-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 88px;
          height: 88px;
          border-radius: 50%;
          background: linear-gradient(135deg, #22c55e, #10b981);
          margin-bottom: 20px;
          animation: icon-pulse 1s ease-in-out infinite;
        }

        @keyframes icon-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
          50% { box-shadow: 0 0 0 16px rgba(34, 197, 94, 0); }
        }

        .checkmark {
          font-size: 44px;
          color: white;
        }

        .celebration-content h3 {
          font-size: 26px;
          color: #e4e4f0;
          margin: 0 0 8px;
          font-weight: 700;
        }

        .celebration-subtitle {
          color: #8b8ba7;
          margin: 0 0 28px;
          font-size: 15px;
        }

        .celebration-actions {
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
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

        .btn-wins {
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          background: linear-gradient(135deg, #22c55e, #10b981);
          color: white;
          border: none;
        }

        .btn-wins:hover {
          background: linear-gradient(135deg, #16a34a, #059669);
          transform: translateY(-1px);
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
