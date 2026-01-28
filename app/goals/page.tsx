'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ============================================
// Types
// ============================================
interface MicroStep {
  id: string
  text: string
  timeEstimate: string
  energyLevel: 'low' | 'medium' | 'high'
  completed: boolean
}

interface Goal {
  id: string
  title: string
  description: string | null
  progress_percent: number
  status: 'active' | 'completed' | 'paused'
  micro_steps: MicroStep[]
  celebration_message?: string
  created_at: string
}

interface ContextState {
  energyLevel?: 'green' | 'yellow' | 'red'
  energyRecent?: boolean
  mood?: number
  contextMessage?: string
  streak?: { type: string; days: number } | null
}

type View = 'list' | 'create' | 'detail'
type CreateStep = 'title' | 'breakdown' | 'review'

// ============================================
// Helpers
// ============================================
const getPlantEmoji = (p: number): string => {
  if (p >= 100) return '🌸'
  if (p >= 75) return '🌷'
  if (p >= 50) return '🪴'
  if (p >= 25) return '🌿'
  return '🌱'
}

const getEnergyColor = (level: string) => {
  switch (level) {
    case 'green': return '#00ba7c'
    case 'yellow': return '#ffad1f'
    case 'red': return '#f4212e'
    default: return '#8899a6'
  }
}

const getEnergyBg = (level: string) => {
  switch (level) {
    case 'green': return 'rgba(0, 186, 124, 0.1)'
    case 'yellow': return 'rgba(255, 173, 31, 0.1)'
    case 'red': return 'rgba(244, 33, 46, 0.1)'
    default: return 'rgba(136, 153, 166, 0.1)'
  }
}

// ============================================
// API Helper
// ============================================
async function fetchGoalsCoach(action: string, data: Record<string, any> = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')

  const response = await fetch('/api/goals-coach', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ action, ...data })
  })

  if (!response.ok) throw new Error('API request failed')
  return response.json()
}

