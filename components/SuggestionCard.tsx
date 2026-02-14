'use client'

import { useState } from 'react'
import type { TaskSuggestionWithCategory, SnoozeOption } from '@/lib/types'

interface SuggestionCardProps {
  suggestion: TaskSuggestionWithCategory
  onAccept: (suggestion: TaskSuggestionWithCategory) => void
  onDismiss: (suggestion: TaskSuggestionWithCategory) => void
  onSnooze: (suggestion: TaskSuggestionWithCategory, until: SnoozeOption) => void
  isLoading?: boolean
}

export default function SuggestionCard({
  suggestion,
  onAccept,
  onDismiss,
  onSnooze,
  isLoading = false,
}: SuggestionCardProps) {
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Use category color or default accent
  const accentColor = suggestion.category?.color || 'var(--color-accent)'

  const getEnergyLabel = (energy: string) => {
    switch (energy) {
      case 'low': return '🔋 Low energy'
      case 'medium': return '⚡ Medium energy'
      case 'high': return '🔥 High energy'
      default: return '⚡ Medium energy'
    }
  }

  const getEnergyColor = (energy: string) => {
    switch (energy) {
      case 'low': return 'var(--color-success)'
      case 'medium': return 'var(--color-warning)'
      case 'high': return 'var(--color-danger)'
      default: return 'var(--color-warning)'
    }
  }

  const getSuggestionTypeLabel = (type: string) => {
    switch (type) {
      case 'gap_fill': return 'Fill the gap'
      case 'priority_boost': return 'Priority boost'
      case 'routine_suggestion': return 'Routine'
      case 'template_based': return 'From template'
      case 'seasonal': return 'Seasonal'
      default: return 'Suggestion'
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    setTimeout(() => onDismiss(suggestion), 300)
  }

  const handleSnooze = (until: SnoozeOption) => {
    setShowSnoozeOptions(false)
    setDismissed(true)
    setTimeout(() => onSnooze(suggestion, until), 300)
  }

  // Animation for dismiss/accept
  if (dismissed) {
    return (
      <div style={{
        opacity: 0,
        transform: 'translateY(-12px) scale(0.96)',
        height: 0,
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        transition: 'opacity 0.3s ease, transform 0.3s ease, height 0.3s ease',
      }} />
    )
  }

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      opacity: isLoading ? 0.6 : 1,
      pointerEvents: isLoading ? 'none' : 'auto',
      transition: 'opacity 0.2s ease',
    }}>
      {/* Color accent strip on left */}
      <div style={{
        display: 'flex',
      }}>
        <div style={{
          width: '4px',
          background: accentColor,
          flexShrink: 0,
        }} />

        <div style={{
          flex: 1,
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          {/* Header: Category icon + Type badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            {/* Category icon */}
            {suggestion.category && (
              <span style={{
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-sm)',
                background: `${suggestion.category.color}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
              }}>
                {suggestion.category.icon}
              </span>
            )}

            {/* Type badge */}
            <span style={{
              fontSize: 'var(--text-caption)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: accentColor,
              background: `${accentColor}15`,
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
            }}>
              {getSuggestionTypeLabel(suggestion.suggestion_type)}
            </span>

            {/* Priority domain */}
            <span style={{
              fontSize: 'var(--text-caption)',
              color: 'var(--color-text-tertiary)',
              marginLeft: 'auto',
            }}>
              {suggestion.priority_domain}
            </span>
          </div>

          {/* Task name */}
          <h3 style={{
            fontSize: 'var(--text-body)',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            margin: 0,
            lineHeight: 1.4,
          }}>
            {suggestion.suggested_task_name}
          </h3>

          {/* Reasoning */}
          <p style={{
            fontSize: 'var(--text-small)',
            color: 'var(--color-text-secondary)',
            margin: 0,
            lineHeight: 1.5,
          }}>
            {suggestion.reasoning}
          </p>

          {/* Meta pills: time estimate, energy, steps */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px',
          }}>
            {/* Time estimate */}
            {suggestion.suggested_estimated_minutes && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-secondary)',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                ~{suggestion.suggested_estimated_minutes} min
              </span>
            )}

            {/* Energy level */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              background: `${getEnergyColor(suggestion.suggested_energy)}15`,
              fontSize: 'var(--text-caption)',
              color: getEnergyColor(suggestion.suggested_energy),
            }}>
              {getEnergyLabel(suggestion.suggested_energy)}
            </span>

            {/* Step count */}
            {suggestion.suggested_steps && suggestion.suggested_steps.length > 0 && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-secondary)',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                {suggestion.suggested_steps.length} step{suggestion.suggested_steps.length > 1 ? 's' : ''}
              </span>
            )}

            {/* Source template */}
            {suggestion.source_template && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-tertiary)',
              }}>
                📋 {suggestion.source_template.name}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '4px',
            position: 'relative',
          }}>
            {/* Add Task - Primary */}
            <button
              onClick={() => {
                setDismissed(true)
                setTimeout(() => onAccept(suggestion), 300)
              }}
              disabled={isLoading}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'var(--color-accent)',
                color: '#fff',
                fontSize: 'var(--text-small)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'transform 0.1s ease, box-shadow 0.1s ease',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Task
            </button>

            {/* Snooze - Secondary */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowSnoozeOptions(!showSnoozeOptions)}
                disabled={isLoading}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--text-small)',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18.5 9.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
                  <path d="M14 15l4 4" />
                  <path d="M2 18a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3" />
                  <path d="M4.5 8.5L6.5 6.5" />
                  <path d="M19.5 8.5L17.5 6.5" />
                </svg>
                Snooze
              </button>

              {/* Snooze dropdown */}
              {showSnoozeOptions && (
                <div style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  marginBottom: '4px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  overflow: 'hidden',
                  zIndex: 10,
                  minWidth: '140px',
                }}>
                  {[
                    { value: 'tomorrow' as SnoozeOption, label: 'Tomorrow' },
                    { value: 'next_week' as SnoozeOption, label: 'Next week' },
                    { value: 'next_month' as SnoozeOption, label: 'Next month' },
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => handleSnooze(option.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--color-text-primary)',
                        fontSize: 'var(--text-small)',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dismiss - Tertiary */}
            <button
              onClick={handleDismiss}
              disabled={isLoading}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'transparent',
                color: 'var(--color-text-tertiary)',
                fontSize: 'var(--text-small)',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
