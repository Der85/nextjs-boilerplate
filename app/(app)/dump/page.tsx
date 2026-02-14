'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DumpInput from '@/components/DumpInput'
import ConfirmationCards from '@/components/ConfirmationCards'
import WeeklyReviewBanner from '@/components/WeeklyReviewBanner'
import type { ParsedTask, DumpResponse } from '@/lib/types'

type DumpPhase = 'input' | 'confirming' | 'success'

export default function DumpPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<DumpPhase>('input')
  const [loading, setLoading] = useState(false)
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([])
  const [dumpId, setDumpId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successCount, setSuccessCount] = useState(0)

  const handleDumpSubmit = useCallback(async (text: string, source: 'text' | 'voice'): Promise<boolean> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: text, source }),
      })
      const data: DumpResponse & { error?: string; ai_error?: string } = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse dump')
      }

      if (data.ai_error) {
        setError(data.ai_error)
      }

      if (data.tasks.length > 0) {
        setParsedTasks(data.tasks)
        setDumpId(data.dump.id)
        setPhase('confirming')
        return true // Success - input can be cleared
      } else {
        setError(data.ai_error || 'Could not extract tasks. Try being more specific about what you need to do.')
        return false // Failed - preserve input
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      return false // Failed - preserve input
    } finally {
      setLoading(false)
    }
  }, [])

  const handleConfirm = useCallback(async (tasks: ParsedTask[]) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dump_id: dumpId, tasks }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save tasks')
      }
      setSuccessCount(tasks.length)
      setPhase('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save tasks')
    } finally {
      setLoading(false)
    }
  }, [dumpId])

  const handleReset = () => {
    setPhase('input')
    setParsedTasks([])
    setDumpId('')
    setError(null)
    setSuccessCount(0)
  }

  return (
    <div style={{ paddingTop: '20px', paddingBottom: '24px' }}>
      {/* Weekly Review Banner - only show on input phase */}
      {phase === 'input' && <WeeklyReviewBanner />}

      {/* Header - only show on input phase */}
      {phase === 'input' && (
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{
            fontSize: 'var(--text-heading)',
            fontWeight: 'var(--font-heading)',
            color: 'var(--color-text-primary)',
          }}>
            Brain Dump
          </h1>
          <p style={{
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--text-caption)',
            marginTop: '4px',
          }}>
            Just type whatever&apos;s on your mind. I&apos;ll sort it out.
          </p>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={{
          background: 'var(--color-warning-light)',
          color: '#92400E',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-caption)',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>&#x26A0;&#xFE0F;</span>
          <span>{error}</span>
        </div>
      )}

      {/* Input phase */}
      {phase === 'input' && (
        <DumpInput onSubmit={handleDumpSubmit} loading={loading} />
      )}

      {/* Confirmation phase */}
      {phase === 'confirming' && (
        <ConfirmationCards
          tasks={parsedTasks}
          dumpId={dumpId}
          onConfirm={handleConfirm}
          onCancel={handleReset}
          loading={loading}
        />
      )}

      {/* Success phase */}
      {phase === 'success' && (
        <div style={{
          textAlign: 'center',
          padding: '48px 0',
          animation: 'fade-in 0.3s ease',
        }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>
            &#x2705;
          </div>
          <h2 style={{
            fontSize: 'var(--text-heading)',
            fontWeight: 'var(--font-heading)',
            color: 'var(--color-text-primary)',
            marginBottom: '8px',
          }}>
            {successCount} task{successCount !== 1 ? 's' : ''} added!
          </h2>
          <p style={{
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--text-caption)',
            marginBottom: '32px',
          }}>
            Nice work getting those out of your head.
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={handleReset}
              style={{
                height: '48px',
                padding: '0 24px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--text-body)',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Dump again
            </button>
            <button
              onClick={() => router.push('/tasks')}
              style={{
                height: '48px',
                padding: '0 24px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'var(--color-accent)',
                color: '#fff',
                fontSize: 'var(--text-body)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              View tasks
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
