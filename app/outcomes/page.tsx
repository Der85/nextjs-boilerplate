'use client'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import UnifiedHeader from '@/components/UnifiedHeader'
import OutcomeChip from '@/components/OutcomeChip'
import NeedsLinkingView from '@/components/NeedsLinkingView'
import RelinkModal from '@/components/RelinkModal'
import type {
  Outcome,
  Commitment,
  OutcomeHorizon,
  OutcomeStatus,
  LinkedFocusPlan,
  HORIZON_COLORS,
} from '@/lib/types/outcomes'

// ============================================
// Types
// ============================================
type View = 'list' | 'create' | 'detail' | 'needs_linking'
type CreateStep = 'form' | 'commitments'

interface CommitmentWithTasks extends Commitment {
  tasks_count?: number
}

// ============================================
// Constants
// ============================================
const HORIZON_OPTIONS: { value: OutcomeHorizon; label: string; color: string }[] = [
  { value: 'weekly', label: 'Weekly', color: '#10b981' },
  { value: 'monthly', label: 'Monthly', color: '#1D9BF0' },
  { value: 'quarterly', label: 'Quarterly', color: '#8b5cf6' },
]

const STATUS_OPTIONS: { value: OutcomeStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
]

// ============================================
// Main Component
// ============================================
export default function OutcomesPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f9fa', color: '#8899a6' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid #1D9BF0', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p>Loading outcomes...</p>
        </div>
      </div>
    }>
      <OutcomesPageContent />
    </Suspense>
  )
}

