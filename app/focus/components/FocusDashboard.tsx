'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import UnifiedHeader from '@/components/UnifiedHeader'
import QuickAllyModal from './QuickAllyModal'
import { useUserStats } from '@/context/UserStatsContext'
import { XP_VALUES } from '@/lib/gamification'
import { useGamificationPrefsSafe } from '@/context/GamificationPrefsContext'

interface Step {
  id: string
  text: string
  completed: boolean
  dueBy?: string
  timeEstimate?: string
}

interface Plan {
  id: string
  task_name: string
  steps: Step[]
  created_at: string
  due_date?: string | null
  energy_required?: string | null
  related_goal_id?: string | null
  related_step_id?: string | null
}

interface Goal {
  id: string
  title: string
  micro_steps: Array<{ id: string; text: string; completed: boolean }>
}

interface FocusDashboardProps {
  plans: Plan[]
  goals: Goal[]
  user: any
  onlineCount: number
  userMode: 'recovery' | 'growth' | 'maintenance'
  onNewBrainDump: () => void
  onPlansUpdate: () => void
}

const getPlantEmoji = (p: number): string => {
  if (p >= 100) return '🌸'
  if (p >= 75) return '🌷'
  if (p >= 50) return '🪴'
  if (p >= 25) return '🌿'
  return '🌱'
}

const DUE_DATE_ORDER: Record<string, number> = {
  today: 0,
  tomorrow: 1,
  this_week: 2,
  no_rush: 3,
}

function sortByDueDate(a: Plan, b: Plan): number {
  const aOrder = DUE_DATE_ORDER[a.due_date || ''] ?? 4
  const bOrder = DUE_DATE_ORDER[b.due_date || ''] ?? 4
  return aOrder - bOrder
}

