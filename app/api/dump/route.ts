import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { dumpRateLimiter } from '@/lib/rateLimiter'
import { parseBrainDump } from '@/lib/ai/gemini'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (dumpRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
    }

    const body = await request.json()
    const rawText = typeof body.raw_text === 'string' ? body.raw_text.trim() : ''
    if (!rawText || rawText.length < 3) {
      return NextResponse.json({ error: 'Please enter at least a few words.' }, { status: 400 })
    }
    if (rawText.length > 5000) {
      return NextResponse.json({ error: 'Text too long (max 5000 characters).' }, { status: 400 })
    }
    const source = body.source === 'voice' ? 'voice' : 'text'

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
      return NextResponse.json({ error: 'Failed to save your dump. Please try again.' }, { status: 500 })
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
        ai_model: 'gemini-2.0-flash',
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
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
