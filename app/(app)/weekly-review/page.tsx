'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import WeeklyReviewHeader from '@/components/WeeklyReviewHeader'
import WeeklyReviewSection from '@/components/WeeklyReviewSection'
import WeeklyReviewHistory from '@/components/WeeklyReviewHistory'
import type { WeeklyReview } from '@/lib/types'

export default function WeeklyReviewPage() {
  const router = useRouter()
  const [review, setReview] = useState<WeeklyReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canGenerate, setCanGenerate] = useState(false)
  const [showFullMarkdown, setShowFullMarkdown] = useState(true)
  const [reflection, setReflection] = useState('')
  const [savingReflection, setSavingReflection] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // Fetch or generate review
  const fetchReview = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/weekly-review')
      const data = await res.json()

      if (res.ok) {
        setReview(data.review)
        setCanGenerate(data.canGenerate)
        setReflection(data.review?.user_reflection || '')

        // Mark as read if not already
        if (data.review && !data.review.is_read) {
          fetch(`/api/weekly-review/${data.review.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_read: true }),
          })
        }
      }
    } catch (err) {
      console.error('Failed to fetch review:', err)
      setError('Failed to load weekly review')
    } finally {
      setLoading(false)
    }
  }, [])

  const generateReview = async () => {
    try {
      setGenerating(true)
      setError(null)
      const res = await fetch('/api/weekly-review/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()

      if (res.ok) {
        setReview(data.review)
        setReflection(data.review?.user_reflection || '')
      } else {
        setError(data.message || data.error || 'Failed to generate review')
      }
    } catch (err) {
      console.error('Failed to generate review:', err)
      setError('Failed to generate weekly review')
    } finally {
      setGenerating(false)
    }
  }

  const saveReflection = async () => {
    if (!review) return

    try {
      setSavingReflection(true)
      const res = await fetch(`/api/weekly-review/${review.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_reflection: reflection }),
      })

      if (res.ok) {
        const data = await res.json()
        setReview(data.review)
      }
    } catch (err) {
      console.error('Failed to save reflection:', err)
    } finally {
      setSavingReflection(false)
    }
  }

  const handleCreateTask = (suggestion: string) => {
    // Navigate to dump page with pre-filled text
    const encodedText = encodeURIComponent(suggestion)
    router.push(`/dump?prefill=${encodedText}`)
  }

  useEffect(() => {
    fetchReview()
  }, [fetchReview])

  if (loading) {
    return (
      <div style={{ paddingTop: '24px' }}>
        <div className="skeleton" style={{ height: '32px', width: '200px', marginBottom: '24px' }} />
        <div className="skeleton" style={{ height: '120px', marginBottom: '16px' }} />
        <div className="skeleton" style={{ height: '160px', marginBottom: '16px' }} />
        <div className="skeleton" style={{ height: '160px' }} />
      </div>
    )
  }

  // No review yet - show generate prompt
  if (!review) {
    return (
      <div style={{ paddingTop: '24px', paddingBottom: '24px' }}>
        <h1 style={{
          fontSize: 'var(--text-heading)',
          fontWeight: 'var(--font-heading)',
          color: 'var(--color-text-primary)',
          marginBottom: '24px',
        }}>
          Weekly Review
        </h1>

        <div style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(99, 102, 241, 0.1))',
          borderRadius: 'var(--radius-lg)',
          padding: '32px 24px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
          <h2 style={{
            fontSize: 'var(--text-subheading)',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            marginBottom: '8px',
          }}>
            {canGenerate ? 'Ready to generate your review!' : 'Weekly Review'}
          </h2>
          <p style={{
            fontSize: 'var(--text-body)',
            color: 'var(--color-text-secondary)',
            marginBottom: '24px',
            maxWidth: '400px',
            margin: '0 auto 24px auto',
          }}>
            {canGenerate
              ? 'Get an AI-powered summary of your week, including wins, patterns, and focus suggestions.'
              : error || 'Weekly reviews are generated on Monday-Wednesday. Check back then!'}
          </p>

          {canGenerate && (
            <button
              onClick={generateReview}
              disabled={generating}
              style={{
                padding: '14px 32px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'var(--color-accent)',
                color: '#fff',
                fontSize: 'var(--text-body)',
                fontWeight: 600,
                cursor: generating ? 'wait' : 'pointer',
                opacity: generating ? 0.7 : 1,
              }}
            >
              {generating ? 'Generating...' : 'Generate My Review'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // Format date range
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  const weekRange = `${formatDate(review.week_start)} - ${formatDate(review.week_end)}`

  return (
    <div style={{ paddingTop: '20px', paddingBottom: '100px' }}>
      {/* Header with stats */}
      <WeeklyReviewHeader
        weekRange={weekRange}
        tasksCompleted={review.tasks_completed}
        completionRate={review.completion_rate}
        balanceScore={review.balance_score_avg}
        balanceTrend={review.balance_score_trend}
      />

      {/* Error banner */}
      {error && (
        <div style={{
          background: 'var(--color-danger-light)',
          color: '#991B1B',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-small)',
          marginBottom: '16px',
        }}>
          {error}
        </div>
      )}

      {/* Wins */}
      {review.wins.length > 0 && (
        <WeeklyReviewSection
          title="Wins"
          emoji="✅"
          items={review.wins}
          color="#10B981"
          bgColor="rgba(16, 185, 129, 0.1)"
        />
      )}

      {/* Gaps */}
      {review.gaps.length > 0 && (
        <WeeklyReviewSection
          title="Areas to explore"
          emoji="🔍"
          items={review.gaps}
          color="#F59E0B"
          bgColor="rgba(245, 158, 11, 0.1)"
        />
      )}

      {/* Patterns */}
      {review.patterns.length > 0 && (
        <WeeklyReviewSection
          title="Patterns noticed"
          emoji="💡"
          items={review.patterns}
          color="#3B82F6"
          bgColor="rgba(59, 130, 246, 0.1)"
        />
      )}

      {/* Suggested Focus */}
      {review.suggested_focus.length > 0 && (
        <WeeklyReviewSection
          title="Suggested focus for this week"
          emoji="🎯"
          items={review.suggested_focus}
          color="#8B5CF6"
          bgColor="rgba(139, 92, 246, 0.1)"
          onCreateTask={handleCreateTask}
        />
      )}

      {/* Full Markdown Summary */}
      <div style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: '16px',
        overflow: 'hidden',
      }}>
        <button
          onClick={() => setShowFullMarkdown(!showFullMarkdown)}
          style={{
            width: '100%',
            padding: '16px 20px',
            background: 'transparent',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
        >
          <span style={{
            fontSize: 'var(--text-body)',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
          }}>
            Full Review
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-text-tertiary)"
            strokeWidth="2"
            style={{
              transform: showFullMarkdown ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showFullMarkdown && (
          <div
            style={{
              padding: '0 20px 20px 20px',
              fontSize: 'var(--text-body)',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.7,
            }}
            dangerouslySetInnerHTML={{
              __html: simpleMarkdownToHtml(review.summary_markdown)
            }}
          />
        )}
      </div>

      {/* User Reflection */}
      <div style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        marginBottom: '24px',
      }}>
        <label style={{
          display: 'block',
          fontSize: 'var(--text-body)',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          marginBottom: '12px',
        }}>
          Your thoughts (optional)
        </label>
        <textarea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          onBlur={saveReflection}
          placeholder="What stood out to you? Anything to celebrate or adjust?"
          style={{
            width: '100%',
            minHeight: '100px',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--text-body)',
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
        {savingReflection && (
          <span style={{
            fontSize: 'var(--text-caption)',
            color: 'var(--color-text-tertiary)',
            marginTop: '8px',
            display: 'block',
          }}>
            Saving...
          </span>
        )}
      </div>

      {/* Previous Reviews Toggle */}
      <button
        onClick={() => setShowHistory(!showHistory)}
        style={{
          width: '100%',
          padding: '16px',
          background: 'var(--color-surface)',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          marginBottom: showHistory ? '16px' : 0,
        }}
      >
        <span style={{
          fontSize: 'var(--text-body)',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
        }}>
          Previous Reviews
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-text-tertiary)"
          strokeWidth="2"
          style={{
            transform: showHistory ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {showHistory && (
        <WeeklyReviewHistory
          currentWeekStart={review.week_start}
          onSelectReview={(weekStart) => {
            router.push(`/weekly-review?week=${weekStart}`)
            fetchReview()
          }}
        />
      )}
    </div>
  )
}

// Simple markdown to HTML converter
function simpleMarkdownToHtml(markdown: string): string {
  if (!markdown) return ''

  let html = markdown
    // Headers
    .replace(/^### (.*$)/gm, '<h3 style="font-size: var(--text-body); font-weight: 600; color: var(--color-text-primary); margin: 16px 0 8px 0;">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 style="font-size: var(--text-subheading); font-weight: 600; color: var(--color-text-primary); margin: 20px 0 12px 0;">$1</h2>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 600; color: var(--color-text-primary);">$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Bullet points
    .replace(/^- (.*$)/gm, '<li style="margin-left: 20px; margin-bottom: 4px;">$1</li>')
    // Line breaks
    .replace(/\n\n/g, '</p><p style="margin-bottom: 12px;">')
    .replace(/\n/g, '<br/>')

  // Wrap in paragraph
  html = `<p style="margin-bottom: 12px;">${html}</p>`

  // Clean up empty paragraphs
  html = html.replace(/<p[^>]*><\/p>/g, '')

  return html
}