function OutcomesPageContent() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // View state
  const [view, setView] = useState<View>('list')
  const [createStep, setCreateStep] = useState<CreateStep>('form')
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome | null>(null)

  // Data
  const [outcomes, setOutcomes] = useState<Outcome[]>([])
  const [detailCommitments, setDetailCommitments] = useState<CommitmentWithTasks[]>([])
  const [detailTasks, setDetailTasks] = useState<LinkedFocusPlan[]>([])
  const [needsLinkingCount, setNeedsLinkingCount] = useState(0)

  // Create form
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [horizon, setHorizon] = useState<OutcomeHorizon>('monthly')

  // Commitment form
  const [commitmentTitle, setCommitmentTitle] = useState('')
  const [newCommitments, setNewCommitments] = useState<string[]>([])

  // Relink modal
  const [relinkModalOpen, setRelinkModalOpen] = useState(false)
  const [relinkTasks, setRelinkTasks] = useState<{ id: string; task_name: string }[]>([])

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
      await loadOutcomes(session.user.id)
      await loadNeedsLinkingCount(session.user.id)
      setLoading(false)
    }
    init()
  }, [router])

  const loadOutcomes = async (userId: string) => {
    const { data } = await supabase
      .from('outcomes')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'paused'])
      .order('priority_rank', { ascending: true })

    setOutcomes(data || [])
  }

  const loadNeedsLinkingCount = async (userId: string) => {
    const { count } = await supabase
      .from('focus_plans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'needs_linking')

    setNeedsLinkingCount(count || 0)
  }

  const loadOutcomeDetail = async (outcomeId: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const response = await fetch(`/api/outcomes/${outcomeId}`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    })

    if (response.ok) {
      const data = await response.json()
      setSelectedOutcome(data.outcome)
      setDetailCommitments(data.commitments || [])
      setDetailTasks(data.tasks || [])
    }
  }

  // ============================================
  // Handlers
  // ============================================
  const handleCreateOutcome = async () => {
    if (!title.trim() || !user) return

    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch('/api/outcomes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          horizon,
        }),
      })

      if (!response.ok) throw new Error('Failed to create outcome')

      const { outcome } = await response.json()

      // Create commitments if any
      for (const commitmentTitle of newCommitments) {
        await fetch('/api/commitments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            outcome_id: outcome.id,
            title: commitmentTitle,
          }),
        })
      }

      // Reset form and go back to list
      setTitle('')
      setDescription('')
      setHorizon('monthly')
      setNewCommitments([])
      setCreateStep('form')
      setView('list')
      await loadOutcomes(user.id)
    } catch (error) {
      console.error('Failed to create outcome:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteOutcome = async (outcomeId: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const response = await fetch(`/api/outcomes/${outcomeId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    })

    if (response.status === 409) {
      // Has active tasks - show relink modal
      const data = await response.json()
      setRelinkTasks(data.activeTasks || [])
      setRelinkModalOpen(true)
      return
    }

    if (response.ok) {
      setView('list')
      setSelectedOutcome(null)
      await loadOutcomes(user.id)
    }
  }

  const handleAddCommitment = () => {
    if (!commitmentTitle.trim()) return
    setNewCommitments([...newCommitments, commitmentTitle.trim()])
    setCommitmentTitle('')
  }

  const handleRemoveCommitment = (index: number) => {
    setNewCommitments(newCommitments.filter((_, i) => i !== index))
  }

  const handleRelinked = async () => {
    setRelinkModalOpen(false)
    setRelinkTasks([])
    if (selectedOutcome && user) {
      await loadOutcomeDetail(selectedOutcome.id)
    }
  }

  // ============================================
  // Render
  // ============================================
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading...</p>
        <style jsx>{`
          .loading-screen {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #f7f9fa;
            color: #8899a6;
          }
          .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid #1D9BF0;
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 12px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="outcomes-page">
      <UnifiedHeader subtitle="Outcomes" />

      <main className="main-content">
        {/* List View */}
        {view === 'list' && (
          <div className="list-view">
            <div className="page-header">
              <h1 className="page-title">Outcomes</h1>
              <button
                className="create-btn"
                onClick={() => setView('create')}
              >
                + New Outcome
              </button>
            </div>

            {/* Needs Linking Alert */}
            {needsLinkingCount > 0 && (
              <button
                className="needs-linking-alert"
                onClick={() => setView('needs_linking')}
              >
                <span className="alert-icon">⚠️</span>
                <span className="alert-text">
                  {needsLinkingCount} task{needsLinkingCount !== 1 ? 's' : ''} need linking
                </span>
                <span className="alert-arrow">→</span>
              </button>
            )}

            {/* Outcomes by Horizon */}
            {HORIZON_OPTIONS.map(({ value: h, label, color }) => {
              const horizonOutcomes = outcomes.filter(o => o.horizon === h)
              if (horizonOutcomes.length === 0) return null

              return (
                <div key={h} className="horizon-section">
                  <div className="horizon-header">
                    <span className="horizon-badge" style={{ backgroundColor: color }}>
                      {label}
                    </span>
                    <span className="horizon-count">{horizonOutcomes.length}</span>
                  </div>

                  <div className="outcomes-list">
                    {horizonOutcomes.map(outcome => (
                      <button
                        key={outcome.id}
                        className="outcome-card"
                        onClick={() => {
                          loadOutcomeDetail(outcome.id)
                          setView('detail')
                        }}
                      >
                        <span className="outcome-icon">🎯</span>
                        <div className="outcome-info">
                          <h3 className="outcome-title">{outcome.title}</h3>
                          {outcome.description && (
                            <p className="outcome-desc">{outcome.description}</p>
                          )}
                        </div>
                        <span className="outcome-arrow">›</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}

            {outcomes.length === 0 && (
              <div className="empty-state">
                <span className="empty-icon">🎯</span>
                <h2>No outcomes yet</h2>
                <p>Create your first outcome to start linking your tasks to meaningful goals.</p>
                <button className="create-btn" onClick={() => setView('create')}>
                  Create Outcome
                </button>
              </div>
            )}
          </div>
        )}

        {/* Create View */}
        {view === 'create' && (
          <div className="create-view">
            <button className="back-btn" onClick={() => {
              setView('list')
              setCreateStep('form')
              setTitle('')
              setDescription('')
              setNewCommitments([])
            }}>
              ← Back
            </button>

            <h1 className="page-title">
              {createStep === 'form' ? 'New Outcome' : 'Add Commitments'}
            </h1>

            {createStep === 'form' && (
              <div className="form-section">
                <div className="field">
                  <label>What outcome are you working toward?</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Launch MVP by end of quarter"
                    className="text-input"
                    autoFocus
                  />
                </div>

                <div className="field">
                  <label>Description (optional)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add context or details..."
                    className="textarea"
                    rows={3}
                  />
                </div>

                <div className="field">
                  <label>Time Horizon</label>
                  <div className="horizon-buttons">
                    {HORIZON_OPTIONS.map(({ value, label, color }) => (
                      <button
                        key={value}
                        type="button"
                        className={`horizon-btn ${horizon === value ? 'selected' : ''}`}
                        onClick={() => setHorizon(value)}
                        style={{
                          borderColor: horizon === value ? color : undefined,
                          backgroundColor: horizon === value ? `${color}15` : undefined,
                          color: horizon === value ? color : undefined,
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  className="continue-btn"
                  onClick={() => setCreateStep('commitments')}
                  disabled={!title.trim()}
                >
                  Continue
                </button>
              </div>
            )}

            {createStep === 'commitments' && (
              <div className="form-section">
                <p className="section-desc">
                  Break down "{title}" into commitments (optional). You can add more later.
                </p>

                <div className="commitments-list">
                  {newCommitments.map((c, i) => (
                    <div key={i} className="commitment-item">
                      <span>{c}</span>
                      <button
                        className="remove-btn"
                        onClick={() => handleRemoveCommitment(i)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div className="add-commitment-row">
                  <input
                    type="text"
                    value={commitmentTitle}
                    onChange={(e) => setCommitmentTitle(e.target.value)}
                    placeholder="e.g., Complete user research"
                    className="text-input"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCommitment()}
                  />
                  <button
                    className="add-btn"
                    onClick={handleAddCommitment}
                    disabled={!commitmentTitle.trim()}
                  >
                    Add
                  </button>
                </div>

                <div className="form-actions">
                  <button
                    className="back-step-btn"
                    onClick={() => setCreateStep('form')}
                  >
                    Back
                  </button>
                  <button
                    className="create-outcome-btn"
                    onClick={handleCreateOutcome}
                    disabled={saving}
                  >
                    {saving ? 'Creating...' : 'Create Outcome'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Detail View */}
        {view === 'detail' && selectedOutcome && (
          <div className="detail-view">
            <button className="back-btn" onClick={() => {
              setView('list')
              setSelectedOutcome(null)
            }}>
              ← Back
            </button>

            <div className="detail-header">
              <OutcomeChip
                title={selectedOutcome.horizon}
                horizon={selectedOutcome.horizon}
                size="medium"
              />
              <h1 className="detail-title">{selectedOutcome.title}</h1>
              {selectedOutcome.description && (
                <p className="detail-desc">{selectedOutcome.description}</p>
              )}
            </div>

            <div className="detail-section">
              <h2 className="section-title">Commitments ({detailCommitments.length})</h2>
              {detailCommitments.length === 0 ? (
                <p className="empty-text">No commitments yet</p>
              ) : (
                <div className="commitments-grid">
                  {detailCommitments.map(c => (
                    <div key={c.id} className="commitment-card">
                      <h3>{c.title}</h3>
                      <span className="status-badge">{c.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="detail-section">
              <h2 className="section-title">Tasks ({detailTasks.length})</h2>
              {detailTasks.length === 0 ? (
                <p className="empty-text">No tasks linked to this outcome</p>
              ) : (
                <div className="tasks-list">
                  {detailTasks.map(t => (
                    <div key={t.id} className="task-item">
                      <span className="task-name">{t.task_name}</span>
                      <span className={`task-status ${t.status}`}>{t.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="detail-actions">
              <button
                className="delete-btn"
                onClick={() => handleDeleteOutcome(selectedOutcome.id)}
              >
                Delete Outcome
              </button>
            </div>
          </div>
        )}

        {/* Needs Linking View */}
        {view === 'needs_linking' && (
          <div className="needs-linking-view-wrapper">
            <button className="back-btn" onClick={() => setView('list')}>
              ← Back
            </button>
            <NeedsLinkingView
              onTaskLinked={() => {
                if (user) loadNeedsLinkingCount(user.id)
              }}
            />
          </div>
        )}
      </main>

      {/* Relink Modal */}
      <RelinkModal
        isOpen={relinkModalOpen}
        activeTasks={relinkTasks}
        sourceType="outcome"
        sourceName={selectedOutcome?.title || ''}
        onClose={() => setRelinkModalOpen(false)}
        onRelinked={handleRelinked}
      />

      <style jsx>{`
        .outcomes-page {
          min-height: 100vh;
          background: #f7f9fa;
        }

        .main-content {
          max-width: 600px;
          margin: 0 auto;
          padding: 16px 16px 100px;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .page-title {
          font-size: 24px;
          font-weight: 700;
          color: #14171a;
          margin: 0;
        }

        .create-btn {
          padding: 10px 16px;
          background: #1D9BF0;
          color: white;
          border: none;
          border-radius: 100px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .create-btn:hover {
          background: #1a8cd8;
        }

        .needs-linking-alert {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: #fef3c7;
          border: 1px solid #fcd34d;
          border-radius: 12px;
          margin-bottom: 20px;
          cursor: pointer;
          text-align: left;
        }

        .alert-icon {
          font-size: 18px;
        }

        .alert-text {
          flex: 1;
          font-size: 14px;
          font-weight: 500;
          color: #92400e;
        }

        .alert-arrow {
          color: #92400e;
        }

        .horizon-section {
          margin-bottom: 24px;
        }

        .horizon-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .horizon-badge {
          padding: 4px 12px;
          color: white;
          border-radius: 100px;
          font-size: 12px;
          font-weight: 600;
          text-transform: capitalize;
        }

        .horizon-count {
          font-size: 12px;
          color: #6b7280;
        }

        .outcomes-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .outcome-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          cursor: pointer;
          text-align: left;
          width: 100%;
          transition: all 0.15s ease;
        }

        .outcome-card:hover {
          border-color: #1D9BF0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }

        .outcome-icon {
          font-size: 20px;
        }

        .outcome-info {
          flex: 1;
          min-width: 0;
        }

        .outcome-title {
          font-size: 15px;
          font-weight: 600;
          color: #14171a;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .outcome-desc {
          font-size: 13px;
          color: #6b7280;
          margin: 2px 0 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .outcome-arrow {
          font-size: 18px;
          color: #9ca3af;
        }

        .empty-state {
          text-align: center;
          padding: 48px 24px;
        }

        .empty-icon {
          font-size: 48px;
          display: block;
          margin-bottom: 12px;
        }

        .empty-state h2 {
          font-size: 18px;
          font-weight: 600;
          color: #14171a;
          margin: 0 0 8px;
        }

        .empty-state p {
          font-size: 14px;
          color: #6b7280;
          margin: 0 0 20px;
        }

        .back-btn {
          background: none;
          border: none;
          color: #1D9BF0;
          font-size: 15px;
          cursor: pointer;
          padding: 0;
          margin-bottom: 16px;
        }

        .form-section {
          background: white;
          border-radius: 16px;
          padding: 20px;
          margin-top: 16px;
        }

        .field {
          margin-bottom: 20px;
        }

        .field label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 8px;
        }

        .text-input, .textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          font-size: 15px;
          outline: none;
          transition: border-color 0.15s;
        }

        .text-input:focus, .textarea:focus {
          border-color: #1D9BF0;
        }

        .textarea {
          resize: vertical;
          font-family: inherit;
        }

        .horizon-buttons {
          display: flex;
          gap: 8px;
        }

        .horizon-btn {
          flex: 1;
          padding: 12px;
          border: 2px solid #e5e7eb;
          border-radius: 10px;
          background: white;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }

        .continue-btn, .create-outcome-btn {
          width: 100%;
          padding: 14px;
          background: #1D9BF0;
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
        }

        .continue-btn:disabled, .create-outcome-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .section-desc {
          font-size: 14px;
          color: #6b7280;
          margin: 0 0 16px;
        }

        .commitments-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }

        .commitment-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 12px;
          background: #f9fafb;
          border-radius: 8px;
          font-size: 14px;
        }

        .remove-btn {
          background: none;
          border: none;
          color: #9ca3af;
          font-size: 18px;
          cursor: pointer;
          padding: 0 4px;
        }

        .add-commitment-row {
          display: flex;
          gap: 8px;
        }

        .add-commitment-row .text-input {
          flex: 1;
        }

        .add-btn {
          padding: 12px 20px;
          background: #f3f4f6;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }

        .add-btn:disabled {
          opacity: 0.5;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .back-step-btn {
          flex: 1;
          padding: 14px;
          background: #f3f4f6;
          color: #374151;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
        }

        .detail-header {
          margin-bottom: 24px;
        }

        .detail-title {
          font-size: 22px;
          font-weight: 700;
          color: #14171a;
          margin: 12px 0 8px;
        }

        .detail-desc {
          font-size: 14px;
          color: #6b7280;
          margin: 0;
        }

        .detail-section {
          background: white;
          border-radius: 16px;
          padding: 16px;
          margin-bottom: 16px;
        }

        .section-title {
          font-size: 16px;
          font-weight: 600;
          color: #14171a;
          margin: 0 0 12px;
        }

        .empty-text {
          font-size: 14px;
          color: #9ca3af;
          margin: 0;
        }

        .commitments-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .commitment-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: #f9fafb;
          border-radius: 10px;
        }

        .commitment-card h3 {
          font-size: 14px;
          font-weight: 500;
          margin: 0;
        }

        .status-badge {
          font-size: 11px;
          padding: 2px 8px;
          background: #e5e7eb;
          border-radius: 100px;
          text-transform: capitalize;
        }

        .tasks-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .task-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 12px;
          background: #f9fafb;
          border-radius: 8px;
        }

        .task-name {
          font-size: 14px;
          color: #374151;
        }

        .task-status {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 100px;
          text-transform: capitalize;
        }

        .task-status.active {
          background: #dcfce7;
          color: #166534;
        }

        .task-status.completed {
          background: #e5e7eb;
          color: #6b7280;
        }

        .task-status.needs_linking {
          background: #fef3c7;
          color: #92400e;
        }

        .detail-actions {
          margin-top: 24px;
        }

        .delete-btn {
          width: 100%;
          padding: 14px;
          background: #fef2f2;
          color: #dc2626;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }

        .delete-btn:hover {
          background: #fee2e2;
        }

        .needs-linking-view-wrapper {
          /* Container for needs linking view */
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
