import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { templatesRateLimiter } from '@/lib/rateLimiter'
import { templateCreateSchema, parseBody } from '@/lib/validations'

const MAX_TEMPLATES = 50

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
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
      return apiError('Failed to load templates.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ templates: templates || [] }, {
      headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    console.error('Templates GET error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    if (templatesRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
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
    const parsed = parseBody(templateCreateSchema, body)
    if (!parsed.success) return parsed.response

    const { name, task_name, description, priority: pri, category_id, is_recurring_default, recurrence_rule, tags } = parsed.data

    // Verify category belongs to user if provided
    if (category_id) {
      const { data: cat } = await supabase
        .from('categories')
        .select('id')
        .eq('id', category_id)
        .eq('user_id', user.id)
        .single()

      if (!cat) {
        return apiError('Invalid category.', 400, 'VALIDATION_ERROR')
      }
    }

    const { data: template, error } = await supabase
      .from('task_templates')
      .insert({
        user_id: user.id,
        name: name.trim(),
        task_name: task_name.trim(),
        description: description ?? null,
        priority: pri ?? null,
        category_id: category_id ?? null,
        is_recurring_default,
        recurrence_rule: recurrence_rule ?? null,
        tags,
      })
      .select('*, category:categories(id, name, color, icon)')
      .single()

    if (error) {
      if (error.code === '23505') {
        return apiError('A template with this name already exists.', 409, 'CONFLICT')
      }
      console.error('Template insert error:', error)
      return apiError('Failed to create template.', 500, 'INTERNAL_ERROR')
    }

    // Check if approaching limit
    const warningThreshold = MAX_TEMPLATES - 5
    const warning = count && count >= warningThreshold
      ? `You're approaching the ${MAX_TEMPLATES} template limit. Consider merging similar templates.`
      : undefined

    return NextResponse.json({ template, warning }, { status: 201 })
  } catch (error) {
    console.error('Templates POST error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
