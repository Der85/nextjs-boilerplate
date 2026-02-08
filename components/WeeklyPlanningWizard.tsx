'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
  type WeeklyPlanFull,
  type WizardStep,
  type PreviousWeekSummary,
  type CapacityWarning,
  WIZARD_STEPS,
  WIZARD_STEP_CONFIG,
  calculateCapacityAnalysis,
} from '@/lib/types/weekly-planning'
import type { Outcome } from '@/lib/types/outcomes'
import { trackWeeklyPlanCommitted } from '@/lib/analytics'

// ===========================================
// Types
// ===========================================

interface WeeklyPlanningWizardProps {
  onClose: () => void
  onComplete?: (plan: WeeklyPlanFull) => void
}

interface AvailableTask {
  id: string
  task_name: string
  status: string
  outcome_id: string | null
  commitment_id: string | null
  estimated_minutes: number | null
}

interface WeekInfo {
  week_number: number
  year: number
  week_start: string
  week_end: string
  range_label: string
  week_label: string
}

// ===========================================
// Main Wizard Component
// ===========================================

export default function WeeklyPlanningWizard({
  onClose,
  onComplete,
}: WeeklyPlanningWizardProps) {
  const supabase = createClient()
  const [currentStep, setCurrentStep] = useState<WizardStep>('review')
  const [plan, setPlan] = useState<WeeklyPlanFull | null>(null)
  const [weekInfo, setWeekInfo] = useState<WeekInfo | null>(null)
  const [previousWeekSummary, setPreviousWeekSummary] = useState<PreviousWeekSummary | null>(null)
  const [availableOutcomes, setAvailableOutcomes] = useState<Outcome[]>([])
  const [availableTasks, setAvailableTasks] = useState<AvailableTask[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reflection state (step 1)
  const [reflection, setReflection] = useState('')
  const [wins, setWins] = useState<string[]>([''])
  const [learnings, setLearnings] = useState<string[]>([''])

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  }, [])

  // Fetch current plan data
  const fetchPlanData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const token = await getAuthToken()
      if (!token) {
        setError('Please sign in to continue')
        return
      }

      const res = await fetch('/api/weekly-plans/current', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.error || 'Failed to load weekly plan')
      }

      const data = await res.json()
      setPlan(data.plan)
      setWeekInfo(data.week_info)
      setPreviousWeekSummary(data.previous_week_summary)
      setAvailableOutcomes(data.available_outcomes || [])
      setAvailableTasks(data.available_tasks || [])

      // Pre-fill reflection data if exists
      if (data.plan.previous_week_reflection) {
        setReflection(data.plan.previous_week_reflection)
      }
      if (data.plan.wins && data.plan.wins.length > 0) {
        setWins(data.plan.wins)
      }
      if (data.plan.learnings && data.plan.learnings.length > 0) {
        setLearnings(data.plan.learnings)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plan')
    } finally {
      setLoading(false)
    }
  }, [getAuthToken])

  useEffect(() => {
    fetchPlanData()
  }, [fetchPlanData])

  // Save reflection (step 1)
  const saveReflection = async () => {
    if (!plan) return

    setSaving(true)
    try {
      const token = await getAuthToken()
      if (!token) return

      await fetch(`/api/weekly-plans/${plan.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          previous_week_reflection: reflection,
          wins: wins.filter(w => w.trim()),
          learnings: learnings.filter(l => l.trim()),
        }),
      })
    } catch (err) {
      console.error('Error saving reflection:', err)
    } finally {
      setSaving(false)
    }
  }

  // Add outcome to plan (step 2)
  const addOutcome = async (outcomeId: string) => {
    if (!plan) return

    try {
      const token = await getAuthToken()
      if (!token) return

      const res = await fetch(`/api/weekly-plans/${plan.id}/outcomes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          outcome_id: outcomeId,
          priority_rank: (plan.outcomes?.length || 0) + 1,
        }),
      })

      if (res.ok) {
        await fetchPlanData()
      } else {
        const errBody = await res.json().catch(() => null)
        console.error('Error adding outcome:', res.status, errBody)
        setError(errBody?.error || `Failed to add outcome (${res.status})`)
      }
    } catch (err) {
      console.error('Error adding outcome:', err)
    }
  }

  // Remove outcome from plan (step 2)
  const removeOutcome = async (outcomeId: string) => {
    if (!plan) return

    try {
      const token = await getAuthToken()
      if (!token) return

      await fetch(`/api/weekly-plans/${plan.id}/outcomes?outcome_id=${outcomeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      await fetchPlanData()
    } catch (err) {
      console.error('Error removing outcome:', err)
    }
  }

  // Add task to plan (step 3)
  const addTask = async (taskId: string, scheduledDay: number | null = null) => {
    if (!plan) return

    try {
      const token = await getAuthToken()
      if (!token) return

      const res = await fetch(`/api/weekly-plans/${plan.id}/tasks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: taskId,
          scheduled_day: scheduledDay,
        }),
      })

      if (res.ok) {
        await fetchPlanData()
      } else {
        const errBody = await res.json().catch(() => null)
        console.error('Error adding task:', res.status, errBody)
        setError(errBody?.error || `Failed to add task (${res.status})`)
      }
    } catch (err) {
      console.error('Error adding task:', err)
    }
  }

  // Update task schedule (step 3)
  const updateTaskSchedule = async (taskId: string, scheduledDay: number | null) => {
    if (!plan) return

    try {
      const token = await getAuthToken()
      if (!token) return

      await fetch(`/api/weekly-plans/${plan.id}/tasks?task_id=${taskId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scheduled_day: scheduledDay }),
      })

      await fetchPlanData()
    } catch (err) {
      console.error('Error updating task:', err)
    }
  }

  // Remove task from plan (step 3)
  const removeTask = async (taskId: string) => {
    if (!plan) return

    try {
      const token = await getAuthToken()
      if (!token) return

      await fetch(`/api/weekly-plans/${plan.id}/tasks?task_id=${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      await fetchPlanData()
    } catch (err) {
      console.error('Error removing task:', err)
    }
  }

  // Update capacity (step 3)
  const updateCapacity = async (minutes: number) => {
    if (!plan) return

    try {
      const token = await getAuthToken()
      if (!token) return

      await fetch(`/api/weekly-plans/${plan.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ available_capacity_minutes: minutes }),
      })

      await fetchPlanData()
    } catch (err) {
      console.error('Error updating capacity:', err)
    }
  }

  // Commit plan (step 4)
  const commitPlan = async () => {
    if (!plan) return

    setSaving(true)
    try {
      const token = await getAuthToken()
      if (!token) return

      const res = await fetch(`/api/weekly-plans/${plan.id}/commit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ generate_summary: true }),
      })

      if (res.ok) {
        const data = await res.json()
        setPlan(data.plan)

        // Track analytics event
        trackWeeklyPlanCommitted({
          outcomes_count: data.plan.outcomes?.length || 0,
          tasks_count: data.plan.tasks?.length || 0,
          week_start: weekInfo?.week_start || new Date().toISOString(),
        })

        setCurrentStep('summary')
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Failed to commit plan')
      }
    } catch (err) {
      setError('Failed to commit plan')
    } finally {
      setSaving(false)
    }
  }

  // Navigation
  const goToStep = (step: WizardStep) => {
    if (step === 'review') {
      saveReflection()
    }
    setCurrentStep(step)
  }

  const goNext = () => {
    const currentIndex = WIZARD_STEPS.indexOf(currentStep)
    if (currentIndex < WIZARD_STEPS.length - 1) {
      goToStep(WIZARD_STEPS[currentIndex + 1])
    }
  }

  const goBack = () => {
    const currentIndex = WIZARD_STEPS.indexOf(currentStep)
    if (currentIndex > 0) {
      goToStep(WIZARD_STEPS[currentIndex - 1])
    }
  }

  const handleComplete = () => {
    if (plan) {
      onComplete?.(plan)
    }
    onClose()
  }

  // ===========================================
  // Render
  // ===========================================

  if (loading) {
    return (
      <div className="wizard-overlay">
        <div className="wizard-container loading">
          <div className="loading-spinner" />
          <p>Loading your weekly plan...</p>
        </div>
        <style jsx>{wizardStyles}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div className="wizard-overlay">
        <div className="wizard-container error">
          <h3>Something went wrong</h3>
          <p>{error}</p>
          <button onClick={onClose}>Close</button>
        </div>
        <style jsx>{wizardStyles}</style>
      </div>
    )
  }

  if (!plan || !weekInfo) {
    return null
  }

  return (
    <div className="wizard-overlay">
      <div className="wizard-container">
        {/* Header */}
        <div className="wizard-header">
          <div className="header-left">
            <h2>Weekly Planning</h2>
            <span className="week-label">{weekInfo.range_label}</span>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Progress Steps */}
        <div className="step-progress">
          {WIZARD_STEPS.map((step, index) => {
            const config = WIZARD_STEP_CONFIG[step]
            const isActive = step === currentStep
            const isCompleted = WIZARD_STEPS.indexOf(currentStep) > index
            const isClickable = isCompleted || index === WIZARD_STEPS.indexOf(currentStep)

            return (
              <button
                key={step}
                className={`step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                onClick={() => isClickable && goToStep(step)}
                disabled={!isClickable}
              >
                <span className="step-icon">{config.icon}</span>
                <span className="step-title">{config.title}</span>
              </button>
            )
          })}
        </div>

        {/* Step Content */}
        <div className="step-content">
          {currentStep === 'review' && (
            <ReviewStep
              previousWeekSummary={previousWeekSummary}
              reflection={reflection}
              setReflection={setReflection}
              wins={wins}
              setWins={setWins}
              learnings={learnings}
              setLearnings={setLearnings}
            />
          )}

          {currentStep === 'outcomes' && (
            <OutcomesStep
              selectedOutcomes={plan.outcomes}
              availableOutcomes={availableOutcomes}
              onAdd={addOutcome}
              onRemove={removeOutcome}
            />
          )}

          {currentStep === 'capacity' && (
            <CapacityStep
              plan={plan}
              availableTasks={availableTasks}
              onAddTask={addTask}
              onRemoveTask={removeTask}
              onUpdateSchedule={updateTaskSchedule}
              onUpdateCapacity={updateCapacity}
            />
          )}

          {currentStep === 'commit' && (
            <CommitStep
              plan={plan}
              saving={saving}
              onCommit={commitPlan}
            />
          )}

          {currentStep === 'summary' && (
            <SummaryStep
              plan={plan}
              weekInfo={weekInfo}
            />
          )}
        </div>

        {/* Footer Navigation */}
        <div className="wizard-footer">
          {currentStep !== 'review' && currentStep !== 'summary' && (
            <button className="nav-btn back" onClick={goBack}>
              ← Back
            </button>
          )}
          <div className="footer-spacer" />
          {currentStep === 'summary' ? (
            <button className="nav-btn primary" onClick={handleComplete}>
              Done
            </button>
          ) : currentStep === 'commit' ? (
            <button
              className="nav-btn primary"
              onClick={commitPlan}
              disabled={saving}
            >
              {saving ? 'Committing...' : 'Commit Plan'}
            </button>
          ) : (
            <button className="nav-btn primary" onClick={goNext}>
              Continue →
            </button>
          )}
        </div>
      </div>
      <style jsx>{wizardStyles}</style>
      <style jsx global>{stepStyles}</style>
    </div>
  )
}

// ===========================================
// Step 1: Review Previous Week
// ===========================================

function ReviewStep({
  previousWeekSummary,
  reflection,
  setReflection,
  wins,
  setWins,
  learnings,
  setLearnings,
}: {
  previousWeekSummary: PreviousWeekSummary | null
  reflection: string
  setReflection: (v: string) => void
  wins: string[]
  setWins: (v: string[]) => void
  learnings: string[]
  setLearnings: (v: string[]) => void
}) {
  const addWin = () => setWins([...wins, ''])
  const updateWin = (index: number, value: string) => {
    const newWins = [...wins]
    newWins[index] = value
    setWins(newWins)
  }
  const removeWin = (index: number) => {
    if (wins.length > 1) {
      setWins(wins.filter((_, i) => i !== index))
    }
  }

  const addLearning = () => setLearnings([...learnings, ''])
  const updateLearning = (index: number, value: string) => {
    const newLearnings = [...learnings]
    newLearnings[index] = value
    setLearnings(newLearnings)
  }
  const removeLearning = (index: number) => {
    if (learnings.length > 1) {
      setLearnings(learnings.filter((_, i) => i !== index))
    }
  }

  return (
    <div className="step-review">
      <h3 className="step-heading">How did last week go?</h3>

      {previousWeekSummary && (
        <div className="prev-week-stats">
          <div className="stat-card">
            <span className="stat-value">{previousWeekSummary.completion_rate}%</span>
            <span className="stat-label">Completion Rate</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{previousWeekSummary.completed_tasks}/{previousWeekSummary.total_planned_tasks}</span>
            <span className="stat-label">Tasks Completed</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{Math.round(previousWeekSummary.total_minutes_completed / 60)}h</span>
            <span className="stat-label">Time Invested</span>
          </div>
        </div>
      )}

      <div className="form-section">
        <label className="form-label">Wins from last week</label>
        <p className="form-hint">What went well? Celebrate your progress!</p>
        {wins.map((win, index) => (
          <div key={index} className="input-row">
            <input
              type="text"
              value={win}
              onChange={(e) => updateWin(index, e.target.value)}
              placeholder="e.g., Completed the API refactor"
            />
            {wins.length > 1 && (
              <button className="remove-btn" onClick={() => removeWin(index)}>×</button>
            )}
          </div>
        ))}
        <button className="add-btn" onClick={addWin}>+ Add win</button>
      </div>

      <div className="form-section">
        <label className="form-label">Learnings</label>
        <p className="form-hint">What would you do differently?</p>
        {learnings.map((learning, index) => (
          <div key={index} className="input-row">
            <input
              type="text"
              value={learning}
              onChange={(e) => updateLearning(index, e.target.value)}
              placeholder="e.g., Need to block more focus time"
            />
            {learnings.length > 1 && (
              <button className="remove-btn" onClick={() => removeLearning(index)}>×</button>
            )}
          </div>
        ))}
        <button className="add-btn" onClick={addLearning}>+ Add learning</button>
      </div>

      <div className="form-section">
        <label className="form-label">Additional Reflection (optional)</label>
        <textarea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="Any other thoughts about last week..."
          rows={3}
        />
      </div>

    </div>
  )
}

// ===========================================
// Step 2: Choose Outcomes
// ===========================================

function OutcomesStep({
  selectedOutcomes,
  availableOutcomes,
  onAdd,
  onRemove,
}: {
  selectedOutcomes: WeeklyPlanFull['outcomes']
  availableOutcomes: Outcome[]
  onAdd: (id: string) => void
  onRemove: (id: string) => void
}) {
  const selectedIds = new Set(selectedOutcomes.map(o => o.outcome_id))
  const unselectedOutcomes = availableOutcomes.filter(o => !selectedIds.has(o.id))

  return (
    <div className="step-outcomes">
      <h3 className="step-heading">Choose your top 3 outcomes for this week</h3>
      <p className="step-description">
        Focus on what matters most. You can select up to 3 outcomes.
      </p>

      <div className="outcomes-section">
        <h4 className="section-heading">Selected ({selectedOutcomes.length}/3)</h4>
        {selectedOutcomes.length === 0 ? (
          <p className="empty-text">No outcomes selected yet</p>
        ) : (
          <div className="outcome-list">
            {selectedOutcomes.map((po, index) => (
              <div key={po.id} className="outcome-card selected">
                <span className="rank">#{index + 1}</span>
                <div className="outcome-info">
                  <span className="outcome-title">{po.outcome?.title}</span>
                  <span className="outcome-horizon">{po.outcome?.horizon}</span>
                </div>
                <button
                  className="remove-btn"
                  onClick={() => onRemove(po.outcome_id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {unselectedOutcomes.length > 0 && selectedOutcomes.length < 3 && (
        <div className="outcomes-section">
          <h4 className="section-heading">Available Outcomes</h4>
          <div className="outcome-list">
            {unselectedOutcomes.map((outcome) => (
              <div key={outcome.id} className="outcome-card available">
                <div className="outcome-info">
                  <span className="outcome-title">{outcome.title}</span>
                  <span className="outcome-horizon">{outcome.horizon}</span>
                </div>
                <button
                  className="add-outcome-btn"
                  onClick={() => onAdd(outcome.id)}
                >
                  + Add
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

// ===========================================
// Step 3: Capacity Planning
// ===========================================

function CapacityStep({
  plan,
  availableTasks,
  onAddTask,
  onRemoveTask,
  onUpdateSchedule,
  onUpdateCapacity,
}: {
  plan: WeeklyPlanFull
  availableTasks: AvailableTask[]
  onAddTask: (id: string, day?: number | null) => void
  onRemoveTask: (id: string) => void
  onUpdateSchedule: (id: string, day: number | null) => void
  onUpdateCapacity: (minutes: number) => void
}) {
  const [capacityHours, setCapacityHours] = useState(
    Math.round(plan.available_capacity_minutes / 60)
  )
  const addedTaskIds = new Set(plan.tasks.map(t => t.task_id))
  const unaddedTasks = availableTasks.filter(t => !addedTaskIds.has(t.id))

  const handleCapacityChange = (hours: number) => {
    setCapacityHours(hours)
    onUpdateCapacity(hours * 60)
  }

  const analysis = plan.capacity_analysis

  return (
    <div className="step-capacity">
      <h3 className="step-heading">Plan your capacity</h3>

      {/* Capacity Setting */}
      <div className="capacity-section">
        <label className="form-label">Available hours this week</label>
        <div className="capacity-input">
          <input
            type="range"
            min="1"
            max="40"
            value={capacityHours}
            onChange={(e) => handleCapacityChange(parseInt(e.target.value))}
          />
          <span className="capacity-value">{capacityHours}h</span>
        </div>
      </div>

      {/* Capacity Bar */}
      <div className="capacity-bar-container">
        <div className="capacity-bar">
          <div
            className={`capacity-fill ${analysis.isOvercommitted ? 'over' : ''}`}
            style={{ width: `${Math.min(100, analysis.utilizationPercent)}%` }}
          />
        </div>
        <div className="capacity-labels">
          <span>Planned: {Math.round(analysis.totalPlannedMinutes / 60)}h</span>
          <span>{analysis.utilizationPercent}% utilized</span>
        </div>
      </div>

      {/* Warnings */}
      {analysis.warnings.length > 0 && (
        <div className="warnings">
          {analysis.warnings.map((warning, index) => (
            <div key={index} className={`warning ${warning.severity}`}>
              <span className="warning-icon">{warning.severity === 'error' ? '⚠️' : '💡'}</span>
              <span>{warning.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Day-by-day breakdown */}
      <div className="day-breakdown">
        <h4 className="section-heading">Tasks by Day</h4>
        {analysis.dayBreakdown.map((day) => (
          <div key={day.day} className="day-row">
            <span className="day-name">{day.dayName}</span>
            <span className="day-minutes">{day.totalMinutes}min</span>
            <div className="day-tasks">
              {day.tasks.map((t) => (
                <span key={t.id} className="task-chip">
                  {t.task?.task_name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Add tasks */}
      <div className="add-tasks-section">
        <h4 className="section-heading">Add Tasks</h4>
        {unaddedTasks.length === 0 ? (
          <p className="empty-text">All available tasks have been added</p>
        ) : (
          <div className="task-list">
            {unaddedTasks.slice(0, 10).map((task) => (
              <div key={task.id} className="task-row">
                <span className="task-title">{task.task_name}</span>
                <span className="task-est">{task.estimated_minutes || 30}min</span>
                <button
                  className="add-task-btn"
                  onClick={() => onAddTask(task.id)}
                >
                  + Add
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current tasks */}
      {plan.tasks.length > 0 && (
        <div className="current-tasks-section">
          <h4 className="section-heading">Planned Tasks ({plan.tasks.length})</h4>
          <div className="task-list">
            {plan.tasks.map((pt) => (
              <div key={pt.id} className="task-row planned">
                <span className="task-title">{pt.task?.task_name}</span>
                <select
                  value={pt.scheduled_day ?? ''}
                  onChange={(e) =>
                    onUpdateSchedule(
                      pt.task_id,
                      e.target.value === '' ? null : parseInt(e.target.value)
                    )
                  }
                >
                  <option value="">Flexible</option>
                  <option value="0">Monday</option>
                  <option value="1">Tuesday</option>
                  <option value="2">Wednesday</option>
                  <option value="3">Thursday</option>
                  <option value="4">Friday</option>
                  <option value="5">Saturday</option>
                  <option value="6">Sunday</option>
                </select>
                <button
                  className="remove-btn"
                  onClick={() => onRemoveTask(pt.task_id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

// ===========================================
// Step 4: Commit
// ===========================================

function CommitStep({
  plan,
  saving,
  onCommit,
}: {
  plan: WeeklyPlanFull
  saving: boolean
  onCommit: () => void
}) {
  const analysis = plan.capacity_analysis

  return (
    <div className="step-commit">
      <h3 className="step-heading">Review and commit your plan</h3>

      <div className="commit-summary">
        <div className="summary-row">
          <span className="summary-label">Outcomes</span>
          <span className="summary-value">{plan.outcomes.length}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Tasks</span>
          <span className="summary-value">{plan.tasks.length}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Planned Time</span>
          <span className="summary-value">{Math.round(analysis.totalPlannedMinutes / 60)}h</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Available Time</span>
          <span className="summary-value">{Math.round(analysis.availableMinutes / 60)}h</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Utilization</span>
          <span className={`summary-value ${analysis.isOvercommitted ? 'over' : ''}`}>
            {analysis.utilizationPercent}%
          </span>
        </div>
      </div>

      {analysis.warnings.length > 0 && (
        <div className="warnings">
          <h4 className="section-heading">Warnings</h4>
          {analysis.warnings.map((warning, index) => (
            <div key={index} className={`warning ${warning.severity}`}>
              <span>{warning.message}</span>
              {warning.details && <span className="warning-details">{warning.details}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="commit-actions">
        <p className="commit-note">
          Once committed, your plan will be locked. You can create a new version
          if you need to make changes later.
        </p>
      </div>

    </div>
  )
}

// ===========================================
// Step 5: Summary
// ===========================================

function SummaryStep({
  plan,
  weekInfo,
}: {
  plan: WeeklyPlanFull
  weekInfo: WeekInfo
}) {
  return (
    <div className="step-summary">
      <div className="success-header">
        <span className="success-icon">✅</span>
        <h3 className="step-heading">Your week is planned!</h3>
        <p className="step-description">{weekInfo.range_label}</p>
      </div>

      {plan.summary_markdown && (
        <div className="summary-content">
          <pre>{plan.summary_markdown}</pre>
        </div>
      )}

      <div className="next-steps">
        <h4 className="section-heading">Next Steps</h4>
        <ul>
          <li>Check your daily tasks in the Now Mode panel</li>
          <li>Complete your daily check-in to track energy levels</li>
          <li>Review and adjust as needed throughout the week</li>
        </ul>
      </div>

    </div>
  )
}

// ===========================================
// Styles
// ===========================================

const wizardStyles = `
  .wizard-overlay {
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

  .wizard-container {
    background: #1a1a2e;
    border-radius: 20px;
    width: 100%;
    max-width: 700px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    color: #e4e4f0;
  }

  .wizard-container.loading,
  .wizard-container.error {
    padding: 60px;
    text-align: center;
    color: #e4e4f0;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #3a3a5e;
    border-top-color: #1D9BF0;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 20px;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .wizard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 1px solid #2a2a4e;
  }

  .header-left h2 {
    font-size: 20px;
    font-weight: 600;
    color: #e4e4f0;
    margin: 0;
  }

  .week-label {
    font-size: 13px;
    color: #8b8ba7;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 28px;
    color: #6b6b8e;
    cursor: pointer;
    line-height: 1;
  }

  .close-btn:hover {
    color: #a0a0be;
  }

  .step-progress {
    display: flex;
    padding: 16px 24px;
    gap: 8px;
    border-bottom: 1px solid #2a2a4e;
    overflow-x: auto;
  }

  .step-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .step-item:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .step-item.active {
    background: #2a2a4e;
  }

  .step-item.completed {
    color: #10b981;
  }

  .step-icon {
    font-size: 18px;
  }

  .step-title {
    font-size: 13px;
    color: #8b8ba7;
  }

  .step-item.active .step-title {
    color: #e4e4f0;
  }

  .step-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .wizard-footer {
    display: flex;
    align-items: center;
    padding: 16px 24px;
    border-top: 1px solid #2a2a4e;
  }

  .footer-spacer {
    flex: 1;
  }

  .nav-btn {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
  }

  .nav-btn.back {
    background: transparent;
    color: #8b8ba7;
  }

  .nav-btn.back:hover {
    color: #e4e4f0;
  }

  .nav-btn.primary {
    background: #1D9BF0;
    color: white;
  }

  .nav-btn.primary:hover {
    background: #1a8cd8;
  }

  .nav-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const stepStyles = `
  .step-heading {
    font-size: 20px;
    font-weight: 600;
    color: #e4e4f0;
    margin: 0 0 8px;
  }

  .section-heading {
    font-size: 15px;
    font-weight: 600;
    color: #e4e4f0;
    margin: 20px 0 12px;
  }

  .step-description {
    color: #8b8ba7;
    font-size: 14px;
    margin-bottom: 24px;
  }

  .prev-week-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }

  .stat-card {
    background: #12121f;
    border-radius: 12px;
    padding: 16px;
    text-align: center;
  }

  .stat-value {
    display: block;
    font-size: 24px;
    font-weight: 600;
    color: #1D9BF0;
    margin-bottom: 4px;
  }

  .stat-label {
    font-size: 12px;
    color: #8b8ba7;
  }

  .form-section {
    margin-bottom: 20px;
  }

  .form-label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: #e4e4f0;
    margin-bottom: 4px;
  }

  .form-hint {
    font-size: 12px;
    color: #6b6b8e;
    margin: 0 0 12px;
  }

  .input-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }

  .input-row input {
    flex: 1;
    padding: 10px 14px;
    background: #12121f;
    border: 1px solid #2a2a4e;
    border-radius: 8px;
    color: #e4e4f0;
    font-size: 14px;
  }

  .input-row input::placeholder {
    color: #6b6b8e;
  }

  .input-row input:focus {
    outline: none;
    border-color: #1D9BF0;
  }

  textarea {
    width: 100%;
    padding: 12px 14px;
    background: #12121f;
    border: 1px solid #2a2a4e;
    border-radius: 8px;
    color: #e4e4f0;
    font-size: 14px;
    resize: vertical;
  }

  textarea::placeholder {
    color: #6b6b8e;
  }

  textarea:focus {
    outline: none;
    border-color: #1D9BF0;
  }

  .remove-btn {
    background: transparent;
    border: none;
    color: #ef4444;
    font-size: 18px;
    cursor: pointer;
    padding: 0 8px;
  }

  .add-btn {
    background: transparent;
    border: none;
    color: #1D9BF0;
    font-size: 13px;
    cursor: pointer;
    padding: 8px 0;
  }

  .add-btn:hover {
    text-decoration: underline;
  }

  .empty-text {
    color: #6b6b8e;
    font-size: 14px;
    font-style: italic;
  }

  .outcome-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .outcome-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: #12121f;
    border-radius: 10px;
    border: 1px solid #2a2a4e;
  }

  .outcome-card.selected {
    border-color: #1D9BF0;
  }

  .rank {
    font-size: 14px;
    font-weight: 600;
    color: #1D9BF0;
  }

  .outcome-info {
    flex: 1;
    min-width: 0;
  }

  .outcome-title {
    display: block;
    font-size: 14px;
    color: #e4e4f0;
  }

  .outcome-horizon {
    font-size: 12px;
    color: #6b6b8e;
    text-transform: capitalize;
  }

  .add-outcome-btn {
    padding: 6px 12px;
    background: #2a2a4e;
    border: none;
    border-radius: 6px;
    color: #e4e4f0;
    font-size: 13px;
    cursor: pointer;
  }

  .add-outcome-btn:hover {
    background: #3a3a5e;
  }

  .capacity-section {
    margin-bottom: 20px;
  }

  .capacity-section .form-label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: #e4e4f0;
    margin-bottom: 8px;
  }

  .capacity-input {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .capacity-input input[type="range"] {
    flex: 1;
    accent-color: #1D9BF0;
  }

  .capacity-value {
    font-size: 18px;
    font-weight: 600;
    color: #1D9BF0;
    min-width: 50px;
  }

  .capacity-bar-container {
    margin-bottom: 20px;
  }

  .capacity-bar {
    height: 12px;
    background: #12121f;
    border-radius: 6px;
    overflow: hidden;
  }

  .capacity-fill {
    height: 100%;
    background: #10b981;
    transition: width 0.3s ease;
  }

  .capacity-fill.over {
    background: #ef4444;
  }

  .capacity-labels {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-size: 12px;
    color: #8b8ba7;
  }

  .warnings {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
  }

  .warning {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
  }

  .warning.warning {
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
  }

  .warning.error {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  .warning-details {
    display: block;
    font-size: 12px;
    opacity: 0.8;
    margin-top: 4px;
  }

  .day-breakdown {
    margin-bottom: 24px;
  }

  .day-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid #2a2a4e;
  }

  .day-name {
    width: 100px;
    font-size: 13px;
    color: #e4e4f0;
  }

  .day-minutes {
    width: 60px;
    font-size: 12px;
    color: #6b6b8e;
  }

  .day-tasks {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .task-chip {
    padding: 4px 10px;
    background: #2a2a4e;
    border-radius: 12px;
    font-size: 11px;
    color: #a0a0be;
  }

  .task-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .task-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: #12121f;
    border-radius: 8px;
  }

  .task-row.planned {
    border: 1px solid #2a2a4e;
  }

  .task-title {
    flex: 1;
    font-size: 13px;
    color: #e4e4f0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .task-est {
    font-size: 12px;
    color: #6b6b8e;
  }

  .add-task-btn {
    padding: 4px 10px;
    background: #2a2a4e;
    border: none;
    border-radius: 4px;
    color: #e4e4f0;
    font-size: 12px;
    cursor: pointer;
  }

  .task-row select {
    padding: 6px 10px;
    background: #2a2a4e;
    border: none;
    border-radius: 6px;
    color: #e4e4f0;
    font-size: 12px;
    cursor: pointer;
  }

  .task-row select option {
    background: #1a1a2e;
    color: #e4e4f0;
  }

  .commit-summary {
    background: #12121f;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 24px;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #2a2a4e;
  }

  .summary-row:last-child {
    border-bottom: none;
  }

  .summary-label {
    font-size: 14px;
    color: #8b8ba7;
  }

  .summary-value {
    font-size: 14px;
    font-weight: 600;
    color: #e4e4f0;
  }

  .summary-value.over {
    color: #ef4444;
  }

  .commit-actions {
    text-align: center;
    font-size: 13px;
  }

  .commit-note {
    color: #6b6b8e;
  }

  .success-header {
    text-align: center;
    margin-bottom: 24px;
  }

  .success-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 16px;
  }

  .summary-content {
    background: #12121f;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 24px;
    overflow-x: auto;
  }

  .summary-content pre {
    font-size: 13px;
    color: #a0a0be;
    white-space: pre-wrap;
    margin: 0;
    font-family: inherit;
  }

  .next-steps {
    background: rgba(29, 155, 240, 0.1);
    border-radius: 12px;
    padding: 20px;
  }

  .next-steps ul {
    margin: 0;
    padding-left: 20px;
  }

  .next-steps li {
    font-size: 14px;
    color: #a0a0be;
    margin-bottom: 8px;
  }

  @media (max-width: 480px) {
    .prev-week-stats {
      grid-template-columns: 1fr;
    }
  }
`
