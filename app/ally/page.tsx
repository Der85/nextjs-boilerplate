'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import PageHeader from '@/components/PageHeader'
import StepProgress from '@/components/StepProgress'
import BottomNav from '@/components/BottomNav'
import { 
  executiveBlocks, 
  drillSergeantThoughts, 
  getRandomActions, 
  getCompassionReframe,
  MicroAction,
  CompassionReframe
} from '@/lib/adhderData'

// Define clear step labels
const steps = [
  { id: 'stuck', label: 'How stuck are you?' },
  { id: 'block', label: 'What\'s blocking you?' },
  { id: 'thought', label: 'What\'s the critical voice saying?' },
  { id: 'reframe', label: 'Here\'s a kinder truth' },
  { id: 'action', label: 'One tiny step forward' },
  { id: 'done', label: 'You did it!' },
]

type StepId = 'stuck' | 'block' | 'thought' | 'reframe' | 'action' | 'done'

export default function AllyPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Flow state
  const [currentStep, setCurrentStep] = useState<StepId>('stuck')
  const [challengeBefore, setChallengeBefore] = useState<number | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null)
  const [selectedThought, setSelectedThought] = useState<string | null>(null)
  const [compassionReframe, setCompassionReframe] = useState<CompassionReframe | null>(null)
  const [microActionsOptions, setMicroActionsOptions] = useState<MicroAction[]>([])
  const [selectedAction, setSelectedAction] = useState<string | null>(null)
  const [customAction, setCustomAction] = useState('')
  const [challengeAfter, setChallengeAfter] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)
      setLoading(false)
    }
    checkUser()
  }, [router])

  const handleBlockSelect = (blockId: string) => {
    setSelectedBlock(blockId)
    setMicroActionsOptions(getRandomActions(blockId, 3))
    setCurrentStep('thought')
  }

  const handleThoughtSelect = (thoughtText: string) => {
    setSelectedThought(thoughtText)
    if (selectedBlock) {
      const reframe = getCompassionReframe(thoughtText, selectedBlock)
      setCompassionReframe(reframe)
    }
    setCurrentStep('reframe')
  }

  const handleComplete = async () => {
    if (!selectedBlock || !selectedThought || (!selectedAction && !customAction)) return
    
    setSaving(true)
    
    await supabase
      .from('ally_sessions')
      .insert({
        user_id: user.id,
        block_type: selectedBlock,
        drill_sergeant_thought: selectedThought,
        micro_action: selectedAction || 'custom',
        custom_action: customAction || null,
        challenge_before: challengeBefore,
        challenge_after: challengeAfter,
        completed: true
      })

    setCurrentStep('done')
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <PageHeader 
        title="Attuned Ally" 
        backPath="/dashboard"
        backLabel="Home"
      />

      {/* Progress */}
      {currentStep !== 'done' && (
        <div className="max-w-lg mx-auto px-4 pt-4">
          <StepProgress steps={steps} currentStep={currentStep} />
        </div>
      )}

      <main className="max-w-lg mx-auto px-4 py-6">
        
        {/* Step 1: Challenge Rating */}
        {currentStep === 'stuck' && (
          <div className="bg-white rounded-xl p-6 border border-slate-200 space-y-6">
            <div className="text-center">
              <span className="text-4xl" aria-hidden="true">💜</span>
              <h2 className="text-xl font-semibold text-slate-800 mt-3">
                How stuck are you feeling?
              </h2>
              <p className="text-slate-600 mt-2">
                1 = a little stuck, 5 = completely frozen
              </p>
            </div>

            <div 
              className="flex justify-center gap-3"
              role="group"
              aria-label="Stuck level rating"
            >
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    setChallengeBefore(level)
                    setCurrentStep('block')
                  }}
                  className="w-14 h-14 rounded-xl text-lg font-bold bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                  aria-label={`Level ${level}`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Select Block */}
        {currentStep === 'block' && (
          <div className="bg-white rounded-xl p-6 border border-slate-200 space-y-5">
            <div className="text-center">
              <span className="text-4xl" aria-hidden="true">🔌</span>
              <h2 className="text-xl font-semibold text-slate-800 mt-3">
                What feels blocked?
              </h2>
              <p className="text-slate-600 mt-2">
                Pick the one that fits best
              </p>
            </div>

            <div className="space-y-2">
              {executiveBlocks.map((block) => (
                <button
                  key={block.id}
                  onClick={() => handleBlockSelect(block.id)}
                  className="w-full flex items-center gap-4 p-4 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors text-left"
                >
                  <span className="text-2xl" aria-hidden="true">{block.icon}</span>
                  <div>
                    <p className="font-semibold text-slate-800">{block.label}</p>
                    <p className="text-sm text-slate-600">{block.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Drill Sergeant */}
        {currentStep === 'thought' && (
          <div className="bg-white rounded-xl p-6 border border-slate-200 space-y-5">
            <div className="text-center">
              <span className="text-4xl" aria-hidden="true">🎖️</span>
              <h2 className="text-xl font-semibold text-slate-800 mt-3">
                The critical inner voice
              </h2>
              <p className="text-slate-600 mt-2">
                What's that harsh voice saying to you?
              </p>
            </div>

            <div className="space-y-2">
              {drillSergeantThoughts.map((thought) => (
                <button
                  key={thought.id}
                  onClick={() => handleThoughtSelect(thought.text)}
                  className="w-full p-4 bg-red-50 hover:bg-red-100 rounded-xl text-left text-slate-700 border border-red-200 transition-colors"
                >
                  "{thought.text}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Reframe */}
        {currentStep === 'reframe' && (
          <div className="bg-white rounded-xl p-6 border border-slate-200 space-y-5">
            <div className="text-center">
              <span className="text-4xl" aria-hidden="true">💚</span>
              <h2 className="text-xl font-semibold text-slate-800 mt-3">
                A kinder truth
              </h2>
            </div>

            {/* The harsh thought */}
            <div className="bg-red-50 p-4 rounded-xl border border-red-200">
              <p className="text-sm text-red-600 font-medium mb-1">
                The harsh voice said:
              </p>
              <p className="text-slate-700 italic">"{selectedThought}"</p>
            </div>

            {/* The compassionate reframe */}
            <div className="bg-green-50 p-5 rounded-xl border-2 border-green-200">
              <p className="text-sm text-green-700 font-medium mb-2">
                The truth is:
              </p>
              <p className="text-slate-800 leading-relaxed">
                {compassionReframe?.attunedResponse || 
                  "You have a neurodivergent brain. This challenge isn't a character flaw; it's a difference in how your brain works."}
              </p>
            </div>

            {/* Affirmation */}
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 text-center">
              <p className="text-purple-800 font-medium">
                "{compassionReframe?.affirmation || "I don't need to be neurotypical to be enough."}"
              </p>
            </div>

            <button
              onClick={() => setCurrentStep('action')}
              className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              I hear this → What can I do?
            </button>
          </div>
        )}

        {/* Step 5: Micro-Action */}
        {currentStep === 'action' && (
          <div className="bg-white rounded-xl p-6 border border-slate-200 space-y-5">
            <div className="text-center">
              <span className="text-4xl" aria-hidden="true">✨</span>
              <h2 className="text-xl font-semibold text-slate-800 mt-3">
                One tiny step
              </h2>
              <p className="text-slate-600 mt-2">
                Pick something small and doable
              </p>
            </div>

            <div className="space-y-2">
              {microActionsOptions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => {
                    setSelectedAction(action.text)
                    setCustomAction('')
                  }}
                  className={`w-full p-4 rounded-xl text-left border-2 transition-colors ${
                    selectedAction === action.text
                      ? 'bg-purple-100 border-purple-400'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <p className="font-medium text-slate-800">{action.text}</p>
                  <p className="text-sm text-slate-500 mt-1">{action.why}</p>
                </button>
              ))}
              
              {/* Custom action */}
              <div className="p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
                <input
                  type="text"
                  value={customAction}
                  onChange={(e) => {
                    setCustomAction(e.target.value)
                    setSelectedAction(null)
                  }}
                  placeholder="Or type your own: I will..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-purple-400 outline-none text-base"
                />
              </div>
            </div>

            {/* Post rating */}
            <div className="pt-4 border-t border-slate-200">
              <p className="text-center text-slate-700 mb-3">How stuck now?</p>
              <div 
                className="flex justify-center gap-2"
                role="group"
                aria-label="Current stuck level"
              >
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    onClick={() => setChallengeAfter(level)}
                    className={`w-11 h-11 rounded-lg font-bold transition-colors ${
                      challengeAfter === level
                        ? 'bg-purple-500 text-white'
                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleComplete}
              disabled={(!selectedAction && !customAction) || saving}
              className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : "I'll do this →"}
            </button>
          </div>
        )}

        {/* Step 6: Complete */}
        {currentStep === 'done' && (
          <div className="bg-white rounded-xl p-6 border border-slate-200 text-center space-y-5">
            <span className="text-5xl" aria-hidden="true">🌟</span>
            <h2 className="text-xl font-semibold text-slate-800">
              You chose kindness
            </h2>
            
            <p className="text-slate-600">
              You picked support over self-criticism. That's real progress.
            </p>

            {challengeBefore && challengeAfter && challengeAfter < challengeBefore && (
              <div className="bg-purple-50 p-4 rounded-xl">
                <p className="text-purple-700">
                  Stuck level: {challengeBefore} → {challengeAfter} 
                  <span className="ml-2">🎉</span>
                </p>
              </div>
            )}

            <div className="bg-green-50 p-4 rounded-xl border border-green-200">
              <p className="text-green-700 font-medium">Your action:</p>
              <p className="text-green-800 mt-1">{selectedAction || customAction}</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  // Reset and start over
                  setCurrentStep('stuck')
                  setChallengeBefore(null)
                  setSelectedBlock(null)
                  setSelectedThought(null)
                  setSelectedAction(null)
                  setCustomAction('')
                  setChallengeAfter(null)
                }}
                className="flex-1 bg-purple-100 hover:bg-purple-200 text-purple-700 font-semibold py-3 rounded-xl transition-colors"
              >
                Do another
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
