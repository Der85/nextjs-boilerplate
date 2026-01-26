'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Goal {
  id: string
  title: string
  description: string | null
  progress_percent: number
  status: 'active' | 'completed' | 'paused'
}

const getPlantEmoji = (p: number): string => {
  if (p >= 100) return '🌸'
  if (p >= 75) return '🌷'
  if (p >= 50) return '🪴'
  if (p >= 25) return '🌿'
  return '🌱'
}

export default function GoalsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'list' | 'create'>('list')
  const [goals, setGoals] = useState<Goal[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      await fetchGoals(session.user.id)
      setLoading(false)
    }
    init()
  }, [router])

  const fetchGoals = async (userId: string) => {
    const { data } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (data) setGoals(data)
  }

  const handleCreate = async () => {
    if (!user || !title.trim()) return
    setSaving(true)

    await supabase.from('goals').insert({
      user_id: user.id,
      title,
      description: description || null,
      progress_percent: 0,
      status: 'active',
      plant_type: 'seedling'
    })

    setTitle('')
    setDescription('')
    setView('list')
    if (user) await fetchGoals(user.id)
    setSaving(false)
  }

  const updateProgress = async (goalId: string, newProgress: number) => {
    if (!user) return
    const progress = Math.min(100, Math.max(0, newProgress))

    await supabase.from('goals').update({
      progress_percent: progress,
      status: progress >= 100 ? 'completed' : 'active'
    }).eq('id', goalId).eq('user_id', user.id)

    await fetchGoals(user.id)
  }

  if (loading) {
    return (
      <div className="goals-page">
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    )
  }

  const activeGoals = goals.filter(g => g.status === 'active')
  const completedGoals = goals.filter(g => g.status === 'completed')

  return (
    <div className="goals-page">
      {/* Header - Consistent with Dashboard */}
      <header className="header">
        <button onClick={() => router.push('/dashboard')} className="logo">
          ADHDer.io
        </button>
        
        <div className="header-actions">
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
            <button onClick={() => { router.push('/focus'); setShowMenu(false) }} className="menu-item">
              ⏱️ Focus Mode
            </button>
            <button onClick={() => { setShowMenu(false) }} className="menu-item active">
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
          <h1>🎯 Goals</h1>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <button 
            className={`tab ${view === 'list' ? 'active' : ''}`} 
            onClick={() => setView('list')}
          >
            My goals
          </button>
          <button 
            className={`tab ${view === 'create' ? 'active' : ''}`} 
            onClick={() => setView('create')}
          >
            New goal
          </button>
        </div>

        {/* Create View */}
        {view === 'create' && (
          <div className="card create-card">
            <p className="label">What's your goal?</p>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Exercise 3x per week"
              className="text-input"
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
              onClick={handleCreate}
              disabled={!title.trim() || saving}
              className="btn-primary green"
            >
              {saving ? 'Planting...' : '🌱 Plant this goal'}
            </button>
          </div>
        )}

        {/* List View */}
        {view === 'list' && (
          <>
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
                      <div key={goal.id} className="card goal-card">
                        <div className="goal-header">
                          <span className="goal-emoji">{getPlantEmoji(goal.progress_percent)}</span>
                          <div className="goal-info">
                            <p className="goal-title">{goal.title}</p>
                            {goal.description && <p className="goal-desc">{goal.description}</p>}
                          </div>
                          <span className="goal-percent">{goal.progress_percent}%</span>
                        </div>

                        <div className="progress-bar">
                          <div 
                            className="progress-fill green" 
                            style={{ width: `${goal.progress_percent}%` }} 
                          />
                        </div>

                        <div className="progress-buttons">
                          <button
                            onClick={() => updateProgress(goal.id, goal.progress_percent - 10)}
                            className="btn-adjust minus"
                            disabled={goal.progress_percent <= 0}
                          >
                            -10%
                          </button>
                          <button
                            onClick={() => updateProgress(goal.id, goal.progress_percent + 10)}
                            className="btn-adjust plus"
                          >
                            +10%
                          </button>
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
                      <div key={goal.id} className="card goal-card completed">
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

// ============================================
// RESPONSIVE STYLES
// ============================================
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
    border: 3px solid var(--success);
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
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
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
    background: var(--success);
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
    border-color: var(--success);
  }

  .textarea {
    min-height: clamp(80px, 20vw, 100px);
    resize: vertical;
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

  .btn-primary.green {
    background: var(--success);
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

  /* ===== SECTION HEADERS ===== */
  .section-header {
    margin-bottom: clamp(10px, 3vw, 14px);
  }

  .section-header h2 {
    font-size: clamp(14px, 3.8vw, 17px);
    font-weight: 700;
    color: var(--dark-gray);
    margin: 0;
  }

  .section-divider {
    height: 1px;
    background: var(--extra-light-gray);
    margin: clamp(18px, 5vw, 28px) 0;
  }

  /* ===== GOAL CARDS ===== */
  .goal-card.completed {
    opacity: 0.7;
  }

  .goal-header {
    display: flex;
    align-items: center;
    gap: clamp(10px, 3vw, 14px);
    margin-bottom: clamp(10px, 3vw, 14px);
  }

  .goal-card.completed .goal-header {
    margin-bottom: 0;
  }

  .goal-emoji {
    font-size: clamp(28px, 8vw, 38px);
    flex-shrink: 0;
  }

  .goal-info {
    flex: 1;
    min-width: 0;
  }

  .goal-title {
    font-size: clamp(15px, 4vw, 18px);
    font-weight: 700;
    margin: 0;
    word-wrap: break-word;
  }

  .goal-desc {
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--light-gray);
    margin: clamp(2px, 0.5vw, 4px) 0 0 0;
  }

  .goal-percent {
    font-size: clamp(16px, 4.5vw, 20px);
    font-weight: 700;
    color: var(--success);
    flex-shrink: 0;
  }

  .goal-check {
    font-size: clamp(16px, 4.5vw, 20px);
    color: var(--success);
    flex-shrink: 0;
  }

  /* ===== PROGRESS BAR ===== */
  .progress-bar {
    height: clamp(8px, 2vw, 10px);
    background: var(--extra-light-gray);
    border-radius: 100px;
    margin-bottom: clamp(12px, 3vw, 18px);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--primary);
    border-radius: 100px;
    transition: width 0.3s ease;
  }

  .progress-fill.green {
    background: var(--success);
  }

  /* ===== PROGRESS BUTTONS ===== */
  .progress-buttons {
    display: flex;
    gap: clamp(8px, 2.5vw, 12px);
  }

  .btn-adjust {
    flex: 1;
    padding: clamp(10px, 2.5vw, 12px);
    border-radius: clamp(8px, 2vw, 10px);
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-adjust.minus {
    background: white;
    border: 1px solid var(--extra-light-gray);
    color: var(--dark-gray);
  }

  .btn-adjust.minus:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .btn-adjust.plus {
    background: white;
    border: 2px solid var(--success);
    color: var(--success);
  }

  .btn-adjust:active {
    transform: scale(0.97);
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

  .nav-btn.active {
    color: var(--primary);
  }

  .nav-icon {
    font-size: clamp(18px, 5vw, 24px);
  }

  .nav-label {
    font-size: clamp(10px, 2.8vw, 12px);
    font-weight: 400;
  }

  .nav-btn.active .nav-label {
    font-weight: 600;
  }

  /* ===== TABLET/DESKTOP ===== */
  @media (min-width: 768px) {
    .main {
      padding: 24px;
      padding-bottom: 120px;
    }
    
    .tabs {
      gap: 8px;
    }
    
    .btn-adjust:hover {
      transform: scale(1.02);
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
