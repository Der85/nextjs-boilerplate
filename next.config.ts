import type { NextConfig } from "next";

// Build CSP connect-src from Supabase URL (available at build time via NEXT_PUBLIC_)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

const cspDirectives = [
  "default-src 'self'",
  // Next.js requires 'unsafe-eval' in dev for Fast Refresh; production uses 'self' only
  process.env.NODE_ENV === 'development'
    ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline'",
  // Inline styles are used extensively via React style props
  "style-src 'self' 'unsafe-inline'",
  // Next.js next/font self-hosts fonts at build time
  "font-src 'self'",
  "img-src 'self' data: blob:",
  // Supabase client makes requests from the browser
  `connect-src 'self' ${supabaseUrl}`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

const ContentSecurityPolicy = cspDirectives.join('; ');

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Content-Security-Policy', value: ContentSecurityPolicy },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
      ],
    },
  ],
};

export default nextConfig;
