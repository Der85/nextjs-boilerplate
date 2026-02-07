// Supabase Client for Server Components and Server Actions
// Use this in Server Components, Route Handlers, and Server Actions

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Creates a Supabase client for use in Server Components and Server Actions.
 * This client reads auth state from cookies (read-only for Server Components).
 *
 * Usage in Server Components:
 * ```tsx
 * import { createClient } from '@/utils/supabase/server'
 *
 * async function MyServerComponent() {
 *   const supabase = await createClient()
 *   const { data } = await supabase.from('table').select()
 *   // ...
 * }
 * ```
 *
 * Usage in Server Actions:
 * ```tsx
 * 'use server'
 * import { createClient } from '@/utils/supabase/server'
 *
 * async function myAction() {
 *   const supabase = await createClient()
 *   // ...
 * }
 * ```
 */
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}
