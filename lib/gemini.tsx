const GEMINI_API_KEY = 'AIzaSyAjYucxStvEVvcbDZStm2sx6JP62UWXFaU'
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

export async function getADHDCoachAdvice(moodScore: number, note: string | null): Promise<string> {
  const moodDescription = getMoodDescription(moodScore)
  
  const prompt = `You are a warm, understanding ADHD coach. A client just checked in with a mood score of ${moodScore}/10 (${moodDescription}).${note ? ` They said: "${note}"` : ''}

Give exactly 2 sentences of supportive, practical advice. Be warm but concise. Focus on validation first, then one small actionable tip. Don't use emojis or bullet points.`

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 100,
        }
      })
    })

    if (!response.ok) {
      console.error('Gemini API error:', response.status)
      return getFallbackAdvice(moodScore)
    }

    const data = await response.json()
    const advice = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!advice) {
      return getFallbackAdvice(moodScore)
    }

    return advice.trim()
  } catch (error) {
    console.error('Gemini API error:', error)
    return getFallbackAdvice(moodScore)
  }
}

function getMoodDescription(score: number): string {
  if (score <= 2) return 'struggling'
  if (score <= 4) return 'low'
  if (score <= 6) return 'okay'
  if (score <= 8) return 'good'
  return 'great'
}

function getFallbackAdvice(moodScore: number): string {
  if (moodScore <= 3) {
    return "It's okay to have hard days—your feelings are valid. Try one tiny thing that brings comfort, even just a glass of water or a moment of stillness."
  }
  if (moodScore <= 5) {
    return "You're showing up and checking in, which takes strength. Consider what one small thing might shift your energy, even slightly."
  }
  if (moodScore <= 7) {
    return "You're in a steady place right now—that's worth acknowledging. This might be a good moment to tackle something small you've been putting off."
  }
  return "What a wonderful place to be! Consider noting what's contributing to this good feeling so you can return to it later."
}