export default function FocusDashboard({
  plans,
  goals,
  user,
  onlineCount,
  userMode,
  onNewBrainDump,
  onPlansUpdate,
}: FocusDashboardProps) {
  const supabase = createClient()
  const { awardXP } = useUserStats()
  const { prefs: gamPrefs } = useGamificationPrefsSafe()
  const [xpToast, setXpToast] = useState<{ amount: number; visible: boolean }>({ amount: 0, visible: false })
  const [pulseStepId, setPulseStepId] = useState<string | null>(null)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [completedPlan, setCompletedPlan] = useState<Plan | null>(null)
  const [syncingGoal, setSyncingGoal] = useState(false)

  // Task action menu
  const [taskMenuId, setTaskMenuId] = useState<string | null>(null)

  // Quick Ally (Stuck) modal state
  const [showStuckModal, setShowStuckModal] = useState(false)
  const [stuckTaskName, setStuckTaskName] = useState('')

  // Quick Capture (Parking Lot)
  const [captureText, setCaptureText] = useState('')
  const [showCaptureToast, setShowCaptureToast] = useState(false)

  // Editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTaskName, setEditingTaskName] = useState('')
  const [editingStepKey, setEditingStepKey] = useState<string | null>(null)
  const [editingStepText, setEditingStepText] = useState('')

  // Undo deletion state
  const [pendingDelete, setPendingDelete] = useState<{
    type: 'plan' | 'step'
    planId: string
    stepId?: string
    label: string
    timer: ReturnType<typeof setTimeout>
  } | null>(null)

  const sortedPlans = [...plans]
    .filter(p => !(pendingDelete?.type === 'plan' && pendingDelete.planId === p.id))
    .sort(sortByDueDate)

  const getGoalTitle = (goalId: string | null) => {
    if (!goalId) return null
    const goal = goals.find(g => g.id === goalId)
    return goal?.title || null
  }

  const getDueDateLabel = (dueDate: string | null | undefined): string | null => {
    if (!dueDate) return null
    switch (dueDate) {
      case 'today': return 'Due today'
      case 'tomorrow': return 'Tomorrow'
      case 'this_week': return 'This week'
      case 'no_rush': return 'No rush'
      default: return dueDate
    }
  }

  const showXpToast = (amount: number) => {
    setXpToast({ amount, visible: true })
    setTimeout(() => setXpToast({ amount: 0, visible: false }), 2000)
  }

  const getGoalProgress = (goalId: string | null): number => {
    if (!goalId) return 0
    const goal = goals.find(g => g.id === goalId)
    if (!goal || goal.micro_steps.length === 0) return 0
    const done = goal.micro_steps.filter(s => s.completed).length
    return Math.round((done / goal.micro_steps.length) * 100)
  }

  // ============================================
  // Step & Plan Actions
  // ============================================

  const toggleStep = async (planId: string, stepId: string) => {
    const plan = plans.find(p => p.id === planId)
    if (!plan || !user) return

    const wasCompleted = plan.steps.find(s => s.id === stepId)?.completed

    const updatedSteps = plan.steps.map(s =>
      s.id === stepId ? { ...s, completed: !s.completed } : s
    )

    const completedCount = updatedSteps.filter(s => s.completed).length
    const isNowComplete = completedCount === updatedSteps.length

    await supabase.from('focus_plans').update({
      steps: updatedSteps,
      steps_completed: completedCount,
      is_completed: isNowComplete,
    }).eq('id', planId).eq('user_id', user.id)

    onPlansUpdate()

    // Award XP when a step is checked (not unchecked)
    if (!wasCompleted) {
      setPulseStepId(stepId)
      setTimeout(() => setPulseStepId(null), 600)

      let xpGained = XP_VALUES.focus_step
      await awardXP('focus_step')
      if (isNowComplete) {
        xpGained += XP_VALUES.focus_plan_complete
        await awardXP('focus_plan_complete')
      }
      showXpToast(xpGained)
    }

    if (isNowComplete && plan.related_goal_id && plan.related_step_id) {
      setCompletedPlan({ ...plan, steps: updatedSteps })
      setShowCompletionModal(true)
    }
  }

  const handleGoalSync = async (shouldSync: boolean) => {
    if (!shouldSync || !completedPlan || !user) {
      setShowCompletionModal(false)
      setCompletedPlan(null)
      return
    }

    setSyncingGoal(true)

    try {
      const { related_goal_id, related_step_id } = completedPlan

      const { data: goalData, error: fetchError } = await supabase
        .from('goals')
        .select('*')
        .eq('id', related_goal_id)
        .eq('user_id', user.id)
        .single()

      if (fetchError || !goalData) {
        setShowCompletionModal(false)
        setCompletedPlan(null)
        setSyncingGoal(false)
        return
      }

      const updatedMicroSteps = (goalData.micro_steps || []).map((step: any) =>
        step.id === related_step_id ? { ...step, completed: true } : step
      )

      const completedStepCount = updatedMicroSteps.filter((s: any) => s.completed).length
      const totalSteps = updatedMicroSteps.length
      const newProgress = totalSteps > 0 ? Math.round((completedStepCount / totalSteps) * 100) : 0
      const isGoalComplete = newProgress >= 100

      const goalUpdate: any = {
        micro_steps: updatedMicroSteps,
        progress_percent: newProgress,
      }

      if (isGoalComplete) {
        goalUpdate.status = 'completed'
        goalUpdate.celebration_message = `You completed "${goalData.title}" by finishing all your focus sessions!`
      }

      await supabase
        .from('goals')
        .update(goalUpdate)
        .eq('id', related_goal_id)
        .eq('user_id', user.id)
    } catch (e) {
      console.error('Failed to sync goal:', e)
    }

    setShowCompletionModal(false)
    setCompletedPlan(null)
    setSyncingGoal(false)
    onPlansUpdate()
  }

  const deletePlan = (planId: string) => {
    const plan = plans.find(p => p.id === planId)
    if (!plan || !user) return
    setTaskMenuId(null)

    if (pendingDelete?.timer) clearTimeout(pendingDelete.timer)

    const timer = setTimeout(async () => {
      await supabase.from('focus_plans').delete().eq('id', planId).eq('user_id', user.id)
      setPendingDelete(null)
      onPlansUpdate()
    }, 5000)

    setPendingDelete({ type: 'plan', planId, label: plan.task_name, timer })
  }

  const startEditTask = (plan: Plan) => {
    setEditingTaskId(plan.id)
    setEditingTaskName(plan.task_name)
    setTaskMenuId(null)
  }

  const saveEditTask = async (planId: string) => {
    if (!user || !editingTaskName.trim()) return
    await supabase.from('focus_plans').update({
      task_name: editingTaskName.trim(),
    }).eq('id', planId).eq('user_id', user.id)
    setEditingTaskId(null)
    setEditingTaskName('')
    onPlansUpdate()
  }

  const cancelEditTask = () => {
    setEditingTaskId(null)
    setEditingTaskName('')
  }

  const deprioritizePlan = async (planId: string) => {
    if (!user) return
    await supabase.from('focus_plans').update({
      due_date: 'no_rush',
    }).eq('id', planId).eq('user_id', user.id)
    setTaskMenuId(null)
    onPlansUpdate()
  }

  const deleteStep = (planId: string, stepId: string) => {
    const plan = plans.find(p => p.id === planId)
    if (!plan || !user) return

    const step = plan.steps.find(s => s.id === stepId)
    if (pendingDelete?.timer) clearTimeout(pendingDelete.timer)

    const timer = setTimeout(async () => {
      const updatedSteps = plan.steps.filter(s => s.id !== stepId)
      const completedCount = updatedSteps.filter(s => s.completed).length

      await supabase.from('focus_plans').update({
        steps: updatedSteps,
        steps_completed: completedCount,
        total_steps: updatedSteps.length,
        is_completed: updatedSteps.length > 0 && completedCount === updatedSteps.length,
      }).eq('id', planId).eq('user_id', user.id)

      setPendingDelete(null)
      onPlansUpdate()
    }, 5000)

    setPendingDelete({ type: 'step', planId, stepId, label: step?.text || 'step', timer })
  }

  const undoDelete = () => {
    if (!pendingDelete) return
    clearTimeout(pendingDelete.timer)
    setPendingDelete(null)
  }

  const startEditStep = (planId: string, step: Step) => {
    setEditingStepKey(`${planId}:${step.id}`)
    setEditingStepText(step.text)
  }

  const saveEditStep = async (planId: string, stepId: string) => {
    const plan = plans.find(p => p.id === planId)
    if (!plan || !user || !editingStepText.trim()) return

    const updatedSteps = plan.steps.map(s =>
      s.id === stepId ? { ...s, text: editingStepText.trim() } : s
    )

    await supabase.from('focus_plans').update({
      steps: updatedSteps,
    }).eq('id', planId).eq('user_id', user.id)

    setEditingStepKey(null)
    setEditingStepText('')
    onPlansUpdate()
  }

  const cancelEditStep = () => {
    setEditingStepKey(null)
    setEditingStepText('')
  }

  const handleQuickCapture = async () => {
    const text = captureText.trim()
    if (!text || !user) return

    setCaptureText('')
    setShowCaptureToast(true)
    setTimeout(() => setShowCaptureToast(false), 2000)

    await supabase.from('focus_plans').insert({
      user_id: user.id,
      task_name: text,
      steps: [],
      steps_completed: 0,
      total_steps: 0,
      is_completed: false,
      due_date: 'no_rush',
      energy_required: 'low',
    })

    onPlansUpdate()
  }

  // ============================================
  // Render
  // ============================================

  return (
    <div className={`focus-page ${userMode === 'recovery' ? 'recovery-dimmed' : ''}`}>
      <UnifiedHeader subtitle="Focus" />

      <main className="main">
        <div className="page-header-title">
          <h1>⏱️ Focus Mode</h1>
        </div>

        <button onClick={onNewBrainDump} className="new-dump-btn">
          🧠 New Brain Dump
        </button>

        {sortedPlans.length === 0 ? (
          <div className="card empty-state">
            <span className="empty-emoji">🔨</span>
            <p className="empty-title">No active tasks</p>
            <p className="empty-subtitle">Do a brain dump to break down what&apos;s on your mind</p>
            <button onClick={onNewBrainDump} className="btn-primary">
              Start Brain Dump
            </button>
          </div>
        ) : (
          sortedPlans.map((plan) => {
            const done = plan.steps.filter(s => s.completed).length
            const total = plan.steps.length
            const pct = total > 0 ? Math.round((done / total) * 100) : 0
            const linkedGoalTitle = getGoalTitle(plan.related_goal_id || null)
            const dueDateLabel = getDueDateLabel(plan.due_date)
            const canDeprioritize = plan.due_date === 'today' || plan.due_date === 'tomorrow'
            const isMenuOpen = taskMenuId === plan.id

            return (
              <div key={plan.id} className="card task-card">
                <div className="task-top-row">
                  <div className="task-badges">
                    {linkedGoalTitle && (
                      <span className="linked-goal-badge">🎯 {linkedGoalTitle}</span>
                    )}
                    {dueDateLabel && (
                      <span className="due-badge">{dueDateLabel}</span>
                    )}
                  </div>
                  <div className="task-actions-wrapper">
                    <button
                      className="task-menu-btn"
                      onClick={() => setTaskMenuId(isMenuOpen ? null : plan.id)}
                      type="button"
                    >
                      ⋯
                    </button>
                    {isMenuOpen && (
                      <div className="task-action-menu">
                        <button className="action-item" onClick={() => startEditTask(plan)}>
                          ✏️ Edit name
                        </button>
                        {canDeprioritize && (
                          <button className="action-item" onClick={() => deprioritizePlan(plan.id)}>
                            🌊 Deprioritize
                          </button>
                        )}
                        <button className="action-item danger" onClick={() => deletePlan(plan.id)}>
                          🗑️ Delete task
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {isMenuOpen && (
                  <div className="action-menu-overlay" onClick={() => setTaskMenuId(null)} />
                )}

                <div className="task-header">
                  {editingTaskId === plan.id ? (
                    <div className="inline-edit">
                      <input
                        type="text"
                        value={editingTaskName}
                        onChange={(e) => setEditingTaskName(e.target.value)}
                        className="inline-edit-input"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditTask(plan.id)
                          if (e.key === 'Escape') cancelEditTask()
                        }}
                      />
                      <button className="inline-save" onClick={() => saveEditTask(plan.id)}>✓</button>
                      <button className="inline-cancel" onClick={cancelEditTask}>✕</button>
                    </div>
                  ) : (
                    <>
                      <p className="task-name">{plan.task_name}</p>
                      <span className="task-progress-text">{done}/{total}</span>
                    </>
                  )}
                </div>

                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>

                {/* Village Presence (Body Doubling) */}
                {onlineCount > 0 && (
                  <div className="village-presence">
                    <div className="village-dots">
                      {Array.from({ length: Math.min(onlineCount, 5) }).map((_, i) => (
                        <span key={i} className="village-dot" />
                      ))}
                    </div>
                    <span className="village-text">
                      {onlineCount} other{onlineCount !== 1 ? 's' : ''} focusing with you
                    </span>
                  </div>
                )}

                <button
                  className="stuck-btn"
                  onClick={() => {
                    setStuckTaskName(plan.task_name)
                    setShowStuckModal(true)
                  }}
                >
                  💜 Hitting a Wall
                </button>

                {plan.steps
                  .filter(s => !(pendingDelete?.type === 'step' && pendingDelete.planId === plan.id && pendingDelete.stepId === s.id))
                  .map((step) => {
                  const stepKey = `${plan.id}:${step.id}`
                  const isEditingThisStep = editingStepKey === stepKey

                  return (
                    <div key={step.id} className="step-item">
                      <div
                        className={`checkbox ${step.completed ? 'checked' : ''} ${pulseStepId === step.id ? 'step-pulse' : ''}`}
                        onClick={() => toggleStep(plan.id, step.id)}
                      >
                        {step.completed && '✓'}
                      </div>
                      <div className="step-content" onClick={() => { if (!isEditingThisStep) toggleStep(plan.id, step.id) }}>
                        {isEditingThisStep ? (
                          <div className="inline-edit">
                            <input
                              type="text"
                              value={editingStepText}
                              onChange={(e) => setEditingStepText(e.target.value)}
                              className="inline-edit-input"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditStep(plan.id, step.id)
                                if (e.key === 'Escape') cancelEditStep()
                              }}
                            />
                            <button className="inline-save" onClick={(e) => { e.stopPropagation(); saveEditStep(plan.id, step.id) }}>✓</button>
                            <button className="inline-cancel" onClick={(e) => { e.stopPropagation(); cancelEditStep() }}>✕</button>
                          </div>
                        ) : (
                          <>
                            <span className={`step-text ${step.completed ? 'completed' : ''}`}>
                              {step.text}
                            </span>
                            {step.dueBy && (
                              <span className="step-meta">{step.dueBy}{step.timeEstimate ? ` · ${step.timeEstimate}` : ''}</span>
                            )}
                          </>
                        )}
                      </div>
                      {!isEditingThisStep && (
                        <div className="step-actions">
                          <button
                            className="step-action-btn"
                            onClick={(e) => { e.stopPropagation(); startEditStep(plan.id, step) }}
                            title="Edit step"
                          >
                            ✏️
                          </button>
                          <button
                            className="step-action-btn delete"
                            onClick={(e) => { e.stopPropagation(); deleteStep(plan.id, step.id) }}
                            title="Delete step"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })
        )}
      </main>

      {/* Quick Ally (Stuck) Modal */}
      <QuickAllyModal
        taskName={stuckTaskName}
        isOpen={showStuckModal}
        onClose={() => setShowStuckModal(false)}
      />

      {/* Goal Sync Modal */}
      {showCompletionModal && completedPlan && (() => {
        const goalProgress = getGoalProgress(completedPlan.related_goal_id || null)
        const plantEmoji = getPlantEmoji(goalProgress)
        const plantScale = 1 + (goalProgress / 100) * 1.5

        return (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-icon">🎉</div>
              <h2 className="modal-title">Great work!</h2>
              <p className="modal-text">
                {onlineCount > 0
                  ? <>You and {onlineCount} other{onlineCount !== 1 ? 's' : ''} crushed it just now.</>
                  : <>You completed your focus session.</>}
                <br />
                <strong>Did this complete the step in your Goal?</strong>
              </p>
              {completedPlan.related_goal_id && (
                <>
                  <div className="modal-goal-badge">
                    🎯 {getGoalTitle(completedPlan.related_goal_id)}
                  </div>
                  <div className="modal-plant-viz">
                    <div className="modal-plant-emoji" style={{ fontSize: `${plantScale}rem` }}>
                      {plantEmoji}
                    </div>
                    <div className="modal-plant-bar">
                      <div className="modal-plant-fill" style={{ width: `${goalProgress}%` }} />
                    </div>
                    <span className="modal-plant-label">{goalProgress}% grown</span>
                  </div>
                </>
              )}
              <div className="modal-actions">
                <button
                  className="modal-btn secondary"
                  onClick={() => handleGoalSync(false)}
                  disabled={syncingGoal}
                >
                  Not yet
                </button>
                <button
                  className="modal-btn primary"
                  onClick={() => handleGoalSync(true)}
                  disabled={syncingGoal}
                >
                  {syncingGoal ? 'Syncing...' : 'Yes, mark complete!'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* XP Toast */}
      {gamPrefs.showXP && xpToast.visible && (
        <div className="xp-toast">+{xpToast.amount} XP</div>
      )}

      {/* Undo Delete Toast */}
      {pendingDelete && (
        <div className="undo-toast">
          <span className="undo-text">Deleted &ldquo;{pendingDelete.label}&rdquo;</span>
          <button onClick={undoDelete} className="undo-btn">Undo</button>
        </div>
      )}

      {/* Quick Capture (Parking Lot) */}
      <div className="quick-capture-bar">
        <span className="quick-capture-icon">📥</span>
        <input
          type="text"
          className="quick-capture-input"
          placeholder="Capture a stray thought..."
          value={captureText}
          onChange={(e) => setCaptureText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleQuickCapture() }}
          maxLength={200}
        />
        <button
          className="quick-capture-add"
          onClick={handleQuickCapture}
          disabled={captureText.trim().length === 0}
        >
          Add
        </button>
      </div>

      {/* Quick Capture Toast */}
      {showCaptureToast && (
        <div className="capture-toast">📥 Saved for later. Back to flow.</div>
      )}

      <style jsx>{`
        .focus-page {
          background: var(--bg-gray);
          min-height: 100vh;
          min-height: 100dvh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .focus-page.recovery-dimmed {
          filter: saturate(0.45) brightness(1.02);
        }

        .main {
          padding: clamp(12px, 4vw, 20px);
          padding-bottom: clamp(120px, 30vw, 160px);
          max-width: 600px;
          margin: 0 auto;
        }

        .page-header-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: clamp(14px, 4vw, 20px);
        }

        .page-header-title h1 {
          font-size: clamp(22px, 6vw, 28px);
          font-weight: 700;
          margin: 0;
        }

        .new-dump-btn {
          width: 100%;
          padding: clamp(12px, 3.5vw, 16px);
          background: white;
          border: 2px dashed var(--primary, #1D9BF0);
          border-radius: var(--card-radius, 16px);
          font-size: clamp(14px, 4vw, 17px);
          font-weight: 600;
          color: var(--primary, #1D9BF0);
          cursor: pointer;
          margin-bottom: clamp(14px, 4vw, 20px);
          transition: background 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .new-dump-btn:hover {
          background: rgba(29, 155, 240, 0.05);
        }

        .card {
          background: white;
          border-radius: var(--card-radius, 16px);
          padding: clamp(16px, 4.5vw, 24px);
          margin-bottom: clamp(12px, 3.5vw, 18px);
          box-shadow: var(--card-shadow, 0 1px 3px rgba(0, 0, 0, 0.08));
        }

        .empty-state {
          text-align: center;
          padding: clamp(30px, 8vw, 50px) clamp(16px, 4vw, 24px);
        }

        .empty-emoji {
          font-size: clamp(40px, 12vw, 60px);
          display: block;
          margin-bottom: clamp(12px, 3vw, 18px);
        }

        .empty-title {
          font-size: clamp(16px, 4.5vw, 20px);
          font-weight: 700;
          margin: 0 0 clamp(6px, 1.5vw, 10px) 0;
        }

        .empty-subtitle {
          font-size: clamp(13px, 3.5vw, 15px);
          color: var(--light-gray, #aab8c2);
          margin: 0 0 clamp(18px, 5vw, 28px) 0;
        }

        .btn-primary {
          padding: clamp(12px, 3vw, 16px) clamp(24px, 6vw, 36px);
          background: var(--primary, #1D9BF0);
          color: white;
          border: none;
          border-radius: 14px;
          font-size: clamp(14px, 4vw, 17px);
          font-weight: 600;
          cursor: pointer;
        }

        .task-top-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: clamp(10px, 3vw, 14px);
        }

        .task-badges {
          display: flex;
          flex-wrap: wrap;
          gap: clamp(6px, 1.5vw, 8px);
        }

        .linked-goal-badge {
          display: inline-flex;
          align-items: center;
          gap: clamp(4px, 1vw, 6px);
          padding: clamp(4px, 1vw, 6px) clamp(8px, 2vw, 12px);
          background: rgba(29, 155, 240, 0.08);
          border-radius: 100px;
          font-size: clamp(11px, 3vw, 13px);
          font-weight: 500;
          color: var(--primary, #1D9BF0);
          max-width: clamp(150px, 40vw, 200px);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .due-badge {
          display: inline-flex;
          padding: clamp(4px, 1vw, 6px) clamp(8px, 2vw, 12px);
          background: rgba(0, 186, 124, 0.08);
          border-radius: 100px;
          font-size: clamp(11px, 3vw, 13px);
          font-weight: 500;
          color: var(--success, #00ba7c);
        }

        .task-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: clamp(10px, 3vw, 14px);
        }

        .task-name {
          font-size: clamp(15px, 4vw, 18px);
          font-weight: 700;
          margin: 0;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .task-progress-text {
          font-size: clamp(12px, 3.2vw, 14px);
          color: var(--light-gray, #aab8c2);
          flex-shrink: 0;
          margin-left: clamp(8px, 2vw, 12px);
        }

        .progress-bar {
          height: clamp(6px, 1.5vw, 8px);
          background: var(--extra-light-gray, #eff3f4);
          border-radius: 100px;
          margin-bottom: clamp(12px, 3vw, 18px);
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: var(--success, #00ba7c);
          border-radius: 100px;
          transition: width 0.3s ease;
        }

        /* Village Presence */
        .village-presence {
          display: flex;
          align-items: center;
          gap: clamp(8px, 2vw, 12px);
          padding: clamp(8px, 2vw, 10px) clamp(10px, 2.5vw, 14px);
          background: rgba(29, 155, 240, 0.05);
          border: 1px solid rgba(29, 155, 240, 0.12);
          border-radius: var(--card-radius, 16px);
          margin-bottom: clamp(10px, 2.5vw, 14px);
        }

        .village-dots {
          display: flex;
          gap: 3px;
          flex-shrink: 0;
        }

        .village-dot {
          width: clamp(8px, 2vw, 10px);
          height: clamp(8px, 2vw, 10px);
          border-radius: 50%;
          background: #00ba7c;
        }

        .village-text {
          flex: 1;
          font-size: clamp(12px, 3.2vw, 14px);
          font-weight: 500;
          color: var(--dark-gray, #657786);
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .stuck-btn {
          width: 100%;
          padding: clamp(10px, 2.5vw, 12px);
          background: rgba(128, 90, 213, 0.06);
          border: 1px dashed rgba(128, 90, 213, 0.3);
          border-radius: var(--card-radius, 16px);
          font-size: clamp(13px, 3.5vw, 15px);
          font-weight: 600;
          color: #805ad5;
          cursor: pointer;
          margin-bottom: clamp(12px, 3vw, 18px);
          transition: background 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .stuck-btn:hover {
          background: rgba(128, 90, 213, 0.12);
          border-color: rgba(128, 90, 213, 0.5);
        }

        .step-item {
          display: flex;
          align-items: flex-start;
          gap: clamp(10px, 3vw, 14px);
          padding: clamp(10px, 3vw, 14px) 0;
          border-bottom: 1px solid var(--extra-light-gray, #eff3f4);
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .step-item:last-child { border-bottom: none; }

        .checkbox {
          position: relative;
          width: clamp(20px, 5.5vw, 26px);
          height: clamp(20px, 5.5vw, 26px);
          border-radius: 50%;
          border: 2px solid var(--light-gray, #aab8c2);
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: clamp(12px, 3vw, 14px);
          flex-shrink: 0;
          transition: all 0.2s ease;
          margin-top: 2px;
        }

        .checkbox.checked {
          border: none;
          background: var(--success, #00ba7c);
        }

        .checkbox.step-pulse {
          animation: checkPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes checkPop {
          0% { transform: scale(1); }
          40% { transform: scale(1.35); }
          100% { transform: scale(1); }
        }

        .step-content {
          flex: 1;
          min-width: 0;
        }

        .step-text {
          display: block;
          font-size: clamp(14px, 3.8vw, 16px);
          color: var(--dark-gray, #657786);
          word-wrap: break-word;
          line-height: 1.4;
        }

        .step-text.completed {
          text-decoration: line-through;
          color: var(--light-gray, #aab8c2);
        }

        .step-meta {
          display: block;
          font-size: clamp(11px, 3vw, 13px);
          color: var(--light-gray, #aab8c2);
          margin-top: 2px;
        }

        /* Task Action Menu */
        .task-actions-wrapper {
          position: relative;
          flex-shrink: 0;
        }

        .task-menu-btn {
          background: none;
          border: none;
          font-size: clamp(18px, 5vw, 22px);
          color: var(--light-gray, #aab8c2);
          cursor: pointer;
          padding: clamp(4px, 1vw, 6px) clamp(6px, 1.5vw, 10px);
          border-radius: 8px;
          line-height: 1;
          letter-spacing: 2px;
          transition: background 0.15s ease;
        }

        .task-menu-btn:hover {
          background: var(--extra-light-gray, #eff3f4);
          color: var(--dark-gray, #657786);
        }

        .task-action-menu {
          position: absolute;
          top: 100%;
          right: 0;
          background: white;
          border-radius: var(--card-radius, 16px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          padding: clamp(4px, 1vw, 6px);
          min-width: clamp(140px, 40vw, 180px);
          z-index: 50;
        }

        .action-item {
          display: block;
          width: 100%;
          padding: clamp(8px, 2.5vw, 12px) clamp(10px, 3vw, 14px);
          text-align: left;
          background: none;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: clamp(13px, 3.5vw, 15px);
          color: var(--dark-gray, #657786);
          transition: background 0.1s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .action-item:hover {
          background: var(--bg-gray, #f5f8fa);
        }

        .action-item.danger {
          color: var(--danger, #f4212e);
        }

        .action-menu-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 49;
        }

        /* Inline Editing */
        .inline-edit {
          display: flex;
          align-items: center;
          gap: clamp(6px, 1.5vw, 8px);
          width: 100%;
        }

        .inline-edit-input {
          flex: 1;
          padding: clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px);
          border: 2px solid var(--primary, #1D9BF0);
          border-radius: 8px;
          font-size: clamp(14px, 3.8vw, 16px);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          min-width: 0;
        }

        .inline-edit-input:focus {
          outline: none;
        }

        .inline-save {
          width: clamp(28px, 7vw, 34px);
          height: clamp(28px, 7vw, 34px);
          border: none;
          background: var(--success, #00ba7c);
          color: white;
          border-radius: 50%;
          font-size: clamp(12px, 3vw, 14px);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .inline-cancel {
          width: clamp(28px, 7vw, 34px);
          height: clamp(28px, 7vw, 34px);
          border: none;
          background: var(--extra-light-gray, #eff3f4);
          color: var(--dark-gray, #657786);
          border-radius: 50%;
          font-size: clamp(12px, 3vw, 14px);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        /* Step Actions */
        .step-actions {
          display: flex;
          gap: clamp(2px, 0.5vw, 4px);
          flex-shrink: 0;
          opacity: 0.4;
          transition: opacity 0.15s ease;
        }

        .step-item:hover .step-actions {
          opacity: 1;
        }

        .step-action-btn {
          width: clamp(26px, 6.5vw, 30px);
          height: clamp(26px, 6.5vw, 30px);
          border: none;
          background: none;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: clamp(12px, 3vw, 14px);
          transition: background 0.15s ease;
        }

        .step-action-btn:hover {
          background: var(--extra-light-gray, #eff3f4);
        }

        .step-action-btn.delete {
          font-size: clamp(16px, 4vw, 20px);
          color: var(--danger, #f4212e);
        }

        .step-action-btn.delete:hover {
          background: rgba(244, 33, 46, 0.1);
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: clamp(16px, 4vw, 24px);
        }

        .modal-card {
          background: white;
          border-radius: var(--card-radius, 16px);
          padding: clamp(24px, 6vw, 36px);
          max-width: 400px;
          width: 100%;
          text-align: center;
        }

        .modal-icon { font-size: clamp(48px, 14vw, 64px); margin-bottom: clamp(12px, 3vw, 18px); }
        .modal-title { font-size: clamp(20px, 5.5vw, 26px); font-weight: 700; margin: 0 0 clamp(8px, 2vw, 12px) 0; }
        .modal-text { font-size: clamp(14px, 3.8vw, 16px); color: var(--dark-gray, #657786); line-height: 1.5; margin: 0 0 clamp(16px, 4vw, 22px) 0; }
        .modal-goal-badge {
          display: inline-block;
          padding: clamp(8px, 2vw, 12px) clamp(14px, 3.5vw, 20px);
          background: rgba(29, 155, 240, 0.08);
          border-radius: 100px;
          font-size: clamp(13px, 3.5vw, 15px);
          font-weight: 500;
          color: var(--primary, #1D9BF0);
          margin-bottom: clamp(18px, 5vw, 26px);
        }

        .modal-actions { display: flex; gap: clamp(10px, 3vw, 14px); }

        .modal-btn {
          flex: 1;
          padding: clamp(12px, 3.5vw, 16px);
          border-radius: 14px;
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .modal-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .modal-btn.secondary { background: var(--bg-gray, #f5f8fa); border: none; color: var(--dark-gray, #657786); }
        .modal-btn.primary { background: var(--success, #00ba7c); border: none; color: white; }
        .modal-btn.primary:hover:not(:disabled) { background: #00a06a; }

        /* Plant Visualization */
        .modal-plant-viz {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(6px, 1.5vw, 10px);
          margin-bottom: clamp(18px, 5vw, 26px);
        }

        .modal-plant-bar {
          width: clamp(120px, 40vw, 180px);
          height: 8px;
          background: var(--extra-light-gray, #eff3f4);
          border-radius: 100px;
          overflow: hidden;
        }

        .modal-plant-fill {
          height: 100%;
          background: linear-gradient(90deg, #00ba7c 0%, #059669 100%);
          border-radius: 100px;
          transition: width 0.6s ease;
        }

        .modal-plant-label {
          font-size: clamp(11px, 3vw, 13px);
          color: var(--light-gray, #aab8c2);
          font-weight: 500;
        }

        /* XP Toast */
        .xp-toast {
          position: fixed;
          bottom: clamp(80px, 20vw, 100px);
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, #00ba7c 0%, #059669 100%);
          color: white;
          padding: clamp(8px, 2vw, 12px) clamp(16px, 4vw, 24px);
          border-radius: 100px;
          font-size: clamp(14px, 3.8vw, 17px);
          font-weight: 700;
          z-index: 950;
          box-shadow: 0 4px 14px rgba(0, 186, 124, 0.4);
        }

        /* Undo Delete Toast */
        .undo-toast {
          position: fixed;
          bottom: clamp(80px, 20vw, 100px);
          left: 50%;
          transform: translateX(-50%);
          background: #1f2937;
          color: white;
          padding: clamp(10px, 2.5vw, 14px) clamp(14px, 3.5vw, 20px);
          border-radius: var(--card-radius, 16px);
          display: flex;
          align-items: center;
          gap: clamp(10px, 2.5vw, 14px);
          z-index: 960;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          max-width: clamp(280px, 80vw, 400px);
        }

        .undo-text {
          font-size: clamp(13px, 3.5vw, 15px);
          font-weight: 500;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .undo-btn {
          padding: clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 16px);
          background: rgba(29, 155, 240, 0.2);
          color: #60a5fa;
          border: none;
          border-radius: 8px;
          font-size: clamp(13px, 3.5vw, 15px);
          font-weight: 700;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .undo-btn:hover {
          background: rgba(29, 155, 240, 0.35);
        }

        /* Quick Capture */
        .quick-capture-bar {
          position: fixed;
          bottom: calc(56px + env(safe-area-inset-bottom, 0px));
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          gap: clamp(8px, 2vw, 12px);
          padding: clamp(10px, 2.5vw, 14px) clamp(12px, 3vw, 18px);
          background: white;
          border-top: 1px solid var(--extra-light-gray, #eff3f4);
          box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.06);
          z-index: 85;
        }

        .quick-capture-icon {
          font-size: clamp(18px, 5vw, 22px);
          flex-shrink: 0;
          opacity: 0.7;
        }

        .quick-capture-input {
          flex: 1;
          padding: clamp(8px, 2vw, 10px) clamp(10px, 2.5vw, 14px);
          border: 1.5px solid var(--extra-light-gray, #eff3f4);
          border-radius: 12px;
          font-size: clamp(13px, 3.5vw, 15px);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: var(--bg-gray, #f5f8fa);
          color: #0f1419;
          min-width: 0;
          transition: border-color 0.15s ease;
        }

        .quick-capture-input:focus {
          outline: none;
          border-color: var(--light-gray, #aab8c2);
          background: white;
        }

        .quick-capture-input::placeholder {
          color: var(--light-gray, #aab8c2);
          font-style: italic;
        }

        .quick-capture-add {
          padding: clamp(8px, 2vw, 10px) clamp(14px, 3.5vw, 18px);
          background: var(--extra-light-gray, #eff3f4);
          border: none;
          border-radius: 12px;
          font-size: clamp(13px, 3.5vw, 15px);
          font-weight: 600;
          color: var(--dark-gray, #657786);
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.15s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .quick-capture-add:hover:not(:disabled) {
          background: var(--primary, #1D9BF0);
          color: white;
        }

        .quick-capture-add:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .capture-toast {
          position: fixed;
          bottom: clamp(120px, 30vw, 150px);
          left: 50%;
          transform: translateX(-50%);
          background: #1f2937;
          color: white;
          padding: clamp(8px, 2vw, 12px) clamp(16px, 4vw, 24px);
          border-radius: 100px;
          font-size: clamp(13px, 3.5vw, 15px);
          font-weight: 600;
          z-index: 950;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
          white-space: nowrap;
        }

        @media (min-width: 768px) {
          .main { padding: 24px; padding-bottom: 160px; }
          .step-item:hover {
            background: var(--bg-gray, #f5f8fa);
            margin: 0 -24px;
            padding-left: 24px;
            padding-right: 24px;
          }
        }

        @media (min-width: 1024px) {
          .main { max-width: 680px; }
        }
      `}</style>

    </div>
  )
}
