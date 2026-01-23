'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  executiveBlocks, 
  drillSergeantThoughts, 
  getRandomActions, 
  getCompassionReframe,
  MicroAction,
  CompassionReframe
} from '@/lib/adhderData'

type Step = 'rating' | 'block' | 'thought' | 'reframe' | 'action' | 'done'

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
  const [reframe, setReframe] = useState<CompassionReframe | null>(null)
  const [actions, setActions] = useState<MicroAction[]>([])
  const [selectedAction, setSelectedAction] = useState<string | null>(null)
  const [customAction, setCustomAction] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      setLoading(false)
    }
    init()
  }, [router])

  const handleBlockSelect = (blockId: string) => {
    setSelectedBlock(blockId)
    setActions(getRandomActions(blockId, 3))
    setCurrentStep('thought')
  }

  const handleThoughtSelect = (thought: string) => {
    setSelectedThought(thought)
    if (selectedBlock) {
      setReframe(getCompassionReframe(thought, selectedBlock))
    }
    setCurrentStep('reframe')
  }

  const handleComplete = async () => {
    if (!user || !selectedBlock || (!selectedAction && !customAction)) return
    setSaving(true)
    
    await supabase.from('ally_sessions').insert({
      user_id: user.id,
      block_type: selectedBlock,
      drill_sergeant_thought: selectedThought,
      micro_action: selectedAction || 'custom',
      custom_action: customAction || null,
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
    setReframe(null)
    setSelectedAction(null)
    setCustomAction('')
  }

  if (loading) {
    return (
      <div className="app-container flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#1da1f2] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const stepLabels = ['How stuck?', 'What\'s blocked?', 'Inner critic', 'Reframe', 'Next step']
  const stepIndex = ['rating', 'block', 'thought', 'reframe', 'action'].indexOf(currentStep)

  return (
    <div className="app-container">
      {/* Top Bar */}
      <div className="top-bar">
        <div className="top-bar-inner">
          <button onClick={() => router.push('/dashboard')} className="btn btn-ghost btn-icon">
            ←
          </button>
          <h1 style={{ fontSize: '19px', fontWeight: 800 }}>I'm Stuck</h1>
          <div style={{ width: '36px' }} />
        </div>
      </div>

      <div className="main-content">
        {/* Progress */}
        {currentStep !== 'done' && (
          <div className="card">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-bold">{stepLabels[stepIndex]}</span>
              <span className="text-sm text-muted">{stepIndex + 1} of 5</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${((stepIndex + 1) / 5) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Step 1: Rating */}
        {currentStep === 'rating' && (
          <div className="card" style={{ textAlign: 'center', padding: '30px 15px' }}>
            <span className="emoji-large">💜</span>
            <h2 className="text-xl font-extrabold mt-3 mb-2">How stuck are you?</h2>
            <p className="text-muted mb-4">1 = a little, 5 = completely frozen</p>
            
            <div className="rating-grid" style={{ justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => { setStuckBefore(n); setCurrentStep('block') }}
                  className="rating-btn"
                  style={{ width: '56px', height: '56px', fontSize: '20px' }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Block Type */}
        {currentStep === 'block' && (
          <>
            <div className="page-header">
              <h2 className="page-title">What feels blocked?</h2>
            </div>
            {executiveBlocks.map((block) => (
              <div
                key={block.id}
                className="card card-clickable"
                onClick={() => handleBlockSelect(block.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="emoji-medium">{block.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p className="font-bold">{block.label}</p>
                    <p className="text-sm text-muted">{block.description}</p>
                  </div>
                  <span className="text-muted">→</span>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Step 3: Drill Sergeant Thought */}
        {currentStep === 'thought' && (
          <>
            <div className="page-header">
              <h2 className="page-title">The inner critic says...</h2>
              <p className="page-subtitle">Which one sounds familiar?</p>
            </div>
            {drillSergeantThoughts.map((thought) => (
              <div
                key={thought.id}
                className="card card-clickable"
                onClick={() => handleThoughtSelect(thought.text)}
                style={{ borderLeft: '3px solid var(--danger)' }}
              >
                <p style={{ fontStyle: 'italic' }}>"{thought.text}"</p>
              </div>
            ))}
          </>
        )}

        {/* Step 4: Reframe */}
        {currentStep === 'reframe' && (
          <>
            {/* Harsh thought */}
            <div className="card" style={{ background: 'rgba(224, 36, 94, 0.05)', borderLeft: '3px solid var(--danger)' }}>
              <p className="text-sm text-danger font-bold mb-1">The harsh voice:</p>
              <p style={{ fontStyle: 'italic' }}>"{selectedThought}"</p>
            </div>

            {/* Reframe */}
            <div className="card" style={{ background: 'rgba(23, 191, 99, 0.05)', borderLeft: '3px solid var(--success)' }}>
              <p className="text-sm text-success font-bold mb-2">The truth is:</p>
              <p className="mb-4">
                {reframe?.attunedResponse || 
                  "Your brain works differently—not wrongly. This challenge is about neurology, not character."}
              </p>
              
              <div style={{ background: 'rgba(29, 161, 242, 0.1)', padding: '12px', borderRadius: '8px' }}>
                <p className="text-sm text-muted mb-1">Say this to yourself:</p>
                <p className="text-primary font-bold" style={{ fontStyle: 'italic' }}>
                  "{reframe?.affirmation || "I'm doing the best I can with the brain I have."}"
                </p>
              </div>
            </div>

            <div className="card">
              <button
                onClick={() => setCurrentStep('action')}
                className="btn btn-primary btn-full"
              >
                I hear this → What can I do?
              </button>
            </div>
          </>
        )}

        {/* Step 5: Action */}
        {currentStep === 'action' && (
          <>
            <div className="page-header">
              <h2 className="page-title">One tiny step</h2>
              <p className="page-subtitle">Small and doable beats big and stuck</p>
            </div>

            {actions.map((action) => (
              <div
                key={action.id}
                className={`card card-clickable ${selectedAction === action.text ? 'selected' : ''}`}
                onClick={() => { setSelectedAction(action.text); setCustomAction('') }}
                style={{ 
                  borderLeft: selectedAction === action.text ? '3px solid var(--primary)' : '3px solid transparent',
                  background: selectedAction === action.text ? 'rgba(29, 161, 242, 0.05)' : undefined
                }}
              >
                <p className="font-bold">{action.text}</p>
                <p className="text-sm text-muted mt-1">{action.why}</p>
              </div>
            ))}

            <div className="card">
              <input
                type="text"
                value={customAction}
                onChange={(e) => { setCustomAction(e.target.value); setSelectedAction(null) }}
                placeholder="Or write your own: I will..."
                className="input"
              />
            </div>

            <div className="section-divider" />

            <div className="card">
              <p className="font-bold mb-3 text-center">How stuck now?</p>
              <div className="rating-grid" style={{ justifyContent: 'center' }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setStuckAfter(n)}
                    className={`rating-btn ${stuckAfter === n ? 'rating-btn-active' : ''}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <button
                onClick={handleComplete}
                disabled={(!selectedAction && !customAction) || saving}
                className="btn btn-primary btn-full btn-large"
              >
                {saving ? 'Saving...' : "I'll do this →"}
              </button>
            </div>
          </>
        )}

        {/* Done */}
        {currentStep === 'done' && (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ 
              width: '80px', 
              height: '80px', 
              background: 'var(--success)', 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <span style={{ fontSize: '40px' }}>🌟</span>
            </div>
            
            <h2 className="text-xl font-extrabold mb-2">You chose kindness</h2>
            <p className="text-muted mb-4">
              You picked support over self-criticism. That's real progress.
            </p>

            {stuckBefore && stuckAfter && stuckAfter < stuckBefore && (
              <div className="stats-row" style={{ justifyContent: 'center', marginBottom: '20px' }}>
                <span className="text-muted">Stuck level:</span>
                <span className="stat-value" style={{ color: 'var(--light-gray)' }}>{stuckBefore}</span>
                <span className="text-muted">→</span>
                <span className="stat-value text-primary">{stuckAfter}</span>
                <span>🎉</span>
              </div>
            )}

            <div style={{ 
              background: 'rgba(23, 191, 99, 0.1)', 
              padding: '16px', 
              borderRadius: '12px',
              marginBottom: '20px'
            }}>
              <p className="text-sm text-success font-bold mb-1">Your next step:</p>
              <p>{selectedAction || customAction}</p>
            </div>

            <div className="flex gap-3">
              <button onClick={reset} className="btn btn-outline" style={{ flex: 1 }}>
                Another round
              </button>
              <button onClick={() => router.push('/dashboard')} className="btn btn-primary" style={{ flex: 1 }}>
                Done
              </button>
            </div>
          </div>
        )}

        <div style={{ height: '50px' }} />
      </div>
    </div>
  )
}
