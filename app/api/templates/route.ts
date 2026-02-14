import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { templatesRateLimiter } from '@/lib/rateLimiter'

const MAX_TEMPLATES = 50

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    let query = supabase
      .from('task_templates')
      .select('*, category:categories(id, name, color, icon)')
      .eq('user_id', user.id)
      .order('use_count', { ascending: false })
      .order('last_used_at', { ascending: false, nullsFirst: false })

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    const { data: templates, error } = await query

    if (error) {
      console.error('Templates fetch error:', error)
      return NextResponse.json({ error: 'Failed to load templates.' }, { status: 500 })
    }

    return NextResponse.json({ templates: templates || [] })
  } catch (error) {
    console.error('Templates GET error:', error)
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

    if (templatesRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    // Check template count limit
    const { count } = await supabase
      .from('task_templates')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (count && count >= MAX_TEMPLATES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_TEMPLATES} templates allowed. Delete unused templates first.` },
        { status: 400 }
      )
    }

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const taskName = typeof body.task_name === 'string' ? body.task_name.trim() : ''

    if (!name || !taskName) {
      return NextResponse.json({ error: 'Template name and task name are required.' }, { status: 400 })
    }

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

    const { data: template, error } = await supabase
      .from('task_templates')
      .insert({
        user_id: user.id,
        name,
        task_name: taskName,
        description: body.description || null,
        priority: ['low', 'medium', 'high'].includes(body.priority) ? body.priority : null,
        category_id: body.category_id || null,
        is_recurring_default: !!body.is_recurring_default,
        recurrence_rule: body.recurrence_rule || null,
        tags: Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === 'string') : [],
      })
      .select('*, category:categories(id, name, color, icon)')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A template with this name already exists.' }, { status: 409 })
      }
      console.error('Template insert error:', error)
      return NextResponse.json({ error: 'Failed to create template.' }, { status: 500 })
    }

    // Check if approaching limit
    const warningThreshold = MAX_TEMPLATES - 5
    const warning = count && count >= warningThreshold
      ? `You're approaching the ${MAX_TEMPLATES} template limit. Consider merging similar templates.`
      : undefined

    return NextResponse.json({ template, warning }, { status: 201 })
  } catch (error) {
    console.error('Templates POST error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
