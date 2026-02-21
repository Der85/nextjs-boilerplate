import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tasksRateLimiter } from '@/lib/rateLimiter'
import { findCategoryByName, getFallbackCategory } from '@/lib/utils/categories'
import type { Category } from '@/lib/types'

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
    const limitParam = searchParams.get('limit')
    const offsetParam = searchParams.get('offset')

    const MAX_LIMIT = 500
    const DEFAULT_LIMIT = 500
    const limit = Math.min(
      limitParam ? Math.max(1, parseInt(limitParam, 10) || DEFAULT_LIMIT) : DEFAULT_LIMIT,
      MAX_LIMIT
    )
    const offset = offsetParam ? Math.max(0, parseInt(offsetParam, 10) || 0) : 0

    let query = supabase
      .from('tasks')
      .select('*, category:categories(id, name, color, icon)')
      .eq('user_id', user.id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

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

    return NextResponse.json({
      tasks: tasks || [],
      pagination: { limit, offset, count: (tasks || []).length },
    })
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

    // Fetch user's categories to map AI category names to IDs
    const { data: categories } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)

    const userCategories = (categories || []) as Category[]
    const fallbackCategory = getFallbackCategory(userCategories)

    // Validate each task title
    for (const t of tasks) {
      const title = String(t.title || '').trim()
      if (!title) {
        return NextResponse.json({ error: 'Each task must have a non-empty title.' }, { status: 400 })
      }
      if (title.length > 500) {
        return NextResponse.json({ error: 'Task title must be 500 characters or fewer.' }, { status: 400 })
      }
    }

    // Batch insert tasks with AI categorization
    const taskRows = tasks.map((t: Record<string, unknown>, i: number) => {
      // Map AI category name to user's category ID
      let categoryId: string | null = null
      let categoryConfidence: number | null = null

      if (t.category && typeof t.category === 'string') {
        const matchedCategory = findCategoryByName(userCategories, t.category)
        if (matchedCategory) {
          categoryId = matchedCategory.id
          categoryConfidence = typeof t.category_confidence === 'number' ? t.category_confidence : 0.8
        } else if (fallbackCategory) {
          // AI returned unknown category, use fallback
          categoryId = fallbackCategory.id
          categoryConfidence = 0.3 // Low confidence since we fell back
        }
      }

      return {
        user_id: user.id,
        dump_id,
        title: String(t.title || '').trim().slice(0, 500),
        status: 'active',
        due_date: t.due_date || null,
        due_time: t.due_time || null,
        priority: ['low', 'medium', 'high'].includes(t.priority as string) ? t.priority : null,
        original_fragment: t.original_fragment || null,
        ai_confidence: typeof t.confidence === 'number' ? t.confidence : 1.0,
        category_id: categoryId,
        category_confidence: categoryConfidence,
        position: i,
      }
    })

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
