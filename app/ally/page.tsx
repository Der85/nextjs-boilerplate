'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppHeader from '@/components/AppHeader'
import { useImplicitOverwhelmLogger } from '@/hooks/useImplicitOverwhelmLogger'

// ============================================
// Types
// ============================================
type Step = 'loading' | 'commitment_check' | 'rating' | 'block' | 'thought' | 'reframe' | 'action' | 'done'

interface BlockSuggestion {
  id: string
  label: string
  description: string
  icon: string
  isAIGenerated: boolean
}

interface ReframeSuggestion {
  harshVoice: string
  kindVoice: string
  affirmation: string
}

interface ActionSuggestion {
  id: string
  text: string
  why: string
  timeEstimate: string
  difficulty: 'easy' | 'medium'
}

interface ActiveCommitment {
  id: string
  action_text: string
  action_type: string
  block_type: string
  created_at: string
}

interface ContextInfo {
  recentMood?: number
  totalCheckIns?: number
  streak?: { type: string; days: number } | null
}

// ============================================
// API Helper
// ============================================
const getClientTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

async function fetchStuckCoach(step: string, data: Record<string, any> = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')

  const response = await fetch('/api/stuck-coach', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ step, timeZone: getClientTimeZone(), ...data })
  })

  if (!response.ok) throw new Error('API request failed')
  return response.json()
}

// ============================================
// Fallback static data
// ============================================
const STATIC_BLOCKS: BlockSuggestion[] = [
  { id: 'initiation', label: 'Getting started', description: "Can't begin the task", icon: '🚀', isAIGenerated: false },
  { id: 'focus', label: 'Staying focused', description: 'Mind keeps wandering', icon: '🎯', isAIGenerated: false },
  { id: 'motivation', label: 'Finding motivation', description: "Don't see the point", icon: '💪', isAIGenerated: false },
  { id: 'overwhelm', label: 'Feeling overwhelmed', description: 'Too much to handle', icon: '🌊', isAIGenerated: false },
  { id: 'decision', label: 'Making decisions', description: "Can't choose what to do", icon: '🤔', isAIGenerated: false },
]

const STATIC_THOUGHTS = [
  "Why can't you just do it like everyone else?",
  "You're so lazy. Just try harder.",
  "You always mess things up.",
  "You should have started this ages ago.",
  "What's wrong with you?",
]

const STATIC_ACTIONS: ActionSuggestion[] = [
  { id: 'timer', text: 'Set a 5-minute timer and just begin', why: 'Starting is the hardest part', timeEstimate: '5 min', difficulty: 'easy' },
  { id: 'tiny_step', text: 'Write down the very first tiny step', why: 'Clarity reduces overwhelm', timeEstimate: '2 min', difficulty: 'easy' },
  { id: 'location', text: 'Move to a different location', why: 'Change of scene can help', timeEstimate: '1 min', difficulty: 'easy' },
  { id: 'body_double', text: "Text a friend you're about to start", why: 'Accountability helps', timeEstimate: '1 min', difficulty: 'easy' },
  { id: 'easiest', text: 'Do the easiest part first', why: 'Build momentum with a quick win', timeEstimate: '10 min', difficulty: 'medium' },
]

