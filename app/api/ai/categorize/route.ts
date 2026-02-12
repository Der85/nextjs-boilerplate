import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { aiRateLimiter } from '@/lib/rateLimiter'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getCategorizePrompt } from '@/lib/ai/prompts'
import { categorizeSchema } from '@/lib/ai/schemas'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (aiRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    // Fetch uncategorized active tasks
    const { data: tasks, error: fetchError } = await supabase
      .from('tasks')
      .select('id, title')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .is('category_id', null)

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch tasks.' }, { status: 500 })
    }

    if (!tasks || tasks.length < 10) {
      return NextResponse.json({
        eligible: false,
        message: `Need at least 10 uncategorized tasks (you have ${tasks?.length || 0}).`,
        task_count: tasks?.length || 0,
      })
    }

    // Call Gemini for categorization
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: categorizeSchema,
      },
    })

    const taskList = tasks.map(t => `[${t.id}] ${t.title}`).join('\n')
    const result = await model.generateContent([
      { text: getCategorizePrompt() },
      { text: `Tasks:\n${taskList}` },
    ])

    const parsed = JSON.parse(result.response.text())

    // Save as suggestion
    const { data: suggestion, error: insertError } = await supabase
      .from('category_suggestions')
      .insert({
        user_id: user.id,
        suggestion_type: 'initial',
        suggested_categories: parsed.categories,
        task_count_at_suggestion: tasks.length,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Suggestion insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save suggestions.' }, { status: 500 })
    }

    return NextResponse.json({ suggestion, eligible: true }, { status: 201 })
  } catch (error) {
    console.error('AI categorize error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
