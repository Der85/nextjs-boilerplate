'use client'

import { useState } from 'react'

interface ParsedTask {
  id: string
  text: string
}

interface ParseInfo {
  aiUsed: boolean
  fallbackReason?: 'no_api_key' | 'api_error' | 'parse_error' | 'rate_limited'
}

interface TriageScreenProps {
  tasks: ParsedTask[]
  loading: boolean
  energyLevel: 'high' | 'low' | null
  parseInfo: ParseInfo | null
  onConfirm: (tasks: ParsedTask[]) => void
  onBack: () => void
}

const BIG_TASK_KEYWORDS = ['project', 'finish', 'complete', 'refactor', 'redesign', 'migrate', 'overhaul', 'organize', 'plan', 'build']

function isTaskTooBig(text: string): boolean {
  const lower = text.toLowerCase()
  if (text.length > 50) return true
  return BIG_TASK_KEYWORDS.some(kw => lower.includes(kw))
}

// Heuristic time estimate based on task text (no real data at triage stage)
const QUICK_KEYWORDS = ['email', 'reply', 'text', 'call', 'message', 'send', 'check', 'look up', 'google', 'quick']

function estimateTaskMinutes(text: string): number {
  const lower = text.toLowerCase()
  const wordCount = text.trim().split(/\s+/).length

  const isQuick = QUICK_KEYWORDS.some(kw => lower.includes(kw))
  const isBig = BIG_TASK_KEYWORDS.some(kw => lower.includes(kw))

  if (isBig || wordCount > 12) return 40
  if (isQuick || wordCount <= 4) return 10
  return 20
}

function getCapacityMinutes(): { minutes: number; isNightSession: boolean } {
  const now = new Date()
  const endOfDay = new Date()
  endOfDay.setHours(17, 0, 0, 0) // 5 PM default

  const minutesLeft = Math.floor((endOfDay.getTime() - now.getTime()) / 60000)

  if (minutesLeft <= 0) {
    return { minutes: 120, isNightSession: true }
  }

  return { minutes: minutesLeft, isNightSession: false }
}

function getFallbackMessage(reason?: string): string {
  switch (reason) {
    case 'no_api_key':
      return 'AI parsing unavailable. These are basic text splits — feel free to edit them.'
    case 'rate_limited':
      return 'AI is busy right now. These are rough splits — you can refine them below.'
    case 'parse_error':
      return 'AI had trouble understanding that. Here\'s a rough breakdown — edit as needed.'
    case 'api_error':
    default:
      return 'Couldn\'t reach the AI. Here\'s a simple breakdown — feel free to edit.'
  }
}

