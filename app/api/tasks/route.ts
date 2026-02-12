import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tasksRateLimiter } from '@/lib/rateLimiter'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const categoryId = searchParams.get('category_id')

    let query = supabase
      .from('tasks')
      .select('*, category:categories(id, name, color, icon)')
      .eq('user_id', user.id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })

    if (status && ['active', 'done', 'dropped'].includes(status)) {
      query = query.eq('status', status)
    }

    if (categoryId) {
      query = query.eq('category_id', categoryId)
    }

    const { data: tasks, error } = await query

    if (error) {
      console.error('Tasks fetch error:', error)
      return NextResponse.json({ error: 'Failed to load tasks.' }, { status: 500 })
    }

    return NextResponse.json({ tasks: tasks || [] })
  } catch (error) {
    console.error('Tasks GET error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (tasksRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const body = await request.json()
    const { dump_id, tasks } = body

    if (!dump_id || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ error: 'Invalid request. Provide dump_id and tasks array.' }, { status: 400 })
    }

    // Verify dump belongs to user
    const { data: dump } = await supabase
      .from('dumps')
      .select('id')
      .eq('id', dump_id)
      .eq('user_id', user.id)
      .single()

    if (!dump) {
      return NextResponse.json({ error: 'Dump not found.' }, { status: 404 })
    }

    // Batch insert tasks
    const taskRows = tasks.map((t: Record<string, unknown>, i: number) => ({
      user_id: user.id,
      dump_id,
      title: String(t.title || '').trim().slice(0, 500),
      status: 'active',
      due_date: t.due_date || null,
      due_time: t.due_time || null,
      priority: ['low', 'medium', 'high'].includes(t.priority as string) ? t.priority : null,
      original_fragment: t.original_fragment || null,
      ai_confidence: typeof t.confidence === 'number' ? t.confidence : 1.0,
      position: i,
    }))

    const { data: createdTasks, error } = await supabase
      .from('tasks')
      .insert(taskRows)
      .select('*, category:categories(id, name, color, icon)')

    if (error) {
      console.error('Tasks insert error:', error)
      return NextResponse.json({ error: 'Failed to save tasks.' }, { status: 500 })
    }

    return NextResponse.json({ tasks: createdTasks || [] }, { status: 201 })
  } catch (error) {
    console.error('Tasks POST error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
