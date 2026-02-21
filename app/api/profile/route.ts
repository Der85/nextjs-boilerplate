import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api-response'
import { createClient } from '@/lib/supabase/server'
import { tasksRateLimiter } from '@/lib/rateLimiter'
import { profilePatchSchema, parseBody } from '@/lib/validations'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return apiError('Authentication required', 401, 'UNAUTHORIZED')
    }
    if (tasksRateLimiter.isLimited(user.id)) {
      return apiError('Too many requests.', 429, 'RATE_LIMITED')
    }


    // Try to fetch existing profile
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error && error.code === 'PGRST116') {
      // No profile exists, create one
      const { data: newProfile, error: insertError } = await supabase
        .from('user_profiles')
        .insert({ id: user.id })
        .select()
        .single()

      if (insertError) {
        console.error('Profile create error:', insertError)
        return apiError('Failed to create profile.', 500, 'INTERNAL_ERROR')
      }

      return NextResponse.json({ profile: newProfile, email: user.email }, {
        headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' },
      })
    }

    if (error) {
      console.error('Profile fetch error:', error)
      return apiError('Failed to load profile.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ profile, email: user.email }, {
      headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' },
    })
  } catch (error) {
    console.error('Profile GET error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}

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
    const parsed = parseBody(profilePatchSchema, body)
    if (!parsed.success) return parsed.response

    const updates: Record<string, unknown> = {}
    if (parsed.data.display_name !== undefined) {
      updates.display_name = parsed.data.display_name.trim() || null
    }
    if (parsed.data.timezone !== undefined) {
      updates.timezone = parsed.data.timezone
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Profile update error:', error)
      return apiError('Failed to update profile.', 500, 'INTERNAL_ERROR')
    }

    return NextResponse.json({ profile })
  } catch (error) {
    console.error('Profile PATCH error:', error)
    return apiError('Something went wrong.', 500, 'INTERNAL_ERROR')
  }
}