// ============================================
// Main Component
// ============================================
export default function AllyPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  // Trojan Horse: silently log overwhelm when user visits this page
  useImplicitOverwhelmLogger()

  // Flow state
  const [currentStep, setCurrentStep] = useState<Step>('loading')
  const [stuckBefore, setStuckBefore] = useState<number | null>(null)
  const [stuckAfter, setStuckAfter] = useState<number | null>(null)

  // Dynamic content from API
  const [greeting, setGreeting] = useState<string>("What's getting in the way?")
  const [blocks, setBlocks] = useState<BlockSuggestion[]>(STATIC_BLOCKS)
  const [thoughts, setThoughts] = useState<string[]>(STATIC_THOUGHTS)
  const [reframe, setReframe] = useState<ReframeSuggestion | null>(null)
  const [actions, setActions] = useState<ActionSuggestion[]>(STATIC_ACTIONS)
  const [activeCommitment, setActiveCommitment] = useState<ActiveCommitment | null>(null)
  const [contextInfo, setContextInfo] = useState<ContextInfo>({})

  // Selections
  const [selectedBlock, setSelectedBlock] = useState<BlockSuggestion | null>(null)
  const [customBlock, setCustomBlock] = useState('')
  const [selectedThought, setSelectedThought] = useState<string | null>(null)
  const [customThought, setCustomThought] = useState('')
  const [selectedAction, setSelectedAction] = useState<ActionSuggestion | null>(null)
  const [customAction, setCustomAction] = useState('')

  // UI state
  const [isLoading, setIsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showCustomBlock, setShowCustomBlock] = useState(false)
  const [showCustomThought, setShowCustomThought] = useState(false)
  const [showCustomAction, setShowCustomAction] = useState(false)
  const [commitmentFollowUp, setCommitmentFollowUp] = useState<'yes' | 'no' | 'partial' | null>(null)

  // Initialize
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUser(session.user)

      try {
        const data = await fetchStuckCoach('initial')
        setBlocks(data.blocks || STATIC_BLOCKS)
        setGreeting(data.greeting || "What's getting in the way?")
        setContextInfo(data.context || {})
        
        if (data.activeCommitments?.length > 0) {
          setActiveCommitment(data.activeCommitments[0])
          setCurrentStep('commitment_check')
        } else {
          setCurrentStep('rating')
        }
      } catch {
        setCurrentStep('rating')
      }
    }
    init()
  }, [router])

  // Handlers
  const handleCommitmentResponse = useCallback(async (response: 'yes' | 'no' | 'partial') => {
    setIsLoading(true)
    try {
      const data = await fetchStuckCoach('commitment_response', {
        commitmentId: activeCommitment?.id,
        response,
        blockType: activeCommitment?.block_type,
      })
      if (data.blocks) setBlocks(data.blocks)
      if (data.greeting) setGreeting(data.greeting)
      setCommitmentFollowUp(response)
      setCurrentStep('rating')
    } catch {
      setCommitmentFollowUp(response)
      setCurrentStep('rating')
    } finally {
      setIsLoading(false)
    }
  }, [activeCommitment])

  const handleRatingSelect = useCallback(async (rating: number) => {
    setStuckBefore(rating)
    setIsLoading(true)
    try {
      const data = await fetchStuckCoach('rating', { stuckRating: rating })
      if (data.blocks) setBlocks(data.blocks)
      if (data.greeting) setGreeting(data.greeting)
    } catch { /* use defaults */ }
    setIsLoading(false)
    setCurrentStep('block')
  }, [])

  const handleBlockSelect = useCallback(async (block: BlockSuggestion) => {
    setSelectedBlock(block)
    setIsLoading(true)
    try {
      const data = await fetchStuckCoach('block', { blockType: block.id, blockLabel: block.label, stuckRating: stuckBefore })
      if (data.thoughts) setThoughts(data.thoughts)
    } catch { /* use defaults */ }
    setIsLoading(false)
    setCurrentStep('thought')
  }, [stuckBefore])

  const handleCustomBlockSubmit = useCallback(async () => {
    const block: BlockSuggestion = { id: 'custom', label: customBlock, description: 'Custom block', icon: '✏️', isAIGenerated: false }
    setSelectedBlock(block)
    setIsLoading(true)
    try {
      const data = await fetchStuckCoach('block', { blockType: 'custom', blockLabel: customBlock, stuckRating: stuckBefore })
      if (data.thoughts) setThoughts(data.thoughts)
    } catch { /* use defaults */ }
    setIsLoading(false)
    setCurrentStep('thought')
  }, [customBlock, stuckBefore])

  const handleThoughtSelect = useCallback(async (thought: string) => {
    setSelectedThought(thought)
    setIsLoading(true)
    try {
      const data = await fetchStuckCoach('thought', {
        thought,
        blockType: selectedBlock?.id,
        blockLabel: selectedBlock?.label,
        stuckRating: stuckBefore,
      })
      if (data.reframe) setReframe(data.reframe)
      else setReframe({ harshVoice: thought, kindVoice: "Your brain works differently, not wrong. This difficulty is real, not laziness.", affirmation: "I'm doing my best with a brain that works differently." })
    } catch {
      setReframe({ harshVoice: thought, kindVoice: "Your brain works differently, not wrong. This difficulty is real, not laziness.", affirmation: "I'm doing my best with a brain that works differently." })
    }
    setIsLoading(false)
    setCurrentStep('reframe')
  }, [selectedBlock, stuckBefore])

  const handleCustomThoughtSubmit = useCallback(async () => {
    if (!customThought.trim()) return
    await handleThoughtSelect(customThought)
  }, [customThought, handleThoughtSelect])

  const handleReframeContinue = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await fetchStuckCoach('reframe', {
        blockType: selectedBlock?.id,
        blockLabel: selectedBlock?.label,
        thought: selectedThought || customThought,
        stuckRating: stuckBefore,
      })
      if (data.actions) setActions(data.actions)
    } catch { /* use defaults */ }
    setIsLoading(false)
    setCurrentStep('action')
  }, [selectedBlock, selectedThought, customThought, stuckBefore])

  const handleComplete = useCallback(async () => {
    const actionText = selectedAction?.text || customAction
    if (!actionText?.trim()) return
    setSaving(true)
    try {
      await fetchStuckCoach('complete', {
        stuckBefore,
        stuckAfter,
        blockType: selectedBlock?.id,
        blockLabel: selectedBlock?.label,
        thought: selectedThought || customThought,
        actionType: selectedAction?.id || 'custom',
        actionText,
      })
    } catch { /* save failed, still show done */ }
    setSaving(false)
    setCurrentStep('done')
  }, [selectedAction, customAction, stuckBefore, stuckAfter, selectedBlock, selectedThought, customThought])

  const reset = () => {
    setCurrentStep('rating')
    setStuckBefore(null)
    setStuckAfter(null)
    setSelectedBlock(null)
    setCustomBlock('')
    setSelectedThought(null)
    setCustomThought('')
    setReframe(null)
    setSelectedAction(null)
    setCustomAction('')
    setShowCustomBlock(false)
    setShowCustomThought(false)
    setShowCustomAction(false)
    setCommitmentFollowUp(null)
  }

  const stepLabels = ['Check-in', 'How stuck?', "What's blocked?", 'Inner critic', 'Reframe', 'Next step']
  const getStepIndex = () => {
    const m: Record<Step, number> = { loading: 0, commitment_check: 0, rating: 1, block: 2, thought: 3, reframe: 4, action: 5, done: 5 }
    return m[currentStep]
  }

  if (currentStep === 'loading') {
    return (
      <div className="ally-page">
        <div className="loading-container"><div className="spinner" /><p>Loading your context...</p></div>
        <style jsx>{styles}</style>
      </div>
    )
  }

  return (
    <div className="ally-page">
      <AppHeader
        notificationBar={{
          text: 'Break through executive dysfunction blocks',
          color: '#805ad5',
          icon: '💜',
        }}
      />

      <main className="main">
        <div className="page-header-title">
          <h1>💜 I'm Stuck</h1>
          {contextInfo.streak?.type === 'checking_in' && contextInfo.streak.days >= 3 && (
            <span className="streak-badge">🔥 {contextInfo.streak.days} day streak</span>
          )}
        </div>

        {currentStep !== 'done' && currentStep !== 'commitment_check' && (
          <div className="card progress-card">
            <div className="progress-header">
              <span className="progress-label">{stepLabels[getStepIndex()]}</span>
              <span className="progress-count">{getStepIndex()} of 5</span>
            </div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${(getStepIndex() / 5) * 100}%` }} /></div>
          </div>
        )}

        {isLoading && <div className="loading-overlay"><div className="spinner small" /><span>Personalizing...</span></div>}

        {/* Commitment Check */}
        {currentStep === 'commitment_check' && activeCommitment && (
          <div className="card commitment-card">
            <span className="commitment-emoji">🤔</span>
            <h2 className="commitment-title">Quick check-in first</h2>
            <p className="commitment-context">Earlier you committed to:</p>
            <div className="commitment-action">"{activeCommitment.action_text}"</div>
            <p className="commitment-question">Did you do it?</p>
            <div className="commitment-buttons">
              <button onClick={() => handleCommitmentResponse('yes')} className="commit-btn yes">✓ Yes!</button>
              <button onClick={() => handleCommitmentResponse('partial')} className="commit-btn partial">≈ Partially</button>
              <button onClick={() => handleCommitmentResponse('no')} className="commit-btn no">✗ Not yet</button>
            </div>
            <button onClick={() => setCurrentStep('rating')} className="skip-link">Skip for now →</button>
          </div>
        )}

        {/* Rating */}
        {currentStep === 'rating' && (
          <div className="card rating-card">
            {commitmentFollowUp === 'yes' && <div className="follow-up-message success">Nice! That's a win. Now let's tackle what's next.</div>}
            {commitmentFollowUp === 'partial' && <div className="follow-up-message partial">Progress counts. Let's build on that.</div>}
            {commitmentFollowUp === 'no' && <div className="follow-up-message">No judgment—let's figure out what's in the way.</div>}
            <span className="rating-emoji">💜</span>
            <h2 className="rating-title">How stuck are you?</h2>
            <p className="rating-desc">1 = a little, 5 = completely frozen</p>
            <div className="rating-grid">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => handleRatingSelect(n)} className="rating-btn">{n}</button>
              ))}
            </div>
          </div>
        )}

        {/* Block */}
        {currentStep === 'block' && (
          <>
            <div className="section-header"><h2>{greeting}</h2></div>
            {blocks.map((block) => (
              <div key={block.id} className={`card option-card ${block.isAIGenerated ? 'ai-generated' : ''}`} onClick={() => handleBlockSelect(block)}>
                <span className="option-icon">{block.icon}</span>
                <div className="option-content">
                  <p className="option-label">{block.label}{block.isAIGenerated && <span className="ai-badge">✨ For you</span>}</p>
                  <p className="option-desc">{block.description}</p>
                </div>
                <span className="option-arrow">→</span>
              </div>
            ))}
            {!showCustomBlock ? (
              <button className="add-custom-btn" onClick={() => setShowCustomBlock(true)}>+ Something else</button>
            ) : (
              <div className="card custom-input-card">
                <input type="text" placeholder="Describe what's blocking you..." value={customBlock} onChange={(e) => setCustomBlock(e.target.value)} className="custom-input" autoFocus />
                <div className="custom-input-actions">
                  <button onClick={() => setShowCustomBlock(false)} className="btn-cancel">Cancel</button>
                  <button onClick={handleCustomBlockSubmit} disabled={!customBlock.trim()} className="btn-primary small">Continue →</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Thought */}
        {currentStep === 'thought' && (
          <>
            <div className="section-header"><h2>What's the harsh voice saying?</h2><p className="section-subtext">Pick what resonates, or write your own</p></div>
            {thoughts.map((thought, i) => (
              <div key={i} className="card thought-card" onClick={() => handleThoughtSelect(thought)}>
                <p className="thought-text">"{thought}"</p>
              </div>
            ))}
            {!showCustomThought ? (
              <button className="add-custom-btn" onClick={() => setShowCustomThought(true)}>+ Write my own</button>
            ) : (
              <div className="card custom-input-card">
                <input type="text" placeholder="What's your inner critic saying?" value={customThought} onChange={(e) => setCustomThought(e.target.value)} className="custom-input" autoFocus />
                <div className="custom-input-actions">
                  <button onClick={() => setShowCustomThought(false)} className="btn-cancel">Cancel</button>
                  <button onClick={handleCustomThoughtSubmit} disabled={!customThought.trim()} className="btn-primary small">Continue →</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Reframe */}
        {currentStep === 'reframe' && reframe && (
          <>
            <div className="card harsh-card">
              <p className="harsh-label">The harsh voice:</p>
              <p className="harsh-text">"{reframe.harshVoice}"</p>
            </div>
            <div className="card truth-card">
              <p className="truth-label">The truth is:</p>
              <p className="truth-text">{reframe.kindVoice}</p>
              <div className="affirmation-box">
                <p className="affirmation-prompt">Say this to yourself:</p>
                <p className="affirmation-text">"{reframe.affirmation}"</p>
              </div>
            </div>
            <div className="card">
              <button onClick={handleReframeContinue} className="btn-primary">I hear this → What can I do?</button>
            </div>
          </>
        )}

        {/* Action */}
        {currentStep === 'action' && (
          <>
            <div className="section-header"><h2>One tiny step</h2><p className="section-subtext">Pick something you can do in the next 10 minutes</p></div>
            {actions.map((action) => (
              <div key={action.id} className={`card action-card ${selectedAction?.id === action.id ? 'selected' : ''}`} onClick={() => { setSelectedAction(action); setCustomAction(''); setShowCustomAction(false) }}>
                <div className="action-header">
                  <p className="action-text">{action.text}</p>
                  <span className="action-time">{action.timeEstimate}</span>
                </div>
                <p className="action-why">{action.why}</p>
              </div>
            ))}
            {!showCustomAction ? (
              <button className="add-custom-btn" onClick={() => { setShowCustomAction(true); setSelectedAction(null) }}>+ I have my own idea</button>
            ) : (
              <div className="card custom-input-card">
                <input type="text" placeholder="What tiny step will you take?" value={customAction} onChange={(e) => { setCustomAction(e.target.value); setSelectedAction(null) }} className="custom-input" autoFocus />
                <div className="custom-input-actions"><button onClick={() => setShowCustomAction(false)} className="btn-cancel">Cancel</button></div>
              </div>
            )}
            <div className="divider" />
            <div className="card">
              <p className="stuck-after-label">How stuck do you feel now?</p>
              <div className="rating-grid centered">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setStuckAfter(n)} className={`rating-btn small ${stuckAfter === n ? 'active' : ''}`}>{n}</button>
                ))}
              </div>
            </div>
            <div className="card commitment-confirm">
              <p className="commitment-label">Your commitment:</p>
              <p className="commitment-text">{selectedAction?.text || customAction || 'Select an action above'}</p>
              <p className="commitment-note">I'll ask you about this next time you check in 💜</p>
              <button onClick={handleComplete} disabled={(!selectedAction && !customAction.trim()) || saving} className="btn-primary large">{saving ? 'Saving...' : "I'll do this →"}</button>
            </div>
          </>
        )}

        {/* Done */}
        {currentStep === 'done' && (
          <div className="card done-card">
            <div className="done-icon"><span>🌟</span></div>
            <h2 className="done-title">You chose kindness</h2>
            <p className="done-desc">You picked support over self-criticism.</p>
            {stuckBefore && stuckAfter && stuckAfter < stuckBefore && (
              <div className="improvement-row">
                <span className="improvement-label">Stuck level:</span>
                <span className="improvement-before">{stuckBefore}</span>
                <span className="improvement-arrow">→</span>
                <span className="improvement-after">{stuckAfter}</span>
                <span className="improvement-emoji">🎉</span>
              </div>
            )}
            <div className="done-commitment">
              <p className="done-commitment-label">Your commitment:</p>
              <p className="done-commitment-text">{selectedAction?.text || customAction}</p>
            </div>
            <div className="done-buttons">
              <button onClick={reset} className="btn-secondary">Another round</button>
              <button onClick={() => router.push('/dashboard')} className="btn-primary">Done</button>
            </div>
          </div>
        )}
      </main>

      <style jsx>{styles}</style>
    </div>
  )
}

const styles = `
  .ally-page {
    --primary: #1D9BF0;
    --success: #00ba7c;
    --danger: #f4212e;
    --purple: #805ad5;
    --purple-light: rgba(128, 90, 213, 0.1);
    --purple-medium: rgba(128, 90, 213, 0.2);
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
  .spinner { width: clamp(24px, 5vw, 32px); height: clamp(24px, 5vw, 32px); border: 3px solid var(--purple); border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; }
  .spinner.small { width: 20px; height: 20px; border-width: 2px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-overlay { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 16px; background: white; border-radius: 12px; margin-bottom: 16px; color: var(--purple); font-size: 14px; }
  .main { padding: clamp(12px, 4vw, 20px); padding-bottom: clamp(16px, 4vw, 24px); max-width: 600px; margin: 0 auto; }
  .page-header-title { display: flex; align-items: center; gap: 12px; margin-bottom: clamp(14px, 4vw, 20px); }
  .page-header-title h1 { font-size: clamp(22px, 6vw, 28px); font-weight: 700; margin: 0; }
  .streak-badge { font-size: 12px; background: linear-gradient(135deg, #ff6b35, #f7c59f); color: white; padding: 4px 10px; border-radius: 100px; font-weight: 600; }
  .card { background: white; border-radius: clamp(14px, 4vw, 20px); padding: clamp(16px, 4.5vw, 24px); margin-bottom: clamp(12px, 3.5vw, 18px); }
  .progress-card { padding: clamp(12px, 3.5vw, 18px); }
  .progress-header { display: flex; justify-content: space-between; margin-bottom: clamp(6px, 2vw, 10px); }
  .progress-label { font-size: clamp(13px, 3.5vw, 15px); font-weight: 700; }
  .progress-count { font-size: clamp(12px, 3.2vw, 14px); color: var(--light-gray); }
  .progress-bar { height: clamp(4px, 1vw, 6px); background: var(--extra-light-gray); border-radius: 100px; overflow: hidden; }
  .progress-fill { height: 100%; background: var(--purple); border-radius: 100px; transition: width 0.3s ease; }
  .commitment-card { text-align: center; padding: clamp(24px, 6vw, 36px) clamp(16px, 4vw, 24px); }
  .commitment-emoji { font-size: clamp(40px, 12vw, 56px); display: block; margin-bottom: 12px; }
  .commitment-title { font-size: clamp(18px, 5vw, 22px); font-weight: 800; margin: 0 0 8px 0; }
  .commitment-context { font-size: clamp(13px, 3.5vw, 15px); color: var(--light-gray); margin: 0 0 12px 0; }
  .commitment-action { background: var(--purple-light); padding: 12px 16px; border-radius: 12px; font-size: clamp(14px, 3.8vw, 16px); font-weight: 600; color: var(--purple); margin-bottom: 16px; }
  .commitment-question { font-size: clamp(15px, 4vw, 17px); font-weight: 600; margin: 0 0 16px 0; }
  .commitment-buttons { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
  .commit-btn { padding: 12px 20px; border-radius: 100px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
  .commit-btn.yes { background: var(--success); color: white; }
  .commit-btn.partial { background: #fbbf24; color: #78350f; }
  .commit-btn.no { background: var(--extra-light-gray); color: var(--dark-gray); }
  .skip-link { background: none; border: none; color: var(--light-gray); font-size: 13px; cursor: pointer; margin-top: 16px; padding: 8px; }
  .rating-card { text-align: center; padding: clamp(24px, 6vw, 36px) clamp(16px, 4vw, 24px); }
  .follow-up-message { background: var(--extra-light-gray); padding: 10px 14px; border-radius: 10px; font-size: 14px; margin-bottom: 20px; color: var(--dark-gray); }
  .follow-up-message.success { background: rgba(0, 186, 124, 0.1); color: #047857; }
  .follow-up-message.partial { background: rgba(251, 191, 36, 0.15); color: #92400e; }
  .rating-emoji { font-size: clamp(48px, 14vw, 72px); display: block; margin-bottom: clamp(12px, 3vw, 18px); }
  .rating-title { font-size: clamp(18px, 5vw, 24px); font-weight: 800; margin: 0 0 clamp(6px, 1.5vw, 10px) 0; }
  .rating-desc { font-size: clamp(13px, 3.5vw, 15px); color: var(--light-gray); margin: 0 0 clamp(18px, 5vw, 26px) 0; }
  .rating-grid { display: flex; justify-content: center; gap: clamp(8px, 2.5vw, 14px); }
  .rating-grid.centered { justify-content: center; }
  .rating-btn { width: clamp(48px, 13vw, 60px); height: clamp(48px, 13vw, 60px); border-radius: 50%; border: 2px solid var(--extra-light-gray); background: white; font-size: clamp(18px, 5vw, 24px); font-weight: 700; cursor: pointer; transition: all 0.2s ease; color: var(--dark-gray); }
  .rating-btn:hover, .rating-btn.active { border-color: var(--purple); background: var(--purple-light); color: var(--purple); }
  .rating-btn.small { width: clamp(40px, 11vw, 50px); height: clamp(40px, 11vw, 50px); font-size: clamp(16px, 4.5vw, 20px); }
  .section-header { margin-bottom: clamp(10px, 3vw, 14px); }
  .section-header h2 { font-size: clamp(16px, 4.5vw, 20px); font-weight: 700; margin: 0 0 4px 0; }
  .section-subtext { font-size: 13px; color: var(--light-gray); margin: 0; }
  .option-card { display: flex; align-items: center; gap: clamp(10px, 3vw, 14px); cursor: pointer; transition: all 0.15s ease; border: 2px solid transparent; }
  .option-card:active, .option-card:hover { background: var(--bg-gray); }
  .option-card.ai-generated { border-color: var(--purple-light); background: linear-gradient(135deg, rgba(128, 90, 213, 0.03), rgba(29, 155, 240, 0.03)); }
  .option-icon { font-size: clamp(28px, 8vw, 38px); flex-shrink: 0; }
  .option-content { flex: 1; min-width: 0; }
  .option-label { font-size: clamp(15px, 4vw, 18px); font-weight: 700; margin: 0 0 clamp(2px, 0.5vw, 4px) 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .ai-badge { font-size: 11px; background: var(--purple); color: white; padding: 2px 8px; border-radius: 100px; font-weight: 500; }
  .option-desc { font-size: clamp(12px, 3.2vw, 14px); color: var(--light-gray); margin: 0; }
  .option-arrow { font-size: clamp(16px, 4vw, 20px); color: var(--light-gray); flex-shrink: 0; }
  .add-custom-btn { width: 100%; padding: 14px; background: none; border: 2px dashed var(--extra-light-gray); border-radius: 14px; color: var(--light-gray); font-size: 14px; cursor: pointer; transition: all 0.2s; }
  .add-custom-btn:hover { border-color: var(--purple); color: var(--purple); background: var(--purple-light); }
  .custom-input-card { padding: 16px; }
  .custom-input { width: 100%; padding: 12px 14px; border: 2px solid var(--extra-light-gray); border-radius: 10px; font-size: 15px; margin-bottom: 12px; box-sizing: border-box; }
  .custom-input:focus { outline: none; border-color: var(--purple); }
  .custom-input-actions { display: flex; justify-content: flex-end; gap: 10px; }
  .btn-cancel { padding: 8px 16px; background: none; border: none; color: var(--light-gray); font-size: 14px; cursor: pointer; }
  .thought-card { border-left: 3px solid var(--danger); cursor: pointer; transition: all 0.15s; }
  .thought-card:active, .thought-card:hover { background: var(--bg-gray); }
  .thought-text { font-size: clamp(14px, 3.8vw, 16px); font-style: italic; color: var(--dark-gray); margin: 0; line-height: 1.5; }
  .harsh-card { background: rgba(244, 33, 46, 0.05); border-left: 3px solid var(--danger); }
  .harsh-label { font-size: clamp(12px, 3.2vw, 14px); font-weight: 700; color: var(--danger); margin: 0 0 clamp(4px, 1vw, 6px) 0; }
  .harsh-text { font-size: clamp(14px, 3.8vw, 16px); font-style: italic; color: var(--dark-gray); margin: 0; }
  .truth-card { background: rgba(0, 186, 124, 0.05); border-left: 3px solid var(--success); }
  .truth-label { font-size: clamp(12px, 3.2vw, 14px); font-weight: 700; color: var(--success); margin: 0 0 clamp(6px, 1.5vw, 10px) 0; }
  .truth-text { font-size: clamp(14px, 3.8vw, 16px); color: var(--dark-gray); margin: 0 0 clamp(14px, 4vw, 20px) 0; line-height: 1.6; }
  .affirmation-box { background: var(--purple-light); padding: clamp(10px, 3vw, 14px); border-radius: clamp(8px, 2vw, 12px); }
  .affirmation-prompt { font-size: clamp(11px, 3vw, 13px); color: var(--light-gray); margin: 0 0 clamp(4px, 1vw, 6px) 0; }
  .affirmation-text { font-size: clamp(14px, 3.8vw, 16px); font-weight: 700; font-style: italic; color: var(--purple); margin: 0; }
  .action-card { border-left: 3px solid transparent; cursor: pointer; transition: all 0.15s ease; }
  .action-card.selected { border-left-color: var(--primary); background: rgba(29, 155, 240, 0.05); }
  .action-card:active, .action-card:hover { background: var(--bg-gray); }
  .action-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 4px; }
  .action-text { font-size: clamp(14px, 3.8vw, 16px); font-weight: 700; margin: 0; flex: 1; }
  .action-time { font-size: 12px; color: var(--primary); background: rgba(29, 155, 240, 0.1); padding: 2px 8px; border-radius: 100px; white-space: nowrap; }
  .action-why { font-size: clamp(12px, 3.2vw, 14px); color: var(--light-gray); margin: 0; }
  .divider { height: 1px; background: var(--extra-light-gray); margin: clamp(14px, 4vw, 22px) 0; }
  .stuck-after-label { font-size: clamp(14px, 3.8vw, 16px); font-weight: 700; text-align: center; margin: 0 0 clamp(12px, 3vw, 16px) 0; }
  .commitment-confirm { text-align: center; border: 2px solid var(--purple-light); background: linear-gradient(180deg, white, rgba(128, 90, 213, 0.03)); }
  .commitment-label { font-size: 13px; color: var(--light-gray); margin: 0 0 8px 0; }
  .commitment-text { font-size: 16px; font-weight: 700; color: var(--purple); margin: 0 0 8px 0; min-height: 24px; }
  .commitment-note { font-size: 12px; color: var(--light-gray); margin: 0 0 16px 0; }
  .btn-primary { width: 100%; padding: clamp(12px, 3.5vw, 16px); background: var(--primary); color: white; border: none; border-radius: clamp(10px, 2.5vw, 14px); font-size: clamp(14px, 4vw, 17px); font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
  .btn-primary.small { width: auto; padding: 10px 20px; font-size: 14px; }
  .btn-primary.large { padding: clamp(14px, 4vw, 18px); font-size: clamp(15px, 4.2vw, 18px); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-secondary { flex: 1; padding: clamp(12px, 3.5vw, 16px); background: white; color: var(--dark-gray); border: 1px solid var(--extra-light-gray); border-radius: clamp(10px, 2.5vw, 14px); font-size: clamp(14px, 4vw, 17px); font-weight: 600; cursor: pointer; }
  .done-card { text-align: center; padding: clamp(30px, 8vw, 50px) clamp(16px, 4vw, 24px); }
  .done-icon { width: clamp(64px, 18vw, 90px); height: clamp(64px, 18vw, 90px); background: var(--success); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto clamp(16px, 4vw, 24px); }
  .done-icon span { font-size: clamp(32px, 9vw, 48px); }
  .done-title { font-size: clamp(18px, 5vw, 24px); font-weight: 800; margin: 0 0 clamp(6px, 1.5vw, 10px) 0; }
  .done-desc { font-size: clamp(13px, 3.5vw, 15px); color: var(--light-gray); margin: 0 0 clamp(18px, 5vw, 26px) 0; }
  .improvement-row { display: flex; align-items: center; justify-content: center; gap: clamp(8px, 2.5vw, 14px); margin-bottom: clamp(18px, 5vw, 26px); }
  .improvement-label { font-size: clamp(13px, 3.5vw, 15px); color: var(--light-gray); }
  .improvement-before { font-size: clamp(20px, 5.5vw, 26px); font-weight: 700; color: var(--light-gray); }
  .improvement-arrow { font-size: clamp(14px, 3.8vw, 18px); color: var(--light-gray); }
  .improvement-after { font-size: clamp(20px, 5.5vw, 26px); font-weight: 700; color: var(--primary); }
  .improvement-emoji { font-size: clamp(20px, 5.5vw, 26px); }
  .done-commitment { background: var(--purple-light); padding: 16px; border-radius: 12px; margin-bottom: 20px; }
  .done-commitment-label { font-size: 12px; color: var(--light-gray); margin: 0 0 6px 0; }
  .done-commitment-text { font-size: 15px; font-weight: 600; color: var(--purple); margin: 0; }
  .done-buttons { display: flex; gap: clamp(10px, 3vw, 14px); }
  .done-buttons .btn-primary { flex: 1; }
  @media (min-width: 768px) { .main { padding: 24px; padding-bottom: 24px; } .rating-grid { gap: 16px; } .option-card:hover { background: var(--bg-gray); } }
  @media (min-width: 1024px) { .main { max-width: 680px; } }
`
