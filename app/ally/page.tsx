'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  executiveBlocks, 
  drillSergeantThoughts, 
  getRandomActions, 
  getAttunedReframe,
  MicroAction 
} from '@/lib/microActions'

type Step = 1 | 2 | 3 | 4 | 5 | 6

export default function AllyPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Flow state
  const [step, setStep] = useState<Step>(1)
  const [challengeBefore, setChallengeBefore] = useState<number | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null)
  const [selectedThought, setSelectedThought] = useState<string | null>(null)
  const [microActions, setMicroActions] = useState<MicroAction[]>([])
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
    setMicroActions(getRandomActions(blockId, 3))
    setStep(3)
  }

  const handleThoughtSelect = (thoughtText: string) => {
    setSelectedThought(thoughtText)
    setStep(4)
  }

  const handleContinueToActions = () => {
    setStep(5)
  }

  const handleActionSelect = (actionText: string) => {
    setSelectedAction(actionText)
    setCustomAction('')
  }

  const handleComplete = async () => {
    if (!selectedBlock || !selectedThought || (!selectedAction && !customAction)) return
    
    setSaving(true)
    
    const { error } = await supabase
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

    if (!error) {
      setStep(6)
    }
    setSaving(false)
  }

  const handleStartOver = () => {
    setStep(1)
    setChallengeBefore(null)
    setSelectedBlock(null)
    setSelectedThought(null)
    setSelectedAction(null)
    setCustomAction('')
    setChallengeAfter(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <button 
            onClick={() => router.push('/dashboard')}
            className="text-purple-600 hover:text-purple-800 font-medium"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold text-purple-700">Attuned Ally</h1>
          <div className="w-16"></div>
        </div>
      </header>

      {/* Progress indicator */}
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full transition-all ${
                s <= step ? 'bg-purple-500' : 'bg-purple-200'
              }`}
            />
          ))}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Step 1: Challenge Rating */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 space-y-6">
            <div className="text-center space-y-2">
              <span className="text-4xl">💜</span>
              <h2 className="text-2xl font-bold text-gray-800">How challenged are you feeling?</h2>
              <p className="text-gray-600">Before we start, let's check in.</p>
            </div>

            <div className="flex justify-center gap-3">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    setChallengeBefore(level)
                    setStep(2)
                  }}
                  className={`w-14 h-14 rounded-full text-xl font-bold transition-all ${
                    challengeBefore === level
                      ? 'bg-purple-500 text-white scale-110'
                      : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-sm text-gray-500 px-2">
              <span>A little</span>
              <span>Very</span>
            </div>
          </div>
        )}

        {/* Step 2: Select Executive Function Block */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 space-y-6">
            <div className="text-center space-y-2">
              <span className="text-4xl">🔌</span>
              <h2 className="text-2xl font-bold text-gray-800">Which wire feels loose right now?</h2>
              <p className="text-gray-600">Select the area that's giving you trouble.</p>
            </div>

            <div className="grid gap-3">
              {executiveBlocks.map((block) => (
                <button
                  key={block.id}
                  onClick={() => handleBlockSelect(block.id)}
                  className="flex items-center gap-4 p-4 bg-purple-50 hover:bg-purple-100 rounded-xl transition-all text-left"
                >
                  <span className="text-3xl">{block.icon}</span>
                  <div>
                    <div className="font-semibold text-gray-800">{block.label}</div>
                    <div className="text-sm text-gray-600">{block.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Acknowledge Drill Sergeant */}
        {step === 3 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 space-y-6">
            <div className="text-center space-y-2">
              <span className="text-4xl">🎖️</span>
              <h2 className="text-2xl font-bold text-gray-800">What is the Drill Sergeant saying?</h2>
              <p className="text-gray-600">That critical inner voice - what's it telling you?</p>
            </div>

            <div className="grid gap-3">
              {drillSergeantThoughts.map((thought) => (
                <button
                  key={thought.id}
                  onClick={() => handleThoughtSelect(thought.text)}
                  className="p-4 bg-red-50 hover:bg-red-100 rounded-xl transition-all text-left text-gray-700 border-2 border-transparent hover:border-red-200"
                >
                  "{thought.text}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Attuned Reframe */}
        {step === 4 && selectedBlock && (
          <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 space-y-6">
            <div className="text-center space-y-2">
              <span className="text-4xl">💚</span>
              <h2 className="text-2xl font-bold text-gray-800">The Attuned Voice</h2>
              <p className="text-gray-600">
                That was the Drill Sergeant - controlling and rigid. Let's switch channels.
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-teal-50 p-6 rounded-xl border-2 border-green-200">
              <p className="text-sm text-green-700 font-medium mb-2">Read this aloud:</p>
              <p className="text-lg text-gray-800 leading-relaxed italic">
                "{getAttunedReframe(selectedBlock)}"
              </p>
            </div>

            <div className="bg-purple-50 p-4 rounded-xl">
              <p className="text-sm text-purple-700">
                <strong>High warmth, high expectations.</strong> You're not making excuses. 
                You're learning to work <em>with</em> your brain, not against it.
              </p>
            </div>

            <button
              onClick={handleContinueToActions}
              className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-4 rounded-xl transition"
            >
              I've read it aloud → Continue
            </button>
          </div>
        )}

        {/* Step 5: Micro-Action Selection */}
        {step === 5 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 space-y-6">
            <div className="text-center space-y-2">
              <span className="text-4xl">✨</span>
              <h2 className="text-2xl font-bold text-gray-800">One small step</h2>
              <p className="text-gray-600">What's one thing in your "Manageable Zone" right now?</p>
            </div>

            <div className="grid gap-3">
              {microActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleActionSelect(action.text)}
                  className={`p-4 rounded-xl transition-all text-left border-2 ${
                    selectedAction === action.text
                      ? 'bg-purple-100 border-purple-500'
                      : 'bg-gray-50 border-transparent hover:bg-purple-50'
                  }`}
                >
                  <div className="font-medium text-gray-800">{action.text}</div>
                  <div className="text-sm text-gray-500 mt-1">{action.why}</div>
                </button>
              ))}
              
              {/* Custom action option */}
              <div className="p-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Or write your own:
                </label>
                <input
                  type="text"
                  value={customAction}
                  onChange={(e) => {
                    setCustomAction(e.target.value)
                    setSelectedAction(null)
                  }}
                  placeholder="I will..."
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
                />
              </div>
            </div>

            {/* Challenge After Rating */}
            <div className="pt-4 border-t">
              <p className="text-center text-gray-700 mb-3">How challenged do you feel now?</p>
              <div className="flex justify-center gap-3">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    onClick={() => setChallengeAfter(level)}
                    className={`w-12 h-12 rounded-full text-lg font-bold transition-all ${
                      challengeAfter === level
                        ? 'bg-purple-500 text-white scale-110'
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
              className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-4 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : "I'll do this →"}
            </button>
          </div>
        )}

        {/* Step 6: Completion */}
        {step === 6 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 space-y-6 text-center">
            <span className="text-6xl">🌟</span>
            <h2 className="text-2xl font-bold text-gray-800">You're befriending your brain</h2>
            
            <p className="text-gray-600">
              You chose to support yourself instead of fighting yourself. That's real progress.
            </p>

            {challengeBefore && challengeAfter && (
              <div className="bg-purple-50 p-4 rounded-xl">
                <p className="text-purple-700">
                  Challenge level: <strong>{challengeBefore}</strong> → <strong>{challengeAfter}</strong>
                  {challengeAfter < challengeBefore && ' 🎉'}
                </p>
              </div>
            )}

            <div className="bg-green-50 p-4 rounded-xl border border-green-200">
              <p className="text-green-800 font-medium">Your micro-action:</p>
              <p className="text-green-700 mt-1">{selectedAction || customAction}</p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleStartOver}
                className="flex-1 bg-purple-100 hover:bg-purple-200 text-purple-700 font-semibold py-3 rounded-xl transition"
              >
                Do another
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 rounded-xl transition"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
