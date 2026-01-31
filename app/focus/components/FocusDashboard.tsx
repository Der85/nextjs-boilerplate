'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BottomNav from '@/components/BottomNav'

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
  onNewBrainDump: () => void
  onPlansUpdate: () => void
}

export default function FocusDashboard({
  plans,
  goals,
  user,
  onlineCount,
  onNewBrainDump,
  onPlansUpdate,
}: FocusDashboardProps) {
  const router = useRouter()
  const [showMenu, setShowMenu] = useState(false)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [completedPlan, setCompletedPlan] = useState<Plan | null>(null)
  const [syncingGoal, setSyncingGoal] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)

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

  const toggleStep = async (planId: string, stepId: string) => {
    const plan = plans.find(p => p.id === planId)
    if (!plan || !user) return

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

      if (isGoalComplete) {
        setShowCelebration(true)
        setTimeout(() => setShowCelebration(false), 4000)
      }
    } catch (e) {
      console.error('Failed to sync goal:', e)
    }

    setShowCompletionModal(false)
    setCompletedPlan(null)
    setSyncingGoal(false)
    onPlansUpdate()
  }

  return (
    <div className="focus-page">
      {/* Header */}
      <header className="header">
        <button onClick={() => router.push('/dashboard')} className="logo">
          ADHDer.io
        </button>
        <div className="header-actions">
          <div className="village-pill">
            <span className="presence-dot" />
            <span className="presence-count">{onlineCount} online</span>
          </div>
          <button onClick={() => router.push('/ally')} className="icon-btn purple" title="I'm stuck">
            💜
          </button>
          <button onClick={() => router.push('/brake')} className="icon-btn red" title="Need to pause">
            🛑
          </button>
          <button onClick={() => setShowMenu(!showMenu)} className="icon-btn menu">
            ☰
          </button>
        </div>

        {showMenu && (
          <div className="dropdown-menu">
            <button onClick={() => { router.push('/dashboard'); setShowMenu(false) }} className="menu-item">
              🏠 Dashboard
            </button>
            <button onClick={() => setShowMenu(false)} className="menu-item active">
              ⏱️ Focus Mode
            </button>
            <button onClick={() => { router.push('/goals'); setShowMenu(false) }} className="menu-item">
              🎯 Goals
            </button>
            <button onClick={() => { router.push('/burnout'); setShowMenu(false) }} className="menu-item">
              ⚡ Energy Tracker
            </button>
            <button onClick={() => { router.push('/village'); setShowMenu(false) }} className="menu-item">
              👥 My Village
            </button>
            <div className="menu-divider" />
            <button
              onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
              className="menu-item logout"
            >
              Log out
            </button>
          </div>
        )}
      </header>

      {showMenu && <div className="menu-overlay" onClick={() => setShowMenu(false)} />}

      <main className="main">
        <div className="page-header-title">
          <h1>⏱️ Focus Mode</h1>
        </div>

        <button onClick={onNewBrainDump} className="new-dump-btn">
          🧠 New Brain Dump
        </button>

        {plans.length === 0 ? (
          <div className="card empty-state">
            <span className="empty-emoji">🔨</span>
            <p className="empty-title">No active tasks</p>
            <p className="empty-subtitle">Do a brain dump to break down what&apos;s on your mind</p>
            <button onClick={onNewBrainDump} className="btn-primary">
              Start Brain Dump
            </button>
          </div>
        ) : (
          plans.map((plan) => {
            const done = plan.steps.filter(s => s.completed).length
            const total = plan.steps.length
            const pct = total > 0 ? Math.round((done / total) * 100) : 0
            const linkedGoalTitle = getGoalTitle(plan.related_goal_id || null)
            const dueDateLabel = getDueDateLabel(plan.due_date)

            return (
              <div key={plan.id} className="card task-card">
                <div className="task-badges">
                  {linkedGoalTitle && (
                    <span className="linked-goal-badge">🎯 {linkedGoalTitle}</span>
                  )}
                  {dueDateLabel && (
                    <span className="due-badge">{dueDateLabel}</span>
                  )}
                </div>

                <div className="task-header">
                  <p className="task-name">{plan.task_name}</p>
                  <span className="task-progress-text">{done}/{total}</span>
                </div>

                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>

                {plan.steps.map((step) => (
                  <div
                    key={step.id}
                    onClick={() => toggleStep(plan.id, step.id)}
                    className="step-item"
                  >
                    <div className={`checkbox ${step.completed ? 'checked' : ''}`}>
                      {step.completed && '✓'}
                    </div>
                    <div className="step-content">
                      <span className={`step-text ${step.completed ? 'completed' : ''}`}>
                        {step.text}
                      </span>
                      {step.dueBy && (
                        <span className="step-meta">{step.dueBy}{step.timeEstimate ? ` · ${step.timeEstimate}` : ''}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          })
        )}
      </main>

      <BottomNav />

      {/* Goal Sync Modal */}
      {showCompletionModal && completedPlan && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-icon">🎉</div>
            <h2 className="modal-title">Great work!</h2>
            <p className="modal-text">
              You completed your focus session.
              <br />
              <strong>Did this complete the step in your Goal?</strong>
            </p>
            {completedPlan.related_goal_id && (
              <div className="modal-goal-badge">
                🎯 {getGoalTitle(completedPlan.related_goal_id)}
              </div>
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
      )}

      {/* Celebration */}
      {showCelebration && (
        <div className="celebration-overlay">
          <div className="celebration-content">
            <div className="celebration-emoji">🌸</div>
            <h2 className="celebration-title">Goal Complete!</h2>
            <p className="celebration-text">
              Your goal has bloomed! All steps are done.
            </p>
            <div className="confetti">
              {[...Array(20)].map((_, i) => (
                <span key={i} className="confetti-piece" style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  backgroundColor: ['#f4212e', '#1D9BF0', '#00ba7c', '#ffad1f', '#805ad5'][i % 5],
                }} />
              ))}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .focus-page {
          --primary: #1D9BF0;
          --success: #00ba7c;
          --danger: #f4212e;
          --bg-gray: #f7f9fa;
          --dark-gray: #536471;
          --light-gray: #8899a6;
          --extra-light-gray: #eff3f4;
          background: var(--bg-gray);
          min-height: 100vh;
          min-height: 100dvh;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .header {
          position: sticky;
          top: 0;
          background: white;
          border-bottom: 1px solid #eee;
          padding: clamp(10px, 2.5vw, 14px) clamp(12px, 4vw, 20px);
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 100;
        }

        .logo {
          background: none;
          border: none;
          cursor: pointer;
          font-size: clamp(16px, 4vw, 20px);
          font-weight: 800;
          color: var(--primary);
        }

        .header-actions {
          display: flex;
          gap: clamp(6px, 2vw, 10px);
        }

        .icon-btn {
          width: clamp(32px, 8vw, 42px);
          height: clamp(32px, 8vw, 42px);
          border-radius: 50%;
          border: none;
          cursor: pointer;
          font-size: clamp(14px, 3.5vw, 18px);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .icon-btn.purple { background: rgba(128, 90, 213, 0.1); }
        .icon-btn.red { background: rgba(239, 68, 68, 0.1); }
        .icon-btn.menu {
          background: white;
          border: 1px solid #ddd;
          font-size: clamp(12px, 3vw, 16px);
        }

        .village-pill {
          display: flex;
          align-items: center;
          gap: clamp(5px, 1.5vw, 8px);
          padding: clamp(4px, 1.2vw, 6px) clamp(8px, 2.5vw, 12px);
          background: rgba(0, 186, 124, 0.08);
          border: 1px solid rgba(0, 186, 124, 0.2);
          border-radius: 100px;
        }

        .presence-dot {
          width: clamp(6px, 1.8vw, 8px);
          height: clamp(6px, 1.8vw, 8px);
          background: var(--success);
          border-radius: 50%;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(0, 186, 124, 0.4); }
          50% { opacity: 0.6; box-shadow: 0 0 0 4px rgba(0, 186, 124, 0); }
        }

        .presence-count {
          font-size: clamp(10px, 2.8vw, 12px);
          font-weight: 600;
          color: var(--success);
        }

        .dropdown-menu {
          position: absolute;
          top: clamp(50px, 12vw, 60px);
          right: clamp(12px, 4vw, 20px);
          background: white;
          border-radius: clamp(10px, 2.5vw, 14px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          padding: clamp(6px, 1.5vw, 10px);
          min-width: clamp(140px, 40vw, 180px);
          z-index: 200;
        }

        .menu-item {
          display: block;
          width: 100%;
          padding: clamp(8px, 2.5vw, 12px) clamp(10px, 3vw, 14px);
          text-align: left;
          background: none;
          border: none;
          border-radius: clamp(6px, 1.5vw, 10px);
          cursor: pointer;
          font-size: clamp(13px, 3.5vw, 15px);
          color: var(--dark-gray);
        }

        .menu-item:hover, .menu-item.active { background: var(--bg-gray); }
        .menu-item.logout { color: #ef4444; }
        .menu-divider { border-top: 1px solid #eee; margin: 8px 0; }
        .menu-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 99;
        }

        .main {
          padding: clamp(12px, 4vw, 20px);
          padding-bottom: clamp(80px, 20vw, 110px);
          max-width: 600px;
          margin: 0 auto;
        }

        .page-header-title {
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
          border: 2px dashed #1D9BF0;
          border-radius: clamp(12px, 3vw, 16px);
          font-size: clamp(14px, 4vw, 17px);
          font-weight: 600;
          color: #1D9BF0;
          cursor: pointer;
          margin-bottom: clamp(14px, 4vw, 20px);
          transition: all 0.2s ease;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .new-dump-btn:hover {
          background: rgba(29, 155, 240, 0.05);
        }

        .card {
          background: white;
          border-radius: clamp(14px, 4vw, 20px);
          padding: clamp(16px, 4.5vw, 24px);
          margin-bottom: clamp(12px, 3.5vw, 18px);
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
          color: var(--light-gray);
          margin: 0 0 clamp(18px, 5vw, 28px) 0;
        }

        .btn-primary {
          padding: clamp(12px, 3vw, 16px) clamp(24px, 6vw, 36px);
          background: var(--primary);
          color: white;
          border: none;
          border-radius: clamp(10px, 2.5vw, 14px);
          font-size: clamp(14px, 4vw, 17px);
          font-weight: 600;
          cursor: pointer;
        }

        .task-badges {
          display: flex;
          flex-wrap: wrap;
          gap: clamp(6px, 1.5vw, 8px);
          margin-bottom: clamp(10px, 3vw, 14px);
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
          color: var(--primary);
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
          color: var(--success);
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
          color: var(--light-gray);
          flex-shrink: 0;
          margin-left: clamp(8px, 2vw, 12px);
        }

        .progress-bar {
          height: clamp(6px, 1.5vw, 8px);
          background: var(--extra-light-gray);
          border-radius: 100px;
          margin-bottom: clamp(12px, 3vw, 18px);
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: var(--success);
          border-radius: 100px;
          transition: width 0.3s ease;
        }

        .step-item {
          display: flex;
          align-items: flex-start;
          gap: clamp(10px, 3vw, 14px);
          padding: clamp(10px, 3vw, 14px) 0;
          border-bottom: 1px solid var(--extra-light-gray);
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .step-item:last-child { border-bottom: none; }

        .checkbox {
          width: clamp(20px, 5.5vw, 26px);
          height: clamp(20px, 5.5vw, 26px);
          border-radius: 50%;
          border: 2px solid var(--light-gray);
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
          background: var(--success);
        }

        .step-content {
          flex: 1;
          min-width: 0;
        }

        .step-text {
          display: block;
          font-size: clamp(14px, 3.8vw, 16px);
          color: var(--dark-gray);
          word-wrap: break-word;
          line-height: 1.4;
        }

        .step-text.completed {
          text-decoration: line-through;
          color: var(--light-gray);
        }

        .step-meta {
          display: block;
          font-size: clamp(11px, 3vw, 13px);
          color: var(--light-gray);
          margin-top: 2px;
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
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal-card {
          background: white;
          border-radius: clamp(16px, 4vw, 24px);
          padding: clamp(24px, 6vw, 36px);
          max-width: 400px;
          width: 100%;
          text-align: center;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .modal-icon { font-size: clamp(48px, 14vw, 64px); margin-bottom: clamp(12px, 3vw, 18px); }
        .modal-title { font-size: clamp(20px, 5.5vw, 26px); font-weight: 700; margin: 0 0 clamp(8px, 2vw, 12px) 0; }
        .modal-text { font-size: clamp(14px, 3.8vw, 16px); color: var(--dark-gray); line-height: 1.5; margin: 0 0 clamp(16px, 4vw, 22px) 0; }
        .modal-goal-badge {
          display: inline-block;
          padding: clamp(8px, 2vw, 12px) clamp(14px, 3.5vw, 20px);
          background: rgba(29, 155, 240, 0.08);
          border-radius: 100px;
          font-size: clamp(13px, 3.5vw, 15px);
          font-weight: 500;
          color: var(--primary);
          margin-bottom: clamp(18px, 5vw, 26px);
        }

        .modal-actions { display: flex; gap: clamp(10px, 3vw, 14px); }

        .modal-btn {
          flex: 1;
          padding: clamp(12px, 3.5vw, 16px);
          border-radius: clamp(10px, 2.5vw, 14px);
          font-size: clamp(14px, 3.8vw, 16px);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .modal-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .modal-btn.secondary { background: var(--bg-gray); border: none; color: var(--dark-gray); }
        .modal-btn.primary { background: var(--success); border: none; color: white; }
        .modal-btn.primary:hover:not(:disabled) { background: #00a06a; }

        /* Celebration */
        .celebration-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
          animation: fadeIn 0.3s ease;
          overflow: hidden;
        }

        .celebration-content { text-align: center; position: relative; z-index: 10; }
        .celebration-emoji { font-size: clamp(72px, 20vw, 100px); animation: bounce 0.6s ease infinite alternate; }

        @keyframes bounce {
          from { transform: translateY(0); }
          to { transform: translateY(-15px); }
        }

        .celebration-title { font-size: clamp(28px, 8vw, 40px); font-weight: 800; color: white; margin: clamp(12px, 3vw, 20px) 0 clamp(8px, 2vw, 12px) 0; }
        .celebration-text { font-size: clamp(16px, 4.5vw, 20px); color: rgba(255, 255, 255, 0.9); margin: 0; }

        .confetti { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; overflow: hidden; }
        .confetti-piece {
          position: absolute;
          width: clamp(8px, 2vw, 12px);
          height: clamp(8px, 2vw, 12px);
          border-radius: 2px;
          top: -20px;
          animation: confettiFall 3s ease-in-out infinite;
        }

        @keyframes confettiFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }

        @media (min-width: 768px) {
          .main { padding: 24px; padding-bottom: 120px; }
          .step-item:hover {
            background: var(--bg-gray);
            margin: 0 -24px;
            padding-left: 24px;
            padding-right: 24px;
          }
        }

        @media (min-width: 1024px) {
          .header { padding: 16px 32px; }
          .main { max-width: 680px; }
        }
      `}</style>
    </div>
  )
}
