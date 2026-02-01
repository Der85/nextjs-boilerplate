'use client'

import { useState } from 'react'

interface QuickAllyModalProps {
  taskName: string
  isOpen: boolean
  onClose: () => void
}

type BlockType = 'cant_start' | 'distracted' | 'overwhelmed'

interface QuickOption {
  id: BlockType
  icon: string
  label: string
  description: string
}

interface MicroAction {
  icon: string
  title: string
  instruction: string
  timeEstimate: string
}

const QUICK_OPTIONS: QuickOption[] = [
  { id: 'cant_start', icon: '🚀', label: "Can't Start", description: "I know what to do but I can't begin" },
  { id: 'distracted', icon: '🎯', label: 'Distracted', description: 'My mind keeps pulling me away' },
  { id: 'overwhelmed', icon: '🌊', label: 'Overwhelmed', description: "It feels like too much" },
]

const MICRO_ACTIONS: Record<BlockType, MicroAction> = {
  cant_start: {
    icon: '⏱️',
    title: 'The 2-Minute Deal',
    instruction: 'Set a timer for 2 minutes. Do the very first tiny action on your current step. You have full permission to stop after 2 minutes.',
    timeEstimate: '2 min',
  },
  distracted: {
    icon: '🧍',
    title: 'Reset & Refocus',
    instruction: 'Stand up and stretch for 30 seconds. Then sit back down and read your current step out loud. Your voice anchors your attention.',
    timeEstimate: '1 min',
  },
  overwhelmed: {
    icon: '🫁',
    title: 'Tunnel Vision',
    instruction: 'Close your eyes. Take 3 slow breaths. Now look at just the next unchecked step — ignore everything else. That one step is your entire world right now.',
    timeEstimate: '1 min',
  },
}

