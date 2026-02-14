import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { templatesRateLimiter } from '@/lib/rateLimiter'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (templatesRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const { id } = await context.params
    const body = await request.json()

    const updates: Record<string, unknown> = {}

    if (typeof body.name === 'string' && body.name.trim()) {
      updates.name = body.name.trim()
    }
    if (typeof body.task_name === 'string' && body.task_name.trim()) {
      updates.task_name = body.task_name.trim()
    }
    if (body.description !== undefined) {
      updates.description = body.description || null
    }
    if (body.priority !== undefined) {
      updates.priority = ['low', 'medium', 'high'].includes(body.priority) ? body.priority : null
    }
    if (body.category_id !== undefined) {
      // Verify category belongs to user if provided
      if (body.category_id) {
        const { data: cat } = await supabase
          .from('categories')
          .select('id')
          .eq('id', body.category_id)
          .eq('user_id', user.id)
          .single()

        if (!cat) {
          return NextResponse.json({ error: 'Invalid category.' }, { status: 400 })
        }
      }
      updates.category_id = body.category_id || null
    }
    if (typeof body.is_recurring_default === 'boolean') {
      updates.is_recurring_default = body.is_recurring_default
    }
    if (body.recurrence_rule !== undefined) {
      updates.recurrence_rule = body.recurrence_rule || null
    }
    if (Array.isArray(body.tags)) {
      updates.tags = body.tags.filter((t: unknown) => typeof t === 'string')
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 })
    }

    const { data: template, error } = await supabase
      .from('task_templates')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*, category:categories(id, name, color, icon)')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A template with this name already exists.' }, { status: 409 })
      }
      console.error('Template update error:', error)
      return NextResponse.json({ error: 'Failed to update template.' }, { status: 500 })
    }

    if (!template) {
      return NextResponse.json({ error: 'Template not found.' }, { status: 404 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Templates PATCH error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await context.params

    const { error } = await supabase
      .from('task_templates')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Template delete error:', error)
      return NextResponse.json({ error: 'Failed to delete template.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Templates DELETE error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
