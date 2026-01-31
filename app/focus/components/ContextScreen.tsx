'use client'

import { useState } from 'react'

interface ParsedTask {
  id: string
  text: string
}

export interface TaskWithContext {
  id: string
  text: string
  dueDate: string
  energyLevel: string
}

interface ContextScreenProps {
  tasks: ParsedTask[]
  onComplete: (tasks: TaskWithContext[]) => void
  onBack: () => void
}

const DUE_OPTIONS = [
  { value: 'today', label: 'Today', icon: '🔥' },
  { value: 'tomorrow', label: 'Tomorrow', icon: '📅' },
  { value: 'this_week', label: 'This Week', icon: '📆' },
  { value: 'no_rush', label: 'No Rush', icon: '🌊' },
]

const ENERGY_OPTIONS = [
  { value: 'low', label: 'Low', icon: '🪫', color: '#f97316' },
  { value: 'medium', label: 'Medium', icon: '⚡', color: '#eab308' },
  { value: 'high', label: 'High', icon: '🔋', color: '#22c55e' },
]

export default function ContextScreen({ tasks, onComplete, onBack }: ContextScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [results, setResults] = useState<TaskWithContext[]>([])
  const [selectedDue, setSelectedDue] = useState<string | null>(null)
  const [selectedEnergy, setSelectedEnergy] = useState<string | null>(null)

  const currentTask = tasks[currentIndex]
  const isLast = currentIndex === tasks.length - 1

  const handleNext = () => {
    if (!selectedDue || !selectedEnergy || !currentTask) return

    const taskWithContext: TaskWithContext = {
      id: currentTask.id,
      text: currentTask.text,
      dueDate: selectedDue,
      energyLevel: selectedEnergy,
    }

    const updatedResults = [...results, taskWithContext]

    if (isLast) {
      onComplete(updatedResults)
    } else {
      setResults(updatedResults)
      setCurrentIndex(prev => prev + 1)
      setSelectedDue(null)
      setSelectedEnergy(null)
    }
  }

  if (!currentTask) return null

  return (
    <div className="context-screen">
      <div className="context-content">
        <div className="progress-indicator">
          Task {currentIndex + 1} of {tasks.length}
        </div>

        <div className="task-display">
          <div className="task-icon">📋</div>
          <h2 className="task-name">{currentTask.text}</h2>
        </div>

        <div className="question-section">
          <p className="question-label">When is this due?</p>
          <div className="chip-grid">
            {DUE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`chip ${selectedDue === opt.value ? 'selected' : ''}`}
                onClick={() => setSelectedDue(opt.value)}
                type="button"
              >
                <span className="chip-icon">{opt.icon}</span>
                <span className="chip-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="question-section">
          <p className="question-label">How much energy will this take?</p>
          <div className="chip-row">
            {ENERGY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`chip energy-chip ${selectedEnergy === opt.value ? 'selected' : ''}`}
                onClick={() => setSelectedEnergy(opt.value)}
                type="button"
                style={{
                  '--energy-color': opt.color,
                } as React.CSSProperties}
              >
                <span className="chip-icon">{opt.icon}</span>
                <span className="chip-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="action-buttons">
          <button
            onClick={handleNext}
            disabled={!selectedDue || !selectedEnergy}
            className="submit-btn"
          >
            {isLast ? 'Break it all down →' : 'Next task →'}
          </button>
          <button onClick={onBack} className="skip-btn">
            ← Back
          </button>
        </div>
      </div>

      <style jsx>{`
        .context-screen {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: clamp(20px, 5vw, 32px);
          background: #f7f9fa;
        }

        .context-content {
          max-width: 600px;
          width: 100%;
          text-align: center;
        }

        .progress-indicator {
          font-size: clamp(12px, 3.2vw, 14px);
          font-weight: 600;
          color: #1D9BF0;
          background: rgba(29, 155, 240, 0.08);
          display: inline-block;
          padding: clamp(6px, 1.5vw, 8px) clamp(14px, 3.5vw, 20px);
          border-radius: 100px;
          margin-bottom: clamp(20px, 5vw, 28px);
        }

        .task-display {
          margin-bottom: clamp(28px, 7vw, 40px);
        }

        .task-icon {
          font-size: clamp(36px, 10vw, 48px);
          margin-bottom: clamp(8px, 2vw, 12px);
        }

        .task-name {
          font-size: clamp(18px, 5vw, 24px);
          font-weight: 700;
          color: #0f1419;
          margin: 0;
          line-height: 1.3;
        }

        .question-section {
          margin-bottom: clamp(24px, 6vw, 32px);
        }

        .question-label {
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 600;
          color: #536471;
          margin: 0 0 clamp(12px, 3vw, 16px) 0;
        }

        .chip-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: clamp(8px, 2vw, 12px);
        }

        .chip-row {
          display: flex;
          gap: clamp(8px, 2vw, 12px);
          justify-content: center;
        }

        .chip {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: clamp(6px, 1.5vw, 8px);
          padding: clamp(12px, 3vw, 16px);
          border: 2px solid #e5e7eb;
          border-radius: clamp(10px, 2.5vw, 14px);
          background: white;
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 500;
          color: #536471;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .chip:hover {
          border-color: #1D9BF0;
          color: #1D9BF0;
        }

        .chip:active {
          transform: scale(0.96);
        }

        .chip.selected {
          border-color: #1D9BF0;
          background: #e8f5fd;
          color: #1D9BF0;
          font-weight: 600;
        }

        .energy-chip.selected {
          border-color: var(--energy-color);
          background: color-mix(in srgb, var(--energy-color) 10%, white);
          color: var(--energy-color);
        }

        .chip-icon {
          font-size: clamp(16px, 4.5vw, 20px);
        }

        .chip-label {
          font-size: clamp(13px, 3.5vw, 15px);
        }

        .action-buttons {
          display: flex;
          flex-direction: column;
          gap: clamp(12px, 3vw, 16px);
          margin-top: clamp(8px, 2vw, 12px);
        }

        .submit-btn {
          background: #1D9BF0;
          color: white;
          border: none;
          border-radius: clamp(10px, 2.5vw, 14px);
          padding: clamp(14px, 4vw, 18px);
          font-size: clamp(15px, 4vw, 17px);
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s ease, transform 0.1s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .submit-btn:hover:not(:disabled) {
          background: #1a8cd8;
        }

        .submit-btn:active:not(:disabled) {
          transform: scale(0.98);
        }

        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .skip-btn {
          background: none;
          border: none;
          color: #8899a6;
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 500;
          cursor: pointer;
          padding: clamp(8px, 2vw, 12px);
          transition: color 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .skip-btn:hover {
          color: #536471;
        }
      `}</style>
    </div>
  )
}
