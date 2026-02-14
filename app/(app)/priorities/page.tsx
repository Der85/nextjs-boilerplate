'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DEFAULT_CATEGORIES } from '@/lib/utils/categories'
import type { PriorityDomain, PriorityInput, UserPriority } from '@/lib/types'

type WizardStep = 'intro' | 'ranking' | 'calibration' | 'notes' | 'confirmation'

interface DomainInfo {
  name: PriorityDomain
  icon: string
  color: string
}

const DOMAINS: DomainInfo[] = DEFAULT_CATEGORIES.map(c => ({
  name: c.name as PriorityDomain,
  icon: c.icon,
  color: c.color,
}))

export default function PrioritiesPage() {
  const router = useRouter()
  const [step, setStep] = useState<WizardStep>('intro')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [existingPriorities, setExistingPriorities] = useState<UserPriority[]>([])

  // Ranking state
  const [rankedDomains, setRankedDomains] = useState<DomainInfo[]>([])
  const [unrankedDomains, setUnrankedDomains] = useState<DomainInfo[]>([...DOMAINS])

  // Importance scores (indexed by domain name)
  const [importanceScores, setImportanceScores] = useState<Record<string, number>>({})

  // Aspirational notes (indexed by domain name)
  const [aspirationalNotes, setAspirationalNotes] = useState<Record<string, string>>({})

  // Load existing priorities
  useEffect(() => {
    async function loadPriorities() {
      try {
        const res = await fetch('/api/priorities')
        if (res.ok) {
          const data = await res.json()
          if (data.priorities && data.priorities.length > 0) {
            setExistingPriorities(data.priorities)

            // Pre-fill with existing data
            const ranked = data.priorities
              .sort((a: UserPriority, b: UserPriority) => a.rank - b.rank)
              .map((p: UserPriority) => {
                const domain = DOMAINS.find(d => d.name === p.domain)
                return domain || { name: p.domain as PriorityDomain, icon: '📋', color: '#6B7280' }
              })
            setRankedDomains(ranked)
            setUnrankedDomains([])

            // Pre-fill importance scores
            const scores: Record<string, number> = {}
            const notes: Record<string, string> = {}
            data.priorities.forEach((p: UserPriority) => {
              scores[p.domain] = p.importance_score
              if (p.aspirational_note) {
                notes[p.domain] = p.aspirational_note
              }
            })
            setImportanceScores(scores)
            setAspirationalNotes(notes)
          }
        }
      } catch (err) {
        console.error('Failed to load priorities:', err)
      } finally {
        setLoading(false)
      }
    }
    loadPriorities()
  }, [])

  const handleSelectDomain = (domain: DomainInfo) => {
    setRankedDomains(prev => [...prev, domain])
    setUnrankedDomains(prev => prev.filter(d => d.name !== domain.name))

    // Set default importance score based on rank
    const rank = rankedDomains.length + 1
    const defaultScore = Math.max(1, 11 - rank) // Rank 1 = 10, Rank 8 = 3
    setImportanceScores(prev => ({
      ...prev,
      [domain.name]: defaultScore,
    }))
  }

  const handleUndoRank = () => {
    if (rankedDomains.length === 0) return
    const lastRanked = rankedDomains[rankedDomains.length - 1]
    setRankedDomains(prev => prev.slice(0, -1))
    setUnrankedDomains(prev => [...prev, lastRanked])

    // Remove importance score
    setImportanceScores(prev => {
      const next = { ...prev }
      delete next[lastRanked.name]
      return next
    })
  }

  const handleImportanceChange = (domain: string, score: number) => {
    setImportanceScores(prev => ({
      ...prev,
      [domain]: score,
    }))
  }

  const handleNoteChange = (domain: string, note: string) => {
    setAspirationalNotes(prev => ({
      ...prev,
      [domain]: note,
    }))
  }

  const handleSave = async () => {
    setSaving(true)

    const priorities: PriorityInput[] = rankedDomains.map((domain, index) => ({
      domain: domain.name,
      rank: index + 1,
      importance_score: importanceScores[domain.name] || (10 - index),
      aspirational_note: aspirationalNotes[domain.name] || undefined,
    }))

    try {
      const res = await fetch('/api/priorities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priorities,
          trigger: existingPriorities.length > 0 ? 'manual' : 'onboarding',
        }),
      })

      if (res.ok) {
        // Show success and redirect
        router.push('/tasks')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to save priorities.')
      }
    } catch (err) {
      console.error('Failed to save priorities:', err)
      alert('Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const goToStep = (newStep: WizardStep) => {
    setStep(newStep)
  }

  const getStepNumber = () => {
    const steps: WizardStep[] = ['intro', 'ranking', 'calibration', 'notes', 'confirmation']
    return steps.indexOf(step) + 1
  }

  if (loading) {
    return (
      <div style={{ paddingTop: '24px' }}>
        <div className="skeleton" style={{ height: '28px', width: '200px', marginBottom: '24px' }} />
        <div className="skeleton" style={{ height: '100px', marginBottom: '16px' }} />
        <div className="skeleton" style={{ height: '100px', marginBottom: '16px' }} />
      </div>
    )
  }

  return (
    <div style={{ paddingTop: '20px', paddingBottom: '100px', minHeight: '100vh' }}>
      {/* Progress indicator */}
      {step !== 'intro' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '24px',
        }}>
          {[1, 2, 3, 4, 5].map(num => (
            <div
              key={num}
              style={{
                width: num === getStepNumber() ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: num <= getStepNumber() ? 'var(--color-accent)' : 'var(--color-border)',
                transition: 'all 0.2s',
              }}
            />
          ))}
          <span style={{
            marginLeft: '8px',
            fontSize: 'var(--text-caption)',
            color: 'var(--color-text-tertiary)',
          }}>
            Step {getStepNumber()} of 5
          </span>
        </div>
      )}

      {/* Step Content */}
      {step === 'intro' && (
        <IntroStep
          isReview={existingPriorities.length > 0}
          onStart={() => goToStep('ranking')}
        />
      )}

      {step === 'ranking' && (
        <RankingStep
          rankedDomains={rankedDomains}
          unrankedDomains={unrankedDomains}
          onSelect={handleSelectDomain}
          onUndo={handleUndoRank}
          onNext={() => goToStep('calibration')}
          onBack={() => goToStep('intro')}
        />
      )}

      {step === 'calibration' && (
        <CalibrationStep
          rankedDomains={rankedDomains}
          importanceScores={importanceScores}
          onScoreChange={handleImportanceChange}
          onNext={() => goToStep('notes')}
          onBack={() => goToStep('ranking')}
          onSkip={() => goToStep('notes')}
        />
      )}

      {step === 'notes' && (
        <NotesStep
          topDomains={rankedDomains.slice(0, 3)}
          aspirationalNotes={aspirationalNotes}
          onNoteChange={handleNoteChange}
          onNext={() => goToStep('confirmation')}
          onBack={() => goToStep('calibration')}
          onSkip={() => goToStep('confirmation')}
        />
      )}

      {step === 'confirmation' && (
        <ConfirmationStep
          rankedDomains={rankedDomains}
          importanceScores={importanceScores}
          aspirationalNotes={aspirationalNotes}
          saving={saving}
          onSave={handleSave}
          onBack={() => goToStep('ranking')}
        />
      )}
    </div>
  )
}

