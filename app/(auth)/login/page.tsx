'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dump')
    }
  }

  return (
    <div style={{
      width: '100%',
      maxWidth: '400px',
      background: 'var(--color-bg)',
      borderRadius: 'var(--radius-lg)',
      padding: '40px 32px',
      boxShadow: 'var(--shadow-lg)',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: 'var(--text-heading)', fontWeight: 'var(--font-heading)', marginBottom: '8px' }}>
          ADHDer.io
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-caption)' }}>
          Welcome back. Let&apos;s get things done.
        </p>
      </div>

      {error && (
        <div style={{
          background: 'var(--color-danger-light)',
          color: 'var(--color-danger)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          fontSize: 'var(--text-caption)',
          marginBottom: '20px',
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label htmlFor="email" style={{
            display: 'block',
            fontSize: 'var(--text-caption)',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            marginBottom: '6px',
          }}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
            style={{
              width: '100%',
              padding: '12px 14px',
              fontSize: 'var(--text-body)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg)',
              color: 'var(--color-text-primary)',
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--color-accent)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
          />
        </div>

        <div>
          <label htmlFor="password" style={{
            display: 'block',
            fontSize: 'var(--text-caption)',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            marginBottom: '6px',
          }}>
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="Your password"
            style={{
              width: '100%',
              padding: '12px 14px',
              fontSize: 'var(--text-body)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg)',
              color: 'var(--color-text-primary)',
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--color-accent)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            height: '48px',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-accent)',
            color: '#fff',
            fontSize: 'var(--text-body)',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: 'background 0.15s, opacity 0.15s',
            marginTop: '8px',
          }}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p style={{
        textAlign: 'center',
        marginTop: '24px',
        fontSize: 'var(--text-caption)',
        color: 'var(--color-text-secondary)',
      }}>
        Don&apos;t have an account?{' '}
        <Link href="/signup" style={{ color: 'var(--color-accent)', fontWeight: 500 }}>
          Sign up
        </Link>
      </p>
    </div>
  )
}
