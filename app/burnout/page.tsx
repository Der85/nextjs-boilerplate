'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface BurnoutLog {
  id: string
  user_id: string
  // Physical symptoms
  sleep_quality: number
  energy_level: number
  physical_tension: number
  // Emotional symptoms
  irritability: number
  overwhelm: number
  motivation: number
  // Cognitive symptoms
  focus_difficulty: number
  forgetfulness: number
  decision_fatigue: number
  // Calculated
  total_score: number
  severity_level: 'green' | 'yellow' | 'red'
  notes: string | null
  created_at: string
}

const questions = [
  { key: 'sleep_quality', label: 'How well did you sleep?', low: 'Terribly', high: 'Great', icon: '😴' },
  { key: 'energy_level', label: 'What\'s your energy like?', low: 'Exhausted', high: 'Energized', icon: '⚡' },
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
  
  // Form state
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
          color: 'var(--success)',
          bgColor: 'rgba(23, 191, 99, 0.1)',
          message: 'Your energy levels are healthy! Keep doing what you\'re doing.'
        }
      case 'yellow':
        return {
          label: 'Watch Out',
          emoji: '⚠️',
          color: 'var(--warning)',
          bgColor: 'rgba(255, 173, 31, 0.1)',
          message: 'You\'re showing some signs of strain. Consider taking breaks and prioritizing rest.'
        }
      case 'red':
        return {
          label: 'Burnout Risk',
          emoji: '🚨',
          color: 'var(--danger)',
          bgColor: 'rgba(224, 36, 94, 0.1)',
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
      setNotes('')
    }

    setSaving(false)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="app-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <span style={{ 
            width: '32px', 
            height: '32px', 
            border: '3px solid var(--primary)', 
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      {/* Top Bar */}
      <div className="top-bar">
        <div className="top-bar-inner">
          <button
            onClick={() => router.push('/dashboard')}
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--dark-gray)'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
            Back
          </button>
          <h1 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--black)' }}>
            🔋 Energy Tracker
          </h1>
          <div style={{ width: '60px' }}></div>
        </div>
      </div>

      <div className="main-content">
        {/* Current Status Card */}
        {recentLogs.length > 0 && !showForm && (
          <div className="card" style={{
            background: getSeverityInfo(recentLogs[0].severity_level).bgColor,
            borderLeft: `4px solid ${getSeverityInfo(recentLogs[0].severity_level).color}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <span style={{ fontSize: '32px' }}>{getSeverityInfo(recentLogs[0].severity_level).emoji}</span>
              <div>
                <div style={{ 
                  fontSize: '18px', 
                  fontWeight: 700,
                  color: getSeverityInfo(recentLogs[0].severity_level).color
                }}>
                  {getSeverityInfo(recentLogs[0].severity_level).label}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--dark-gray)' }}>
                  Last check: {formatDate(recentLogs[0].created_at)}
                </div>
              </div>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--dark-gray)', lineHeight: 1.5 }}>
              {getSeverityInfo(recentLogs[0].severity_level).message}
            </p>
          </div>
        )}

        {/* New Check Button or Form */}
        {!showForm ? (
          <div className="card">
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              How's your energy?
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--dark-gray)', marginBottom: '16px' }}>
              Track your energy levels to spot burnout before it happens.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              Start Energy Check
            </button>
          </div>
        ) : (
          <div className="card">
            {/* Progress */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <span style={{ fontSize: '13px', color: 'var(--dark-gray)' }}>
                  Question {currentQuestion + 1} of {questions.length}
                </span>
                <button
                  onClick={() => {
                    setShowForm(false)
                    setCurrentQuestion(0)
                  }}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    cursor: 'pointer',
                    color: 'var(--light-gray)',
                    fontSize: '18px'
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ 
                height: '4px', 
                background: 'var(--extra-light-gray)', 
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${((currentQuestion + 1) / questions.length) * 100}%`,
                  background: 'var(--primary)',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
 <nav className="bottom-nav">
          <button onClick={() => router.push('/dashboard')} className="nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            <span>Dashboard</span>
          </button>
          <button onClick={() => router.push('/focus')} className="nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            <span>Focus</span>
          </button>
          <button onClick={() => router.push('/goals')} className="nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
            </svg>
            <span>Goals</span>
          </button>
          <button className="nav-item nav-item-active">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 1 0 10 10H12V2z"/><path d="M12 2a10 10 0 0 1 10 10"/>
            </svg>
            <span>Energy</span>
          </button>
          <button onClick={() => router.push('/village')} className="nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span>Village</span>
          </button>
        </nav>
            {/* Question */}
            {currentQuestion < questions.length ? (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <span style={{ fontSize: '48px' }}>{questions[currentQuestion].icon}</span>
                  <h3 style={{ 
                    fontSize: '18px', 
                    fontWeight: 600, 
                    color: 'var(--black)',
                    marginTop: '12px'
                  }}>
                    {questions[currentQuestion].label}
                  </h3>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    color: 'var(--dark-gray)',
                    marginBottom: '8px'
                  }}>
                    <span>{questions[currentQuestion].low}</span>
                    <span style={{ 
                      fontSize: '24px', 
                      fontWeight: 700,
                      color: 'var(--primary)'
                    }}>
                      {answers[questions[currentQuestion].key]}
                    </span>
                    <span>{questions[currentQuestion].high}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={answers[questions[currentQuestion].key]}
                    onChange={(e) => setAnswers({
                      ...answers,
                      [questions[currentQuestion].key]: parseInt(e.target.value)
                    })}
                    style={{
                      width: '100%',
                      height: '8px',
                      borderRadius: '4px',
                      appearance: 'none',
                      background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${(answers[questions[currentQuestion].key] - 1) * 11.1}%, var(--extra-light-gray) ${(answers[questions[currentQuestion].key] - 1) * 11.1}%, var(--extra-light-gray) 100%)`,
                      cursor: 'pointer'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  {currentQuestion > 0 && (
                    <button
                      onClick={() => setCurrentQuestion(currentQuestion - 1)}
                      className="btn btn-outline"
                      style={{ flex: 1 }}
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={() => setCurrentQuestion(currentQuestion + 1)}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                  >
                    {currentQuestion === questions.length - 1 ? 'Review' : 'Next'}
                  </button>
                </div>
              </div>
            ) : (
              // Review & Submit
              <div>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: 600, 
                  marginBottom: '16px',
                  textAlign: 'center'
                }}>
                  Review Your Answers
                </h3>
                
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(3, 1fr)', 
                  gap: '8px',
                  marginBottom: '16px'
                }}>
                  {questions.map((q, i) => (
                    <div 
                      key={q.key}
                      onClick={() => setCurrentQuestion(i)}
                      style={{
                        background: 'var(--bg-gray)',
                        borderRadius: '8px',
                        padding: '12px 8px',
                        textAlign: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ fontSize: '20px', marginBottom: '4px' }}>{q.icon}</div>
                      <div style={{ 
                        fontSize: '18px', 
                        fontWeight: 700,
                        color: answers[q.key] >= 7 ? 'var(--success)' : 
                               answers[q.key] >= 4 ? 'var(--warning)' : 'var(--danger)'
                      }}>
                        {answers[q.key]}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Overall Score Preview */}
                <div style={{
                  background: getSeverityInfo(getSeverity(calculateScore().avg)).bgColor,
                  borderRadius: '12px',
                  padding: '16px',
                  textAlign: 'center',
                  marginBottom: '16px'
                }}>
                  <div style={{ fontSize: '32px', marginBottom: '4px' }}>
                    {getSeverityInfo(getSeverity(calculateScore().avg)).emoji}
                  </div>
                  <div style={{ 
                    fontSize: '24px', 
                    fontWeight: 700,
                    color: getSeverityInfo(getSeverity(calculateScore().avg)).color
                  }}>
                    {calculateScore().avg.toFixed(1)} / 10
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--dark-gray)' }}>
                    {getSeverityInfo(getSeverity(calculateScore().avg)).label}
                  </div>
                </div>

                {/* Optional Notes */}
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes? (optional)"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid var(--extra-light-gray)',
                    borderRadius: '12px',
                    fontSize: '15px',
                    resize: 'none',
                    marginBottom: '16px'
                  }}
                />

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => setCurrentQuestion(questions.length - 1)}
                    className="btn btn-outline"
                    style={{ flex: 1 }}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                  >
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
            <div className="page-header">
              <h2 className="page-title">Recent Check-ins</h2>
            </div>
            
            {recentLogs.map((log) => {
              const info = getSeverityInfo(log.severity_level)
              return (
                <div key={log.id} className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '28px' }}>{info.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          fontWeight: 700,
                          color: info.color
                        }}>
                          {(log.total_score / 9).toFixed(1)}/10
                        </span>
                        <span style={{ 
                          fontSize: '12px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: info.bgColor,
                          color: info.color,
                          fontWeight: 500
                        }}>
                          {info.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--dark-gray)' }}>
                        {formatDate(log.created_at)}
                      </div>
                    </div>
                  </div>
                  {log.notes && (
                    <p style={{ 
                      marginTop: '8px', 
                      fontSize: '14px', 
                      color: 'var(--dark-gray)' 
                    }}>
                      {log.notes}
                    </p>
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* ADHD Tip */}
        <div className="card" style={{
          background: 'rgba(29, 161, 242, 0.05)',
          borderLeft: '3px solid var(--primary)'
        }}>
          <div style={{ 
            fontSize: '13px', 
            fontWeight: 600, 
            color: 'var(--primary)',
            marginBottom: '4px'
          }}>
            💡 ADHD & Burnout
          </div>
          <p style={{ fontSize: '14px', color: 'var(--dark-gray)', lineHeight: 1.5 }}>
            ADHDers often rely on stress to stay productive, which leads to burnout faster. 
            Regular energy check-ins help you catch the warning signs early.
          </p>
        </div>

        {/* Bottom Navigation */}
        <nav className="bottom-nav">
          <button onClick={() => router.push('/dashboard')} className="nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            <span>Dashboard</span>
          </button>
          <button onClick={() => router.push('/focus')} className="nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            <span>Focus</span>
          </button>
          <button onClick={() => router.push('/goals')} className="nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
            </svg>
            <span>Goals</span>
          </button>
          <button className="nav-item nav-item-active">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 1 0 10 10H12V2z"/><path d="M12 2a10 10 0 0 1 10 10"/>
            </svg>
            <span>Energy</span>
          </button>
          <button onClick={() => router.push('/village')} className="nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span>Village</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