export default function TriageScreen({ tasks, loading, energyLevel, parseInfo, onConfirm, onBack }: TriageScreenProps) {
  const [confirmedTasks, setConfirmedTasks] = useState<ParsedTask[]>(tasks)
  const [energyWarning, setEnergyWarning] = useState<{ task: ParsedTask; visible: boolean }>({ task: { id: '', text: '' }, visible: false })

  // Reality Check: time-blindness safety net
  const totalLoadMinutes = confirmedTasks.reduce((sum, t) => sum + estimateTaskMinutes(t.text), 0)
  const capacity = getCapacityMinutes()
  const isOvercapacity = totalLoadMinutes > capacity.minutes
  const loadRatio = capacity.minutes > 0 ? totalLoadMinutes / capacity.minutes : 1
  const overflowMinutes = Math.max(0, totalLoadMinutes - capacity.minutes)

  const deferLastItem = () => {
    setConfirmedTasks(prev => prev.slice(0, -1))
  }

  // Sync with incoming tasks when they arrive
  if (!loading && tasks.length > 0 && confirmedTasks.length === 0) {
    setConfirmedTasks(tasks)
  }

  const removeTask = (id: string) => {
    setConfirmedTasks(prev => prev.filter(t => t.id !== id))
  }

  const handleConfirm = () => {
    if (energyLevel === 'low') {
      const flagged = confirmedTasks.find(t => isTaskTooBig(t.text))
      if (flagged) {
        setEnergyWarning({ task: flagged, visible: true })
        return
      }
    }
    onConfirm(confirmedTasks)
  }

  const handleBreakDown = () => {
    // Send only the flagged task to context screen for further breakdown
    onConfirm([energyWarning.task])
    setEnergyWarning({ task: { id: '', text: '' }, visible: false })
  }

  const handleProceedAnyway = () => {
    setEnergyWarning({ task: { id: '', text: '' }, visible: false })
    onConfirm(confirmedTasks)
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

  const isSprint = energyLevel === 'high'

  return (
    <div className="triage-screen">
      <div className="triage-content">
        {isSprint && (
          <div className="sprint-badge">🚀 Sprint Mode</div>
        )}

        {/* AI Fallback Warning */}
        {parseInfo && !parseInfo.aiUsed && (
          <div className="fallback-warning">
            <span className="fallback-icon">✏️</span>
            <span className="fallback-text">{getFallbackMessage(parseInfo.fallbackReason)}</span>
          </div>
        )}

        <h2 className="triage-title">
          {isSprint ? 'Pick Your Top 3' : 'Here\u0027s what I found'}
        </h2>
        <p className="triage-subtitle">
          {isSprint
            ? 'Energy is high — choose your 3 most impactful tasks and go.'
            : 'Remove anything that doesn\u0027t feel like a task right now'}
        </p>

        {isSprint && confirmedTasks.length > 3 && (
          <div className="sprint-hint">
            ⚡ You have {confirmedTasks.length} tasks — trim to 3 for maximum focus
          </div>
        )}

        <div className="task-list">
          {confirmedTasks.map((task) => (
            <div key={task.id} className="task-card">
              <span className="task-check">✓</span>
              <span className="task-text">{task.text}</span>
              <span className="task-estimate">~{estimateTaskMinutes(task.text)}m</span>
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

        {/* Reality Check: Time Load Bar */}
        {confirmedTasks.length > 0 && (
          <div className="load-bar-section">
            <div className="load-bar-header">
              <span className="load-bar-label">
                {capacity.isNightSession ? '🌙 Night Session' : '⏱️ Time Check'}
              </span>
              <span className={`load-bar-value ${isOvercapacity ? 'over' : ''}`}>
                {totalLoadMinutes} min / {capacity.minutes} min available
              </span>
            </div>
            <div className="load-bar-track">
              <div
                className={`load-bar-fill ${isOvercapacity ? 'over' : loadRatio > 0.8 ? 'warning' : 'ok'}`}
                style={{ width: `${Math.min(loadRatio * 100, 100)}%` }}
              />
            </div>
            {isOvercapacity && (
              <p className="load-bar-warning">
                +{overflowMinutes} min over capacity
              </p>
            )}
          </div>
        )}

        {confirmedTasks.length === 0 && (
          <div className="empty-state">
            <p>No tasks left. Go back and try again?</p>
          </div>
        )}

        <div className="action-buttons">
          <button
            onClick={handleConfirm}
            disabled={confirmedTasks.length === 0}
            className={`submit-btn ${isOvercapacity ? 'overcapacity' : isSprint ? 'sprint' : ''}`}
          >
            {isOvercapacity ? (
              <>⚠️ Heavy Load — Continue anyway →</>
            ) : isSprint ? (
              <>🚀 Lock in {confirmedTasks.length} task{confirmedTasks.length !== 1 ? 's' : ''} →</>
            ) : (
              <>Continue with {confirmedTasks.length} task{confirmedTasks.length !== 1 ? 's' : ''} →</>
            )}
          </button>
          {isOvercapacity && confirmedTasks.length > 1 && (
            <button onClick={deferLastItem} className="defer-btn" type="button">
              Defer last item for later
            </button>
          )}
          <button onClick={onBack} className="skip-btn">
            ← Back to Brain Dump
          </button>
        </div>
      </div>

      {/* Energy Warning Toast */}
      {energyWarning.visible && (
        <div className="energy-toast-overlay">
          <div className="energy-toast">
            <div className="energy-toast-icon">⚠️</div>
            <p className="energy-toast-text">
              Energy is low. Are you sure? We can break <strong>&quot;{energyWarning.task.text}&quot;</strong> down further first.
            </p>
            <div className="energy-toast-actions">
              <button onClick={handleBreakDown} className="energy-toast-btn primary">
                Break it down
              </button>
              <button onClick={handleProceedAnyway} className="energy-toast-btn secondary">
                I&apos;m sure
              </button>
            </div>
          </div>
        </div>
      )}

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

  /* ===== ENERGY WARNING TOAST ===== */
  .energy-toast-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 1000;
    padding: clamp(16px, 4vw, 24px);
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .energy-toast {
    background: white;
    border-radius: clamp(16px, 4vw, 22px) clamp(16px, 4vw, 22px) 0 0;
    padding: clamp(24px, 6vw, 32px);
    max-width: 480px;
    width: 100%;
    text-align: center;
    border-top: 4px solid #ffad1f;
    animation: slideUp 0.3s ease;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(40px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .energy-toast-icon {
    font-size: clamp(36px, 10vw, 48px);
    margin-bottom: clamp(10px, 2.5vw, 14px);
  }

  .energy-toast-text {
    font-size: clamp(14px, 3.8vw, 16px);
    color: #536471;
    line-height: 1.5;
    margin: 0 0 clamp(18px, 5vw, 24px) 0;
  }

  .energy-toast-text strong {
    color: #0f1419;
  }

  .energy-toast-actions {
    display: flex;
    flex-direction: column;
    gap: clamp(8px, 2vw, 12px);
  }

  .energy-toast-btn {
    width: 100%;
    padding: clamp(12px, 3.5vw, 16px);
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .energy-toast-btn.primary {
    background: linear-gradient(135deg, #ffad1f 0%, #f59e0b 100%);
    color: white;
    border: none;
    box-shadow: 0 4px 14px rgba(255, 173, 31, 0.3);
  }

  .energy-toast-btn.primary:hover {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  }

  .energy-toast-btn.secondary {
    background: #f7f9fa;
    color: #536471;
    border: none;
  }

  .energy-toast-btn.secondary:hover {
    background: #eff3f4;
  }

  /* ===== REALITY CHECK: LOAD BAR ===== */
  .load-bar-section {
    margin-top: clamp(16px, 4vw, 24px);
    padding: clamp(12px, 3vw, 16px);
    background: white;
    border-radius: clamp(12px, 3vw, 16px);
    border: 2px solid #e5e7eb;
  }

  .load-bar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: clamp(8px, 2vw, 12px);
  }

  .load-bar-label {
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 600;
    color: #0f1419;
  }

  .load-bar-value {
    font-size: clamp(12px, 3.2vw, 14px);
    color: #536471;
    font-weight: 500;
  }

  .load-bar-value.over {
    color: #f4212e;
    font-weight: 600;
  }

  .load-bar-track {
    height: clamp(8px, 2vw, 10px);
    background: #eff3f4;
    border-radius: 999px;
    overflow: hidden;
  }

  .load-bar-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.4s ease, background 0.3s ease;
  }

  .load-bar-fill.ok {
    background: linear-gradient(90deg, #1D9BF0, #00ba7c);
  }

  .load-bar-fill.warning {
    background: linear-gradient(90deg, #ffad1f, #f59e0b);
  }

  .load-bar-fill.over {
    background: linear-gradient(90deg, #f97316, #f4212e);
  }

  .load-bar-warning {
    font-size: clamp(12px, 3.2vw, 14px);
    color: #f4212e;
    font-weight: 600;
    margin: clamp(6px, 1.5vw, 8px) 0 0 0;
    text-align: center;
  }

  .task-estimate {
    font-size: clamp(11px, 3vw, 13px);
    color: #8899a6;
    font-weight: 500;
    flex-shrink: 0;
    background: #f7f9fa;
    padding: 2px 8px;
    border-radius: 999px;
  }

  .submit-btn.overcapacity {
    background: linear-gradient(135deg, #f97316 0%, #f4212e 100%);
  }

  .submit-btn.overcapacity:hover:not(:disabled) {
    background: linear-gradient(135deg, #ea580c 0%, #dc2626 100%);
  }

  .defer-btn {
    background: white;
    color: #f97316;
    border: 2px solid #f97316;
    border-radius: clamp(10px, 2.5vw, 14px);
    padding: clamp(12px, 3.5vw, 16px);
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .defer-btn:hover {
    background: #fff7ed;
  }

  /* ===== SPRINT MODE ===== */
  .sprint-badge {
    display: inline-block;
    background: linear-gradient(135deg, #00ba7c 0%, #059669 100%);
    color: white;
    padding: clamp(6px, 1.5vw, 8px) clamp(14px, 3.5vw, 20px);
    border-radius: 100px;
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 700;
    letter-spacing: 0.3px;
    margin-bottom: clamp(12px, 3vw, 16px);
    box-shadow: 0 2px 10px rgba(0, 186, 124, 0.3);
  }

  .sprint-hint {
    background: rgba(0, 186, 124, 0.08);
    border: 1px solid rgba(0, 186, 124, 0.2);
    border-radius: clamp(10px, 2.5vw, 14px);
    padding: clamp(10px, 2.5vw, 14px);
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 600;
    color: #059669;
    margin-bottom: clamp(16px, 4vw, 24px);
    text-align: center;
  }

  .submit-btn.sprint {
    background: linear-gradient(135deg, #00ba7c 0%, #059669 100%);
    box-shadow: 0 4px 14px rgba(0, 186, 124, 0.3);
  }

  .submit-btn.sprint:hover:not(:disabled) {
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
  }

  /* ===== AI FALLBACK WARNING ===== */
  .fallback-warning {
    display: flex;
    align-items: center;
    gap: clamp(10px, 2.5vw, 14px);
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.12) 0%, rgba(245, 158, 11, 0.08) 100%);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: clamp(10px, 2.5vw, 14px);
    padding: clamp(12px, 3vw, 16px);
    margin-bottom: clamp(16px, 4vw, 20px);
    text-align: left;
  }

  .fallback-icon {
    font-size: clamp(18px, 4.5vw, 22px);
    flex-shrink: 0;
  }

  .fallback-text {
    font-size: clamp(13px, 3.5vw, 15px);
    color: #92400e;
    line-height: 1.4;
    font-weight: 500;
  }
`
