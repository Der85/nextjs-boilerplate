import { NextResponse } from "next/server";

export function apiError(message: string, status = 500, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function unauthorized() {
  return apiError("Not authenticated", 401, "UNAUTHENTICATED");
}
