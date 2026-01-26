'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Step = 'impulse' | 'intensity' | 'observe' | 'cope' | 'proceed' | 'done'

const emotions = [
  { id: 'anger', label: 'Angry', icon: '😤' },
  { id: 'anxiety', label: 'Anxious', icon: '😰' },
  { id: 'sadness', label: 'Sad', icon: '😢' },
  { id: 'frustration', label: 'Frustrated', icon: '😣' },
  { id: 'overwhelm', label: 'Overwhelmed', icon: '🤯' },
  { id: 'boredom', label: 'Bored', icon: '😑' },
  { id: 'excitement', label: 'Excited', icon: '🤩' },
  { id: 'shame', label: 'Ashamed', icon: '😔' },
]

const skills = [
  { text: 'Take 5 deep breaths', why: 'Activates your calm nervous system', time: '30 sec' },
  { text: 'Splash cold water on face', why: 'Triggers dive reflex, slows heart rate', time: '1 min' },
  { text: 'Name 5 things you can see', why: 'Grounds you in the present moment', time: '1 min' },
  { text: 'Do 10 jumping jacks', why: 'Burns off adrenaline', time: '30 sec' },
  { text: 'Hold ice cubes', why: 'Strong sensation redirects focus', time: '1 min' },
  { text: 'Count backwards from 100 by 7s', why: 'Engages logical brain', time: '2 min' },
]

