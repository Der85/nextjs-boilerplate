import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/csrf'

function getCsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${CSRF_COOKIE_NAME}=`))
  return match?.split('=')[1]
}

/**
 * Fetch wrapper that auto-injects the CSRF token header and
 * defaults Content-Type to application/json when a body is present.
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers)

  const csrfToken = getCsrfToken()
  if (csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken)
  }

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return fetch(url, { ...options, headers })
}
