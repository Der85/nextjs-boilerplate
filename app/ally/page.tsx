'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Step = 'rating' | 'block' | 'thought' | 'reframe' | 'action' | 'done'

const blocks = [
  { id: 'initiation', label: 'Getting started', desc: "Can't begin the task", icon: '🚀' },
  { id: 'focus', label: 'Staying focused', desc: 'Mind keeps wandering', icon: '🎯' },
  { id: 'motivation', label: 'Finding motivation', desc: "Don't see the point", icon: '💪' },
  { id: 'overwhelm', label: 'Feeling overwhelmed', desc: 'Too much to handle', icon: '🌊' },
  { id: 'decision', label: 'Making decisions', desc: "Can't choose what to do", icon: '🤔' },
]

const thoughts = [
  "Why can't you just do it like everyone else?",
  "You're so lazy. Just try harder.",
  "You always mess things up.",
  "You should have started this ages ago.",
  "What's wrong with you?",
]

const actions = [
  { text: 'Set a 5-minute timer and just begin', why: 'Starting is the hardest part' },
  { text: 'Write down the very first tiny step', why: 'Clarity reduces overwhelm' },
  { text: 'Move to a different location', why: 'Change of scene can help' },
  { text: 'Text a friend you\'re about to start', why: 'Accountability helps' },
  { text: 'Do the easiest part first', why: 'Build momentum with a quick win' },
]

