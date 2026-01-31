'use client'

import { useState } from 'react'

interface ParsedTask {
  id: string
  text: string
}

interface TriageScreenProps {
  tasks: ParsedTask[]
  loading: boolean
  onConfirm: (tasks: ParsedTask[]) => void
  onBack: () => void
}

export default function TriageScreen({ tasks, loading, onConfirm, onBack }: TriageScreenProps) {
  const [confirmedTasks, setConfirmedTasks] = useState<ParsedTask[]>(tasks)

  // Sync with incoming tasks when they arrive
  if (!loading && tasks.length > 0 && confirmedTasks.length === 0) {
    setConfirmedTasks(tasks)
  }

  const removeTask = (id: string) => {
    setConfirmedTasks(prev => prev.filter(t => t.id !== id))
  }

  if (loading) {
    return (
      <div className="triage-screen">
        <div className="triage-content">
          <div className="processing-icon">🔍</div>
          <h2 className="triage-title">Sorting your thoughts...</h2>
          <p className="triage-subtitle">Finding the tasks hidden in your brain dump</p>
          <div className="loading-dots">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        </div>
        <style jsx>{styles}</style>
      </div>
    )
  }

  return (
    <div className="triage-screen">
      <div className="triage-content">
        <h2 className="triage-title">Here&apos;s what I found</h2>
        <p className="triage-subtitle">Remove anything that doesn&apos;t feel like a task right now</p>

        <div className="task-list">
          {confirmedTasks.map((task) => (
            <div key={task.id} className="task-card">
              <span className="task-check">✓</span>
              <span className="task-text">{task.text}</span>
              <button
                onClick={() => removeTask(task.id)}
                className="task-remove"
                type="button"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {confirmedTasks.length === 0 && (
          <div className="empty-state">
            <p>No tasks left. Go back and try again?</p>
          </div>
        )}

        <div className="action-buttons">
          <button
            onClick={() => onConfirm(confirmedTasks)}
            disabled={confirmedTasks.length === 0}
            className="submit-btn"
          >
            Continue with {confirmedTasks.length} task{confirmedTasks.length !== 1 ? 's' : ''} →
          </button>
          <button onClick={onBack} className="skip-btn">
            ← Back to Brain Dump
          </button>
        </div>
      </div>
      <style jsx>{styles}</style>
    </div>
  )
}

const styles = `
  .triage-screen {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(20px, 5vw, 32px);
    background: #f7f9fa;
  }

  .triage-content {
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

  .triage-title {
    font-size: clamp(22px, 6vw, 28px);
    font-weight: 700;
    color: #0f1419;
    margin: 0 0 clamp(8px, 2vw, 12px) 0;
  }

  .triage-subtitle {
    font-size: clamp(14px, 3.8vw, 16px);
    color: #536471;
    margin: 0 0 clamp(24px, 6vw, 32px) 0;
  }

  .loading-dots {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-top: clamp(16px, 4vw, 24px);
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #1D9BF0;
    animation: bounce 1.4s ease-in-out infinite;
  }

  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes bounce {
    0%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-12px); }
  }

  .task-list {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 2vw, 12px);
    text-align: left;
  }

  .task-card {
    display: flex;
    align-items: center;
    gap: clamp(10px, 3vw, 14px);
    background: white;
    padding: clamp(14px, 4vw, 18px);
    border-radius: clamp(12px, 3vw, 16px);
    border: 2px solid #e5e7eb;
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .task-check {
    width: clamp(28px, 7vw, 34px);
    height: clamp(28px, 7vw, 34px);
    border-radius: 50%;
    background: #00ba7c;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: clamp(14px, 3.5vw, 16px);
    font-weight: 700;
    flex-shrink: 0;
  }

  .task-text {
    flex: 1;
    font-size: clamp(14px, 3.8vw, 16px);
    color: #0f1419;
    line-height: 1.4;
  }

  .task-remove {
    width: clamp(32px, 8vw, 38px);
    height: clamp(32px, 8vw, 38px);
    border: none;
    background: none;
    color: #f4212e;
    font-size: clamp(20px, 5.5vw, 26px);
    cursor: pointer;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.15s ease;
  }

  .task-remove:hover {
    background: rgba(244, 33, 46, 0.1);
  }

  .empty-state {
    padding: clamp(24px, 6vw, 36px);
    color: #8899a6;
    font-size: clamp(14px, 3.8vw, 16px);
  }

  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 3vw, 16px);
    margin-top: clamp(24px, 6vw, 32px);
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
`