export default function BrakePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const [currentStep, setCurrentStep] = useState<Step>('impulse')
  const [impulseText, setImpulseText] = useState('')
  const [intensityBefore, setIntensityBefore] = useState<number | null>(null)
  const [intensityAfter, setIntensityAfter] = useState<number | null>(null)
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([])
  const [usedSkill, setUsedSkill] = useState<string | null>(null)
  const [actedOnImpulse, setActedOnImpulse] = useState<boolean | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      setLoading(false)
    }
    init()
  }, [router])

  const toggleEmotion = (id: string) => {
    setSelectedEmotions(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    )
  }

  const handleComplete = async (acted: boolean) => {
    if (!user) return
    setSaving(true)
    setActedOnImpulse(acted)

    await supabase.from('impulse_events').insert({
      user_id: user.id,
      impulse_description: impulseText,
      intensity_before: intensityBefore,
      intensity_after: intensityAfter,
      emotions_felt: selectedEmotions,
      coping_skill_used: usedSkill,
      acted_on_impulse: acted,
    })

    setCurrentStep('done')
    setSaving(false)
  }

  const reset = () => {
    setCurrentStep('impulse')
    setImpulseText('')
    setIntensityBefore(null)
    setIntensityAfter(null)
    setSelectedEmotions([])
    setUsedSkill(null)
    setActedOnImpulse(null)
  }

  if (loading) {
    return (
      <div className="brake-page">
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    )
  }

  const stepLabels = ['The urge', 'How strong?', 'Underneath', 'Cope first', 'Decide']
  const stepIndex = ['impulse', 'intensity', 'observe', 'cope', 'proceed'].indexOf(currentStep)

  return (
    <div className="brake-page">
      {/* Header - Consistent with Dashboard */}
      <header className="header">
        <button onClick={() => router.push('/dashboard')} className="logo">
          ADHDer.io
        </button>
        
        <div className="header-actions">
          <button onClick={() => router.push('/ally')} className="icon-btn purple" title="I'm stuck">
            💜
          </button>
          <button className="icon-btn red active" title="Need to pause">
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
          <h1>🛑 STOP</h1>
        </div>

        {/* Progress Bar */}
        {currentStep !== 'done' && (
          <div className="card progress-card">
            <div className="progress-header">
              <span className="progress-label">{stepLabels[stepIndex]}</span>
              <span className="progress-count">{stepIndex + 1} of 5</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${((stepIndex + 1) / 5) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Step: Impulse */}
        {currentStep === 'impulse' && (
          <div className="card impulse-card">
            <div className="impulse-header">
              <span className="impulse-emoji">🛑</span>
              <h2 className="impulse-title">STOP</h2>
              <p className="impulse-desc">What do you feel like doing?</p>
            </div>
            <textarea
              value={impulseText}
              onChange={(e) => setImpulseText(e.target.value)}
              placeholder="I want to..."
              className="impulse-input"
              rows={3}
              autoFocus
            />
            <div className="impulse-footer">
              <button
                onClick={() => setCurrentStep('intensity')}
                disabled={!impulseText.trim()}
                className="btn-warning"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step: Intensity */}
        {currentStep === 'intensity' && (
          <div className="card intensity-card">
            <span className="intensity-emoji">🌡️</span>
            <h2 className="intensity-title">How strong is this urge?</h2>
            <p className="intensity-desc">1 = mild, 10 = overwhelming</p>
            <div className="rating-grid">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setIntensityBefore(n)}
                  className={`rating-btn ${intensityBefore === n ? 'active' : ''}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentStep('observe')}
              disabled={!intensityBefore}
              className="btn-warning full"
            >
              Next →
            </button>
          </div>
        )}

        {/* Step: Observe Emotions */}
        {currentStep === 'observe' && (
          <>
            <div className="section-header">
              <h2>What's underneath?</h2>
              <p>Select all emotions you're feeling</p>
            </div>
            <div className="emotions-grid">
              {emotions.map((e) => (
                <div
                  key={e.id}
                  className={`emotion-card ${selectedEmotions.includes(e.id) ? 'selected' : ''}`}
                  onClick={() => toggleEmotion(e.id)}
                >
                  <span className="emotion-icon">{e.icon}</span>
                  <span className="emotion-label">{e.label}</span>
                </div>
              ))}
            </div>
            <div className="card">
              <button
                onClick={() => setCurrentStep('cope')}
                disabled={selectedEmotions.length === 0}
                className="btn-warning full"
              >
                Next →
              </button>
            </div>
          </>
        )}

        {/* Step: Cope */}
        {currentStep === 'cope' && (
          <>
            <div className="section-header">
              <h2>Try a coping skill first</h2>
              <p>Pick one and do it before deciding</p>
            </div>
            {skills.map((s) => (
              <div
                key={s.text}
                className="card skill-card"
                onClick={() => { setUsedSkill(s.text); setCurrentStep('proceed') }}
              >
                <p className="skill-text">{s.text}</p>
                <p className="skill-why">{s.why}</p>
                <span className="skill-time">{s.time}</span>
              </div>
            ))}
            <div className="card">
              <button onClick={() => setCurrentStep('proceed')} className="btn-ghost full">
                Skip for now →
              </button>
            </div>
          </>
        )}

        {/* Step: Proceed */}
        {currentStep === 'proceed' && (
          <>
            <div className="section-header">
              <h2>Now decide</h2>
              <p>After pausing, what do you want to do?</p>
            </div>

            {usedSkill && (
              <div className="card tried-card">
                <p className="tried-label">You tried:</p>
                <p className="tried-text">{usedSkill}</p>
              </div>
            )}

            <div className="card">
              <p className="urge-now-label">How strong is the urge now?</p>
              <div className="rating-grid small">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setIntensityAfter(n)}
                    className={`rating-btn small ${intensityAfter === n ? 'active' : ''}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="decide-buttons">
                <button
                  onClick={() => handleComplete(false)}
                  disabled={saving}
                  className="btn-success"
                >
                  ✓ I'll wait
                </button>
                <button
                  onClick={() => handleComplete(true)}
                  disabled={saving}
                  className="btn-warning-outline"
                >
                  → I'll do it
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step: Done */}
        {currentStep === 'done' && (
          <div className="card done-card">
            <div className={`done-icon ${actedOnImpulse ? 'warning' : 'success'}`}>
              <span>{actedOnImpulse ? '👍' : '🌟'}</span>
            </div>
            <h2 className="done-title">
              {actedOnImpulse ? 'You made a choice' : 'You hit the brakes!'}
            </h2>
            <p className="done-desc">
              {actedOnImpulse
                ? 'You paused and made a conscious decision.'
                : 'You paused and chose not to act impulsively.'}
            </p>

            {intensityBefore && intensityAfter && intensityAfter < intensityBefore && (
              <div className="improvement-row">
                <span className="improvement-label">Urge:</span>
                <span className="improvement-before">{intensityBefore}</span>
                <span className="improvement-arrow">→</span>
                <span className="improvement-after">{intensityAfter}</span>
                <span className="improvement-emoji">📉</span>
              </div>
            )}

            <div className="done-buttons">
              <button onClick={reset} className="btn-secondary">
                Another urge
              </button>
              <button onClick={() => router.push('/dashboard')} className="btn-warning">
                Done
              </button>
            </div>
          </div>
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
  .brake-page {
    --primary: #1D9BF0;
    --success: #00ba7c;
    --warning: #f59e0b;
    --danger: #ef4444;
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
    border: 3px solid var(--warning);
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
  .icon-btn.red.active { 
    background: rgba(239, 68, 68, 0.25); 
    box-shadow: 0 0 0 2px var(--danger);
  }
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

  .menu-item:hover { background: var(--bg-gray); }
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
    color: var(--warning);
  }

  /* ===== CARDS ===== */
  .card {
    background: white;
    border-radius: clamp(14px, 4vw, 20px);
    padding: clamp(16px, 4.5vw, 24px);
    margin-bottom: clamp(12px, 3.5vw, 18px);
  }

  /* ===== PROGRESS CARD ===== */
  .progress-card {
    padding: clamp(12px, 3.5vw, 18px);
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: clamp(6px, 2vw, 10px);
  }

  .progress-label {
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 700;
  }

  .progress-count {
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--light-gray);
  }

  .progress-bar {
    height: clamp(4px, 1vw, 6px);
    background: var(--extra-light-gray);
    border-radius: 100px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--warning);
    border-radius: 100px;
    transition: width 0.3s ease;
  }

  /* ===== IMPULSE CARD ===== */
  .impulse-card {
    /* inherits from .card */
  }

  .impulse-header {
    text-align: center;
    margin-bottom: clamp(16px, 4vw, 22px);
  }

  .impulse-emoji {
    font-size: clamp(48px, 14vw, 72px);
    display: block;
    margin-bottom: clamp(8px, 2vw, 12px);
  }

  .impulse-title {
    font-size: clamp(20px, 5.5vw, 26px);
    font-weight: 800;
    margin: 0 0 clamp(4px, 1vw, 8px) 0;
  }

  .impulse-desc {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--light-gray);
    margin: 0;
  }

  .impulse-input {
    width: 100%;
    padding: clamp(12px, 3.5vw, 16px);
    border: 1px solid var(--extra-light-gray);
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(15px, 4vw, 18px);
    font-family: inherit;
    resize: none;
    box-sizing: border-box;
  }

  .impulse-input:focus {
    outline: none;
    border-color: var(--warning);
  }

  .impulse-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: clamp(14px, 4vw, 20px);
  }

  /* ===== INTENSITY CARD ===== */
  .intensity-card {
    text-align: center;
    padding: clamp(24px, 6vw, 36px) clamp(16px, 4vw, 24px);
  }

  .intensity-emoji {
    font-size: clamp(48px, 14vw, 72px);
    display: block;
    margin-bottom: clamp(12px, 3vw, 18px);
  }

  .intensity-title {
    font-size: clamp(18px, 5vw, 24px);
    font-weight: 800;
    margin: 0 0 clamp(6px, 1.5vw, 10px) 0;
  }

  .intensity-desc {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--light-gray);
    margin: 0 0 clamp(18px, 5vw, 26px) 0;
  }

  /* ===== RATING GRID ===== */
  .rating-grid {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: clamp(6px, 2vw, 10px);
    margin-bottom: clamp(18px, 5vw, 26px);
  }

  .rating-grid.small {
    gap: clamp(4px, 1.5vw, 8px);
    margin-bottom: 0;
  }

  .rating-btn {
    width: clamp(38px, 9vw, 46px);
    height: clamp(38px, 9vw, 46px);
    border-radius: 50%;
    border: 2px solid var(--extra-light-gray);
    background: white;
    font-size: clamp(14px, 3.8vw, 17px);
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    color: var(--dark-gray);
  }

  .rating-btn.small {
    width: clamp(32px, 8vw, 40px);
    height: clamp(32px, 8vw, 40px);
    font-size: clamp(12px, 3.2vw, 15px);
  }

  .rating-btn:hover, .rating-btn.active {
    border-color: var(--warning);
    background: rgba(245, 158, 11, 0.15);
    color: var(--warning);
  }

  /* ===== SECTION HEADER ===== */
  .section-header {
    margin-bottom: clamp(12px, 3.5vw, 18px);
  }

  .section-header h2 {
    font-size: clamp(16px, 4.5vw, 20px);
    font-weight: 700;
    margin: 0 0 clamp(2px, 0.5vw, 4px) 0;
  }

  .section-header p {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--light-gray);
    margin: 0;
  }

  /* ===== EMOTIONS GRID ===== */
  .emotions-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: clamp(8px, 2.5vw, 12px);
    margin-bottom: clamp(12px, 3.5vw, 18px);
  }

  .emotion-card {
    background: white;
    border-radius: clamp(12px, 3vw, 16px);
    padding: clamp(12px, 3.5vw, 18px);
    display: flex;
    align-items: center;
    gap: clamp(8px, 2vw, 12px);
    cursor: pointer;
    border: 2px solid transparent;
    transition: all 0.15s ease;
  }

  .emotion-card.selected {
    border-color: var(--primary);
    background: rgba(29, 155, 240, 0.05);
  }

  .emotion-card:active {
    transform: scale(0.98);
  }

  .emotion-icon {
    font-size: clamp(22px, 6vw, 28px);
  }

  .emotion-label {
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 600;
  }

  /* ===== SKILL CARDS ===== */
  .skill-card {
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .skill-card:active {
    background: var(--bg-gray);
  }

  .skill-text {
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 700;
    margin: 0 0 clamp(4px, 1vw, 6px) 0;
  }

  .skill-why {
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--light-gray);
    margin: 0 0 clamp(8px, 2vw, 12px) 0;
  }

  .skill-time {
    font-size: clamp(11px, 3vw, 13px);
    padding: clamp(2px, 0.5vw, 4px) clamp(8px, 2vw, 12px);
    background: var(--bg-gray);
    border-radius: clamp(4px, 1vw, 6px);
    color: var(--dark-gray);
    display: inline-block;
  }

  /* ===== TRIED CARD ===== */
  .tried-card {
    background: rgba(0, 186, 124, 0.05);
    border-left: 3px solid var(--success);
  }

  .tried-label {
    font-size: clamp(12px, 3.2vw, 14px);
    font-weight: 700;
    color: var(--success);
    margin: 0 0 clamp(4px, 1vw, 6px) 0;
  }

  .tried-text {
    font-size: clamp(14px, 3.8vw, 16px);
    margin: 0;
  }

  .urge-now-label {
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 700;
    text-align: center;
    margin: 0 0 clamp(12px, 3vw, 16px) 0;
  }

  /* ===== BUTTONS ===== */
  .btn-warning {
    padding: clamp(12px, 3.5vw, 16px) clamp(20px, 5vw, 28px);
    background: var(--warning);
    color: white;
    border: none;
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(14px, 4vw, 17px);
    font-weight: 600;
    cursor: pointer;
  }

  .btn-warning.full {
    width: 100%;
  }

  .btn-warning:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-warning-outline {
    flex: 1;
    padding: clamp(12px, 3.5vw, 16px);
    background: white;
    color: var(--warning);
    border: 2px solid var(--warning);
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(14px, 4vw, 17px);
    font-weight: 600;
    cursor: pointer;
  }

  .btn-success {
    flex: 1;
    padding: clamp(12px, 3.5vw, 16px);
    background: var(--success);
    color: white;
    border: none;
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(14px, 4vw, 17px);
    font-weight: 600;
    cursor: pointer;
  }

  .btn-ghost {
    width: 100%;
    padding: clamp(12px, 3.5vw, 16px);
    background: transparent;
    color: var(--dark-gray);
    border: none;
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(14px, 4vw, 17px);
    font-weight: 500;
    cursor: pointer;
  }

  .btn-ghost.full {
    width: 100%;
  }

  .btn-secondary {
    flex: 1;
    padding: clamp(12px, 3.5vw, 16px);
    background: white;
    color: var(--dark-gray);
    border: 1px solid var(--extra-light-gray);
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(14px, 4vw, 17px);
    font-weight: 600;
    cursor: pointer;
  }

  .decide-buttons {
    display: flex;
    gap: clamp(10px, 3vw, 14px);
  }

  /* ===== DONE CARD ===== */
  .done-card {
    text-align: center;
    padding: clamp(30px, 8vw, 50px) clamp(16px, 4vw, 24px);
  }

  .done-icon {
    width: clamp(64px, 18vw, 90px);
    height: clamp(64px, 18vw, 90px);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto clamp(16px, 4vw, 24px);
  }

  .done-icon.success {
    background: var(--success);
  }

  .done-icon.warning {
    background: var(--warning);
  }

  .done-icon span {
    font-size: clamp(32px, 9vw, 48px);
  }

  .done-title {
    font-size: clamp(18px, 5vw, 24px);
    font-weight: 800;
    margin: 0 0 clamp(6px, 1.5vw, 10px) 0;
  }

  .done-desc {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--light-gray);
    margin: 0 0 clamp(18px, 5vw, 26px) 0;
  }

  .improvement-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(8px, 2.5vw, 14px);
    margin-bottom: clamp(18px, 5vw, 26px);
  }

  .improvement-label {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--light-gray);
  }

  .improvement-before {
    font-size: clamp(20px, 5.5vw, 26px);
    font-weight: 700;
    color: var(--light-gray);
  }

  .improvement-arrow {
    font-size: clamp(14px, 3.8vw, 18px);
    color: var(--light-gray);
  }

  .improvement-after {
    font-size: clamp(20px, 5.5vw, 26px);
    font-weight: 700;
    color: var(--warning);
  }

  .improvement-emoji {
    font-size: clamp(20px, 5.5vw, 26px);
  }

  .done-buttons {
    display: flex;
    gap: clamp(10px, 3vw, 14px);
  }

  .done-buttons .btn-warning {
    flex: 1;
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
    
    .emotions-grid {
      gap: 14px;
    }

    .skill-card:hover {
      background: var(--bg-gray);
    }

    .emotion-card:hover {
      background: var(--bg-gray);
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
