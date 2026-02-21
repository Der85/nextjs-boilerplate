export const CSRF_COOKIE_NAME = 'csrf-token'
export const CSRF_HEADER_NAME = 'x-csrf-token'

const STATE_CHANGING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

export function isStateChangingMethod(method: string): boolean {
  return STATE_CHANGING_METHODS.has(method.toUpperCase())
}

export function generateCsrfToken(): string {
  return crypto.randomUUID()
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function validateCsrfToken(headerValue: string, cookieValue: string): boolean {
  if (headerValue.length !== cookieValue.length) return false
  const a = new TextEncoder().encode(headerValue)
  const b = new TextEncoder().encode(cookieValue)
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a[i] ^ b[i]
  }
  return mismatch === 0
}

export function getAllowedOrigins(): string[] {
  const origins: string[] = []

  if (process.env.NEXT_PUBLIC_APP_URL) {
    origins.push(process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ''))
  }

  // Vercel deployment URLs
  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`)
  }

  if (process.env.NODE_ENV === 'development') {
    origins.push('http://localhost:3000')
  }

  return origins
}

export function getCookieOptions(): {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax'
  path: string
  maxAge: number
} {
  return {
    httpOnly: false, // Frontend JS must read this cookie
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 86400, // 24 hours
  }
}
