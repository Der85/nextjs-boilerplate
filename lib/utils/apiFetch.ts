import { CSRF_COOKIE_NAME } from '@/lib/csrf'

export function getCsrfToken(): string {
  return (
    document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${CSRF_COOKIE_NAME}=`))
      ?.split('=')[1] ?? ''
  )
}

const STATE_CHANGING = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method ?? 'GET').toUpperCase()
  const headers = new Headers(options.headers)

  if (STATE_CHANGING.has(method)) {
    headers.set('x-csrf-token', getCsrfToken())
    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json')
    }
  }

  return fetch(url, { ...options, headers })
}
