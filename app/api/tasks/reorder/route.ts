import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tasksRateLimiter } from '@/lib/rateLimiter'

export async function PATCH(request: NextRequest) {
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
    const { tasks } = body

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ error: 'Provide tasks array with id and position.' }, { status: 400 })
    }

    // Update each task's position
    const updates = tasks.map((t: { id: string; position: number }) =>
      supabase
        .from('tasks')
        .update({ position: t.position })
        .eq('id', t.id)
        .eq('user_id', user.id)
    )

    await Promise.all(updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Tasks reorder error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