// ============================
// Step Components
// ============================

interface IntroStepProps {
  isReview: boolean
  onStart: () => void
}

function IntroStep({ isReview, onStart }: IntroStepProps) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <div style={{
        fontSize: '48px',
        marginBottom: '24px',
      }}>
        🎯
      </div>
      <h1 style={{
        fontSize: 'var(--text-heading)',
        fontWeight: 'var(--font-heading)',
        color: 'var(--color-text-primary)',
        marginBottom: '12px',
      }}>
        {isReview ? 'Review Your Priorities' : 'What matters most to you?'}
      </h1>
      <p style={{
        fontSize: 'var(--text-body)',
        color: 'var(--color-text-secondary)',
        maxWidth: '320px',
        margin: '0 auto 32px',
        lineHeight: 1.5,
      }}>
        {isReview
          ? "Life changes. Let's make sure your priorities still reflect what matters most."
          : "Understanding your priorities helps us suggest the right tasks and spot when life gets out of balance. This takes about 2 minutes."}
      </p>

      {/* Domain preview */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '8px',
        marginBottom: '32px',
      }}>
        {DOMAINS.map(domain => (
          <span
            key={domain.name}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              background: `${domain.color}15`,
              color: domain.color,
              fontSize: 'var(--text-small)',
            }}
          >
            <span>{domain.icon}</span>
            <span>{domain.name}</span>
          </span>
        ))}
      </div>

      <button
        onClick={onStart}
        style={{
          padding: '14px 32px',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-accent)',
          color: '#fff',
          fontSize: 'var(--text-body)',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {isReview ? "Let's review" : "Let's start"}
      </button>
    </div>
  )
}

