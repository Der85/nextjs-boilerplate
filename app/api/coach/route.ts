// ... [Keep imports and helper functions: getClient, getServiceClient, getIp, isRateLimited, isValidMoodScore, buildUserContext] ...

// ============================================
// IMPROVED PROMPT GENERATOR
// Includes "Sanitization" logic to prevent echoing typos
// ============================================

function generateContextualPrompt(context: UserContext, moodScore: number, noteText: string) {
  const insights: string[] = []
  let suggestedApproach = 'standard'

  // 1. ANALYZE HISTORY
  if (context.totalCheckIns === 0) {
    insights.push("This is the user's first check-in. Welcome them warmly.")
    suggestedApproach = 'onboarding'
  } else {
    // Streak Analysis
    if (context.currentStreak) {
      if (context.currentStreak.type === 'low_mood' && context.currentStreak.days >= 3) {
        insights.push(`CRITICAL: User is in a "Low Mood Cycle" (Day ${context.currentStreak.days}).`)
        suggestedApproach = 'gentle_support'
      } else if (context.currentStreak.type === 'high_mood') {
        insights.push(`User is on a "High Mood Streak" (${context.currentStreak.days} days). Help them bank this feeling.`)
        suggestedApproach = 'celebrate_maintain'
      } else if (context.currentStreak.type === 'checking_in') {
        insights.push(`Consistency Win: ${context.currentStreak.days}-day check-in streak.`)
      }
    }

    // Pattern Recognition
    if (context.currentPattern) {
      insights.push(`Observed Pattern: ${context.currentPattern.description}`)
    }

    // Baseline Comparison
    if (context.comparedToBaseline !== 'same') {
      const direction = context.comparedToBaseline === 'better' ? 'above' : 'below'
      insights.push(`Current State: Mood is ${direction} their historical baseline of ${context.averageMood}.`)
    }
    
    // Last Session Bridge (Object Permanence)
    if (context.lastCheckIn && context.lastCheckIn.note) {
      // Only reference note if it was substantial
      if (context.lastCheckIn.note.length > 5) {
         insights.push(`Context from last time: They were feeling ${context.lastCheckIn.mood_score}/10 and mentioned "${context.lastCheckIn.note.slice(0, 50)}..."`)
      }
    }
  }

  // 2. DEFINE SYSTEM PERSONA
  const systemContext = `ROLE: You are an expert ADHD coach who acts as an "External Executive Function" for the user. You prioritize pattern recognition over generic cheerleading.
  
USER PROFILE (The "Moat" Data):
- History: ${context.totalCheckIns} check-ins logged
- Baseline Mood: ${context.averageMood}/10
${insights.map(i => `- ${i}`).join('\n')}`

  // 3. DEFINE CURRENT SITUATION
  const moodChange = context.lastCheckIn 
    ? moodScore - context.lastCheckIn.mood_score 
    : 0
  
  const currentSituation = `
CURRENT INPUT:
- Score: ${moodScore}/10
- Raw Text: "${noteText || '(no note provided)'}"
- Delta: ${moodChange > 0 ? '+' : ''}${moodChange} points from last entry
${moodScore <= 3 ? '- ALERT: High Dysregulation Risk. Reduce friction.' : ''}`

  // 4. STRATEGIC INSTRUCTION
  const approachInstructions: Record<string, string> = {
    standard: 'Connect the current mood to their recent history. Look for correlations.',
    onboarding: 'Focus on low-pressure welcome. Do not overwhelm with questions.',
    gentle_support: 'Validate the difficulty of the streak. Do NOT suggest big tasks. Suggest one sensory reset (e.g., drink water, step outside).',
    celebrate_maintain: 'Ask them to identify ONE thing that made this happen, so they can replicate it later.',
  }

  return {
    systemContext,
    currentSituation,
    suggestedApproach: approachInstructions[suggestedApproach] || approachInstructions.standard
  }
}

// ============================================
// MAIN API HANDLER
// ============================================

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  const supabase = getClient()

  // [Keep existing Error Handling, Auth, Rate Limiting, and UserID logic...]
  if (!apiKey || !supabase) return NextResponse.json({ advice: getGenericAdvice(5) }, { status: 500 })
  
  // ... [Rate limit check code] ...
  // ... [Auth check code] ...
  
  // For the purpose of this snippet, assuming we have userId, moodScore, note from your original code:
  // --------------------------------------------------------------------------
  
  // (Paste this inside your existing try/catch block after getting userId)
  
    // Parse request body
    const { moodScore, note } = await request.json()
    if (!isValidMoodScore(moodScore)) {
      return NextResponse.json({ advice: getGenericAdvice(5) }, { status: 400 })
    }

    const noteText = typeof note === 'string' ? note : ''
    
    // Build Context
    const serviceClient = getServiceClient()
    const contextClient = serviceClient || supabase
    const userContext = await buildUserContext(contextClient, userId) // userId comes from your Auth logic
    
    // Quick returns for empty notes (Keep your existing logic here)
    if (noteText.trim().length < 3 && userContext.totalCheckIns === 0) {
       // ... [Your existing Onboarding return]
    }
    if (noteText.trim().length < 3) {
       // ... [Your existing ContextAwareGeneric return]
    }

    // =========================================================
    // THE NEW "ANTI-WRAPPER" PROMPT
    // This is where we fix the "Echoing" and "Robot" issues
    // =========================================================
    
    const contextualPrompt = generateContextualPrompt(userContext, moodScore, noteText)

    const prompt = `
${contextualPrompt.systemContext}

${contextualPrompt.currentSituation}

STRATEGY:
${contextualPrompt.suggestedApproach}

### CRITICAL RULES FOR INPUT SANITIZATION (Do not skip):
1. **NO PARROTING:** If the user's text seems like a typo, fragment, or incoherent (e.g., "grand like", "tired ugh", "sdlfk"), **DO NOT quote it directly**.
   - BAD: "I see 'grand like' is on your mind."
   - GOOD: "It sounds like things are a bit unclear or weighing on you right now."
   - GOOD (if typo seems happy): "I sense some good energy despite the typo!"
2. **INTERPRET INTENT:** If the text is short/unclear, prioritize the MOOD SCORE (${moodScore}/10) as your source of truth.
3. **OBJECT PERMANENCE:** If they mentioned a specific struggle in the *previous* session (see context), and they are low again, reference that connection.

### OUTPUT FORMAT:
- Write 2-3 short, warm sentences.
- **Sentence 1:** Validate their state using the Context (Streak/History) + Current Mood.
- **Sentence 2:** Offer a micro-observation or a tiny "frictionless" next step.
- Tone: UK English, casual, supportive (like a smart friend, not a medical textbook).
- NO emojis at start of sentences. NO bullet points.

Now respond:`

    // Call Gemini API (Keep your existing fetch logic)
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7, // Lowered slightly to reduce hallucinations on typos
          maxOutputTokens: 200,
        }
      })
    })

    // ... [Rest of your response handling logic]
}