export default function AllyPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [currentStep, setCurrentStep] = useState<Step>('rating')
  const [stuckBefore, setStuckBefore] = useState<number | null>(null)
  const [stuckAfter, setStuckAfter] = useState<number | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null)
  const [selectedThought, setSelectedThought] = useState<string | null>(null)
  const [selectedAction, setSelectedAction] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      setLoading(false)
    }
    init()
  }, [router])

  const handleComplete = async () => {
    if (!user || !selectedAction) return
    setSaving(true)
    await supabase.from('ally_sessions').insert({
      user_id: user.id,
      block_type: selectedBlock,
      drill_sergeant_thought: selectedThought,
      micro_action: selectedAction,
      challenge_before: stuckBefore,
      challenge_after: stuckAfter,
      completed: true
    })
    setCurrentStep('done')
    setSaving(false)
  }

  const reset = () => {
    setCurrentStep('rating')
    setStuckBefore(null)
    setStuckAfter(null)
    setSelectedBlock(null)
    setSelectedThought(null)
    setSelectedAction(null)
  }

  if (loading) {
    return (
      <div className="app-container flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const stepLabels = ['How stuck?', 'What\'s blocked?', 'Inner critic', 'Reframe', 'Next step']
  const stepIndex = ['rating', 'block', 'thought', 'reframe', 'action'].indexOf(currentStep)

  return (
    <div className="app-container">
      <div className="top-bar">
        <div className="top-bar-inner">
          <button onClick={() => router.push('/dashboard')} className="btn btn-ghost btn-icon">←</button>
          <h1 style={{ fontSize: '19px', fontWeight: 800 }}>I'm Stuck</h1>
          <div style={{ width: '36px' }} />
        </div>
      </div>

      <div className="main-content">
        {currentStep !== 'done' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span className="text-sm font-bold">{stepLabels[stepIndex]}</span>
              <span className="text-sm text-muted">{stepIndex + 1} of 5</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${((stepIndex + 1) / 5) * 100}%` }} />
            </div>
          </div>
        )}

        {currentStep === 'rating' && (
          <div className="card text-center" style={{ padding: '30px 15px' }}>
            <span className="emoji-large">💜</span>
            <h2 className="text-xl font-extrabold mt-3 mb-2">How stuck are you?</h2>
            <p className="text-muted mb-4">1 = a little, 5 = completely frozen</p>
            <div className="rating-grid" style={{ justifyContent: 'center' }}>
              {[1,2,3,4,5].map((n) => (
                <button key={n} onClick={() => { setStuckBefore(n); setCurrentStep('block') }}
                  className="rating-btn" style={{ width: '56px', height: '56px', fontSize: '20px' }}>{n}</button>
              ))}
            </div>
          </div>
        )}

        {currentStep === 'block' && (
          <>
            <div className="page-header"><h2 className="page-title">What feels blocked?</h2></div>
            {blocks.map((b) => (
              <div key={b.id} className="card card-clickable" onClick={() => { setSelectedBlock(b.id); setCurrentStep('thought') }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="emoji-medium">{b.icon}</span>
                  <div style={{ flex: 1 }}><p className="font-bold">{b.label}</p><p className="text-sm text-muted">{b.desc}</p></div>
                  <span className="text-muted">→</span>
                </div>
              </div>
            ))}
          </>
        )}

        {currentStep === 'thought' && (
          <>
            <div className="page-header"><h2 className="page-title">The inner critic says...</h2></div>
            {thoughts.map((t, i) => (
              <div key={i} className="card card-clickable" onClick={() => { setSelectedThought(t); setCurrentStep('reframe') }}
                style={{ borderLeft: '3px solid var(--danger)' }}>
                <p style={{ fontStyle: 'italic' }}>"{t}"</p>
              </div>
            ))}
          </>
        )}

        {currentStep === 'reframe' && (
          <>
            <div className="card" style={{ background: 'rgba(224,36,94,0.05)', borderLeft: '3px solid var(--danger)' }}>
              <p className="text-sm font-bold mb-1" style={{ color: 'var(--danger)' }}>The harsh voice:</p>
              <p style={{ fontStyle: 'italic' }}>"{selectedThought}"</p>
            </div>
            <div className="card" style={{ background: 'rgba(23,191,99,0.05)', borderLeft: '3px solid var(--success)' }}>
              <p className="text-sm font-bold mb-2" style={{ color: 'var(--success)' }}>The truth is:</p>
              <p className="mb-4">Your brain works differently—not wrongly. This challenge is about neurology, not character.</p>
              <div style={{ background: 'rgba(29,161,242,0.1)', padding: '12px', borderRadius: '8px' }}>
                <p className="text-sm text-muted mb-1">Say this to yourself:</p>
                <p className="font-bold" style={{ fontStyle: 'italic', color: 'var(--primary)' }}>"I'm doing the best I can with the brain I have."</p>
              </div>
            </div>
            <div className="card">
              <button onClick={() => setCurrentStep('action')} className="btn btn-primary w-full">I hear this → What can I do?</button>
            </div>
          </>
        )}

        {currentStep === 'action' && (
          <>
            <div className="page-header"><h2 className="page-title">One tiny step</h2></div>
            {actions.map((a, i) => (
              <div key={i} className="card card-clickable" onClick={() => setSelectedAction(a.text)}
                style={{ borderLeft: selectedAction === a.text ? '3px solid var(--primary)' : '3px solid transparent',
                  background: selectedAction === a.text ? 'rgba(29,161,242,0.05)' : undefined }}>
                <p className="font-bold">{a.text}</p>
                <p className="text-sm text-muted mt-1">{a.why}</p>
              </div>
            ))}
            <div className="section-divider" />
            <div className="card">
              <p className="font-bold mb-3 text-center">How stuck now?</p>
              <div className="rating-grid" style={{ justifyContent: 'center' }}>
                {[1,2,3,4,5].map((n) => (
                  <button key={n} onClick={() => setStuckAfter(n)}
                    className={`rating-btn ${stuckAfter === n ? 'rating-btn-active' : ''}`}>{n}</button>
                ))}
              </div>
            </div>
            <div className="card">
              <button onClick={handleComplete} disabled={!selectedAction || saving} className="btn btn-primary btn-large w-full">
                {saving ? 'Saving...' : "I'll do this →"}
              </button>
            </div>
          </>
        )}

        {currentStep === 'done' && (
          <div className="card text-center" style={{ padding: '40px 20px' }}>
            <div style={{ width: '80px', height: '80px', background: 'var(--success)', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <span style={{ fontSize: '40px' }}>🌟</span>
            </div>
            <h2 className="text-xl font-extrabold mb-2">You chose kindness</h2>
            <p className="text-muted mb-4">You picked support over self-criticism.</p>
            {stuckBefore && stuckAfter && stuckAfter < stuckBefore && (
              <div className="stats-row" style={{ justifyContent: 'center', marginBottom: '20px' }}>
                <span className="text-muted">Stuck:</span>
                <span className="stat-value" style={{ color: 'var(--light-gray)' }}>{stuckBefore}</span>
                <span className="text-muted">→</span>
                <span className="stat-value text-primary">{stuckAfter}</span>
                <span>🎉</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={reset} className="btn btn-outline" style={{ flex: 1 }}>Another round</button>
              <button onClick={() => router.push('/dashboard')} className="btn btn-primary" style={{ flex: 1 }}>Done</button>
            </div>
          </div>
        )}

        <div style={{ height: '50px' }} />
      </div>
    </div>
  )
}