interface RankingStepProps {
  rankedDomains: DomainInfo[]
  unrankedDomains: DomainInfo[]
  onSelect: (domain: DomainInfo) => void
  onUndo: () => void
  onNext: () => void
  onBack: () => void
}

function RankingStep({
  rankedDomains,
  unrankedDomains,
  onSelect,
  onUndo,
  onNext,
  onBack,
}: RankingStepProps) {
  const currentRank = rankedDomains.length + 1
  const isComplete = unrankedDomains.length === 0

  return (
    <div>
      <h2 style={{
        fontSize: 'var(--text-subheading)',
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        textAlign: 'center',
        marginBottom: '8px',
      }}>
        {isComplete
          ? 'All ranked!'
          : `What's your #${currentRank} priority?`}
      </h2>
      <p style={{
        fontSize: 'var(--text-small)',
        color: 'var(--color-text-tertiary)',
        textAlign: 'center',
        marginBottom: '24px',
      }}>
        {isComplete
          ? 'Great job! Review your ranking below or continue.'
          : 'Tap the area of life that matters most right now.'}
      </p>

      {/* Ranked domains */}
      {rankedDomains.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}>
            <span style={{
              fontSize: 'var(--text-caption)',
              color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Your ranking
            </span>
            {rankedDomains.length > 0 && (
              <button
                onClick={onUndo}
                style={{
                  fontSize: 'var(--text-caption)',
                  color: 'var(--color-text-tertiary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 10h10a5 5 0 0 1 5 5v2" />
                  <path d="M3 10l4-4" />
                  <path d="M3 10l4 4" />
                </svg>
                Undo
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rankedDomains.map((domain, index) => (
              <div
                key={domain.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <span style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--radius-full)',
                  background: domain.color,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--text-caption)',
                  fontWeight: 700,
                }}>
                  {index + 1}
                </span>
                <span style={{ fontSize: '20px' }}>{domain.icon}</span>
                <span style={{
                  fontSize: 'var(--text-body)',
                  color: 'var(--color-text-primary)',
                }}>
                  {domain.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unranked domains */}
      {unrankedDomains.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          {rankedDomains.length > 0 && (
            <span style={{
              display: 'block',
              fontSize: 'var(--text-caption)',
              color: 'var(--color-text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '12px',
            }}>
              Remaining ({unrankedDomains.length})
            </span>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {unrankedDomains.map(domain => (
              <button
                key={domain.name}
                onClick={() => onSelect(domain)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-bg)',
                  border: '2px solid var(--color-border)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 0.15s, transform 0.1s',
                }}
              >
                <span style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-md)',
                  background: `${domain.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                }}>
                  {domain.icon}
                </span>
                <span style={{
                  fontSize: 'var(--text-body)',
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                }}>
                  {domain.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginTop: '24px',
      }}>
        <button
          onClick={onBack}
          style={{
            flex: 1,
            padding: '12px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--text-body)',
            cursor: 'pointer',
          }}
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!isComplete}
          style={{
            flex: 1,
            padding: '12px',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            background: isComplete ? 'var(--color-accent)' : 'var(--color-border)',
            color: isComplete ? '#fff' : 'var(--color-text-tertiary)',
            fontSize: 'var(--text-body)',
            fontWeight: 600,
            cursor: isComplete ? 'pointer' : 'not-allowed',
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

interface CalibrationStepProps {
  rankedDomains: DomainInfo[]
  importanceScores: Record<string, number>
  onScoreChange: (domain: string, score: number) => void
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

function CalibrationStep({
  rankedDomains,
  importanceScores,
  onScoreChange,
  onNext,
  onBack,
  onSkip,
}: CalibrationStepProps) {
  return (
    <div>
      <h2 style={{
        fontSize: 'var(--text-subheading)',
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        textAlign: 'center',
        marginBottom: '8px',
      }}>
        Fine-tune the intensity
      </h2>
      <p style={{
        fontSize: 'var(--text-small)',
        color: 'var(--color-text-tertiary)',
        textAlign: 'center',
        marginBottom: '24px',
        maxWidth: '300px',
        margin: '0 auto 24px',
      }}>
        Your ranking shows order. The slider shows intensity. Maybe Work is #1 but Health is almost as important.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {rankedDomains.map((domain, index) => {
          const score = importanceScores[domain.name] || (10 - index)
          return (
            <div
              key={domain.name}
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '12px',
              }}>
                <span style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: 'var(--radius-full)',
                  background: domain.color,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--text-caption)',
                  fontWeight: 700,
                }}>
                  {index + 1}
                </span>
                <span style={{ fontSize: '18px' }}>{domain.icon}</span>
                <span style={{
                  fontSize: 'var(--text-body)',
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                }}>
                  {domain.name}
                </span>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: 'var(--text-body)',
                  fontWeight: 600,
                  color: domain.color,
                }}>
                  {score}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={score}
                onChange={(e) => onScoreChange(domain.name, parseInt(e.target.value))}
                style={{
                  width: '100%',
                  accentColor: domain.color,
                }}
              />
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 'var(--text-caption)',
                color: 'var(--color-text-tertiary)',
                marginTop: '4px',
              }}>
                <span>Low</span>
                <span>High</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Navigation */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginTop: '24px',
      }}>
        <button
          onClick={onBack}
          style={{
            flex: 1,
            padding: '12px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--text-body)',
            cursor: 'pointer',
          }}
        >
          Back
        </button>
        <button
          onClick={onSkip}
          style={{
            padding: '12px 16px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg)',
            color: 'var(--color-text-tertiary)',
            fontSize: 'var(--text-body)',
            cursor: 'pointer',
          }}
        >
          Skip
        </button>
        <button
          onClick={onNext}
          style={{
            flex: 1,
            padding: '12px',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-accent)',
            color: '#fff',
            fontSize: 'var(--text-body)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

interface NotesStepProps {
  topDomains: DomainInfo[]
  aspirationalNotes: Record<string, string>
  onNoteChange: (domain: string, note: string) => void
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

function NotesStep({
  topDomains,
  aspirationalNotes,
  onNoteChange,
  onNext,
  onBack,
  onSkip,
}: NotesStepProps) {
  const placeholders: Record<string, string> = {
    Work: 'Get promoted by Q3',
    Health: 'Exercise 3x/week',
    Home: 'Keep the house organized',
    Finance: 'Save $500/month',
    Social: 'See friends weekly',
    'Personal Growth': 'Read 2 books/month',
    Admin: 'Stay on top of paperwork',
    Family: 'Have dinner together every night',
  }

  return (
    <div>
      <h2 style={{
        fontSize: 'var(--text-subheading)',
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        textAlign: 'center',
        marginBottom: '8px',
      }}>
        What does success look like?
      </h2>
      <p style={{
        fontSize: 'var(--text-small)',
        color: 'var(--color-text-tertiary)',
        textAlign: 'center',
        marginBottom: '24px',
        maxWidth: '300px',
        margin: '0 auto 24px',
      }}>
        For your top 3 priorities, describe what you're working towards in one sentence.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {topDomains.map((domain, index) => (
          <div
            key={domain.name}
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '12px',
            }}>
              <span style={{
                width: '24px',
                height: '24px',
                borderRadius: 'var(--radius-full)',
                background: domain.color,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--text-caption)',
                fontWeight: 700,
              }}>
                {index + 1}
              </span>
              <span style={{ fontSize: '18px' }}>{domain.icon}</span>
              <span style={{
                fontSize: 'var(--text-body)',
                fontWeight: 500,
                color: 'var(--color-text-primary)',
              }}>
                {domain.name}
              </span>
            </div>
            <input
              type="text"
              value={aspirationalNotes[domain.name] || ''}
              onChange={(e) => onNoteChange(domain.name, e.target.value)}
              placeholder={placeholders[domain.name] || 'What does success look like?'}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-body)',
                color: 'var(--color-text-primary)',
                background: 'var(--color-bg)',
              }}
            />
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginTop: '24px',
      }}>
        <button
          onClick={onBack}
          style={{
            flex: 1,
            padding: '12px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--text-body)',
            cursor: 'pointer',
          }}
        >
          Back
        </button>
        <button
          onClick={onSkip}
          style={{
            padding: '12px 16px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg)',
            color: 'var(--color-text-tertiary)',
            fontSize: 'var(--text-body)',
            cursor: 'pointer',
          }}
        >
          Skip
        </button>
        <button
          onClick={onNext}
          style={{
            flex: 1,
            padding: '12px',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-accent)',
            color: '#fff',
            fontSize: 'var(--text-body)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

interface ConfirmationStepProps {
  rankedDomains: DomainInfo[]
  importanceScores: Record<string, number>
  aspirationalNotes: Record<string, string>
  saving: boolean
  onSave: () => void
  onBack: () => void
}

function ConfirmationStep({
  rankedDomains,
  importanceScores,
  aspirationalNotes,
  saving,
  onSave,
  onBack,
}: ConfirmationStepProps) {
  return (
    <div>
      <div style={{
        textAlign: 'center',
        marginBottom: '24px',
      }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>✨</div>
        <h2 style={{
          fontSize: 'var(--text-subheading)',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          marginBottom: '8px',
        }}>
          Looking good!
        </h2>
        <p style={{
          fontSize: 'var(--text-small)',
          color: 'var(--color-text-tertiary)',
        }}>
          Here's your priority ranking. We'll use this to help you stay balanced.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
        {rankedDomains.map((domain, index) => {
          const score = importanceScores[domain.name] || (10 - index)
          const note = aspirationalNotes[domain.name]
          return (
            <div
              key={domain.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <span style={{
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-full)',
                background: domain.color,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--text-caption)',
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {index + 1}
              </span>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>{domain.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span style={{
                    fontSize: 'var(--text-body)',
                    fontWeight: 500,
                    color: 'var(--color-text-primary)',
                  }}>
                    {domain.name}
                  </span>
                  <span style={{
                    fontSize: 'var(--text-caption)',
                    color: domain.color,
                    fontWeight: 600,
                  }}>
                    {score}/10
                  </span>
                </div>
                {note && (
                  <p style={{
                    fontSize: 'var(--text-small)',
                    color: 'var(--color-text-tertiary)',
                    margin: '4px 0 0',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {note}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Navigation */}
      <div style={{
        display: 'flex',
        gap: '12px',
      }}>
        <button
          onClick={onBack}
          disabled={saving}
          style={{
            flex: 1,
            padding: '12px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--text-body)',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.5 : 1,
          }}
        >
          Let me adjust
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            flex: 1,
            padding: '12px',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-accent)',
            color: '#fff',
            fontSize: 'var(--text-body)',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Looks good!'}
        </button>
      </div>
    </div>
  )
}
