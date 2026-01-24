'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Form data
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mood, setMood] = useState(5)
  const [moodNote, setMoodNote] = useState('')
  const [coachAdvice, setCoachAdvice] = useState('')

  const totalSteps = 11

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1)
    }
  }

  const handleRegister = async () => {
    if (!email || !password || !name) {
      setError('Please fill in all fields')
      return
    }
    
    setIsLoading(true)
    setError('')
    
    try {
      const supabase = createClient()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
          }
        }
      })
      
      if (signUpError) throw signUpError
      
      handleNext()
    } catch (err: any) {
      setError(err.message || 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMoodSubmit = async () => {
    setIsLoading(true)
    
    try {
      // Get coach advice
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moodScore: mood, note: moodNote }),
      })
      
      const data = await response.json()
      setCoachAdvice(data.advice)
      
      // Save mood entry
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        await supabase.from('mood_entries').insert({
          user_id: user.id,
          mood_score: mood,
          note: moodNote,
          coach_advice: data.advice,
        })
      }
      
      handleNext()
    } catch (err) {
      console.error('Error:', err)
      handleNext()
    } finally {
      setIsLoading(false)
    }
  }

  const handleFinish = () => {
    router.push('/dashboard')
  }

  const renderStep = () => {
    switch (step) {
      // Step 0: Welcome - First time user?
      case 0:
        return (
          <div className="text-center">
            <div className="text-6xl mb-6">👋</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Welcome to ADHDer.io</h1>
            <p className="text-gray-600 mb-8">Is this your first time here?</p>
            <div className="space-y-3">
              <button
                onClick={handleNext}
                className="w-full bg-blue-500 text-white py-3 px-6 rounded-full font-medium hover:bg-blue-600 transition"
              >
                Yes, I'm new here
              </button>
              <button
                onClick={() => router.push('/login')}
                className="w-full bg-white text-gray-700 py-3 px-6 rounded-full font-medium border border-gray-300 hover:bg-gray-50 transition"
              >
                No, take me to login
              </button>
            </div>
          </div>
        )

      // Step 1: Meet Der, get name
      case 1:
        return (
          <div>
            <div className="text-5xl mb-4">🧠</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Hello! I'm Der, your ADHD coach.
            </h1>
            <p className="text-gray-600 mb-2">
              It's <span className="font-semibold text-blue-500">ADHD-er</span>, get it? 😄
            </p>
            <p className="text-gray-600 mb-6">What's your name?</p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full p-4 border border-gray-300 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            <button
              onClick={handleNext}
              disabled={!name.trim()}
              className="w-full mt-6 bg-blue-500 text-white py-3 px-6 rounded-full font-medium hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        )

      // Step 2: Get email
      case 2:
        return (
          <div>
            <div className="text-5xl mb-4">✨</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Hi {name}, great to meet you!
            </h1>
            <p className="text-gray-600 mb-6">What's your email?</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full p-4 border border-gray-300 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            <button
              onClick={handleNext}
              disabled={!email.trim()}
              className="w-full mt-6 bg-blue-500 text-white py-3 px-6 rounded-full font-medium hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        )

      // Step 3: Create password & register
      case 3:
        return (
          <div>
            <div className="text-5xl mb-4">🔐</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Great! Now create a password
            </h1>
            <p className="text-gray-600 mb-6">So you can log back in later.</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              className="w-full p-4 border border-gray-300 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-red-500 text-sm">{error}</p>
            )}
            <button
              onClick={handleRegister}
              disabled={!password.trim() || isLoading}
              className="w-full mt-6 bg-blue-500 text-white py-3 px-6 rounded-full font-medium hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </div>
        )

      // Step 4: Der's story
      case 4:
        return (
          <div>
            <div className="text-5xl mb-4">💭</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              A bit about me...
            </h1>
            <div className="space-y-4 text-gray-600">
              <p>
                I was only diagnosed with ADHD in my 30s. Suddenly so much made sense, and at the same time there still feels like there's so much to figure out.
              </p>
              <p>
                That's why I'm here — to build <span className="font-semibold text-gray-900">systems with you that work</span>.
              </p>
              <p>
                Not brand new "expensive" systems that require you to buy a bunch of new things — I'm guessing you've tried that already.
              </p>
              <p className="font-medium text-gray-900">
                Systems that are yours, built where you are — not where you imagine you'll be with the new gym membership or supplement from the health food store.
              </p>
            </div>
            <button
              onClick={handleNext}
              className="w-full mt-6 bg-blue-500 text-white py-3 px-6 rounded-full font-medium hover:bg-blue-600 transition"
            >
              I like the sound of that
            </button>
          </div>
        )

      // Step 5: First check-in (mood + note)
      case 5:
        return (
          <div>
            <div className="text-5xl mb-4">📊</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Let's start with a simple check-in
            </h1>
            <p className="text-gray-600 mb-6">
              Rate how you're feeling right now, with 10 being the best you've ever felt and 0 being the worst.
            </p>
            
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-500 mb-2">
                <span>Worst</span>
                <span className="text-2xl font-bold text-blue-500">{mood}</span>
                <span>Best</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={mood}
                onChange={(e) => setMood(parseInt(e.target.value))}
                className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            <p className="text-gray-600 mb-3">
              Why did you pick that number? What's happening?
            </p>
            <textarea
              value={moodNote}
              onChange={(e) => setMoodNote(e.target.value)}
              placeholder="Share what's on your mind..."
              rows={3}
              className="w-full p-4 border border-gray-300 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            
            <button
              onClick={handleMoodSubmit}
              disabled={isLoading}
              className="w-full mt-6 bg-blue-500 text-white py-3 px-6 rounded-full font-medium hover:bg-blue-600 transition disabled:opacity-50"
            >
              {isLoading ? 'Getting advice...' : 'Submit Check-in'}
            </button>
          </div>
        )

      // Step 6: Show coach advice
      case 6:
        return (
          <div>
            <div className="text-5xl mb-4">🧠</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Here's what I think...
            </h1>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <p className="text-gray-800">
                {coachAdvice || "Thanks for sharing. Remember, checking in with yourself is the first step to understanding your patterns."}
              </p>
            </div>
            <p className="text-gray-600 mb-6">
              This was your first coaching session! I'm going to ask you to tell me how you're feeling once per day and offer suggestions like this.
            </p>
            <p className="text-gray-600 mb-6">
              The goal is to help recognize patterns. There aren't always patterns, but sometimes there are — and helping you recognize them can help build new ones, or choose to continue with the old ones.
            </p>
            <p className="font-semibold text-gray-900 mb-6">
              You're in the driving seat here!
            </p>
            <button
              onClick={handleNext}
              className="w-full bg-blue-500 text-white py-3 px-6 rounded-full font-medium hover:bg-blue-600 transition"
            >
              Continue
            </button>
          </div>
        )

      // Step 7: Other tools intro
      case 7:
        return (
          <div>
            <div className="text-5xl mb-4">🧰</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              There's more I can help with
            </h1>
            <p className="text-gray-600 mb-4">
              Helping you recognize your patterns is one thing, but there's a bunch of other stuff on this journey too.
            </p>
            <div className="bg-gray-100 rounded-xl p-4 mb-6">
              <p className="text-gray-600 text-sm">
                💡 Pressing the menu button after this journey will show you everything I can help with — but don't worry about that for now.
              </p>
            </div>
            <p className="text-gray-900 font-semibold mb-6">
              The first tool I need to show you is <span className="text-red-500">BREAK</span> →
            </p>
            <button
              onClick={handleNext}
              className="w-full bg-blue-500 text-white py-3 px-6 rounded-full font-medium hover:bg-blue-600 transition"
            >
              Show me BREAK
            </button>
          </div>
        )

      // Step 8: BREAK explanation
      case 8:
        return (
          <div>
            <div className="text-5xl mb-4">🛑</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              BREAK is for when everything is overwhelming
            </h1>
            <p className="text-gray-600 mb-4">
              For me, sometimes it's the noise in a busy supermarket. Or being a bit tired and someone asks me a question and I'm snappy, they get annoyed, I get more annoyed…
            </p>
            <p className="text-gray-600 mb-4 font-medium">
              You know the story.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="text-gray-800 text-sm">
                Press the <span className="font-bold text-red-500">BREAK</span> button for 10 seconds. Select if you're frustrated, angry, feel rejected, or upset.
              </p>
            </div>
            <p className="text-gray-600 mb-6">
              ADHD isn't just about focus and dopamine levels — it's so much more. Mainly, it's about <span className="font-semibold">dysregulation</span>.
            </p>
            <button
              onClick={handleNext}
              className="w-full bg-blue-500 text-white py-3 px-6 rounded-full font-medium hover:bg-blue-600 transition"
            >
              Tell me more about dysregulation
            </button>
          </div>
        )

      // Step 9: Dysregulation explanation
      case 9:
        return (
          <div>
            <div className="text-5xl mb-4">💙</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Dysregulation means it's not your fault
            </h1>
            <p className="text-gray-600 mb-4">
              Dysregulation of attention, sure. But also of sleep, food, energy levels, relationships.
            </p>
            <p className="text-gray-600 mb-4">
              I know you won't fully believe me when I say it's not your fault.
            </p>
            <p className="text-gray-600 mb-4">
              You didn't get to grow up with people who could teach you how to cope with the world. But it's not your parents' fault either — ADHD is highly hereditary.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <p className="text-blue-800 font-medium">
                🧬 Your brain is wired differently. That's not a flaw — it's just different.
              </p>
            </div>
            <button
              onClick={handleNext}
              className="w-full bg-blue-500 text-white py-3 px-6 rounded-full font-medium hover:bg-blue-600 transition"
            >
              Continue
            </button>
          </div>
        )

      // Step 10: Energy levels & burnout
      case 10:
        return (
          <div>
            <div className="text-5xl mb-4">🔋</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Let's talk about energy
            </h1>
            <p className="text-gray-600 mb-4">
              Energy for us ADHDers is, well, <span className="font-semibold">dysregulated</span>.
            </p>
            <p className="text-gray-600 mb-4">
              If it's something we're interested in, everything else disappears. But if it's something we "have" to do, it's nearly impossible to get off the couch.
            </p>
            <p className="text-gray-600 mb-4">
              When we're not interested in something but it still needs to be done (think: work), we often rely on <span className="font-semibold">stress and anxiety</span> to keep us moving.
            </p>
            <p className="text-gray-600 mb-4">
              No problem once in a while — but when it becomes our default… <span className="font-semibold text-orange-600">burnout becomes the destination</span>.
            </p>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
              <p className="text-orange-800 font-medium">
                ⚡ When your mood is lower or when you share that you've been frustrated, I'm going to ask about your energy levels. The key is to avoid burnout.
              </p>
            </div>
            <p className="text-gray-900 font-semibold mb-6">
              Nothing is more important than taking care of yourself.
            </p>
            <button
              onClick={handleFinish}
              className="w-full bg-blue-500 text-white py-3 px-6 rounded-full font-medium hover:bg-blue-600 transition"
            >
              Let's get started! →
            </button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Progress bar */}
      {step > 0 && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-gray-200">
          <div 
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${(step / (totalSteps - 1)) * 100}%` }}
          />
        </div>
      )}

      {/* Back button */}
      {step > 0 && step < 4 && (
        <button
          onClick={handleBack}
          className="fixed top-4 left-4 p-2 text-gray-500 hover:text-gray-700"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {renderStep()}
        </div>
      </div>

      {/* Step indicator */}
      {step > 0 && (
        <div className="fixed bottom-4 left-0 right-0 flex justify-center">
          <span className="text-sm text-gray-400">
            {step} of {totalSteps - 1}
          </span>
        </div>
      )}
    </div>
  )
}
