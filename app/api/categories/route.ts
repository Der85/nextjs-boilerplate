import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { categoriesRateLimiter } from '@/lib/rateLimiter'
import { DEFAULT_CATEGORIES } from '@/lib/utils/categories'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    let { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('position', { ascending: true })

    if (error) {
      console.error('Categories fetch error:', error)
      return NextResponse.json({ error: 'Failed to load categories.' }, { status: 500 })
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

    return NextResponse.json({ categories: categories || [] })
  } catch (error) {
    console.error('Categories GET error:', error)
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

    if (categoriesRateLimiter.isLimited(user.id)) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
    }

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'Category name is required.' }, { status: 400 })
    }

    const { data: category, error } = await supabase
      .from('categories')
      .insert({
        user_id: user.id,
        name,
        color: body.color || '#3B82F6',
        icon: body.icon || String.fromCodePoint(0x1F4C1),
        is_ai_generated: false,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A category with this name already exists.' }, { status: 409 })
      }
      console.error('Category insert error:', error)
      return NextResponse.json({ error: 'Failed to create category.' }, { status: 500 })
    }

    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    console.error('Categories POST error:', error)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
