import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { dumpRateLimiter } from '@/lib/rateLimiter'
import { parseBrainDump, GEMINI_MODEL } from '@/lib/ai/gemini'
import { dumpCreateSchema, parseBody } from '@/lib/validations'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    if (dumpRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const body = await request.json()
    const parsed = parseBody(dumpCreateSchema, body)
    if (!parsed.success) return parsed.response

    const rawText = parsed.data.raw_text.trim()
    const source = parsed.data.source

    // Save dump immediately so user's text is never lost
    const startTime = Date.now()
    const { data: dump, error: dumpError } = await supabase
      .from('dumps')
      .insert({
        user_id: user.id,
        raw_text: rawText,
        source,
        task_count: 0,
      })
      .select()
      .single()

    if (dumpError || !dump) {
      console.error('Dump insert error:', dumpError)
      return apiError('Failed to save your dump. Please try again.', 500, 'INTERNAL_ERROR')
    }

    // Parse with AI
    let parseResult
    try {
      parseResult = await parseBrainDump(rawText)
    } catch (aiError) {
      console.error('AI parsing error:', aiError)
      // AI failed but dump is saved — return it with empty tasks
      return NextResponse.json({
        dump,
        tasks: [],
        ai_error: 'Could not parse your dump automatically. You can add tasks manually.',
      }, { status: 200 })
    }

    const aiLatency = Date.now() - startTime

    // Update dump with task count and AI metadata
    await supabase
      .from('dumps')
      .update({
        task_count: parseResult.tasks.length,
        ai_model: GEMINI_MODEL,
        ai_latency_ms: aiLatency,
      })
      .eq('id', dump.id)
      .eq('user_id', user.id)

    return NextResponse.json({
      dump: { ...dump, task_count: parseResult.tasks.length },
      tasks: parseResult.tasks,
    }, { status: 201 })
  } catch (error) {
    console.error('Dump POST error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
