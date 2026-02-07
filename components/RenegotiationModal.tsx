'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  type RenegotiationAction,
  type RenegotiationReasonCode,
  type TaskNeedingRenegotiation,
  type SubtaskInput,
  type RenegotiationResult,
  RENEGOTIATION_ACTIONS,
  RENEGOTIATION_REASONS,
  QUICK_RESCHEDULE_OPTIONS,
  SUPPORTIVE_COPY,
  getRandomEncouragement,
  formatDaysOverdue,
} from '@/lib/types/renegotiation'
import {
  generateSplitSuggestions,
  formatDateForDisplay,
  formatDateForAPI,
} from '@/lib/renegotiation-engine'

// ===========================================
// Types
// ===========================================

interface RenegotiationModalProps {
  task: TaskNeedingRenegotiation
  onClose: () => void
  onComplete: (result: RenegotiationResult) => void
}

type ModalStep = 'action' | 'reason' | 'details' | 'confirm'

// ===========================================
// Main Component
// ===========================================

export default function RenegotiationModal({
  task,
  onClose,
  onComplete,
}: RenegotiationModalProps) {
  const supabase = createClient()
  const [step, setStep] = useState<ModalStep>('action')
  const [selectedAction, setSelectedAction] = useState<RenegotiationAction | null>(null)
  const [selectedReason, setSelectedReason] = useState<RenegotiationReasonCode | null>(null)
  const [reasonText, setReasonText] = useState('')
  const [newDueDate, setNewDueDate] = useState<string>('')
  const [subtasks, setSubtasks] = useState<SubtaskInput[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }, [])

  // Initialize subtasks when split is selected
  const handleActionSelect = (action: RenegotiationAction) => {
    setSelectedAction(action)

    if (action === 'split') {
      const suggestions = generateSplitSuggestions(task.title, null)
      setSubtasks(suggestions.map(s => ({
        title: s.title,
        estimated_minutes: s.estimatedMinutes,
        due_date: s.suggestedDueDate ? formatDateForAPI(s.suggestedDueDate) : undefined,
      })))
    }

    setStep('reason')
  }

  const handleReasonSelect = (reason: RenegotiationReasonCode) => {
    setSelectedReason(reason)
    setStep('details')
  }

  const handleQuickReschedule = async (option: typeof QUICK_RESCHEDULE_OPTIONS[0]) => {
    setNewDueDate(formatDateForAPI(option.getDueDate()))
    await handleSubmit(formatDateForAPI(option.getDueDate()))
  }

  const handleSubmit = async (overrideDueDate?: string) => {
    if (!selectedAction || !selectedReason) return

    setSaving(true)
    setError(null)

    try {
      const token = await getAuthToken()
      if (!token) {
        setError('Please sign in to continue')
        return
      }

      const body: Record<string, unknown> = {
        task_id: task.id,
        action: selectedAction,
        reason_code: selectedReason,
        reason_text: selectedReason === 'other' ? reasonText : undefined,
      }

      if (selectedAction === 'reschedule') {
        body.new_due_date = overrideDueDate || newDueDate
      }

      if (selectedAction === 'split') {
        body.subtasks = subtasks.filter(s => s.title.trim())
      }

      const res = await fetch('/api/renegotiations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to renegotiate')
      }

      const result: RenegotiationResult = await res.json()
      onComplete(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const goBack = () => {
    switch (step) {
      case 'reason':
        setStep('action')
        break
      case 'details':
        setStep('reason')
        break
      case 'confirm':
        setStep('details')
        break
    }
  }

  // ===========================================
  // Render
  // ===========================================

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2>{SUPPORTIVE_COPY.modalTitle}</h2>
            <p className="subtitle">{SUPPORTIVE_COPY.modalSubtitle}</p>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Task Info */}
        <div className="task-info">
          <span className="task-title">{task.title}</span>
          <span className="task-overdue">{formatDaysOverdue(task.days_overdue)}</span>
        </div>

        {/* Content */}
        <div className="modal-content">
          {step === 'action' && (
            <ActionStep
              onSelect={handleActionSelect}
              renegotiationCount={task.renegotiation_count}
            />
          )}

          {step === 'reason' && selectedAction && (
            <ReasonStep
              action={selectedAction}
              onSelect={handleReasonSelect}
              onBack={goBack}
            />
          )}

          {step === 'details' && selectedAction && selectedReason && (
            <DetailsStep
              action={selectedAction}
              reason={selectedReason}
              newDueDate={newDueDate}
              setNewDueDate={setNewDueDate}
              reasonText={reasonText}
              setReasonText={setReasonText}
              subtasks={subtasks}
              setSubtasks={setSubtasks}
              onQuickReschedule={handleQuickReschedule}
              onSubmit={() => handleSubmit()}
              onBack={goBack}
              saving={saving}
              error={error}
            />
          )}
        </div>

        {/* Encouragement */}
        <div className="encouragement">
          <span className="encouragement-icon">💙</span>
          <span>{getRandomEncouragement()}</span>
        </div>

        <style jsx>{modalStyles}</style>
      </div>
    </div>
  )
}

