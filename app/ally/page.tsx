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

const steps: { id: Step; label: string }[] = [
  { id: 'rating', label: 'How stuck?' },
  { id: 'block', label: 'What\'s blocked?' },
  { id: 'thought', label: 'Inner critic' },
  { id: 'reframe', label: 'Reframe' },
  { id: 'action', label: 'Next step' },
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

  const currentStepIndex = steps.findIndex(s => s.id === currentStep)

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
      <div className="app-shell flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="app-shell bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/20">
        <div className="app-max py-4 flex items-center justify-between">
          <button 
            onClick={() => router.push('/dashboard')}
            className="btn btn-ghost flex items-center gap-2 text-purple-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Home
          </button>
          <h1 className="text-lg font-bold text-purple-800">Attuned Ally</h1>
          <div className="w-16" />
        </div>
      </header>

      {/* Progress */}
      {currentStep !== 'done' && (
        <div className="app-max pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-purple-700">
              {steps[currentStepIndex]?.label}
            </span>
            <span className="text-sm text-purple-500">
              {currentStepIndex + 1} of {steps.length}
            </span>
          </div>
          <div className="flex gap-1.5">
            {steps.map((step, i) => (
              <div
                key={step.id}
                className={`h-1.5 flex-1 rounded-full transition-all ${
                  i <= currentStepIndex 
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-500' 
                    : 'bg-purple-200'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <main className="app-max py-6 space-y-4">
        
        {/* Step 1: Rating */}
        {currentStep === 'rating' && (
          <section className="surface p-6 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30 mb-4">
                <span className="text-3xl">💜</span>
              </div>
              <h2 className="text-xl font-bold text-slate-800">How stuck are you?</h2>
              <p className="text-slate-600 mt-1">1 = a little, 5 = completely frozen</p>
            </div>

            <div className="flex justify-center gap-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => { setStuckBefore(n); setCurrentStep('block') }}
                  className="w-14 h-14 rounded-2xl text-lg font-bold bg-purple-100 text-purple-700 hover:bg-purple-200 transition-all hover:scale-105 active:scale-95"
                >
                  {n}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Step 2: Block Type */}
        {currentStep === 'block' && (
          <section className="surface p-6 space-y-5">
            <div className="text-center">
              <span className="text-4xl">🔌</span>
              <h2 className="text-xl font-bold text-slate-800 mt-2">What feels blocked?</h2>
            </div>

            <div className="space-y-2">
              {executiveBlocks.map((block) => (
                <button
                  key={block.id}
                  onClick={() => handleBlockSelect(block.id)}
                  className="surface card-hover w-full flex items-center gap-4 p-4 text-left bg-purple-50 border-purple-200/50"
                >
                  <span className="text-2xl">{block.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800">{block.label}</p>
                    <p className="text-sm text-slate-600">{block.description}</p>
                  </div>
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Step 3: Drill Sergeant Thought */}
        {currentStep === 'thought' && (
          <section className="surface p-6 space-y-5">
            <div className="text-center">
              <span className="text-4xl">🎖️</span>
              <h2 className="text-xl font-bold text-slate-800 mt-2">The inner critic says...</h2>
              <p className="text-slate-600 mt-1">Which one sounds familiar?</p>
            </div>

            <div className="space-y-2">
              {drillSergeantThoughts.map((thought) => (
                <button
                  key={thought.id}
                  onClick={() => handleThoughtSelect(thought.text)}
                  className="surface card-hover w-full p-4 text-left bg-rose-50 border-rose-200/50"
                >
                  <p className="text-slate-700 italic">"{thought.text}"</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Step 4: Reframe */}
        {currentStep === 'reframe' && (
          <div className="space-y-4">
            {/* The harsh thought */}
            <div className="surface p-5 bg-rose-50 border-rose-200/50">
              <p className="text-sm font-medium text-rose-600 mb-1">The harsh voice:</p>
              <p className="text-slate-700 italic">"{selectedThought}"</p>
            </div>

            {/* The reframe */}
            <section className="surface p-6">
              <div className="text-center mb-4">
                <span className="text-4xl">💚</span>
                <h2 className="text-xl font-bold text-slate-800 mt-2">The truth is...</h2>
              </div>

              <div className="surface p-5 bg-green-50 border-green-200/50 mb-4">
                <p className="text-slate-800 leading-relaxed">
                  {reframe?.attunedResponse || 
                    "Your brain works differently—not wrongly. This challenge is about neurology, not character."}
                </p>
              </div>

              <div className="surface p-4 bg-purple-50 border-purple-200/50 text-center mb-5">
                <p className="text-sm text-purple-600 mb-1">Say this to yourself:</p>
                <p className="text-purple-800 font-medium italic">
                  "{reframe?.affirmation || "I'm doing the best I can with the brain I have."}"
                </p>
              </div>

              <button
                onClick={() => setCurrentStep('action')}
                className="btn btn-primary w-full bg-gradient-to-r from-purple-500 to-indigo-500"
              >
                I hear this → What can I do?
              </button>
            </section>
          </div>
        )}

        {/* Step 5: Action */}
        {currentStep === 'action' && (
          <section className="surface p-6 space-y-5">
            <div className="text-center">
              <span className="text-4xl">✨</span>
              <h2 className="text-xl font-bold text-slate-800 mt-2">One tiny step</h2>
              <p className="text-slate-600">Small and doable beats big and stuck</p>
            </div>

            <div className="space-y-2">
              {actions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => { setSelectedAction(action.text); setCustomAction('') }}
                  className={`surface card-hover w-full p-4 text-left ${
                    selectedAction === action.text
                      ? 'bg-purple-100 border-purple-400'
                      : 'bg-slate-50'
                  }`}
                >
                  <p className="font-medium text-slate-800">{action.text}</p>
                  <p className="text-sm text-slate-500 mt-1">{action.why}</p>
                </button>
              ))}
            </div>

            {/* Custom */}
            <div className="surface p-4 border-dashed">
              <input
                type="text"
                value={customAction}
                onChange={(e) => { setCustomAction(e.target.value); setSelectedAction(null) }}
                placeholder="Or write your own: I will..."
                className="input"
              />
            </div>

            {/* Post rating */}
            <div className="pt-4 border-t border-slate-200">
              <p className="text-center text-slate-700 mb-3 font-medium">How stuck now?</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setStuckAfter(n)}
                    className={`w-12 h-12 rounded-xl font-bold transition-all ${
                      stuckAfter === n
                        ? 'bg-gradient-to-br from-purple-500 to-indigo-500 text-white shadow-lg'
                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleComplete}
              disabled={(!selectedAction && !customAction) || saving}
              className="btn btn-primary w-full bg-gradient-to-r from-purple-500 to-indigo-500"
            >
              {saving ? 'Saving...' : "I'll do this →"}
            </button>
          </section>
        )}

        {/* Done */}
        {currentStep === 'done' && (
          <section className="surface p-6 text-center space-y-5">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30">
              <span className="text-4xl">🌟</span>
            </div>
            
            <h2 className="text-xl font-bold text-slate-800">You chose kindness</h2>
            <p className="text-slate-600">
              You picked support over self-criticism. That's real progress.
            </p>

            {stuckBefore && stuckAfter && stuckAfter < stuckBefore && (
              <div className="inline-flex items-center gap-3 surface px-5 py-3 bg-purple-50">
                <span className="text-purple-600 font-medium">Stuck level:</span>
                <span className="text-2xl font-bold text-purple-400">{stuckBefore}</span>
                <span className="text-purple-300">→</span>
                <span className="text-2xl font-bold text-purple-600">{stuckAfter}</span>
                <span className="text-xl">🎉</span>
              </div>
            )}

            <div className="surface p-4 bg-green-50 border-green-200/50">
              <p className="text-sm text-green-600 font-medium mb-1">Your next step:</p>
              <p className="text-green-800">{selectedAction || customAction}</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={reset} className="btn btn-ghost flex-1">
                Another round
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="btn btn-primary flex-1 bg-gradient-to-r from-purple-500 to-indigo-500"
              >
                Done
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
