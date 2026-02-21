import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { tasksRateLimiter } from '@/lib/rateLimiter'
import { findCategoryByName, getFallbackCategory } from '@/lib/utils/categories'
import { taskCreateSchema, parseBody } from '@/lib/validations'
import type { Category } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
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
      return apiError('Failed to load tasks.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({
      tasks: tasks || [],
      pagination: { limit, offset, count: (tasks || []).length },
    }, {
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    })
  } catch (error) {
    console.error('Tasks GET error:', error)
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

    if (tasksRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const body = await request.json()
    const parsed = parseBody(taskCreateSchema, body)
    if (!parsed.success) return parsed.response

    const { dump_id, tasks } = parsed.data

    // Verify dump belongs to user
    const { data: dump } = await supabase
      .from('dumps')
      .select('id')
      .eq('id', dump_id)
      .eq('user_id', user.id)
      .single()

    if (!dump) {
      return apiError('Dump not found.', 404, 'NOT_FOUND')
    }

    // Fetch user's categories to map AI category names to IDs
    const { data: categories } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)

    const userCategories = (categories || []) as Category[]
    const fallbackCategory = getFallbackCategory(userCategories)

    // Batch insert tasks with AI categorization
    const taskRows = tasks.map((t, i) => {
      // Map AI category name to user's category ID
      let categoryId: string | null = null
      let categoryConfidence: number | null = null

      if (t.category) {
        const matchedCategory = findCategoryByName(userCategories, t.category)
        if (matchedCategory) {
          categoryId = matchedCategory.id
          categoryConfidence = t.category_confidence ?? 0.8
        } else if (fallbackCategory) {
          categoryId = fallbackCategory.id
          categoryConfidence = 0.3
        }
      }

      return {
        user_id: user.id,
        dump_id,
        title: t.title.trim().slice(0, 500),
        status: 'active',
        due_date: t.due_date ?? null,
        due_time: t.due_time ?? null,
        priority: t.priority,
        original_fragment: t.original_fragment ?? null,
        ai_confidence: t.confidence ?? 1.0,
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
      return apiError('Failed to save tasks.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ tasks: createdTasks || [] }, { status: 201 })
  } catch (error) {
    console.error('Tasks POST error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
