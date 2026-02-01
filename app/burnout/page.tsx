'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppHeader from '@/components/AppHeader'

interface BurnoutLog {
  id: string
  user_id: string
  sleep_quality: number
  energy_level: number
  physical_tension: number
  irritability: number
  overwhelm: number
  motivation: number
  focus_difficulty: number
  forgetfulness: number
  decision_fatigue: number
  total_score: number
  severity_level: 'green' | 'yellow' | 'red'
  notes: string | null
  created_at: string
}

const questions = [
  { key: 'sleep_quality', label: 'How well did you sleep?', low: 'Terribly', high: 'Great', icon: '😴' },
  { key: 'energy_level', label: "What's your energy like?", low: 'Exhausted', high: 'Energized', icon: '⚡' },
  { key: 'physical_tension', label: 'Any physical tension or pain?', low: 'A lot', high: 'None', icon: '💪' },
  { key: 'irritability', label: 'How easily annoyed are you?', low: 'Very', high: 'Not at all', icon: '😤' },
  { key: 'overwhelm', label: 'Feeling overwhelmed?', low: 'Completely', high: 'Not at all', icon: '🌊' },
  { key: 'motivation', label: 'How motivated do you feel?', low: 'Zero', high: 'Very', icon: '🔥' },
  { key: 'focus_difficulty', label: 'How hard is it to focus?', low: 'Impossible', high: 'Easy', icon: '🎯' },
  { key: 'forgetfulness', label: 'Forgetting things?', low: 'Constantly', high: 'Not really', icon: '🧠' },
  { key: 'decision_fatigue', label: 'Hard to make decisions?', low: 'Very', high: 'Not at all', icon: '🤔' },
]

