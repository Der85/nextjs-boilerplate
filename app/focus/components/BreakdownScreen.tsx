'use client'

import { useState, useEffect } from 'react'

interface MicroStep {
  id: string
  text: string
  dueBy: string
  timeEstimate: string
  completed: boolean
}

interface TaskBreakdown {
  taskName: string
  dueDate: string
  energyLevel: string
  steps: MicroStep[]
}

interface BreakdownScreenProps {
  breakdowns: TaskBreakdown[]
  loading: boolean
  onStartFocusing: (breakdowns: TaskBreakdown[]) => void
  onBack: () => void
}

const STATUS_MESSAGES = [
  'Analyzing your tasks...',
  'Building your micro-steps...',
  'Scheduling timestamps...',
  'Making it ADHD-friendly...',
  'Almost there...',
]

export default function BreakdownScreen({
  breakdowns,
  loading,
  onStartFocusing,
  onBack,
}: BreakdownScreenProps) {
  const [statusIndex, setStatusIndex] = useState(0)

  useEffect(() => {
    if (!loading) return
    const interval = setInterval(() => {
      setStatusIndex(prev => (prev + 1) % STATUS_MESSAGES.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [loading])

  if (loading) {
    return (
      <div className="breakdown-screen">
        <div className="breakdown-content">
          <div className="processing-icon">⚡</div>
          <h2 className="breakdown-title">Creating your plan</h2>
          <p className="status-message">{STATUS_MESSAGES[statusIndex]}</p>
          <div className="loading-bar">
            <div className="loading-fill" />
          </div>
        </div>
        <style jsx>{styles}</style>
      </div>
    )
  }

  return (
    <div className="breakdown-screen">
      <div className="breakdown-content">
        <h2 className="breakdown-title">Your plan is ready</h2>
        <p className="breakdown-subtitle">
          {breakdowns.length} task{breakdowns.length !== 1 ? 's' : ''} broken into bite-sized steps
        </p>

        <div className="breakdowns-list">
          {breakdowns.map((breakdown, i) => (
            <div key={i} className="breakdown-card">
              <div className="breakdown-header">
                <span className="breakdown-task-name">{breakdown.taskName}</span>
                <span className="breakdown-meta">
                  {getDueDateLabel(breakdown.dueDate)} · {breakdown.energyLevel} energy
                </span>
              </div>
              <div className="steps-list">
                {breakdown.steps.map((step, j) => (
                  <div key={step.id} className="step-row">
                    <span className="step-number">{j + 1}</span>
                    <div className="step-info">
                      <span className="step-text">{step.text}</span>
                      <span className="step-meta">
                        {step.dueBy} · {step.timeEstimate}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="action-buttons">
          <button
            onClick={() => onStartFocusing(breakdowns)}
            className="submit-btn"
          >
            Start focusing →
          </button>
          <button onClick={onBack} className="skip-btn">
            ← Back
          </button>
        </div>
      </div>
      <style jsx>{styles}</style>
    </div>
  )
}

function getDueDateLabel(dueDate: string): string {
  switch (dueDate) {
    case 'today': return 'Due today'
    case 'tomorrow': return 'Due tomorrow'
    case 'this_week': return 'This week'
    case 'no_rush': return 'No rush'
    default: return dueDate
  }
}

const styles = `
  .breakdown-screen {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: clamp(20px, 5vw, 32px);
    padding-top: clamp(40px, 10vw, 60px);
    background: #f7f9fa;
  }

  .breakdown-content {
    max-width: 600px;
    width: 100%;
    text-align: center;
  }

  .processing-icon {
    font-size: clamp(48px, 14vw, 64px);
    margin-bottom: clamp(12px, 3vw, 18px);
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }

  .breakdown-title {
    font-size: clamp(22px, 6vw, 28px);
    font-weight: 700;
    color: #0f1419;
    margin: 0 0 clamp(8px, 2vw, 12px) 0;
  }

  .breakdown-subtitle {
    font-size: clamp(14px, 3.8vw, 16px);
    color: #536471;
    margin: 0 0 clamp(24px, 6vw, 32px) 0;
  }

  .status-message {
    font-size: clamp(14px, 3.8vw, 16px);
    color: #536471;
    margin: 0 0 clamp(20px, 5vw, 28px) 0;
    min-height: 24px;
  }

  .loading-bar {
    height: 6px;
    background: #e5e7eb;
    border-radius: 100px;
    overflow: hidden;
    max-width: 200px;
    margin: 0 auto;
  }

  .loading-fill {
    height: 100%;
    background: #1D9BF0;
    border-radius: 100px;
    animation: loadProgress 3s ease-in-out infinite;
  }

  @keyframes loadProgress {
    0% { width: 0%; }
    50% { width: 80%; }
    100% { width: 100%; }
  }

  .breakdowns-list {
    display: flex;
    flex-direction: column;
    gap: clamp(16px, 4vw, 20px);
    text-align: left;
  }

  .breakdown-card {
    background: white;
    border-radius: clamp(14px, 4vw, 20px);
    padding: clamp(16px, 4.5vw, 24px);
    border: 1px solid #e5e7eb;
  }

  .breakdown-header {
    margin-bottom: clamp(14px, 3.5vw, 18px);
    padding-bottom: clamp(12px, 3vw, 16px);
    border-bottom: 1px solid #eff3f4;
  }

  .breakdown-task-name {
    display: block;
    font-size: clamp(16px, 4.5vw, 18px);
    font-weight: 700;
    color: #0f1419;
    margin-bottom: clamp(4px, 1vw, 6px);
  }

  .breakdown-meta {
    font-size: clamp(12px, 3.2vw, 14px);
    color: #8899a6;
  }

  .steps-list {
    display: flex;
    flex-direction: column;
    gap: clamp(10px, 2.5vw, 14px);
  }

  .step-row {
    display: flex;
    align-items: flex-start;
    gap: clamp(10px, 3vw, 14px);
  }

  .step-number {
    width: clamp(24px, 6vw, 28px);
    height: clamp(24px, 6vw, 28px);
    border-radius: 50%;
    background: #eff3f4;
    color: #536471;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: clamp(12px, 3vw, 14px);
    font-weight: 700;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .step-info {
    flex: 1;
  }

  .step-text {
    display: block;
    font-size: clamp(14px, 3.8vw, 16px);
    color: #0f1419;
    line-height: 1.4;
    margin-bottom: clamp(2px, 0.5vw, 4px);
  }

  .step-meta {
    font-size: clamp(11px, 3vw, 13px);
    color: #8899a6;
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 3vw, 16px);
    margin-top: clamp(24px, 6vw, 32px);
  }

  .submit-btn {
    background: #00ba7c;
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

  .submit-btn:hover {
    background: #00a06a;
  }

  .submit-btn:active {
    transform: scale(0.98);
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
`
