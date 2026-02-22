import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { categoriesRateLimiter } from '@/lib/rateLimiter'
import { DEFAULT_CATEGORIES } from '@/lib/utils/categories'
import { categoryCreateSchema, parseBody } from '@/lib/validations'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }

    let { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('position', { ascending: true })

    if (error) {
      console.error('Categories fetch error:', error)
      return apiError('Failed to load categories.', 500, 'INTERNAL_ERROR')
    }

    // Seed default categories if user has none
    if (!categories || categories.length === 0) {
      const defaultsToInsert = DEFAULT_CATEGORIES.map(cat => ({
        ...cat,
        user_id: user.id,
      }))

      const { data: seeded, error: seedError } = await supabase
        .from('categories')
        .insert(defaultsToInsert)
        .select()

      if (seedError) {
        console.error('Categories seed error:', seedError)
        // Continue with empty array rather than failing
      } else {
        categories = seeded
      }
    }

    return NextResponse.json({ categories: categories || [] }, {
      headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    console.error('Categories GET error:', error)
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

    if (categoriesRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }

    const body = await request.json()
    const parsed = parseBody(categoryCreateSchema, body)
    if (!parsed.success) return parsed.response

    const { data: category, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        name: parsed.data.name.trim(),
        color: parsed.data.color,
        icon: parsed.data.icon || String.fromCodePoint(0x1F4C1),
        is_ai_generated: false,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return apiError('A category with this name already exists.', 409, 'CONFLICT')
      }
      console.error('Category insert error:', error)
      return apiError('Failed to create category.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    console.error('Categories POST error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
