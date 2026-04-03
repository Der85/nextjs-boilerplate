import type { NextConfig } from "next";

// Build CSP connect-src from Supabase URL (available at build time via NEXT_PUBLIC_)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
// Supabase Realtime uses WebSockets — derive wss:// from the https:// URL
const supabaseWsUrl = supabaseUrl.replace(/^https:\/\//, 'wss://');

const isProduction = process.env.NODE_ENV === 'production';

const cspDirectives = [
  "default-src 'self'",
  // Next.js requires 'unsafe-eval' in dev for Fast Refresh; production uses 'self' only
  isProduction
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  // Inline styles are used extensively via React style props
  "style-src 'self' 'unsafe-inline'",
  // Next.js next/font self-hosts fonts at build time
  "font-src 'self'",
  "img-src 'self' data: blob:",
  // Supabase REST + Auth (https) and Realtime (wss)
  [
    "connect-src 'self'",
    supabaseUrl,
    supabaseWsUrl,
    // Vercel preview toolbar (non-prod only)
    !isProduction ? 'https://*.vercel.live wss://*.vercel.live' : '',
  ].filter(Boolean).join(' '),
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
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
      ],
    },
  ],
};

export default nextConfig;
