const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

export async function getADHDCoachAdvice(moodScore: number, note: string | null): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY
  
  if (!apiKey) {
    console.error('Gemini API key not configured')
    return getGenericAdvice(moodScore)
  }

  // If no note provided, give a gentle prompt to share more next time
  if (!note || note.trim().length < 3) {
    return getGenericAdvice(moodScore)
  }

  const prompt = `You are a warm, experienced ADHD coach responding to a client's check-in.

THEIR CHECK-IN:
- Mood: ${moodScore}/10
- What they shared: "${note}"

YOUR TASK:
Respond with EXACTLY 2 sentences that directly address what they specifically shared. 

CRITICAL RULES:
1. Your response MUST reference the specific situation, feelings, or details they mentioned
2. First sentence: Validate their specific experience (use their words/situation)
3. Second sentence: Give ONE practical micro-tip relevant to their exact situation
4. Be warm but concise
5. No emojis, no bullet points, no generic advice
6. Do NOT give advice that could apply to anyone - make it specific to what they wrote

BAD EXAMPLE (too generic): "It sounds like you're having a tough time. Try taking a few deep breaths."
GOOD EXAMPLE (specific): "Dealing with a boss who keeps changing priorities is exhausting, especially when your ADHD brain was already working hard to stay on track. Before your next interaction with them, jot down your top 2 non-negotiables so you have an anchor when things shift again."

Respond now with your 2 personalized sentences:`

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 150,
        }
      })
    })

    if (!response.ok) {
      console.error('Gemini API error:', response.status)
      return getGenericAdvice(moodScore)
    }

    const data = await response.json()
    const advice = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!advice) {
      return getGenericAdvice(moodScore)
    }

    return advice.trim()
  } catch (error) {
    console.error('Gemini API error:', error)
    return getGenericAdvice(moodScore)
  }
}

function getGenericAdvice(moodScore: number): string {
  if (moodScore <= 3) {
    return "It's okay to have hard days—your feelings are valid. Try sharing what's on your mind next time so I can give you more personalized support."
  }
  if (moodScore <= 5) {
    return "Thanks for checking in—showing up matters. If you share what's going on, I can offer advice tailored to your situation."
  }
  if (moodScore <= 7) {
    return "You're in a steady place right now—that's worth acknowledging. Tell me more about what's happening and I can help you make the most of it."
  }
  return "Love to see you feeling good! Share what's contributing to this so we can help you recreate it."
}