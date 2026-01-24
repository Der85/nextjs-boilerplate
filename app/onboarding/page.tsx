'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

  // Twitter-style button component
  const PrimaryButton = ({ onClick, disabled, children }: { onClick: () => void, disabled?: boolean, children: React.ReactNode }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full bg-[#1D9BF0] text-white py-3 px-6 rounded-full font-bold text-[15px] hover:bg-[#1A8CD8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )

  const SecondaryButton = ({ onClick, children }: { onClick: () => void, children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className="w-full bg-white text-[#0F1419] py-3 px-6 rounded-full font-bold text-[15px] border border-[#CFD9DE] hover:bg-[#F7F9F9] transition-colors"
    >
      {children}
    </button>
  )

  const renderStep = () => {
    switch (step) {
      // Step 0: Welcome - First time user?
      case 0:
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-[#1D9BF0] rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">🧠</span>
            </div>
            <h1 className="text-[23px] font-bold text-[#0F1419] mb-2">Welcome to ADHDer.io</h1>
            <p className="text-[15px] text-[#536471] mb-8">Is this your first time here?</p>
            <div className="space-y-3">
              <PrimaryButton onClick={handleNext}>
                Yes, I'm new here
              </PrimaryButton>
              <SecondaryButton onClick={() => router.push('/login')}>
                No, take me to login
              </SecondaryButton>
            </div>
          </div>
        )

      // Step 1: Meet Der, get name
      case 1:
        return (
          <div>
            <h1 className="text-[23px] font-bold text-[#0F1419] mb-2">
              Hello! I'm Der, your ADHD coach.
            </h1>
            <p className="text-[15px] text-[#536471] mb-1">
              It's <span className="font-bold text-[#1D9BF0]">ADHD-er</span>, get it? 😄
            </p>
            <p className="text-[15px] text-[#536471] mb-6">What's your name?</p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full p-3 bg-white border border-[#CFD9DE] rounded-lg text-[15px] text-[#0F1419] placeholder-[#536471] focus:outline-none focus:border-[#1D9BF0] focus:ring-1 focus:ring-[#1D9BF0]"
              autoFocus
            />
            <div className="mt-6">
              <PrimaryButton onClick={handleNext} disabled={!name.trim()}>
                Continue
              </PrimaryButton>
            </div>
          </div>
        )

      // Step 2: Get email
      case 2:
        return (
          <div>
            <h1 className="text-[23px] font-bold text-[#0F1419] mb-2">
              Hi {name}, great to meet you!
            </h1>
            <p className="text-[15px] text-[#536471] mb-6">What's your email?</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full p-3 bg-white border border-[#CFD9DE] rounded-lg text-[15px] text-[#0F1419] placeholder-[#536471] focus:outline-none focus:border-[#1D9BF0] focus:ring-1 focus:ring-[#1D9BF0]"
              autoFocus
            />
            <div className="mt-6">
              <PrimaryButton onClick={handleNext} disabled={!email.trim()}>
                Continue
              </PrimaryButton>
            </div>
          </div>
        )

      // Step 3: Create password & register
      case 3:
        return (
          <div>
            <h1 className="text-[23px] font-bold text-[#0F1419] mb-2">
              Great! Now create a password
            </h1>
            <p className="text-[15px] text-[#536471] mb-6">So you can log back in later.</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              className="w-full p-3 bg-white border border-[#CFD9DE] rounded-lg text-[15px] text-[#0F1419] placeholder-[#536471] focus:outline-none focus:border-[#1D9BF0] focus:ring-1 focus:ring-[#1D9BF0]"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-[#F4212E] text-[13px]">{error}</p>
            )}
            <div className="mt-6">
              <PrimaryButton onClick={handleRegister} disabled={!password.trim() || isLoading}>
                {isLoading ? 'Creating account...' : 'Create Account'}
              </PrimaryButton>
            </div>
          </div>
        )

      // Step 4: Der's story
      case 4:
        return (
          <div>
            <h1 className="text-[23px] font-bold text-[#0F1419] mb-4">
              A bit about me...
            </h1>
            <div className="space-y-4 text-[15px] text-[#536471]">
              <p>
                I was only diagnosed with ADHD in my 30s. Suddenly so much made sense, and at the same time there still feels like there's so much to figure out.
              </p>
              <p>
                That's why I'm here — to build <span className="font-bold text-[#0F1419]">systems with you that work</span>.
              </p>
              <p>
                Not brand new "expensive" systems that require you to buy a bunch of new things — I'm guessing you've tried that already.
              </p>
              <p className="font-medium text-[#0F1419]">
                Systems that are yours, built where you are — not where you imagine you'll be with the new gym membership or supplement from the health food store.
              </p>
            </div>
            <div className="mt-6">
              <PrimaryButton onClick={handleNext}>
                I like the sound of that
              </PrimaryButton>
            </div>
          </div>
        )

      // Step 5: First check-in (mood + note)
      case 5:
        return (
          <div>
            <h1 className="text-[23px] font-bold text-[#0F1419] mb-2">
              Let's start with a simple check-in
            </h1>
            <p className="text-[15px] text-[#536471] mb-6">
              Rate how you're feeling right now, with 10 being the best you've ever felt and 0 being the worst.
            </p>
            
            <div className="mb-6">
              <div className="flex justify-between text-[13px] text-[#536471] mb-2">
                <span>Worst</span>
                <span className="text-[20px] font-bold text-[#1D9BF0]">{mood}</span>
                <span>Best</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={mood}
                onChange={(e) => setMood(parseInt(e.target.value))}
                className="w-full h-2 bg-[#CFD9DE] rounded-lg appearance-none cursor-pointer accent-[#1D9BF0]"
              />
            </div>

            <p className="text-[15px] text-[#536471] mb-3">
              Why did you pick that number? What's happening?
            </p>
            <textarea
              value={moodNote}
              onChange={(e) => setMoodNote(e.target.value)}
              placeholder="Share what's on your mind..."
              rows={3}
              className="w-full p-3 bg-white border border-[#CFD9DE] rounded-lg text-[15px] text-[#0F1419] placeholder-[#536471] focus:outline-none focus:border-[#1D9BF0] focus:ring-1 focus:ring-[#1D9BF0] resize-none"
            />
            
            <div className="mt-6">
              <PrimaryButton onClick={handleMoodSubmit} disabled={isLoading}>
                {isLoading ? 'Getting advice...' : 'Submit Check-in'}
              </PrimaryButton>
            </div>
          </div>
        )

      // Step 6: Show coach advice
      case 6:
        return (
          <div>
            <h1 className="text-[23px] font-bold text-[#0F1419] mb-4">
              Here's what I think...
            </h1>
            <div className="bg-[#F7F9F9] border border-[#CFD9DE] rounded-2xl p-4 mb-6">
              <p className="text-[15px] text-[#0F1419]">
                {coachAdvice || "Thanks for sharing. Remember, checking in with yourself is the first step to understanding your patterns."}
              </p>
            </div>
            <div className="space-y-4 text-[15px] text-[#536471]">
              <p>
                This was your first coaching session! I'm going to ask you to tell me how you're feeling once per day and offer suggestions like this.
              </p>
              <p>
                The goal is to help recognize patterns. There aren't always patterns, but sometimes there are — and helping you recognize them can help build new ones, or choose to continue with the old ones.
              </p>
              <p className="font-bold text-[#0F1419]">
                You're in the driving seat here!
              </p>
            </div>
            <div className="mt-6">
              <PrimaryButton onClick={handleNext}>
                Continue
              </PrimaryButton>
            </div>
          </div>
        )

      // Step 7: Other tools intro
      case 7:
        return (
          <div>
            <h1 className="text-[23px] font-bold text-[#0F1419] mb-4">
              There's more I can help with
            </h1>
            <p className="text-[15px] text-[#536471] mb-4">
              Helping you recognize your patterns is one thing, but there's a bunch of other stuff on this journey too.
            </p>
            <div className="bg-[#F7F9F9] border border-[#CFD9DE] rounded-2xl p-4 mb-6">
              <p className="text-[13px] text-[#536471]">
                💡 Pressing the menu button after this journey will show you everything I can help with — but don't worry about that for now.
              </p>
            </div>
            <p className="text-[15px] text-[#0F1419] font-bold mb-6">
              The first tool I need to show you is <span className="text-[#F4212E]">BREAK</span> →
            </p>
            <PrimaryButton onClick={handleNext}>
              Show me BREAK
            </PrimaryButton>
          </div>
        )

      // Step 8: BREAK explanation
      case 8:
        return (
          <div>
            <div className="w-12 h-12 bg-[#F4212E] rounded-full flex items-center justify-center mb-4">
              <span className="text-white text-xl">🛑</span>
            </div>
            <h1 className="text-[23px] font-bold text-[#0F1419] mb-4">
              BREAK is for when everything is overwhelming
            </h1>
            <div className="space-y-4 text-[15px] text-[#536471]">
              <p>
                For me, sometimes it's the noise in a busy supermarket. Or being a bit tired and someone asks me a question and I'm snappy, they get annoyed, I get more annoyed…
              </p>
              <p className="font-medium text-[#0F1419]">
                You know the story.
              </p>
            </div>
            <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-2xl p-4 my-6">
              <p className="text-[13px] text-[#991B1B]">
                Press the <span className="font-bold">BREAK</span> button for 10 seconds. Select if you're frustrated, angry, feel rejected, or upset.
              </p>
            </div>
            <p className="text-[15px] text-[#536471] mb-6">
              ADHD isn't just about focus and dopamine levels — it's so much more. Mainly, it's about <span className="font-bold text-[#0F1419]">dysregulation</span>.
            </p>
            <PrimaryButton onClick={handleNext}>
              Tell me more about dysregulation
            </PrimaryButton>
          </div>
        )

      // Step 9: Dysregulation explanation
      case 9:
        return (
          <div>
            <div className="w-12 h-12 bg-[#1D9BF0] rounded-full flex items-center justify-center mb-4">
              <span className="text-white text-xl">💙</span>
            </div>
            <h1 className="text-[23px] font-bold text-[#0F1419] mb-4">
              Dysregulation means it's not your fault
            </h1>
            <div className="space-y-4 text-[15px] text-[#536471]">
              <p>
                Dysregulation of attention, sure. But also of sleep, food, energy levels, relationships.
              </p>
              <p>
                I know you won't fully believe me when I say it's not your fault.
              </p>
              <p>
                You didn't get to grow up with people who could teach you how to cope with the world. But it's not your parents' fault either — ADHD is highly hereditary.
              </p>
            </div>
            <div className="bg-[#E8F5FD] border border-[#BBDFFA] rounded-2xl p-4 my-6">
              <p className="text-[13px] text-[#1D9BF0] font-medium">
                🧬 Your brain is wired differently. That's not a flaw — it's just different.
              </p>
            </div>
            <PrimaryButton onClick={handleNext}>
              Continue
            </PrimaryButton>
          </div>
        )

      // Step 10: Energy levels & burnout
      case 10:
        return (
          <div>
            <div className="w-12 h-12 bg-[#F97316] rounded-full flex items-center justify-center mb-4">
              <span className="text-white text-xl">🔋</span>
            </div>
            <h1 className="text-[23px] font-bold text-[#0F1419] mb-4">
              Let's talk about energy
            </h1>
            <div className="space-y-4 text-[15px] text-[#536471]">
              <p>
                Energy for us ADHDers is, well, <span className="font-bold text-[#0F1419]">dysregulated</span>.
              </p>
              <p>
                If it's something we're interested in, everything else disappears. But if it's something we "have" to do, it's nearly impossible to get off the couch.
              </p>
              <p>
                When we're not interested in something but it still needs to be done (think: work), we often rely on <span className="font-bold text-[#0F1419]">stress and anxiety</span> to keep us moving.
              </p>
              <p>
                No problem once in a while — but when it becomes our default… <span className="font-bold text-[#F97316]">burnout becomes the destination</span>.
              </p>
            </div>
            <div className="bg-[#FFF7ED] border border-[#FDBA74] rounded-2xl p-4 my-6">
              <p className="text-[13px] text-[#C2410C] font-medium">
                ⚡ When your mood is lower or when you share that you've been frustrated, I'm going to ask about your energy levels. The key is to avoid burnout.
              </p>
            </div>
            <p className="text-[15px] font-bold text-[#0F1419] mb-6">
              Nothing is more important than taking care of yourself.
            </p>
            <PrimaryButton onClick={handleFinish}>
              Let's get started! →
            </PrimaryButton>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F9F9] flex flex-col">
      {/* Progress bar */}
      {step > 0 && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-[#EFF3F4] z-50">
          <div 
            className="h-full bg-[#1D9BF0] transition-all duration-300"
            style={{ width: `${(step / (totalSteps - 1)) * 100}%` }}
          />
        </div>
      )}

      {/* Header with back button */}
      {step > 0 && step < 4 && (
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-[#EFF3F4] z-40">
          <div className="max-w-[600px] mx-auto px-4 h-[53px] flex items-center">
            <button
              onClick={handleBack}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#EFF3F4] transition-colors"
            >
              <svg className="w-5 h-5 text-[#0F1419]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="ml-6 text-[17px] font-bold text-[#0F1419]">Sign up</span>
          </div>
        </header>
      )}

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-sm border border-[#EFF3F4] p-6">
          {renderStep()}
        </div>
      </div>

      {/* Step indicator */}
      {step > 0 && (
        <div className="fixed bottom-4 left-0 right-0 flex justify-center">
          <span className="text-[13px] text-[#536471] bg-white px-3 py-1 rounded-full shadow-sm border border-[#EFF3F4]">
            {step} of {totalSteps - 1}
          </span>
        </div>
      )}
    </div>
  )
}
