import { NextResponse } from 'next/server'

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'BAD_REQUEST'
  | 'INTERNAL_ERROR'

interface ApiErrorBody {
  error: string
  code: ApiErrorCode
}

/**
 * Return a standardized JSON error response with an HTTP status and a
 * machine-readable `code` field clients can switch on without parsing strings.
 */
export function apiError(
  message: string,
  status: number,
  code: ApiErrorCode
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: message, code }, { status })
}