// ===========================================
// Step 1: Choose Action
// ===========================================

function ActionStep({
  onSelect,
  renegotiationCount,
}: {
  onSelect: (action: RenegotiationAction) => void
  renegotiationCount: number
}) {
  return (
    <div className="step-action">
      <div className="action-grid">
        {RENEGOTIATION_ACTIONS.map((action) => (
          <button
            key={action.id}
            className="action-card"
            onClick={() => onSelect(action.id)}
          >
            <span className="action-icon">{action.icon}</span>
            <div className="action-content">
              <span className="action-label">{action.label}</span>
              <span className="action-description">{action.description}</span>
            </div>
          </button>
        ))}
      </div>

      {renegotiationCount > 0 && (
        <p className="renegotiation-note">
          This task has been adjusted {renegotiationCount} time{renegotiationCount > 1 ? 's' : ''} before.
          That&apos;s okay — finding the right approach takes time.
        </p>
      )}

      <style jsx>{stepStyles}</style>
    </div>
  )
}

// ===========================================
// Step 2: Choose Reason
// ===========================================

function ReasonStep({
  action,
  onSelect,
  onBack,
}: {
  action: RenegotiationAction
  onSelect: (reason: RenegotiationReasonCode) => void
  onBack: () => void
}) {
  const actionConfig = RENEGOTIATION_ACTIONS.find(a => a.id === action)

  return (
    <div className="step-reason">
      <p className="step-prompt">What got in the way?</p>
      <p className="step-hint">{SUPPORTIVE_COPY.noShame}</p>

      <div className="reason-grid">
        {RENEGOTIATION_REASONS.map((reason) => (
          <button
            key={reason.code}
            className="reason-chip"
            onClick={() => onSelect(reason.code)}
          >
            <span className="reason-icon">{reason.icon}</span>
            <span className="reason-label">{reason.label}</span>
          </button>
        ))}
      </div>

      <button className="back-btn" onClick={onBack}>
        ← Back
      </button>

      <style jsx>{stepStyles}</style>
    </div>
  )
}

// ===========================================
// Step 3: Details
// ===========================================

