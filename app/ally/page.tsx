'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  executiveBlocks, 
  drillSergeantThoughts, 
  getRandomActions, 
  getCompassionReframe,
  getRandomAffirmation,
  MicroAction,
  CompassionReframe
} from '@/lib/adhderData'

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
  const [compassionReframe, setCompassionReframe] = useState<CompassionReframe | null>(null)
  const [microActionsOptions, setMicroActionsOptions] = useState<MicroAction[]>([])
  const [selectedAction, setSelectedAction] = useState<string | null>(null)
  const [customAction, setCustomAction] = useState('')
  const [challengeAfter, setChallengeAfter] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [showAffirmation, setShowAffirmation] = useState(false)

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
    setStep(3)
  }

  const handleThoughtSelect = (thoughtText: string) => {
    setSelectedThought(thoughtText)
    // Get the specific reframe for this thought and block
    if (selectedBlock) {
      const reframe = getCompassionReframe(thoughtText, selectedBlock)
      setCompassionReframe(reframe)
    }
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
    setCompassionReframe(null)
    setSelectedAction(null)
    setCustomAction('')
    setChallengeAfter(null)
    setShowAffirmation(false)
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
            className="text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-lg font-bold text-purple-700">Attuned Ally</h1>
          <div className="w-16"></div>
        </div>
      </header>

      {/* Progress */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                s <= step ? 'bg-purple-500' : 'bg-purple-200'
              }`}
            />
          ))}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Step 1: Challenge Rating */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-4xl">💜</span>
              <h2 className="text-xl font-bold text-slate-800">How stuck are you feeling?</h2>
              <p className="text-slate-600 text-sm">Before we start, let's check in.</p>
            </div>

            <div className="flex justify-center gap-3">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    setChallengeBefore(level)
                    setStep(2)
                  }}
                  className="w-12 h-12 rounded-full text-lg font-bold transition-all bg-purple-100 text-purple-700 hover:bg-purple-200 hover:scale-110"
                >
                  {level}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-slate-400 px-4">
              <span>A little stuck</span>
              <span>Completely frozen</span>
            </div>
          </div>
        )}

        {/* Step 2: Select Block */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-4xl">🔌</span>
              <h2 className="text-xl font-bold text-slate-800">Which wire feels loose?</h2>
              <p className="text-slate-600 text-sm">Select what's giving you trouble.</p>
            </div>

            <div className="grid gap-2">
              {executiveBlocks.map((block) => (
                <button
                  key={block.id}
                  onClick={() => handleBlockSelect(block.id)}
                  className="flex items-center gap-3 p-4 bg-purple-50 hover:bg-purple-100 rounded-xl transition-all text-left"
                >
                  <span className="text-2xl">{block.icon}</span>
                  <div>
                    <div className="font-semibold text-slate-800">{block.label}</div>
                    <div className="text-xs text-slate-600">{block.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Drill Sergeant */}
        {step === 3 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-4xl">🎖️</span>
              <h2 className="text-xl font-bold text-slate-800">The Drill Sergeant Voice</h2>
              <p className="text-slate-600 text-sm">What's that critical inner voice saying?</p>
            </div>

            <div className="grid gap-2">
              {drillSergeantThoughts.map((thought) => (
                <button
                  key={thought.id}
                  onClick={() => handleThoughtSelect(thought.text)}
                  className="p-4 bg-red-50 hover:bg-red-100 rounded-xl transition-all text-left text-slate-700 border-2 border-transparent hover:border-red-200"
                >
                  "{thought.text}"
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Enhanced Reframe */}
        {step === 4 && selectedBlock && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-4xl">💚</span>
              <h2 className="text-xl font-bold text-slate-800">Switch to Attuned</h2>
              <p className="text-slate-600 text-sm">
                That was the Drill Sergeant—controlling and rigid. Here's the truth:
              </p>
            </div>

            {/* The Drill Sergeant said... */}
            <div className="bg-red-50 p-4 rounded-xl border border-red-200">
              <p className="text-xs text-red-600 font-medium mb-1 uppercase tracking-wide">The Drill Sergeant said:</p>
              <p className="text-slate-700 italic">"{selectedThought}"</p>
            </div>

            {/* The Attuned Response */}
            <div className="bg-gradient-to-br from-green-50 to-teal-50 p-5 rounded-xl border-2 border-green-200">
              <p className="text-xs text-green-700 font-medium mb-2 uppercase tracking-wide">The truth is:</p>
              <p className="text-slate-800 leading-relaxed">
                {compassionReframe?.attunedResponse || 
                  "You have a neurodivergent brain. This challenge isn't a character flaw; it's a difference in how your brain works. You don't need to be neurotypical to be enough."}
              </p>
            </div>

            {/* Affirmation Card */}
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
              <p className="text-xs text-purple-600 font-medium mb-2 uppercase tracking-wide">Say this to yourself:</p>
              <p className="text-purple-800 font-medium text-center text-lg">
                "{compassionReframe?.affirmation || getRandomAffirmation()}"
              </p>
            </div>

            {/* Optional: Show more affirmation */}
            {!showAffirmation ? (
              <button
                onClick={() => setShowAffirmation(true)}
                className="w-full text-purple-600 text-sm hover:text-purple-800 transition"
              >
                + Show me another affirmation
              </button>
            ) : (
              <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 animate-fadeIn">
                <p className="text-purple-800 font-medium text-center">
                  "{getRandomAffirmation()}"
                </p>
              </div>
            )}

            <button
              onClick={handleContinueToActions}
              className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3.5 rounded-xl transition"
            >
              I hear this → What can I do?
            </button>
          </div>
        )}

        {/* Step 5: Micro-Action */}
        {step === 5 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-4xl">✨</span>
              <h2 className="text-xl font-bold text-slate-800">One Tiny Step</h2>
              <p className="text-slate-600 text-sm">What's in your "manageable zone" right now?</p>
            </div>

            <div className="grid gap-2">
              {microActionsOptions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleActionSelect(action.text)}
                  className={`p-4 rounded-xl transition-all text-left border-2 ${
                    selectedAction === action.text
                      ? 'bg-purple-100 border-purple-500'
                      : 'bg-slate-50 border-transparent hover:bg-purple-50'
                  }`}
                >
                  <div className="font-medium text-slate-800 text-sm">{action.text}</div>
                  <div className="text-xs text-slate-500 mt-1">{action.why}</div>
                </button>
              ))}
              
              <div className="p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300">
                <input
                  type="text"
                  value={customAction}
                  onChange={(e) => {
                    setCustomAction(e.target.value)
                    setSelectedAction(null)
                  }}
                  placeholder="Or write your own: I will..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none text-sm"
                />
              </div>
            </div>

            {/* Post Rating */}
            <div className="pt-4 border-t">
              <p className="text-center text-slate-700 text-sm mb-3">How stuck do you feel now?</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    onClick={() => setChallengeAfter(level)}
                    className={`w-10 h-10 rounded-full text-sm font-bold transition-all ${
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
              className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3.5 rounded-xl transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : "I'll do this →"}
            </button>
          </div>
        )}

        {/* Step 6: Complete */}
        {step === 6 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 text-center animate-fadeIn">
            <span className="text-5xl">🌟</span>
            <h2 className="text-xl font-bold text-slate-800">You're befriending your brain</h2>
            
            <p className="text-slate-600 text-sm">
              You chose support over self-criticism. That's real progress.
            </p>

            {challengeBefore && challengeAfter && (
              <div className="bg-purple-50 p-4 rounded-xl">
                <p className="text-purple-700 text-sm">
                  Stuck level: <strong>{challengeBefore}</strong> → <strong>{challengeAfter}</strong>
                  {challengeAfter < challengeBefore && ' 🎉'}
                </p>
                {challengeAfter < challengeBefore && (
                  <p className="text-purple-600 text-xs mt-1">
                    You reduced your stuck feeling by {challengeBefore - challengeAfter} points!
                  </p>
                )}
              </div>
            )}

            <div className="bg-green-50 p-4 rounded-xl border border-green-200">
              <p className="text-green-800 font-medium text-sm">Your action:</p>
              <p className="text-green-700 mt-1 text-sm">{selectedAction || customAction}</p>
            </div>

            {/* Reminder of the reframe */}
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
              <p className="text-purple-700 text-sm italic">
                Remember: "{compassionReframe?.affirmation || "I don't need to be neurotypical to be enough."}"
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleStartOver}
                className="flex-1 bg-purple-100 hover:bg-purple-200 text-purple-700 font-semibold py-3 rounded-xl transition text-sm"
              >
                Do another
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 rounded-xl transition text-sm"
              >
                Dashboard
              </button>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
