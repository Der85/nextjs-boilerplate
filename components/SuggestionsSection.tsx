'use client'

import SuggestionCard from '@/components/SuggestionCard'
import type { TaskSuggestionWithCategory, SnoozeOption } from '@/lib/types'

interface SuggestionsSectionProps {
  suggestions: TaskSuggestionWithCategory[]
  suggestionsLoading: boolean
  onGenerate: () => void
  onAccept: (suggestion: TaskSuggestionWithCategory) => void
  onDismiss: (suggestion: TaskSuggestionWithCategory) => void
  onSnooze: (suggestion: TaskSuggestionWithCategory, until: SnoozeOption) => void
}

export default function SuggestionsSection({
  suggestions,
  suggestionsLoading,
  onGenerate,
  onAccept,
  onDismiss,
  onSnooze,
}: SuggestionsSectionProps) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
      }}>
        <h2 style={{
          fontSize: 'var(--text-subheading)',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>✨</span>
          Suggestions for You
        </h2>
        <button
          onClick={onGenerate}
          disabled={suggestionsLoading}
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--text-small)',
            cursor: suggestionsLoading ? 'wait' : 'pointer',
            opacity: suggestionsLoading ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {suggestionsLoading ? (
            <>
              <span style={{
                width: '12px',
                height: '12px',
                border: '2px solid var(--color-border)',
                borderTopColor: 'var(--color-accent)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              Generating...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
              Get New Ideas
            </>
          )}
        </button>
      </div>

      {suggestions.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {suggestions.slice(0, 3).map(suggestion => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onAccept={onAccept}
              onDismiss={onDismiss}
              onSnooze={onSnooze}
              isLoading={suggestionsLoading}
            />
          ))}
        </div>
      ) : (
        <div style={{
          padding: '24px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
        }}>
          <p style={{
            fontSize: 'var(--text-body)',
            color: 'var(--color-text-secondary)',
            margin: '0 0 12px 0',
          }}>
            No suggestions right now.
          </p>
          <p style={{
            fontSize: 'var(--text-small)',
            color: 'var(--color-text-tertiary)',
            margin: 0,
          }}>
            Click &quot;Get New Ideas&quot; to generate task suggestions based on your priorities.
          </p>
        </div>
      )}
    </div>
  )
}