function DetailsStep({
  action,
  reason,
  newDueDate,
  setNewDueDate,
  reasonText,
  setReasonText,
  subtasks,
  setSubtasks,
  onQuickReschedule,
  onSubmit,
  onBack,
  saving,
  error,
}: {
  action: RenegotiationAction
  reason: RenegotiationReasonCode
  newDueDate: string
  setNewDueDate: (date: string) => void
  reasonText: string
  setReasonText: (text: string) => void
  subtasks: SubtaskInput[]
  setSubtasks: (subtasks: SubtaskInput[]) => void
  onQuickReschedule: (option: typeof QUICK_RESCHEDULE_OPTIONS[0]) => void
  onSubmit: () => void
  onBack: () => void
  saving: boolean
  error: string | null
}) {
  const actionConfig = RENEGOTIATION_ACTIONS.find(a => a.id === action)

  const addSubtask = () => {
    setSubtasks([...subtasks, { title: '', estimated_minutes: 30 }])
  }

  const updateSubtask = (index: number, field: keyof SubtaskInput, value: string | number) => {
    const updated = [...subtasks]
    updated[index] = { ...updated[index], [field]: value }
    setSubtasks(updated)
  }

  const removeSubtask = (index: number) => {
    if (subtasks.length > 1) {
      setSubtasks(subtasks.filter((_, i) => i !== index))
    }
  }

  const canSubmit = () => {
    if (action === 'reschedule') {
      return newDueDate && newDueDate.length > 0
    }
    if (action === 'split') {
      return subtasks.some(s => s.title.trim().length > 0)
    }
    if (reason === 'other') {
      return reasonText.trim().length > 0
    }
    return true
  }

  return (
    <div className="step-details">
      {/* Supportive message */}
      <div className="supportive-message">
        <span className="message-icon">{actionConfig?.icon}</span>
        <p>{actionConfig?.supportiveMessage}</p>
      </div>

      {/* Reschedule options */}
      {action === 'reschedule' && (
        <div className="reschedule-section">
          <label>Quick options</label>
          <div className="quick-chips">
            {QUICK_RESCHEDULE_OPTIONS.map((option) => (
              <button
                key={option.id}
                className="quick-chip"
                onClick={() => onQuickReschedule(option)}
                disabled={saving}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label>Or pick a date</label>
          <input
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
      )}

      {/* Split options */}
      {action === 'split' && (
        <div className="split-section">
          <label>Break this into smaller steps</label>
          {subtasks.map((subtask, index) => (
            <div key={index} className="subtask-row">
              <input
                type="text"
                value={subtask.title}
                onChange={(e) => updateSubtask(index, 'title', e.target.value)}
                placeholder={`Step ${index + 1}...`}
              />
              <input
                type="date"
                value={subtask.due_date || ''}
                onChange={(e) => updateSubtask(index, 'due_date', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
              {subtasks.length > 1 && (
                <button
                  className="remove-subtask"
                  onClick={() => removeSubtask(index)}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button className="add-subtask" onClick={addSubtask}>
            + Add another step
          </button>
        </div>
      )}

      {/* Other reason text */}
      {reason === 'other' && (
        <div className="reason-text-section">
          <label>What happened?</label>
          <textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="Share a bit about what got in the way..."
            rows={3}
          />
        </div>
      )}

      {/* Park/Drop confirmation */}
      {(action === 'park' || action === 'drop') && (
        <div className="confirm-section">
          <p>
            {action === 'park'
              ? "This task will be parked and won't appear in your active list. You can bring it back anytime."
              : "This task will be removed from your list. You can always recreate it later if needed."}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="detail-actions">
        <button className="back-btn" onClick={onBack} disabled={saving}>
          ← Back
        </button>
        <button
          className="submit-btn"
          onClick={onSubmit}
          disabled={saving || !canSubmit()}
        >
          {saving ? 'Saving...' : (
            action === 'reschedule' ? 'Reschedule' :
            action === 'split' ? 'Create subtasks' :
            action === 'park' ? 'Park task' :
            'Drop task'
          )}
        </button>
      </div>

      <style jsx>{stepStyles}</style>
    </div>
  )
}

// ===========================================
// Styles
// ===========================================

const modalStyles = `
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .modal-container {
    background: #1a1a2e;
    border-radius: 20px;
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 24px 24px 16px;
    border-bottom: 1px solid #2a2a4e;
  }

  .modal-header h2 {
    font-size: 20px;
    font-weight: 600;
    color: #e4e4f0;
    margin: 0 0 4px;
  }

  .subtitle {
    font-size: 14px;
    color: #8b8ba7;
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 28px;
    color: #6b6b8e;
    cursor: pointer;
    line-height: 1;
    padding: 0;
  }

  .close-btn:hover {
    color: #a0a0be;
  }

  .task-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 24px;
    background: #12121f;
    border-bottom: 1px solid #2a2a4e;
  }

  .task-title {
    font-size: 14px;
    font-weight: 500;
    color: #e4e4f0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    margin-right: 12px;
  }

  .task-overdue {
    font-size: 12px;
    color: #f59e0b;
    flex-shrink: 0;
  }

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .encouragement {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 24px;
    background: rgba(29, 155, 240, 0.1);
    border-top: 1px solid #2a2a4e;
    font-size: 13px;
    color: #a0a0be;
  }

  .encouragement-icon {
    font-size: 16px;
  }
`

const stepStyles = `
  .action-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .action-card {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 16px;
    background: #12121f;
    border: 1px solid #2a2a4e;
    border-radius: 12px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }

  .action-card:hover {
    border-color: #3a3a5e;
    background: #1a1a30;
  }

  .action-icon {
    font-size: 24px;
    flex-shrink: 0;
  }

  .action-content {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .action-label {
    font-size: 15px;
    font-weight: 500;
    color: #e4e4f0;
  }

  .action-description {
    font-size: 13px;
    color: #8b8ba7;
  }

  .renegotiation-note {
    margin-top: 16px;
    padding: 12px;
    background: rgba(139, 139, 167, 0.1);
    border-radius: 8px;
    font-size: 13px;
    color: #a0a0be;
    text-align: center;
  }

  .step-prompt {
    font-size: 16px;
    font-weight: 500;
    color: #e4e4f0;
    margin: 0 0 4px;
  }

  .step-hint {
    font-size: 13px;
    color: #8b8ba7;
    margin: 0 0 20px;
  }

  .reason-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 20px;
  }

  .reason-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #12121f;
    border: 1px solid #2a2a4e;
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .reason-chip:hover {
    border-color: #1D9BF0;
    background: rgba(29, 155, 240, 0.1);
  }

  .reason-icon {
    font-size: 16px;
  }

  .reason-label {
    font-size: 13px;
    color: #e4e4f0;
  }

  .back-btn {
    background: transparent;
    border: none;
    color: #8b8ba7;
    font-size: 14px;
    cursor: pointer;
    padding: 8px 0;
  }

  .back-btn:hover {
    color: #e4e4f0;
  }

  .supportive-message {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    background: rgba(16, 185, 129, 0.1);
    border-radius: 12px;
    margin-bottom: 20px;
  }

  .message-icon {
    font-size: 24px;
  }

  .supportive-message p {
    margin: 0;
    font-size: 14px;
    color: #10b981;
    line-height: 1.5;
  }

  .reschedule-section,
  .split-section,
  .reason-text-section,
  .confirm-section {
    margin-bottom: 20px;
  }

  label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: #e4e4f0;
    margin-bottom: 8px;
  }

  .quick-chips {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .quick-chip {
    padding: 10px 16px;
    background: #2a2a4e;
    border: none;
    border-radius: 8px;
    color: #e4e4f0;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .quick-chip:hover:not(:disabled) {
    background: #1D9BF0;
  }

  .quick-chip:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  input[type="date"],
  input[type="text"],
  textarea {
    width: 100%;
    padding: 12px 14px;
    background: #12121f;
    border: 1px solid #2a2a4e;
    border-radius: 8px;
    color: #e4e4f0;
    font-size: 14px;
  }

  input[type="date"]:focus,
  input[type="text"]:focus,
  textarea:focus {
    outline: none;
    border-color: #1D9BF0;
  }

  textarea {
    resize: vertical;
    min-height: 80px;
  }

  .subtask-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }

  .subtask-row input[type="text"] {
    flex: 1;
  }

  .subtask-row input[type="date"] {
    width: 150px;
    flex-shrink: 0;
  }

  .remove-subtask {
    background: transparent;
    border: none;
    color: #ef4444;
    font-size: 20px;
    cursor: pointer;
    padding: 0 8px;
  }

  .add-subtask {
    background: transparent;
    border: none;
    color: #1D9BF0;
    font-size: 13px;
    cursor: pointer;
    padding: 8px 0;
  }

  .add-subtask:hover {
    text-decoration: underline;
  }

  .confirm-section p {
    font-size: 14px;
    color: #a0a0be;
    line-height: 1.5;
    margin: 0;
  }

  .error-message {
    padding: 12px;
    background: rgba(239, 68, 68, 0.1);
    border-radius: 8px;
    color: #ef4444;
    font-size: 13px;
    margin-bottom: 16px;
  }

  .detail-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #2a2a4e;
  }

  .submit-btn {
    padding: 12px 24px;
    background: #1D9BF0;
    border: none;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .submit-btn:hover:not(:disabled) {
    background: #1a8cd8;
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`
