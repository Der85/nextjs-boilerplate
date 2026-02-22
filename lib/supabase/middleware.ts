import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  isStateChangingMethod,
  generateCsrfToken,
  validateCsrfToken,
  getAllowedOrigins,
  getCookieOptions,
} from '@/lib/csrf'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protected app routes — redirect to login if not authenticated
  const isAppRoute =
    request.nextUrl.pathname.startsWith('/dump') ||
    request.nextUrl.pathname.startsWith('/tasks') ||
    request.nextUrl.pathname.startsWith('/insights') ||
    request.nextUrl.pathname.startsWith('/settings') ||
    request.nextUrl.pathname.startsWith('/api/')

  if (!user && isAppRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Auth routes — redirect to dump if already logged in
  const isAuthRoute =
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/signup'

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dump'
    return NextResponse.redirect(url)
  }

  // ── CSRF Protection for state-changing API requests ──────────────────
  const method = request.method.toUpperCase()
  if (
    request.nextUrl.pathname.startsWith('/api/') &&
    isStateChangingMethod(method)
  ) {
    // Layer 1: Origin validation
    const origin = request.headers.get('origin')
    const referer = request.headers.get('referer')
    const requestOrigin = origin || (referer ? new URL(referer).origin : null)

    if (requestOrigin) {
      const allowedOrigins = getAllowedOrigins()
      if (allowedOrigins.length > 0 && !allowedOrigins.includes(requestOrigin)) {
        return NextResponse.json(
          { error: 'Invalid request origin.', code: 'CSRF_ERROR' },
          { status: 403 }
        )
      }
    }

    // Layer 2: Double Submit Cookie validation
    const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value
    const headerToken = request.headers.get(CSRF_HEADER_NAME)

    if (!cookieToken || !headerToken || !validateCsrfToken(headerToken, cookieToken)) {
      return NextResponse.json(
        { error: 'CSRF validation failed.', code: 'CSRF_ERROR' },
        { status: 403 }
      )
    }
  }

  // Ensure CSRF cookie is set on every response
  if (!request.cookies.get(CSRF_COOKIE_NAME)?.value) {
    supabaseResponse.cookies.set(CSRF_COOKIE_NAME, generateCsrfToken(), getCookieOptions())
  }

  return supabaseResponse
}
