import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { tasksRateLimiter } from '@/lib/rateLimiter'

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    if (tasksRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const body = await request.json()
    const { tasks } = body

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return apiError('Provide tasks array with id and position.', 400, 'BAD_REQUEST')
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
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