export default function QuickAllyModal({ taskName, isOpen, onClose }: QuickAllyModalProps) {
  const [selected, setSelected] = useState<BlockType | null>(null)

  if (!isOpen) return null

  const handleSelect = (id: BlockType) => {
    setSelected(id)
  }

  const handleClose = () => {
    setSelected(null)
    onClose()
  }

  const action = selected ? MICRO_ACTIONS[selected] : null

  return (
    <div className="ally-overlay" onClick={handleClose}>
      <div className="ally-modal" onClick={(e) => e.stopPropagation()}>
        {!action ? (
          <>
            <div className="ally-modal-header">
              <span className="ally-modal-icon">💜</span>
              <h2 className="ally-modal-title">What&apos;s blocking you on</h2>
              <p className="ally-modal-task">&ldquo;{taskName}&rdquo;</p>
            </div>

            <div className="ally-options">
              {QUICK_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  className="ally-option-btn"
                  onClick={() => handleSelect(opt.id)}
                >
                  <span className="ally-option-icon">{opt.icon}</span>
                  <div className="ally-option-text">
                    <span className="ally-option-label">{opt.label}</span>
                    <span className="ally-option-desc">{opt.description}</span>
                  </div>
                </button>
              ))}
            </div>

            <button className="ally-dismiss" onClick={handleClose}>
              Never mind, I&apos;m okay
            </button>
          </>
        ) : (
          <>
            <div className="ally-action-header">
              <span className="ally-action-icon">{action.icon}</span>
              <h2 className="ally-action-title">{action.title}</h2>
              <span className="ally-action-time">{action.timeEstimate}</span>
            </div>

            <p className="ally-action-instruction">{action.instruction}</p>

            <div className="ally-action-buttons">
              <button className="ally-back-btn" onClick={() => setSelected(null)}>
                ← Back
              </button>
              <button className="ally-got-it-btn" onClick={handleClose}>
                Got it, let&apos;s go
              </button>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        .ally-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          z-index: 1000;
          padding: clamp(16px, 4vw, 24px);
          animation: overlayFadeIn 0.2s ease;
        }

        @keyframes overlayFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .ally-modal {
          background: white;
          border-radius: clamp(20px, 5vw, 28px) clamp(20px, 5vw, 28px) 0 0;
          padding: clamp(24px, 6vw, 36px);
          max-width: 500px;
          width: 100%;
          max-height: 85vh;
          overflow-y: auto;
          animation: modalSlideUp 0.3s ease;
        }

        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Selection Screen */
        .ally-modal-header {
          text-align: center;
          margin-bottom: clamp(20px, 5vw, 28px);
        }

        .ally-modal-icon {
          font-size: clamp(36px, 10vw, 48px);
          display: block;
          margin-bottom: clamp(10px, 2.5vw, 14px);
        }

        .ally-modal-title {
          font-size: clamp(16px, 4.5vw, 20px);
          font-weight: 700;
          color: #0f1419;
          margin: 0 0 clamp(4px, 1vw, 6px) 0;
        }

        .ally-modal-task {
          font-size: clamp(14px, 3.8vw, 16px);
          color: #805ad5;
          font-weight: 600;
          margin: 0;
          word-break: break-word;
        }

        .ally-options {
          display: flex;
          flex-direction: column;
          gap: clamp(10px, 2.5vw, 14px);
          margin-bottom: clamp(16px, 4vw, 22px);
        }

        .ally-option-btn {
          display: flex;
          align-items: center;
          gap: clamp(12px, 3.5vw, 16px);
          width: 100%;
          padding: clamp(14px, 4vw, 18px);
          background: #f7f9fa;
          border: 2px solid transparent;
          border-radius: clamp(12px, 3vw, 16px);
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .ally-option-btn:hover {
          border-color: rgba(128, 90, 213, 0.3);
          background: rgba(128, 90, 213, 0.05);
        }

        .ally-option-btn:active {
          transform: scale(0.98);
        }

        .ally-option-icon {
          font-size: clamp(24px, 7vw, 32px);
          flex-shrink: 0;
        }

        .ally-option-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .ally-option-label {
          font-size: clamp(15px, 4vw, 17px);
          font-weight: 700;
          color: #0f1419;
        }

        .ally-option-desc {
          font-size: clamp(12px, 3.2vw, 14px);
          color: #8899a6;
        }

        .ally-dismiss {
          width: 100%;
          padding: clamp(10px, 3vw, 14px);
          background: none;
          border: none;
          color: #8899a6;
          font-size: clamp(13px, 3.5vw, 15px);
          cursor: pointer;
          text-align: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .ally-dismiss:hover {
          color: #536471;
        }

        /* Action Screen */
        .ally-action-header {
          text-align: center;
          margin-bottom: clamp(18px, 5vw, 26px);
        }

        .ally-action-icon {
          font-size: clamp(40px, 12vw, 56px);
          display: block;
          margin-bottom: clamp(10px, 2.5vw, 14px);
        }

        .ally-action-title {
          font-size: clamp(20px, 5.5vw, 26px);
          font-weight: 800;
          color: #0f1419;
          margin: 0 0 clamp(6px, 1.5vw, 10px) 0;
        }

        .ally-action-time {
          display: inline-block;
          font-size: clamp(12px, 3.2vw, 14px);
          color: #805ad5;
          background: rgba(128, 90, 213, 0.1);
          padding: 4px 12px;
          border-radius: 100px;
          font-weight: 600;
        }

        .ally-action-instruction {
          font-size: clamp(15px, 4vw, 17px);
          color: #536471;
          line-height: 1.7;
          margin: 0 0 clamp(24px, 6vw, 32px) 0;
          text-align: center;
        }

        .ally-action-buttons {
          display: flex;
          gap: clamp(10px, 3vw, 14px);
        }

        .ally-back-btn {
          flex-shrink: 0;
          padding: clamp(12px, 3.5vw, 16px) clamp(16px, 4vw, 22px);
          background: #f7f9fa;
          border: none;
          border-radius: clamp(10px, 2.5vw, 14px);
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 600;
          color: #536471;
          cursor: pointer;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .ally-back-btn:hover {
          background: #eff3f4;
        }

        .ally-got-it-btn {
          flex: 1;
          padding: clamp(12px, 3.5vw, 16px);
          background: #805ad5;
          border: none;
          border-radius: clamp(10px, 2.5vw, 14px);
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 700;
          color: white;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .ally-got-it-btn:hover {
          background: #6b46c1;
        }

        .ally-got-it-btn:active {
          transform: scale(0.98);
        }
      `}</style>
    </div>
  )
}