export default function BurnoutPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [recentLogs, setRecentLogs] = useState<BurnoutLog[]>([])

  const [answers, setAnswers] = useState<Record<string, number>>({
    sleep_quality: 5,
    energy_level: 5,
    physical_tension: 5,
    irritability: 5,
    overwhelm: 5,
    motivation: 5,
    focus_difficulty: 5,
    forgetfulness: 5,
    decision_fatigue: 5,
  })
  const [notes, setNotes] = useState('')
  const [currentQuestion, setCurrentQuestion] = useState(0)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      await fetchLogs(session.user.id)
      setLoading(false)
    }
    init()
  }, [router])

  const fetchLogs = async (userId: string) => {
    const { data } = await supabase
      .from('burnout_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (data) setRecentLogs(data)
  }

  const calculateScore = () => {
    const values = Object.values(answers)
    const total = values.reduce((sum, val) => sum + val, 0)
    const avg = total / values.length
    return { total, avg }
  }

  const getSeverity = (avg: number): 'green' | 'yellow' | 'red' => {
    if (avg >= 7) return 'green'
    if (avg >= 4) return 'yellow'
    return 'red'
  }

  const getSeverityInfo = (severity: 'green' | 'yellow' | 'red') => {
    switch (severity) {
      case 'green':
        return {
          label: 'Looking Good',
          emoji: '✅',
          color: '#00ba7c',
          bgColor: 'rgba(0, 186, 124, 0.1)',
          message: "Your energy levels are healthy! Keep doing what you're doing."
        }
      case 'yellow':
        return {
          label: 'Watch Out',
          emoji: '⚠️',
          color: '#ffad1f',
          bgColor: 'rgba(255, 173, 31, 0.1)',
          message: "You're showing some signs of strain. Consider taking breaks and prioritizing rest."
        }
      case 'red':
        return {
          label: 'Burnout Risk',
          emoji: '🚨',
          color: '#f4212e',
          bgColor: 'rgba(244, 33, 46, 0.1)',
          message: 'Your scores suggest high burnout risk. Please prioritize self-care and consider talking to someone.'
        }
    }
  }

  const handleSubmit = async () => {
    if (!user) return
    setSaving(true)

    const { total, avg } = calculateScore()
    const severity = getSeverity(avg)

    const { error } = await supabase.from('burnout_logs').insert({
      user_id: user.id,
      sleep_quality: answers.sleep_quality,
      energy_level: answers.energy_level,
      physical_tension: answers.physical_tension,
      irritability: answers.irritability,
      overwhelm: answers.overwhelm,
      motivation: answers.motivation,
      focus_difficulty: answers.focus_difficulty,
      forgetfulness: answers.forgetfulness,
      decision_fatigue: answers.decision_fatigue,
      total_score: total,
      severity_level: severity,
      notes: notes || null,
    })

    if (!error) {
      await fetchLogs(user.id)
      setShowForm(false)
      setCurrentQuestion(0)
      setAnswers({
        sleep_quality: 5, energy_level: 5, physical_tension: 5,
        irritability: 5, overwhelm: 5, motivation: 5,
        focus_difficulty: 5, forgetfulness: 5, decision_fatigue: 5,
      })
      setNotes('')
    }
    setSaving(false)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="burnout-page">
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    )
  }

  return (
    <div className="burnout-page">
      <AppHeader
        notificationBar={recentLogs.length > 0 ? {
          text: getSeverityInfo(recentLogs[0].severity_level).label,
          color: getSeverityInfo(recentLogs[0].severity_level).color,
          icon: '🔋',
        } : {
          text: 'Track your energy levels',
          color: '#1D9BF0',
          icon: '🔋',
        }}
      />

      <main className="main">
        {/* Page Title */}
        <div className="page-header-title">
          <h1>🔋 Energy Tracker</h1>
        </div>

        {/* Current Status Card */}
        {recentLogs.length > 0 && !showForm && (
          <div 
            className="card status-card"
            style={{ 
              background: getSeverityInfo(recentLogs[0].severity_level).bgColor,
              borderLeft: `4px solid ${getSeverityInfo(recentLogs[0].severity_level).color}`
            }}
          >
            <div className="status-header">
              <span className="status-emoji">{getSeverityInfo(recentLogs[0].severity_level).emoji}</span>
              <div className="status-info">
                <div className="status-label" style={{ color: getSeverityInfo(recentLogs[0].severity_level).color }}>
                  {getSeverityInfo(recentLogs[0].severity_level).label}
                </div>
                <div className="status-time">Last check: {formatDate(recentLogs[0].created_at)}</div>
              </div>
            </div>
            <p className="status-message">{getSeverityInfo(recentLogs[0].severity_level).message}</p>
          </div>
        )}

        {/* New Check Button or Form */}
        {!showForm ? (
          <div className="card">
            <h2 className="card-title">How's your energy?</h2>
            <p className="card-desc">Track your energy levels to spot burnout before it happens.</p>
            <button onClick={() => setShowForm(true)} className="btn-primary">
              Start Energy Check
            </button>
          </div>
        ) : (
          <div className="card form-card">
            {/* Progress */}
            <div className="progress-header">
              <span className="progress-text">Question {currentQuestion + 1} of {questions.length}</span>
              <button onClick={() => { setShowForm(false); setCurrentQuestion(0) }} className="close-btn">×</button>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }} />
            </div>

            {/* Question */}
            {currentQuestion < questions.length ? (
              <div className="question-container">
                <div className="question-display">
                  <span className="question-icon">{questions[currentQuestion].icon}</span>
                  <h3 className="question-label">{questions[currentQuestion].label}</h3>
                </div>

                <div className="slider-container">
                  <div className="slider-labels">
                    <span>{questions[currentQuestion].low}</span>
                    <span className="slider-value">{answers[questions[currentQuestion].key]}</span>
                    <span>{questions[currentQuestion].high}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={answers[questions[currentQuestion].key]}
                    onChange={(e) => setAnswers({ ...answers, [questions[currentQuestion].key]: parseInt(e.target.value) })}
                    className="slider"
                    style={{
                      background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${(answers[questions[currentQuestion].key] - 1) * 11.1}%, var(--extra-light-gray) ${(answers[questions[currentQuestion].key] - 1) * 11.1}%, var(--extra-light-gray) 100%)`
                    }}
                  />
                </div>

                <div className="nav-buttons">
                  {currentQuestion > 0 && (
                    <button onClick={() => setCurrentQuestion(currentQuestion - 1)} className="btn-secondary">
                      Back
                    </button>
                  )}
                  <button 
                    onClick={() => setCurrentQuestion(currentQuestion + 1)} 
                    className="btn-primary"
                    style={{ flex: currentQuestion === 0 ? 'none' : 1, width: currentQuestion === 0 ? '100%' : 'auto' }}
                  >
                    {currentQuestion === questions.length - 1 ? 'Review' : 'Next'}
                  </button>
                </div>
              </div>
            ) : (
              /* Review & Submit */
              <div className="review-container">
                <h3 className="review-title">Review Your Answers</h3>
                
                <div className="answers-grid">
                  {questions.map((q, i) => (
                    <div 
                      key={q.key} 
                      onClick={() => setCurrentQuestion(i)}
                      className="answer-item"
                    >
                      <div className="answer-icon">{q.icon}</div>
                      <div 
                        className="answer-value"
                        style={{ 
                          color: answers[q.key] >= 7 ? '#00ba7c' : answers[q.key] >= 4 ? '#ffad1f' : '#f4212e'
                        }}
                      >
                        {answers[q.key]}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Overall Score Preview */}
                <div 
                  className="score-preview"
                  style={{ background: getSeverityInfo(getSeverity(calculateScore().avg)).bgColor }}
                >
                  <div className="score-emoji">{getSeverityInfo(getSeverity(calculateScore().avg)).emoji}</div>
                  <div className="score-value" style={{ color: getSeverityInfo(getSeverity(calculateScore().avg)).color }}>
                    {calculateScore().avg.toFixed(1)} / 10
                  </div>
                  <div className="score-label">{getSeverityInfo(getSeverity(calculateScore().avg)).label}</div>
                </div>

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes? (optional)"
                  rows={2}
                  className="notes-input"
                />

                <div className="nav-buttons">
                  <button onClick={() => setCurrentQuestion(questions.length - 1)} className="btn-secondary">
                    Back
                  </button>
                  <button onClick={handleSubmit} disabled={saving} className="btn-primary">
                    {saving ? 'Saving...' : 'Save Check-in'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History */}
        {recentLogs.length > 0 && !showForm && (
          <>
            <div className="section-header">
              <h2>Recent Check-ins</h2>
            </div>
            {recentLogs.map((log) => {
              const info = getSeverityInfo(log.severity_level)
              return (
                <div key={log.id} className="card log-card">
                  <div className="log-header">
                    <span className="log-emoji">{info.emoji}</span>
                    <div className="log-info">
                      <div className="log-score-row">
                        <span className="log-score" style={{ color: info.color }}>
                          {(log.total_score / 9).toFixed(1)}/10
                        </span>
                        <span className="log-badge" style={{ background: info.bgColor, color: info.color }}>
                          {info.label}
                        </span>
                      </div>
                      <div className="log-time">{formatDate(log.created_at)}</div>
                    </div>
                  </div>
                  {log.notes && <p className="log-notes">{log.notes}</p>}
                </div>
              )
            })}
          </>
        )}

        {/* ADHD Tip */}
        <div className="card tip-card">
          <div className="tip-label">💡 ADHD & Burnout</div>
          <p className="tip-text">
            ADHDers often rely on stress to stay productive, which leads to burnout faster. 
            Regular energy check-ins help you catch the warning signs early.
          </p>
        </div>
      </main>

      <style jsx>{styles}</style>
    </div>
  )
}

// ============================================
// RESPONSIVE STYLES
// ============================================
const styles = `
  .burnout-page {
    --primary: #1D9BF0;
    --success: #00ba7c;
    --warning: #ffad1f;
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

  /* ===== MAIN CONTENT ===== */
  .main {
    padding: clamp(12px, 4vw, 20px);
    padding-bottom: clamp(16px, 4vw, 24px);
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

  /* ===== CARDS ===== */
  .card {
    background: white;
    border-radius: clamp(14px, 4vw, 20px);
    padding: clamp(16px, 4.5vw, 24px);
    margin-bottom: clamp(12px, 3.5vw, 18px);
  }

  .card-title {
    font-size: clamp(16px, 4.5vw, 20px);
    font-weight: 600;
    margin: 0 0 clamp(6px, 1.5vw, 10px) 0;
  }

  .card-desc {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    margin: 0 0 clamp(14px, 4vw, 20px) 0;
    line-height: 1.5;
  }

  /* ===== STATUS CARD ===== */
  .status-card {
    border-radius: clamp(14px, 4vw, 20px);
  }

  .status-header {
    display: flex;
    align-items: center;
    gap: clamp(10px, 3vw, 14px);
    margin-bottom: clamp(8px, 2vw, 12px);
  }

  .status-emoji {
    font-size: clamp(28px, 8vw, 38px);
  }

  .status-label {
    font-size: clamp(16px, 4.5vw, 20px);
    font-weight: 700;
  }

  .status-time {
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--dark-gray);
  }

  .status-message {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    line-height: 1.5;
    margin: 0;
  }

  /* ===== FORM ===== */
  .form-card {
    /* inherits from .card */
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: clamp(8px, 2vw, 12px);
  }

  .progress-text {
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--dark-gray);
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--light-gray);
    font-size: clamp(20px, 5vw, 26px);
    line-height: 1;
    padding: 4px;
  }

  .progress-bar {
    height: clamp(4px, 1vw, 6px);
    background: var(--extra-light-gray);
    border-radius: 100px;
    overflow: hidden;
    margin-bottom: clamp(18px, 5vw, 26px);
  }

  .progress-fill {
    height: 100%;
    background: var(--primary);
    border-radius: 100px;
    transition: width 0.3s ease;
  }

  /* ===== QUESTION ===== */
  .question-container {
    /* container */
  }

  .question-display {
    text-align: center;
    margin-bottom: clamp(20px, 5vw, 28px);
  }

  .question-icon {
    font-size: clamp(40px, 12vw, 56px);
    display: block;
    margin-bottom: clamp(10px, 3vw, 14px);
  }

  .question-label {
    font-size: clamp(16px, 4.5vw, 20px);
    font-weight: 600;
    margin: 0;
  }

  .slider-container {
    margin-bottom: clamp(20px, 5vw, 28px);
  }

  .slider-labels {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--dark-gray);
    margin-bottom: clamp(8px, 2vw, 12px);
  }

  .slider-value {
    font-size: clamp(22px, 6vw, 28px);
    font-weight: 700;
    color: var(--primary);
  }

  .slider {
    width: 100%;
    height: clamp(8px, 2vw, 10px);
    border-radius: 100px;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
  }

  .slider::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: clamp(22px, 6vw, 28px);
    height: clamp(22px, 6vw, 28px);
    border-radius: 50%;
    background: var(--primary);
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  }

  .slider::-moz-range-thumb {
    width: clamp(22px, 6vw, 28px);
    height: clamp(22px, 6vw, 28px);
    border-radius: 50%;
    background: var(--primary);
    cursor: pointer;
    border: none;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  }

  /* ===== BUTTONS ===== */
  .btn-primary {
    flex: 1;
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

  .nav-buttons {
    display: flex;
    gap: clamp(10px, 3vw, 14px);
  }

  /* ===== REVIEW ===== */
  .review-container {
    /* container */
  }

  .review-title {
    font-size: clamp(16px, 4.5vw, 20px);
    font-weight: 600;
    text-align: center;
    margin: 0 0 clamp(14px, 4vw, 20px) 0;
  }

  .answers-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: clamp(6px, 2vw, 10px);
    margin-bottom: clamp(14px, 4vw, 20px);
  }

  .answer-item {
    background: var(--bg-gray);
    border-radius: clamp(8px, 2vw, 12px);
    padding: clamp(10px, 3vw, 14px) clamp(6px, 2vw, 10px);
    text-align: center;
    cursor: pointer;
  }

  .answer-icon {
    font-size: clamp(18px, 5vw, 24px);
    margin-bottom: clamp(2px, 1vw, 6px);
  }

  .answer-value {
    font-size: clamp(16px, 4.5vw, 20px);
    font-weight: 700;
  }

  .score-preview {
    border-radius: clamp(10px, 2.5vw, 14px);
    padding: clamp(14px, 4vw, 20px);
    text-align: center;
    margin-bottom: clamp(14px, 4vw, 20px);
  }

  .score-emoji {
    font-size: clamp(28px, 8vw, 38px);
    margin-bottom: clamp(4px, 1vw, 8px);
  }

  .score-value {
    font-size: clamp(22px, 6vw, 28px);
    font-weight: 700;
  }

  .score-label {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
  }

  .notes-input {
    width: 100%;
    padding: clamp(10px, 3vw, 14px);
    border: 1px solid var(--extra-light-gray);
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(14px, 3.8vw, 16px);
    font-family: inherit;
    resize: none;
    margin-bottom: clamp(14px, 4vw, 20px);
    box-sizing: border-box;
  }

  .notes-input:focus {
    outline: none;
    border-color: var(--primary);
  }

  /* ===== SECTION HEADER ===== */
  .section-header {
    margin-bottom: clamp(10px, 3vw, 14px);
  }

  .section-header h2 {
    font-size: clamp(14px, 3.8vw, 17px);
    font-weight: 700;
    color: var(--dark-gray);
    margin: 0;
  }

  /* ===== LOG CARDS ===== */
  .log-card {
    /* inherits from .card */
  }

  .log-header {
    display: flex;
    align-items: center;
    gap: clamp(10px, 3vw, 14px);
  }

  .log-emoji {
    font-size: clamp(24px, 7vw, 32px);
  }

  .log-info {
    flex: 1;
  }

  .log-score-row {
    display: flex;
    align-items: center;
    gap: clamp(6px, 2vw, 10px);
    flex-wrap: wrap;
  }

  .log-score {
    font-size: clamp(15px, 4vw, 18px);
    font-weight: 700;
  }

  .log-badge {
    font-size: clamp(11px, 3vw, 13px);
    padding: clamp(2px, 0.5vw, 4px) clamp(6px, 2vw, 10px);
    border-radius: 100px;
    font-weight: 500;
  }

  .log-time {
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--dark-gray);
  }

  .log-notes {
    margin: clamp(8px, 2vw, 12px) 0 0 0;
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
  }

  /* ===== TIP CARD ===== */
  .tip-card {
    background: rgba(29, 155, 240, 0.05);
    border-left: 3px solid var(--primary);
  }

  .tip-label {
    font-size: clamp(12px, 3.2vw, 14px);
    font-weight: 600;
    color: var(--primary);
    margin-bottom: clamp(4px, 1vw, 6px);
  }

  .tip-text {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    line-height: 1.5;
    margin: 0;
  }

  /* ===== TABLET/DESKTOP ===== */
  @media (min-width: 768px) {
    .main {
      padding: 24px;
      padding-bottom: 24px;
    }

    .answers-grid {
      gap: 12px;
    }
  }

  @media (min-width: 1024px) {
    .main {
      max-width: 680px;
    }
  }
`