// ============================================
// Main Component
// ============================================
export default function GoalsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  // View state
  const [view, setView] = useState<View>('list')
  const [createStep, setCreateStep] = useState<CreateStep>('title')
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)

  // Data
  const [goals, setGoals] = useState<Goal[]>([])
  const [context, setContext] = useState<ContextState>({})
  const [suggestion, setSuggestion] = useState<{ goalId: string; suggestion: string; reason: string } | null>(null)

  // Create form
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [generatedSteps, setGeneratedSteps] = useState<MicroStep[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  // ============================================
  // Initialize
  // ============================================
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      await loadData(session.user.id)
      setLoading(false)
    }
    init()
  }, [router])

  const loadData = async (userId: string) => {
    // Fetch goals from database
    const { data: goalsData } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (goalsData) {
      setGoals(goalsData.map(g => ({
        ...g,
        micro_steps: g.micro_steps || []
      })))
    }

    // Fetch context from AI
    try {
      const contextData = await fetchGoalsCoach('context_check')
      setContext({
        energyLevel: contextData.energyState?.level,
        energyRecent: contextData.energyState?.isRecent,
        mood: contextData.mood,
        contextMessage: contextData.contextMessage,
        streak: contextData.streak
      })
    } catch (e) {
      console.error('Failed to load context:', e)
    }
  }

  // ============================================
  // Get Next Suggestion
  // ============================================
  const loadSuggestion = async () => {
    try {
      const data = await fetchGoalsCoach('suggest_next')
      setSuggestion(data.suggestion)
    } catch (e) {
      console.error('Failed to load suggestion:', e)
    }
  }

  useEffect(() => {
    if (goals.length > 0 && view === 'list') {
      loadSuggestion()
    }
  }, [goals, view])

  // ============================================
  // Create Goal Flow
  // ============================================
  const handleGenerateBreakdown = async () => {
    if (!title.trim()) return
    setIsGenerating(true)

    try {
      const data = await fetchGoalsCoach('breakdown', {
        goalTitle: title,
        goalDescription: description || null
      })
      setGeneratedSteps(data.steps || [])
      setCreateStep('breakdown')
    } catch (e) {
      console.error('Failed to generate breakdown:', e)
      // Use fallback steps
      setGeneratedSteps([
        { id: 'step_1', text: 'Write down the first tiny action', timeEstimate: '2 min', energyLevel: 'low', completed: false },
        { id: 'step_2', text: 'Gather what you need', timeEstimate: '5 min', energyLevel: 'low', completed: false },
        { id: 'step_3', text: 'Set a timer and start', timeEstimate: '10 min', energyLevel: 'medium', completed: false },
      ])
      setCreateStep('breakdown')
    }

    setIsGenerating(false)
  }

  const handleCreateGoal = async () => {
    if (!user || !title.trim()) return
    setSaving(true)

    try {
      await supabase.from('goals').insert({
        user_id: user.id,
        title,
        description: description || null,
        progress_percent: 0,
        status: 'active',
        micro_steps: generatedSteps,
        used_ai_breakdown: generatedSteps.length > 0,
        energy_when_created: context.energyLevel || null,
        mood_when_created: context.mood || null
      })

      // Reset form
      setTitle('')
      setDescription('')
      setGeneratedSteps([])
      setCreateStep('title')
      setView('list')
      
      await loadData(user.id)
    } catch (e) {
      console.error('Failed to create goal:', e)
    }

    setSaving(false)
  }

  // ============================================
  // Step Completion
  // ============================================
  const handleStepToggle = async (goal: Goal, stepId: string) => {
    if (!user) return

    const updatedSteps = goal.micro_steps.map(s =>
      s.id === stepId ? { ...s, completed: !s.completed } : s
    )

    const completedCount = updatedSteps.filter(s => s.completed).length
    const newProgress = Math.round((completedCount / updatedSteps.length) * 100)
    const isNowComplete = newProgress >= 100

    // Update in database
    const updates: any = {
      micro_steps: updatedSteps,
      progress_percent: newProgress,
    }

    if (isNowComplete) {
      updates.status = 'completed'
      
      // Get celebration message
      try {
        const celebrationData = await fetchGoalsCoach('celebrate', { goalTitle: goal.title })
        updates.celebration_message = celebrationData.message
      } catch (e) {
        updates.celebration_message = `You completed "${goal.title}"! That took real persistence.`
      }
    }

    await supabase
      .from('goals')
      .update(updates)
      .eq('id', goal.id)
      .eq('user_id', user.id)

    // Log progress
    await supabase.from('goal_progress_logs').insert({
      user_id: user.id,
      goal_id: goal.id,
      action_type: isNowComplete ? 'goal_completed' : 'step_completed',
      step_id: stepId,
      step_text: goal.micro_steps.find(s => s.id === stepId)?.text,
      progress_before: goal.progress_percent,
      progress_after: newProgress,
      mood_at_action: context.mood,
      energy_at_action: context.energyLevel
    })

    await loadData(user.id)

    // Update selected goal if viewing detail
    if (selectedGoal?.id === goal.id) {
      setSelectedGoal({ ...goal, micro_steps: updatedSteps, progress_percent: newProgress })
    }
  }

  const handleProgressAdjust = async (goal: Goal, delta: number) => {
    if (!user) return
    const newProgress = Math.min(100, Math.max(0, goal.progress_percent + delta))
    
    await supabase
      .from('goals')
      .update({
        progress_percent: newProgress,
        status: newProgress >= 100 ? 'completed' : 'active'
      })
      .eq('id', goal.id)
      .eq('user_id', user.id)

    await loadData(user.id)
  }

  // ============================================
  // Render
  // ============================================
  if (loading) {
    return (
      <div className="goals-page">
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading your garden...</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    )
  }

  const activeGoals = goals.filter(g => g.status === 'active')
  const completedGoals = goals.filter(g => g.status === 'completed')

  return (
    <div className="goals-page">
      {/* Header */}
      <header className="header">
        <button onClick={() => router.push('/dashboard')} className="logo">ADHDer.io</button>
        <div className="header-actions">
          <button onClick={() => router.push('/ally')} className="icon-btn purple" title="I'm stuck">💜</button>
          <button onClick={() => router.push('/brake')} className="icon-btn red" title="Need to pause">🛑</button>
          <button onClick={() => setShowMenu(!showMenu)} className="icon-btn menu">☰</button>
        </div>
        {showMenu && (
          <div className="dropdown-menu">
            <button onClick={() => { router.push('/dashboard'); setShowMenu(false) }} className="menu-item">🏠 Dashboard</button>
            <button onClick={() => { router.push('/focus'); setShowMenu(false) }} className="menu-item">⏱️ Focus Mode</button>
            <button onClick={() => setShowMenu(false)} className="menu-item active">🎯 Goals</button>
            <button onClick={() => { router.push('/burnout'); setShowMenu(false) }} className="menu-item">⚡ Energy Tracker</button>
            <button onClick={() => { router.push('/village'); setShowMenu(false) }} className="menu-item">👥 My Village</button>
            <div className="menu-divider" />
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="menu-item logout">Log out</button>
          </div>
        )}
      </header>
      {showMenu && <div className="menu-overlay" onClick={() => setShowMenu(false)} />}

      <main className="main">
        <div className="page-header-title">
          <h1>🎯 Goals</h1>
          {context.energyLevel && context.energyRecent && (
            <span className="energy-badge" style={{ background: getEnergyBg(context.energyLevel), color: getEnergyColor(context.energyLevel) }}>
              {context.energyLevel === 'green' ? '⚡' : context.energyLevel === 'yellow' ? '🔋' : '🪫'} {context.energyLevel}
            </span>
          )}
        </div>

        {/* Context Message */}
        {context.contextMessage && view === 'list' && (
          <div className="card context-card">
            <p className="context-message">{context.contextMessage}</p>
          </div>
        )}

        {/* Tabs */}
        {view !== 'detail' && (
          <div className="tabs">
            <button className={`tab ${view === 'list' ? 'active' : ''}`} onClick={() => { setView('list'); setCreateStep('title') }}>
              My goals
            </button>
            <button className={`tab ${view === 'create' ? 'active' : ''}`} onClick={() => setView('create')}>
              + New goal
            </button>
          </div>
        )}

        {/* Detail View */}
        {view === 'detail' && selectedGoal && (
          <>
            <button className="back-btn" onClick={() => { setView('list'); setSelectedGoal(null) }}>
              ← Back to goals
            </button>

            <div className="card detail-card">
              <div className="detail-header">
                <span className="detail-emoji">{getPlantEmoji(selectedGoal.progress_percent)}</span>
                <div className="detail-info">
                  <h2 className="detail-title">{selectedGoal.title}</h2>
                  {selectedGoal.description && <p className="detail-desc">{selectedGoal.description}</p>}
                </div>
                <span className="detail-percent">{selectedGoal.progress_percent}%</span>
              </div>

              <div className="progress-bar large">
                <div className="progress-fill green" style={{ width: `${selectedGoal.progress_percent}%` }} />
              </div>

              {/* Celebration Message */}
              {selectedGoal.status === 'completed' && selectedGoal.celebration_message && (
                <div className="celebration-box">
                  <span className="celebration-emoji">🎉</span>
                  <p className="celebration-text">{selectedGoal.celebration_message}</p>
                </div>
              )}

              {/* Micro Steps */}
              {selectedGoal.micro_steps.length > 0 && selectedGoal.status === 'active' && (
                <div className="steps-section">
                  <h3 className="steps-title">Micro-steps</h3>
                  {selectedGoal.micro_steps.map((step) => (
                    <div
                      key={step.id}
                      className={`step-item ${step.completed ? 'completed' : ''}`}
                      onClick={() => handleStepToggle(selectedGoal, step.id)}
                    >
                      <div className={`step-checkbox ${step.completed ? 'checked' : ''}`}>
                        {step.completed && '✓'}
                      </div>
                      <div className="step-content">
                        <p className="step-text">{step.text}</p>
                        <div className="step-meta">
                          <span className="step-time">{step.timeEstimate}</span>
                          <span 
                            className="step-energy" 
                            style={{ 
                              background: getEnergyBg(step.energyLevel === 'low' ? 'green' : step.energyLevel === 'medium' ? 'yellow' : 'red'),
                              color: getEnergyColor(step.energyLevel === 'low' ? 'green' : step.energyLevel === 'medium' ? 'yellow' : 'red')
                            }}
                          >
                            {step.energyLevel} energy
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Manual Progress Adjust */}
              {selectedGoal.status === 'active' && selectedGoal.micro_steps.length === 0 && (
                <div className="progress-buttons">
                  <button
                    onClick={() => handleProgressAdjust(selectedGoal, -10)}
                    className="btn-adjust minus"
                    disabled={selectedGoal.progress_percent <= 0}
                  >
                    -10%
                  </button>
                  <button
                    onClick={() => handleProgressAdjust(selectedGoal, 10)}
                    className="btn-adjust plus"
                  >
                    +10%
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Create View */}
        {view === 'create' && (
          <>
            {createStep === 'title' && (
              <div className="card create-card">
                <p className="label">What's your goal?</p>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Exercise 3x per week"
                  className="text-input"
                  autoFocus
                />

                <p className="label">Why is this important? (optional)</p>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What will achieving this mean to you?"
                  className="text-input textarea"
                  rows={3}
                />

                <button
                  onClick={handleGenerateBreakdown}
                  disabled={!title.trim() || isGenerating}
                  className="btn-primary green"
                >
                  {isGenerating ? (
                    <>
                      <span className="spinner-inline" />
                      Breaking it down...
                    </>
                  ) : (
                    '✨ Break it down for me'
                  )}
                </button>

                <button
                  onClick={() => { setGeneratedSteps([]); setCreateStep('review') }}
                  disabled={!title.trim()}
                  className="btn-secondary"
                >
                  Skip breakdown →
                </button>
              </div>
            )}

            {createStep === 'breakdown' && (
              <div className="card create-card">
                <h2 className="breakdown-title">Here's your breakdown:</h2>
                <p className="breakdown-subtitle">These are ADHD-friendly micro-steps based on your current energy</p>

                <div className="steps-preview">
                  {generatedSteps.map((step, i) => (
                    <div key={step.id} className="step-preview-item">
                      <span className="step-number">{i + 1}</span>
                      <div className="step-preview-content">
                        <p className="step-preview-text">{step.text}</p>
                        <div className="step-meta">
                          <span className="step-time">{step.timeEstimate}</span>
                          <span 
                            className="step-energy"
                            style={{ 
                              background: getEnergyBg(step.energyLevel === 'low' ? 'green' : step.energyLevel === 'medium' ? 'yellow' : 'red'),
                              color: getEnergyColor(step.energyLevel === 'low' ? 'green' : step.energyLevel === 'medium' ? 'yellow' : 'red')
                            }}
                          >
                            {step.energyLevel} energy
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="breakdown-actions">
                  <button onClick={() => setCreateStep('title')} className="btn-secondary">
                    ← Edit goal
                  </button>
                  <button onClick={handleCreateGoal} disabled={saving} className="btn-primary green">
                    {saving ? 'Planting...' : '🌱 Plant this goal'}
                  </button>
                </div>
              </div>
            )}

            {createStep === 'review' && (
              <div className="card create-card">
                <div className="review-preview">
                  <span className="review-emoji">🌱</span>
                  <h2 className="review-title">{title}</h2>
                  {description && <p className="review-desc">{description}</p>}
                </div>

                <div className="breakdown-actions">
                  <button onClick={() => setCreateStep('title')} className="btn-secondary">
                    ← Edit
                  </button>
                  <button onClick={handleCreateGoal} disabled={saving} className="btn-primary green">
                    {saving ? 'Planting...' : '🌱 Plant this goal'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* List View */}
        {view === 'list' && (
          <>
            {/* AI Suggestion Card */}
            {suggestion && activeGoals.length > 0 && (
              <div className="card suggestion-card">
                <div className="suggestion-header">
                  <span className="suggestion-icon">💡</span>
                  <span className="suggestion-label">Suggested next step</span>
                </div>
                <p className="suggestion-text">{suggestion.suggestion}</p>
                <p className="suggestion-reason">{suggestion.reason}</p>
                <button 
                  className="suggestion-btn"
                  onClick={() => {
                    const goal = goals.find(g => g.id === suggestion.goalId)
                    if (goal) {
                      setSelectedGoal(goal)
                      setView('detail')
                    }
                  }}
                >
                  Go to goal →
                </button>
              </div>
            )}

            {goals.length === 0 ? (
              <div className="card empty-state">
                <span className="empty-emoji">🌱</span>
                <p className="empty-title">No goals planted yet</p>
                <p className="empty-subtitle">Plant your first goal and watch it grow</p>
                <button onClick={() => setView('create')} className="btn-primary green">
                  Plant first goal
                </button>
              </div>
            ) : (
              <>
                {activeGoals.length > 0 && (
                  <>
                    <div className="section-header">
                      <h2>Growing ({activeGoals.length})</h2>
                    </div>
                    {activeGoals.map((goal) => (
                      <div 
                        key={goal.id} 
                        className="card goal-card"
                        onClick={() => { setSelectedGoal(goal); setView('detail') }}
                      >
                        <div className="goal-header">
                          <span className="goal-emoji">{getPlantEmoji(goal.progress_percent)}</span>
                          <div className="goal-info">
                            <p className="goal-title">{goal.title}</p>
                            {goal.micro_steps.length > 0 && (
                              <p className="goal-steps-count">
                                {goal.micro_steps.filter(s => s.completed).length}/{goal.micro_steps.length} steps
                              </p>
                            )}
                          </div>
                          <span className="goal-percent">{goal.progress_percent}%</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill green" style={{ width: `${goal.progress_percent}%` }} />
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {completedGoals.length > 0 && (
                  <>
                    <div className="section-divider" />
                    <div className="section-header">
                      <h2>Bloomed 🌸 ({completedGoals.length})</h2>
                    </div>
                    {completedGoals.map((goal) => (
                      <div 
                        key={goal.id} 
                        className="card goal-card completed"
                        onClick={() => { setSelectedGoal(goal); setView('detail') }}
                      >
                        <div className="goal-header">
                          <span className="goal-emoji">🌸</span>
                          <p className="goal-title">{goal.title}</p>
                          <span className="goal-check">✓</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
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
        <button onClick={() => router.push('/focus')} className="nav-btn">
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

const styles = `
  .goals-page {
    --primary: #1D9BF0;
    --success: #00ba7c;
    --bg-gray: #f7f9fa;
    --dark-gray: #536471;
    --light-gray: #8899a6;
    --extra-light-gray: #eff3f4;
    background: var(--bg-gray);
    min-height: 100vh;
    min-height: 100dvh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .loading-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; color: var(--light-gray); gap: 12px; }
  .spinner { width: clamp(24px, 5vw, 32px); height: clamp(24px, 5vw, 32px); border: 3px solid var(--success); border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; }
  .spinner-inline { width: 16px; height: 16px; border: 2px solid white; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; display: inline-block; margin-right: 8px; vertical-align: middle; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .header { position: sticky; top: 0; background: white; border-bottom: 1px solid #eee; padding: clamp(10px, 2.5vw, 14px) clamp(12px, 4vw, 20px); display: flex; justify-content: space-between; align-items: center; z-index: 100; }
  .logo { background: none; border: none; cursor: pointer; font-size: clamp(16px, 4vw, 20px); font-weight: 800; color: var(--primary); }
  .header-actions { display: flex; gap: clamp(6px, 2vw, 10px); }
  .icon-btn { width: clamp(32px, 8vw, 42px); height: clamp(32px, 8vw, 42px); border-radius: 50%; border: none; cursor: pointer; font-size: clamp(14px, 3.5vw, 18px); display: flex; align-items: center; justify-content: center; }
  .icon-btn.purple { background: rgba(128, 90, 213, 0.1); }
  .icon-btn.red { background: rgba(239, 68, 68, 0.1); }
  .icon-btn.menu { background: white; border: 1px solid #ddd; font-size: clamp(12px, 3vw, 16px); }
  .dropdown-menu { position: absolute; top: clamp(50px, 12vw, 60px); right: clamp(12px, 4vw, 20px); background: white; border-radius: clamp(10px, 2.5vw, 14px); box-shadow: 0 4px 20px rgba(0,0,0,0.15); padding: clamp(6px, 1.5vw, 10px); min-width: clamp(140px, 40vw, 180px); z-index: 200; }
  .menu-item { display: block; width: 100%; padding: clamp(8px, 2.5vw, 12px) clamp(10px, 3vw, 14px); text-align: left; background: none; border: none; border-radius: clamp(6px, 1.5vw, 10px); cursor: pointer; font-size: clamp(13px, 3.5vw, 15px); color: var(--dark-gray); }
  .menu-item:hover, .menu-item.active { background: var(--bg-gray); }
  .menu-item.logout { color: #ef4444; }
  .menu-divider { border-top: 1px solid #eee; margin: 8px 0; }
  .menu-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 99; }
  .main { padding: clamp(12px, 4vw, 20px); padding-bottom: clamp(80px, 20vw, 110px); max-width: 600px; margin: 0 auto; }
  .page-header-title { display: flex; align-items: center; gap: 12px; margin-bottom: clamp(14px, 4vw, 20px); }
  .page-header-title h1 { font-size: clamp(22px, 6vw, 28px); font-weight: 700; margin: 0; }
  .energy-badge { font-size: 12px; padding: 4px 10px; border-radius: 100px; font-weight: 600; text-transform: capitalize; }
  .context-card { background: linear-gradient(135deg, rgba(29, 155, 240, 0.05), rgba(0, 186, 124, 0.05)); border-left: 3px solid var(--primary); }
  .context-message { font-size: 14px; color: var(--dark-gray); margin: 0; line-height: 1.5; }
  .tabs { display: flex; gap: clamp(4px, 1.5vw, 8px); margin-bottom: clamp(14px, 4vw, 20px); background: white; padding: clamp(4px, 1vw, 6px); border-radius: clamp(10px, 2.5vw, 14px); }
  .tab { flex: 1; padding: clamp(10px, 3vw, 14px); border: none; background: transparent; border-radius: clamp(8px, 2vw, 10px); font-size: clamp(13px, 3.5vw, 15px); font-weight: 500; color: var(--dark-gray); cursor: pointer; transition: all 0.2s ease; }
  .tab.active { background: var(--success); color: white; font-weight: 600; }
  .card { background: white; border-radius: clamp(14px, 4vw, 20px); padding: clamp(16px, 4.5vw, 24px); margin-bottom: clamp(12px, 3.5vw, 18px); }
  .back-btn { background: none; border: none; color: var(--light-gray); font-size: 14px; cursor: pointer; padding: 8px 0; margin-bottom: 12px; }
  .detail-card { }
  .detail-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
  .detail-emoji { font-size: 48px; }
  .detail-info { flex: 1; }
  .detail-title { font-size: 20px; font-weight: 700; margin: 0 0 4px 0; }
  .detail-desc { font-size: 14px; color: var(--light-gray); margin: 0; }
  .detail-percent { font-size: 24px; font-weight: 700; color: var(--success); }
  .progress-bar { height: clamp(8px, 2vw, 10px); background: var(--extra-light-gray); border-radius: 100px; overflow: hidden; }
  .progress-bar.large { height: 12px; margin-bottom: 20px; }
  .progress-fill { height: 100%; background: var(--primary); border-radius: 100px; transition: width 0.3s ease; }
  .progress-fill.green { background: var(--success); }
  .celebration-box { background: linear-gradient(135deg, rgba(0, 186, 124, 0.1), rgba(255, 215, 0, 0.1)); padding: 16px; border-radius: 12px; text-align: center; margin-bottom: 20px; }
  .celebration-emoji { font-size: 32px; display: block; margin-bottom: 8px; }
  .celebration-text { font-size: 15px; color: var(--dark-gray); margin: 0; line-height: 1.5; }
  .steps-section { margin-top: 20px; }
  .steps-title { font-size: 16px; font-weight: 700; margin: 0 0 12px 0; }
  .step-item { display: flex; gap: 12px; padding: 12px; margin-bottom: 8px; border-radius: 12px; background: var(--bg-gray); cursor: pointer; transition: all 0.15s; }
  .step-item:hover { background: var(--extra-light-gray); }
  .step-item.completed { opacity: 0.6; }
  .step-item.completed .step-text { text-decoration: line-through; }
  .step-checkbox { width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--light-gray); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 14px; color: white; transition: all 0.2s; }
  .step-checkbox.checked { background: var(--success); border-color: var(--success); }
  .step-content { flex: 1; }
  .step-text { font-size: 14px; font-weight: 500; margin: 0 0 6px 0; }
  .step-meta { display: flex; gap: 8px; flex-wrap: wrap; }
  .step-time { font-size: 12px; color: var(--light-gray); }
  .step-energy { font-size: 11px; padding: 2px 8px; border-radius: 100px; text-transform: capitalize; }
  .suggestion-card { background: linear-gradient(135deg, rgba(255, 215, 0, 0.08), rgba(255, 173, 31, 0.08)); border-left: 3px solid #ffad1f; }
  .suggestion-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .suggestion-icon { font-size: 18px; }
  .suggestion-label { font-size: 12px; font-weight: 600; color: #b8860b; text-transform: uppercase; letter-spacing: 0.5px; }
  .suggestion-text { font-size: 15px; font-weight: 600; margin: 0 0 4px 0; }
  .suggestion-reason { font-size: 13px; color: var(--light-gray); margin: 0 0 12px 0; }
  .suggestion-btn { background: none; border: 1px solid #ffad1f; color: #b8860b; padding: 8px 16px; border-radius: 100px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .create-card { }
  .label { font-size: clamp(14px, 3.8vw, 16px); font-weight: 700; margin: 0 0 clamp(8px, 2vw, 12px) 0; }
  .text-input { width: 100%; padding: clamp(10px, 3vw, 14px); border: 1px solid var(--extra-light-gray); border-radius: clamp(8px, 2vw, 12px); font-size: clamp(14px, 3.8vw, 16px); font-family: inherit; margin-bottom: clamp(14px, 4vw, 20px); box-sizing: border-box; transition: border-color 0.2s ease; }
  .text-input:focus { outline: none; border-color: var(--success); }
  .textarea { min-height: clamp(80px, 20vw, 100px); resize: vertical; }
  .btn-primary { width: 100%; padding: clamp(12px, 3.5vw, 16px); background: var(--primary); color: white; border: none; border-radius: clamp(10px, 2.5vw, 14px); font-size: clamp(14px, 4vw, 17px); font-weight: 600; cursor: pointer; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; }
  .btn-primary.green { background: var(--success); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-secondary { width: 100%; padding: clamp(12px, 3.5vw, 16px); background: white; color: var(--dark-gray); border: 1px solid var(--extra-light-gray); border-radius: clamp(10px, 2.5vw, 14px); font-size: clamp(14px, 4vw, 17px); font-weight: 500; cursor: pointer; }
  .breakdown-title { font-size: 18px; font-weight: 700; margin: 0 0 4px 0; }
  .breakdown-subtitle { font-size: 13px; color: var(--light-gray); margin: 0 0 20px 0; }
  .steps-preview { margin-bottom: 20px; }
  .step-preview-item { display: flex; gap: 12px; padding: 12px; margin-bottom: 8px; border-radius: 12px; background: var(--bg-gray); }
  .step-number { width: 24px; height: 24px; border-radius: 50%; background: var(--success); color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
  .step-preview-content { flex: 1; }
  .step-preview-text { font-size: 14px; font-weight: 500; margin: 0 0 6px 0; }
  .breakdown-actions { display: flex; gap: 10px; }
  .breakdown-actions .btn-secondary, .breakdown-actions .btn-primary { flex: 1; margin-bottom: 0; }
  .review-preview { text-align: center; padding: 20px 0 30px; }
  .review-emoji { font-size: 48px; display: block; margin-bottom: 12px; }
  .review-title { font-size: 20px; font-weight: 700; margin: 0 0 8px 0; }
  .review-desc { font-size: 14px; color: var(--light-gray); margin: 0; }
  .empty-state { text-align: center; padding: clamp(30px, 8vw, 50px) clamp(16px, 4vw, 24px); }
  .empty-emoji { font-size: clamp(40px, 12vw, 60px); display: block; margin-bottom: clamp(12px, 3vw, 18px); }
  .empty-title { font-size: clamp(16px, 4.5vw, 20px); font-weight: 700; margin: 0 0 clamp(6px, 1.5vw, 10px) 0; }
  .empty-subtitle { font-size: clamp(13px, 3.5vw, 15px); color: var(--light-gray); margin: 0 0 clamp(18px, 5vw, 28px) 0; }
  .empty-state .btn-primary { width: auto; padding: clamp(12px, 3vw, 16px) clamp(24px, 6vw, 36px); }
  .section-header { margin-bottom: clamp(10px, 3vw, 14px); }
  .section-header h2 { font-size: clamp(14px, 3.8vw, 17px); font-weight: 700; color: var(--dark-gray); margin: 0; }
  .section-divider { height: 1px; background: var(--extra-light-gray); margin: clamp(18px, 5vw, 28px) 0; }
  .goal-card { cursor: pointer; transition: all 0.15s; }
  .goal-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
  .goal-card.completed { opacity: 0.7; }
  .goal-header { display: flex; align-items: center; gap: clamp(10px, 3vw, 14px); margin-bottom: clamp(10px, 3vw, 14px); }
  .goal-card.completed .goal-header { margin-bottom: 0; }
  .goal-emoji { font-size: clamp(28px, 8vw, 38px); flex-shrink: 0; }
  .goal-info { flex: 1; min-width: 0; }
  .goal-title { font-size: clamp(15px, 4vw, 18px); font-weight: 700; margin: 0; word-wrap: break-word; }
  .goal-steps-count { font-size: 12px; color: var(--light-gray); margin: 4px 0 0 0; }
  .goal-percent { font-size: clamp(16px, 4.5vw, 20px); font-weight: 700; color: var(--success); flex-shrink: 0; }
  .goal-check { font-size: clamp(16px, 4.5vw, 20px); color: var(--success); flex-shrink: 0; }
  .progress-buttons { display: flex; gap: clamp(8px, 2.5vw, 12px); margin-top: 16px; }
  .btn-adjust { flex: 1; padding: clamp(10px, 2.5vw, 12px); border-radius: clamp(8px, 2vw, 10px); font-size: clamp(13px, 3.5vw, 15px); font-weight: 600; cursor: pointer; transition: all 0.15s ease; }
  .btn-adjust.minus { background: white; border: 1px solid var(--extra-light-gray); color: var(--dark-gray); }
  .btn-adjust.minus:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-adjust.plus { background: white; border: 2px solid var(--success); color: var(--success); }
  .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; background: white; border-top: 1px solid #eee; display: flex; justify-content: space-around; padding: clamp(6px, 2vw, 10px) 0; padding-bottom: max(clamp(6px, 2vw, 10px), env(safe-area-inset-bottom)); z-index: 100; }
  .nav-btn { display: flex; flex-direction: column; align-items: center; gap: clamp(2px, 1vw, 4px); background: none; border: none; cursor: pointer; padding: clamp(6px, 2vw, 10px) clamp(14px, 4vw, 20px); color: var(--light-gray); }
  .nav-icon { font-size: clamp(18px, 5vw, 24px); }
  .nav-label { font-size: clamp(10px, 2.8vw, 12px); font-weight: 400; }
  @media (min-width: 768px) { .main { padding: 24px; padding-bottom: 120px; } .goal-card:hover { transform: translateY(-2px); } }
  @media (min-width: 1024px) { .header { padding: 16px 32px; } .main { max-width: 680px; } }
`
