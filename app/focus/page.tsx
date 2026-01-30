'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Step {
  id: string
  text: string
  completed: boolean
}

// Phase 1: Updated Plan interface with goal linking fields
interface Plan {
  id: string
  task_name: string
  steps: Step[]
  created_at: string
  related_goal_id?: string | null    // Links to goals.id
  related_step_id?: string | null    // Tracks which micro-step from the goal
}

// Phase 1: Goal interface for fetching available goals
interface Goal {
  id: string
  title: string
  micro_steps: Array<{ id: string; text: string; completed: boolean }>
}

export default function FocusPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'list' | 'create'>('list')
  const [plans, setPlans] = useState<Plan[]>([])
  const [taskName, setTaskName] = useState('')
  const [steps, setSteps] = useState<string[]>(['', '', ''])
  const [showMenu, setShowMenu] = useState(false)
  
  // Phase 1: Goal linking state
  const [goals, setGoals] = useState<Goal[]>([])
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  
  // Phase 1: Random online count for Village presence
  const [onlineCount] = useState(() => Math.floor(Math.random() * 51))

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)
      await fetchPlans(session.user.id)
      await fetchGoals(session.user.id) // Phase 1: Fetch goals for linking
      setLoading(false)
    }
    init()
  }, [router])

  const fetchPlans = async (userId: string) => {
    const { data } = await supabase
      .from('focus_plans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (data) setPlans(data.map(p => ({ 
      ...p, 
      steps: p.steps || [],
      related_goal_id: p.related_goal_id || null,
      related_step_id: p.related_step_id || null
    })))
  }

  // Phase 1: Fetch user's goals for the dropdown
  const fetchGoals = async (userId: string) => {
    const { data } = await supabase
      .from('goals')
      .select('id, title, micro_steps')
      .eq('user_id', userId)
      .eq('is_completed', false)
      .order('created_at', { ascending: false })
      .limit(20)

    if (data) setGoals(data.map(g => ({
      ...g,
      micro_steps: g.micro_steps || []
    })))
  }

  const addStep = () => setSteps([...steps, ''])

  const updateStep = (i: number, val: string) => {
    const newSteps = [...steps]
    newSteps[i] = val
    setSteps(newSteps)
  }

  const removeStep = (i: number) => {
    if (steps.length > 1) setSteps(steps.filter((_, idx) => idx !== i))
  }

  // Phase 1: Handle goal selection - auto-populate task name and steps
  const handleGoalSelect = (goalId: string | null) => {
    setSelectedGoalId(goalId)
    setSelectedStepId(null)
    
    if (goalId) {
      const goal = goals.find(g => g.id === goalId)
      if (goal) {
        // Auto-populate task name from goal title
        setTaskName(goal.title)
      }
    }
  }

  // Phase 1: Handle step selection from goal
  const handleStepSelect = (stepId: string | null) => {
    setSelectedStepId(stepId)
    
    if (stepId && selectedGoalId) {
      const goal = goals.find(g => g.id === selectedGoalId)
      if (goal) {
        const step = goal.micro_steps.find(s => s.id === stepId)
        if (step) {
          // Auto-populate task name from the selected step
          setTaskName(step.text)
        }
      }
    }
  }

  const handleCreate = async () => {
    if (!user || !taskName.trim()) return
    const validSteps = steps.filter(s => s.trim())
    if (validSteps.length === 0) return

    setSaving(true)

    const stepsData = validSteps.map((text, i) => ({
      id: `step-${i}`,
      text,
      completed: false
    }))

    // Phase 1: Include goal linking fields in insert
    await supabase.from('focus_plans').insert({
      user_id: user.id,
      task_name: taskName,
      steps: stepsData,
      steps_completed: 0,
      total_steps: stepsData.length,
      is_completed: false,
      related_goal_id: selectedGoalId || null,
      related_step_id: selectedStepId || null
    })

    // Reset form
    setTaskName('')
    setSteps(['', '', ''])
    setSelectedGoalId(null)
    setSelectedStepId(null)
    setView('list')
    
    if (user) await fetchPlans(user.id)
    setSaving(false)
  }

  const toggleStep = async (planId: string, stepId: string) => {
    const plan = plans.find(p => p.id === planId)
    if (!plan) return

    const updatedSteps = plan.steps.map(s =>
      s.id === stepId ? { ...s, completed: !s.completed } : s
    )

    const completedCount = updatedSteps.filter(s => s.completed).length

    if (!user) return

    await supabase.from('focus_plans').update({
      steps: updatedSteps,
      steps_completed: completedCount,
      is_completed: completedCount === updatedSteps.length
    }).eq('id', planId).eq('user_id', user.id)

    await fetchPlans(user.id)
  }

  // Phase 1: Get goal title for display
  const getGoalTitle = (goalId: string | null) => {
    if (!goalId) return null
    const goal = goals.find(g => g.id === goalId)
    return goal?.title || null
  }

  if (loading) {
    return (
      <div className="focus-page">
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    )
  }

  return (
    <div className="focus-page">
      {/* Header - Consistent with Dashboard */}
      <header className="header">
        <button onClick={() => router.push('/dashboard')} className="logo">
          ADHDer.io
        </button>
        <div className="header-actions">
          {/* Village Presence Indicator */}
          <div className="village-pill">
            <span className="presence-dot"></span>
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
            <button onClick={() => { setShowMenu(false) }} className="menu-item active">
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
        {/* Page Title */}
        <div className="page-header-title">
          <h1>⏱️ Break it down</h1>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab ${view === 'list' ? 'active' : ''}`}
            onClick={() => setView('list')}
          >
            My tasks
          </button>
          <button
            className={`tab ${view === 'create' ? 'active' : ''}`}
            onClick={() => setView('create')}
          >
            New task
          </button>
        </div>

        {/* Create View */}
        {view === 'create' && (
          <div className="card create-card">
            {/* Phase 1: Link to Goal (optional) */}
            {goals.length > 0 && (
              <>
                <p className="label">Link to a goal <span className="optional">(optional)</span></p>
                <select
                  value={selectedGoalId || ''}
                  onChange={(e) => handleGoalSelect(e.target.value || null)}
                  className="select-input"
                >
                  <option value="">No goal - standalone task</option>
                  {goals.map(goal => (
                    <option key={goal.id} value={goal.id}>
                      🎯 {goal.title}
                    </option>
                  ))}
                </select>

                {/* Phase 1: Select specific step from goal */}
                {selectedGoalId && (
                  <>
                    <p className="label sub-label">Working on which step?</p>
                    <select
                      value={selectedStepId || ''}
                      onChange={(e) => handleStepSelect(e.target.value || null)}
                      className="select-input"
                    >
                      <option value="">General progress on goal</option>
                      {goals.find(g => g.id === selectedGoalId)?.micro_steps
                        .filter(s => !s.completed)
                        .map(step => (
                          <option key={step.id} value={step.id}>
                            {step.text}
                          </option>
                        ))}
                    </select>
                  </>
                )}
              </>
            )}

            <p className="label">What's the task?</p>
            <input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="e.g., Clean my room"
              className="text-input"
            />

            <p className="label">Break it into steps:</p>
            {steps.map((step, i) => (
              <div key={i} className="step-row">
                <span className="step-number">{i + 1}.</span>
                <input
                  type="text"
                  value={step}
                  onChange={(e) => updateStep(i, e.target.value)}
                  placeholder={`Step ${i + 1}`}
                  className="text-input step-input"
                />
                {steps.length > 1 && (
                  <button onClick={() => removeStep(i)} className="remove-btn">×</button>
                )}
              </div>
            ))}

            <button onClick={addStep} className="add-step-btn">
              + Add another step
            </button>

            <button
              onClick={handleCreate}
              disabled={!taskName.trim() || steps.filter(s => s.trim()).length === 0 || saving}
              className="btn-primary"
            >
              {saving ? 'Saving...' : 'Create task'}
            </button>
          </div>
        )}

        {/* List View */}
        {view === 'list' && (
          <>
            {plans.length === 0 ? (
              <div className="card empty-state">
                <span className="empty-emoji">🔨</span>
                <p className="empty-title">No tasks yet</p>
                <p className="empty-subtitle">Break down a task to get started</p>
                <button onClick={() => setView('create')} className="btn-primary">
                  Create first task
                </button>
              </div>
            ) : (
              plans.map((plan) => {
                const done = plan.steps.filter(s => s.completed).length
                const total = plan.steps.length
                const pct = total > 0 ? Math.round((done / total) * 100) : 0
                const linkedGoalTitle = getGoalTitle(plan.related_goal_id || null)

                return (
                  <div key={plan.id} className="card task-card">
                    {/* Phase 1: Show linked goal badge */}
                    {linkedGoalTitle && (
                      <div className="linked-goal-badge">
                        <span className="badge-icon">🎯</span>
                        <span className="badge-text">{linkedGoalTitle}</span>
                      </div>
                    )}
                    
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
                        <span className={`step-text ${step.completed ? 'completed' : ''}`}>
                          {step.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              })
            )}
          </>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="bottom-nav">
        <button onClick={() => router.push('/dashboard')} className="nav-btn">
          <span className="nav-icon">🏠</span>
          <span className="nav-label">Home</span>
        </button>
        <button className="nav-btn active">
          <span className="nav-icon">⏱️</span>
          <span className="nav-label">Focus</span>
        </button>
        <button onClick={() => router.push('/history')} className="nav-btn">
          <span className="nav-icon">📊</span>
          <span className="nav-label">Insights</span>
        </button>
      </nav>

      <style jsx>{styles}</style>
    </div>
  )
}

// ============================================
// RESPONSIVE STYLES
// ============================================
const styles = `
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

  /* ===== LOADING ===== */
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    min-height: 100dvh;
    color: var(--light-gray);
  }

  .spinner {
    width: clamp(24px, 5vw, 32px);
    height: clamp(24px, 5vw, 32px);
    border: 3px solid var(--primary);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 12px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ===== HEADER ===== */
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

  /* ===== VILLAGE PRESENCE PILL ===== */
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
    0%, 100% {
      opacity: 1;
      box-shadow: 0 0 0 0 rgba(0, 186, 124, 0.4);
    }
    50% {
      opacity: 0.6;
      box-shadow: 0 0 0 4px rgba(0, 186, 124, 0);
    }
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

  /* ===== MAIN CONTENT ===== */
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

  /* ===== TABS ===== */
  .tabs {
    display: flex;
    gap: clamp(4px, 1.5vw, 8px);
    margin-bottom: clamp(14px, 4vw, 20px);
    background: white;
    padding: clamp(4px, 1vw, 6px);
    border-radius: clamp(10px, 2.5vw, 14px);
  }

  .tab {
    flex: 1;
    padding: clamp(10px, 3vw, 14px);
    border: none;
    background: transparent;
    border-radius: clamp(8px, 2vw, 10px);
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 500;
    color: var(--dark-gray);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .tab.active {
    background: var(--primary);
    color: white;
    font-weight: 600;
  }

  /* ===== CARDS ===== */
  .card {
    background: white;
    border-radius: clamp(14px, 4vw, 20px);
    padding: clamp(16px, 4.5vw, 24px);
    margin-bottom: clamp(12px, 3.5vw, 18px);
  }

  /* ===== CREATE FORM ===== */
  .label {
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 700;
    margin: 0 0 clamp(8px, 2vw, 12px) 0;
  }

  .label .optional {
    font-weight: 400;
    color: var(--light-gray);
    font-size: clamp(12px, 3.2vw, 14px);
  }

  .sub-label {
    margin-top: clamp(4px, 1vw, 8px);
    font-size: clamp(13px, 3.5vw, 15px);
  }

  .text-input {
    width: 100%;
    padding: clamp(10px, 3vw, 14px);
    border: 1px solid var(--extra-light-gray);
    border-radius: clamp(8px, 2vw, 12px);
    font-size: clamp(14px, 3.8vw, 16px);
    font-family: inherit;
    margin-bottom: clamp(14px, 4vw, 20px);
    box-sizing: border-box;
    transition: border-color 0.2s ease;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--primary);
  }

  /* Phase 1: Select input for goal linking */
  .select-input {
    width: 100%;
    padding: clamp(10px, 3vw, 14px);
    border: 1px solid var(--extra-light-gray);
    border-radius: clamp(8px, 2vw, 12px);
    font-size: clamp(14px, 3.8vw, 16px);
    font-family: inherit;
    margin-bottom: clamp(14px, 4vw, 20px);
    box-sizing: border-box;
    background: white;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23536471' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right clamp(10px, 3vw, 14px) center;
    padding-right: clamp(32px, 8vw, 40px);
  }

  .select-input:focus {
    outline: none;
    border-color: var(--primary);
  }

  .step-row {
    display: flex;
    align-items: center;
    gap: clamp(6px, 2vw, 10px);
    margin-bottom: clamp(8px, 2vw, 12px);
  }

  .step-number {
    color: var(--light-gray);
    font-size: clamp(13px, 3.5vw, 15px);
    min-width: clamp(20px, 5vw, 28px);
    padding: clamp(10px, 3vw, 14px) 0;
  }

  .step-input {
    flex: 1;
    margin-bottom: 0;
  }

  .remove-btn {
    width: clamp(32px, 8vw, 40px);
    height: clamp(32px, 8vw, 40px);
    border: none;
    background: none;
    color: var(--danger);
    font-size: clamp(18px, 5vw, 24px);
    cursor: pointer;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .remove-btn:hover {
    background: rgba(244, 33, 46, 0.1);
  }

  .add-step-btn {
    background: none;
    border: none;
    color: var(--primary);
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 500;
    cursor: pointer;
    padding: clamp(8px, 2vw, 12px) 0;
    margin-bottom: clamp(14px, 4vw, 20px);
  }

  .btn-primary {
    width: 100%;
    padding: clamp(12px, 3.5vw, 16px);
    background: var(--primary);
    color: white;
    border: none;
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(14px, 4vw, 17px);
    font-weight: 600;
    cursor: pointer;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ===== EMPTY STATE ===== */
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

  .empty-state .btn-primary {
    width: auto;
    padding: clamp(12px, 3vw, 16px) clamp(24px, 6vw, 36px);
  }

  /* ===== TASK CARDS ===== */
  /* Phase 1: Linked goal badge */
  .linked-goal-badge {
    display: inline-flex;
    align-items: center;
    gap: clamp(4px, 1vw, 6px);
    padding: clamp(4px, 1vw, 6px) clamp(8px, 2vw, 12px);
    background: rgba(29, 155, 240, 0.08);
    border-radius: 100px;
    margin-bottom: clamp(10px, 3vw, 14px);
  }

  .badge-icon {
    font-size: clamp(12px, 3vw, 14px);
  }

  .badge-text {
    font-size: clamp(11px, 3vw, 13px);
    font-weight: 500;
    color: var(--primary);
    max-width: clamp(150px, 40vw, 200px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

  /* ===== PROGRESS BAR ===== */
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

  /* ===== STEP ITEMS ===== */
  .step-item {
    display: flex;
    align-items: center;
    gap: clamp(10px, 3vw, 14px);
    padding: clamp(10px, 3vw, 14px) 0;
    border-bottom: 1px solid var(--extra-light-gray);
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .step-item:last-child {
    border-bottom: none;
  }

  .step-item:active {
    background: var(--bg-gray);
    margin: 0 clamp(-16px, -4.5vw, -24px);
    padding-left: clamp(16px, 4.5vw, 24px);
    padding-right: clamp(16px, 4.5vw, 24px);
  }

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
  }

  .checkbox.checked {
    border: none;
    background: var(--success);
  }

  .step-text {
    font-size: clamp(14px, 3.8vw, 16px);
    color: var(--dark-gray);
    flex: 1;
    min-width: 0;
    word-wrap: break-word;
  }

  .step-text.completed {
    text-decoration: line-through;
    color: var(--light-gray);
  }

  /* ===== BOTTOM NAV ===== */
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: white;
    border-top: 1px solid #eee;
    display: flex;
    justify-content: space-around;
    padding: clamp(6px, 2vw, 10px) 0;
    padding-bottom: max(clamp(6px, 2vw, 10px), env(safe-area-inset-bottom));
    z-index: 100;
  }

  .nav-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(2px, 1vw, 4px);
    background: none;
    border: none;
    cursor: pointer;
    padding: clamp(6px, 2vw, 10px) clamp(14px, 4vw, 20px);
    color: var(--light-gray);
  }

  .nav-btn.active { color: var(--primary); }
  .nav-icon { font-size: clamp(18px, 5vw, 24px); }
  .nav-label { font-size: clamp(10px, 2.8vw, 12px); font-weight: 400; }
  .nav-btn.active .nav-label { font-weight: 600; }

  /* ===== TABLET/DESKTOP ===== */
  @media (min-width: 768px) {
    .main {
      padding: 24px;
      padding-bottom: 120px;
    }

    .tabs {
      gap: 8px;
    }

    .step-item:hover {
      background: var(--bg-gray);
      margin: 0 -24px;
      padding-left: 24px;
      padding-right: 24px;
    }
  }

  @media (min-width: 1024px) {
    .header {
      padding: 16px 32px;
    }

    .main {
      max-width: 680px;
    }
  }
`
