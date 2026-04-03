'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const HANDLE_REGEX = /^[a-zA-Z0-9_]{3,20}$/

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  fontSize: 'var(--text-body)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--color-bg)',
  color: 'var(--color-text-primary)',
  outline: 'none',
  transition: 'border-color 0.15s',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-caption)',
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
  marginBottom: '6px',
}

export default function SignupPage() {
  const router = useRouter()
  const [handle, setHandle] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!HANDLE_REGEX.test(handle)) {
      setError('Handle must be 3–20 characters: letters, numbers, and underscores only')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    const supabase = createClient()

    // Check handle availability before sign up to give a fast error
    const { data: existingHandle } = await supabase
      .from('profiles')
      .select('handle')
      .eq('handle', handle)
      .maybeSingle()

    if (existingHandle) {
      setError('That handle is already taken. Try another.')
      setLoading(false)
      return
    }

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Upsert the profile with the user-chosen handle.
      // The DB trigger also inserts a profile row (from email prefix) as a fallback,
      // but since we're faster here, ON CONFLICT (id) DO NOTHING on the trigger
      // means this row wins. Assumes email confirmation is disabled in Supabase.
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          handle,
          display_name: displayName || handle,
        }, { onConflict: 'id' })

      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }
    }

    router.push('/local')
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
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
          ADHDer.io
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
          Your location is your voice.
        </p>
      </div>

      {error && (
        <div style={{
          background: 'var(--color-danger-light)',
          color: 'var(--color-danger)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.875rem',
          marginBottom: '20px',
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label htmlFor="handle" style={labelStyle}>Handle</label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--color-text-tertiary)', pointerEvents: 'none',
            }}>@</span>
            <input
              id="handle"
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              required
              autoComplete="username"
              placeholder="yourhandle"
              maxLength={20}
              style={{ ...inputStyle, paddingLeft: '28px' }}
              onFocus={(e) => e.target.style.borderColor = 'var(--color-accent)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
            />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
            3–20 chars, letters, numbers, underscores
          </p>
        </div>

        <div>
          <label htmlFor="display-name" style={labelStyle}>Display name</label>
          <input
            id="display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
            placeholder="Your name (optional)"
            maxLength={50}
            style={inputStyle}
            onFocus={(e) => e.target.style.borderColor = 'var(--color-accent)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
          />
        </div>

        <div>
          <label htmlFor="email" style={labelStyle}>Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
            style={inputStyle}
            onFocus={(e) => e.target.style.borderColor = 'var(--color-accent)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
          />
        </div>

        <div>
          <label htmlFor="password" style={labelStyle}>Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="At least 6 characters"
            style={inputStyle}
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
            fontSize: '1rem',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: 'opacity 0.15s',
            marginTop: '8px',
          }}
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p style={{
        textAlign: 'center',
        marginTop: '24px',
        fontSize: '0.875rem',
        color: 'var(--color-text-secondary)',
      }}>
        Already have an account?{' '}
        <Link href="/login" style={{ color: 'var(--color-accent)', fontWeight: 500 }}>
          Sign in
        </Link>
      </p>
    </div>
  )
}
