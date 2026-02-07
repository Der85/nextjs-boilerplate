'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import UnifiedHeader from '@/components/UnifiedHeader'
import FABToolbox from '@/components/FABToolbox'
import ParentSelector from '@/components/ParentSelector'
import {
  type InboxItemWithAge,
  type TriageAction,
  type InboxSummary,
  TRIAGE_ACTIONS,
  enrichInboxItem,
} from '@/lib/types/inbox'
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts'

// ============================================
// Constants
// ============================================
const UNDO_TIMEOUT_MS = 10_000

// ============================================
// Main Component
// ============================================
export default function TriagePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f9fa', color: '#8899a6' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #1D9BF0', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p>Loading triage...</p>
        </div>
      </div>
    }>
      <TriagePageContent />
    </Suspense>
  )
}

function TriagePageContent() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  // Data
  const [items, setItems] = useState<InboxItemWithAge[]>([])
  const [summary, setSummary] = useState<InboxSummary | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  // UI state
  const [showLinkSelector, setShowLinkSelector] = useState(false)
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(null)
  const [selectedCommitmentId, setSelectedCommitmentId] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<TriageAction | null>(null)

  // Schedule modal
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')

  // Delegate modal
  const [showDelegateModal, setShowDelegateModal] = useState(false)
  const [delegateAssignee, setDelegateAssignee] = useState('')

  // Undo state
  const [undoItem, setUndoItem] = useState<{ id: string; timeout: NodeJS.Timeout } | null>(null)

  // Current item
  const currentItem = items[currentIndex]

  // ============================================
  // Initialize
  // ============================================
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)
      await loadItems()
      setLoading(false)
    }
    init()
  }, [router])

  const loadItems = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const response = await fetch('/api/inbox?status=pending&limit=100', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    })

    if (response.ok) {
      const data = await response.json()
      setItems(data.items || [])
      setSummary(data.summary || null)
      setCurrentIndex(0)
    }
  }

  // ============================================
  // Triage Handlers
  // ============================================
  const handleTriage = useCallback(async (action: TriageAction, metadata?: Record<string, unknown>) => {
    if (!currentItem || processing) return

    // For schedule and delegate, show modal first
    if (action === 'schedule' && !metadata?.scheduled_date) {
      setShowScheduleModal(true)
      setPendingAction('schedule')
      return
    }

    if (action === 'delegate' && !metadata?.assignee) {
      setShowDelegateModal(true)
      setPendingAction('delegate')
      return
    }

    // For do_now, schedule, delegate - optionally show link selector
    if ((action === 'do_now' || action === 'schedule' || action === 'delegate') && !showLinkSelector && !selectedOutcomeId && !selectedCommitmentId) {
      setShowLinkSelector(true)
      setPendingAction(action)
      return
    }

    setProcessing(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/inbox/triage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          inbox_item_id: currentItem.id,
          action,
          metadata,
          outcome_id: selectedOutcomeId,
          commitment_id: selectedCommitmentId,
        }),
      })

      if (!response.ok) throw new Error('Triage failed')

      // Set up undo
      const timeout = setTimeout(() => {
        setUndoItem(null)
      }, UNDO_TIMEOUT_MS)

      setUndoItem({ id: currentItem.id, timeout })

      // Move to next item
      setItems(prev => prev.filter((_, i) => i !== currentIndex))
      if (currentIndex >= items.length - 1) {
        setCurrentIndex(Math.max(0, currentIndex - 1))
      }

      // Reset state
      setShowLinkSelector(false)
      setSelectedOutcomeId(null)
      setSelectedCommitmentId(null)
      setPendingAction(null)
      setShowScheduleModal(false)
      setShowDelegateModal(false)

    } catch (error) {
      console.error('Triage failed:', error)
    } finally {
      setProcessing(false)
    }
  }, [currentItem, processing, currentIndex, items.length, selectedOutcomeId, selectedCommitmentId, showLinkSelector])

  const handleUndo = async () => {
    if (!undoItem) return

    clearTimeout(undoItem.timeout)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const response = await fetch('/api/inbox/undo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ inbox_item_id: undoItem.id }),
    })

    if (response.ok) {
      await loadItems()
    }

    setUndoItem(null)
  }

  const handleSkip = () => {
    if (items.length > 1) {
      // Move current item to end
      const item = items[currentIndex]
      setItems(prev => [...prev.filter((_, i) => i !== currentIndex), item])
    }
  }

  const handleLinkAndContinue = () => {
    if (pendingAction) {
      handleTriage(pendingAction)
    }
  }

  const handleSkipLink = () => {
    setShowLinkSelector(false)
    if (pendingAction) {
      handleTriage(pendingAction)
    }
  }

  // ============================================
  // Keyboard Shortcuts
  // ============================================
  useGlobalShortcuts([
    { key: 'd', handler: () => handleTriage('do_now'), description: 'Do now' },
    { key: 's', handler: () => handleTriage('schedule'), description: 'Schedule' },
    { key: 'g', handler: () => handleTriage('delegate'), description: 'Delegate' },
    { key: 'p', handler: () => handleTriage('park'), description: 'Park' },
    { key: 'x', handler: () => handleTriage('drop'), description: 'Drop' },
    { key: 'z', ctrl: true, handler: handleUndo, description: 'Undo' },
    { key: 'Tab', handler: handleSkip, description: 'Skip' },
  ])

  // ============================================
  // Render
  // ============================================
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading...</p>
        <style jsx>{`
          .loading-screen { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f7f9fa; }
          .spinner { width: 32px; height: 32px; border: 3px solid #1D9BF0; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 12px; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    )
  }

  return (
    <div className="triage-page">
      <UnifiedHeader subtitle="Inbox triage" />

      <main className="main-content">
        {/* Progress Header */}
        <div className="progress-header">
          <h1 className="page-title">Triage</h1>
          {summary && summary.pending_count > 0 && (
            <div className="progress-info">
              <span className="items-left">{summary.pending_count} items left</span>
              {summary.triaged_today_count > 0 && (
                <span className="streak">🔥 {summary.triaged_today_count} triaged today</span>
              )}
            </div>
          )}
        </div>

        {/* Empty State */}
        {items.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">✨</span>
            <h2>Inbox Zero!</h2>
            <p>All caught up. Nothing to triage.</p>
            <button className="back-btn" onClick={() => router.push('/dashboard')}>
              Back to Dashboard
            </button>
          </div>
        ) : (
          <>
            {/* Current Item Card */}
            {currentItem && (
              <div className={`triage-card ${currentItem.inferred_urgency}`}>
                <div className="card-header">
                  <span className={`urgency-badge ${currentItem.inferred_urgency}`}>
                    {currentItem.inferred_urgency === 'high' ? '🔴' : currentItem.inferred_urgency === 'medium' ? '🟡' : '🟢'}
                    {currentItem.inferred_urgency}
                  </span>
                  <span className="age">{currentItem.age_display}</span>
                </div>

                <div className="card-body">
                  <p className="raw-text">{currentItem.raw_text}</p>

                  {currentItem.parsed_tokens && Object.keys(currentItem.parsed_tokens).length > 0 && (
                    <div className="tokens">
                      {currentItem.parsed_tokens.due && (
                        <span className="token">📅 {currentItem.parsed_tokens.due}</span>
                      )}
                      {currentItem.parsed_tokens.project && (
                        <span className="token">#{currentItem.parsed_tokens.project}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Link Selector */}
                {showLinkSelector && (
                  <div className="link-selector-section">
                    <p className="link-prompt">Link to an outcome or commitment (optional):</p>
                    <ParentSelector
                      selectedOutcomeId={selectedOutcomeId}
                      selectedCommitmentId={selectedCommitmentId}
                      onSelect={(outcomeId, commitmentId) => {
                        setSelectedOutcomeId(outcomeId)
                        setSelectedCommitmentId(commitmentId)
                      }}
                    />
                    <div className="link-actions">
                      <button className="skip-link-btn" onClick={handleSkipLink}>
                        Skip linking
                      </button>
                      <button
                        className="continue-btn"
                        onClick={handleLinkAndContinue}
                        disabled={processing}
                      >
                        {processing ? 'Processing...' : 'Continue'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {!showLinkSelector && (
                  <div className="actions">
                    {TRIAGE_ACTIONS.map(action => (
                      <button
                        key={action.action}
                        className={`action-btn ${action.action}`}
                        onClick={() => handleTriage(action.action)}
                        disabled={processing}
                        title={`${action.description} (${action.shortcut})`}
                      >
                        <span className="action-icon">{action.icon}</span>
                        <span className="action-label">{action.label}</span>
                        <kbd className="action-shortcut">{action.shortcut}</kbd>
                      </button>
                    ))}
                  </div>
                )}

                {/* Skip Button */}
                {!showLinkSelector && items.length > 1 && (
                  <button className="skip-btn" onClick={handleSkip}>
                    Skip for now (Tab)
                  </button>
                )}
              </div>
            )}

            {/* Undo Toast */}
            {undoItem && (
              <div className="undo-toast">
                <span>Item triaged</span>
                <button onClick={handleUndo}>Undo (Ctrl+Z)</button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Schedule for when?</h3>
            <input
              type="date"
              value={scheduleDate}
              onChange={e => setScheduleDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              autoFocus
            />
            <div className="modal-actions">
              <button onClick={() => setShowScheduleModal(false)}>Cancel</button>
              <button
                className="primary"
                onClick={() => {
                  if (scheduleDate) {
                    handleTriage('schedule', { scheduled_date: scheduleDate })
                  }
                }}
                disabled={!scheduleDate}
              >
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delegate Modal */}
      {showDelegateModal && (
        <div className="modal-overlay" onClick={() => setShowDelegateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>Delegate to whom?</h3>
            <input
              type="text"
              value={delegateAssignee}
              onChange={e => setDelegateAssignee(e.target.value)}
              placeholder="Name or email"
              autoFocus
            />
            <div className="modal-actions">
              <button onClick={() => setShowDelegateModal(false)}>Cancel</button>
              <button
                className="primary"
                onClick={() => {
                  if (delegateAssignee) {
                    handleTriage('delegate', { assignee: delegateAssignee })
                  }
                }}
                disabled={!delegateAssignee}
              >
                Delegate
              </button>
            </div>
          </div>
        </div>
      )}

      <FABToolbox mode="maintenance" />

      <style jsx>{`
        .triage-page {
          min-height: 100vh;
          background: #f7f9fa;
        }

        .main-content {
          max-width: 600px;
          margin: 0 auto;
          padding: 16px 16px 100px;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .page-title {
          font-size: 24px;
          font-weight: 700;
          color: #14171a;
          margin: 0;
        }

        .progress-info {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .items-left {
          font-size: 14px;
          color: #6b7280;
          background: #e5e7eb;
          padding: 4px 12px;
          border-radius: 100px;
        }

        .streak {
          font-size: 14px;
          color: #f59e0b;
        }

        .empty-state {
          text-align: center;
          padding: 64px 24px;
        }

        .empty-icon {
          font-size: 64px;
          display: block;
          margin-bottom: 16px;
        }

        .empty-state h2 {
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 8px;
        }

        .empty-state p {
          color: #6b7280;
          margin: 0 0 24px;
        }

        .back-btn {
          padding: 12px 24px;
          background: #1D9BF0;
          color: white;
          border: none;
          border-radius: 100px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
        }

        .triage-card {
          background: white;
          border-radius: 20px;
          padding: 20px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          border-left: 4px solid #e5e7eb;
        }

        .triage-card.high {
          border-left-color: #ef4444;
        }

        .triage-card.medium {
          border-left-color: #f59e0b;
        }

        .triage-card.low {
          border-left-color: #10b981;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .urgency-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 600;
          text-transform: capitalize;
        }

        .urgency-badge.high {
          background: #fee2e2;
          color: #b91c1c;
        }

        .urgency-badge.medium {
          background: #fef3c7;
          color: #92400e;
        }

        .urgency-badge.low {
          background: #dcfce7;
          color: #166534;
        }

        .age {
          font-size: 13px;
          color: #9ca3af;
        }

        .card-body {
          margin-bottom: 20px;
        }

        .raw-text {
          font-size: 18px;
          line-height: 1.5;
          color: #1f2937;
          margin: 0 0 12px;
        }

        .tokens {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .token {
          font-size: 12px;
          padding: 4px 10px;
          background: #f3f4f6;
          border-radius: 100px;
          color: #6b7280;
        }

        .link-selector-section {
          border-top: 1px solid #e5e7eb;
          padding-top: 16px;
          margin-top: 16px;
        }

        .link-prompt {
          font-size: 14px;
          color: #6b7280;
          margin: 0 0 12px;
        }

        .link-actions {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }

        .skip-link-btn {
          flex: 1;
          padding: 12px;
          background: #f3f4f6;
          color: #6b7280;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          cursor: pointer;
        }

        .continue-btn {
          flex: 1;
          padding: 12px;
          background: #1D9BF0;
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .continue-btn:disabled {
          opacity: 0.5;
        }

        .actions {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
        }

        .action-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 12px 8px;
          background: #f9fafb;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .action-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .action-btn.do_now:hover { border-color: #10b981; background: #dcfce7; }
        .action-btn.schedule:hover { border-color: #1D9BF0; background: #dbeafe; }
        .action-btn.delegate:hover { border-color: #8b5cf6; background: #ede9fe; }
        .action-btn.park:hover { border-color: #f59e0b; background: #fef3c7; }
        .action-btn.drop:hover { border-color: #6b7280; background: #f3f4f6; }

        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .action-icon {
          font-size: 20px;
        }

        .action-label {
          font-size: 11px;
          font-weight: 600;
          color: #374151;
        }

        .action-shortcut {
          font-size: 10px;
          padding: 2px 6px;
          background: #e5e7eb;
          border-radius: 4px;
          color: #6b7280;
          font-family: monospace;
        }

        .skip-btn {
          width: 100%;
          margin-top: 12px;
          padding: 10px;
          background: none;
          border: none;
          color: #9ca3af;
          font-size: 13px;
          cursor: pointer;
        }

        .skip-btn:hover {
          color: #6b7280;
        }

        .undo-toast {
          position: fixed;
          bottom: 100px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
          background: #1f2937;
          color: white;
          border-radius: 100px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          z-index: 100;
        }

        .undo-toast button {
          background: none;
          border: none;
          color: #60a5fa;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          padding: 16px;
        }

        .modal-content {
          background: white;
          border-radius: 16px;
          padding: 24px;
          width: 100%;
          max-width: 400px;
        }

        .modal-content h3 {
          margin: 0 0 16px;
          font-size: 18px;
        }

        .modal-content input {
          width: 100%;
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          font-size: 15px;
          margin-bottom: 16px;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
        }

        .modal-actions button {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
        }

        .modal-actions button:first-child {
          background: #f3f4f6;
          color: #6b7280;
        }

        .modal-actions button.primary {
          background: #1D9BF0;
          color: white;
        }

        .modal-actions button.primary:disabled {
          opacity: 0.5;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
