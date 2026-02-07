'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import type {
  Outcome,
  Commitment,
  ParentSelectorTab,
  HORIZON_COLORS,
} from '@/lib/types/outcomes'

interface ParentSelectorProps {
  selectedOutcomeId: string | null
  selectedCommitmentId: string | null
  onSelect: (outcomeId: string | null, commitmentId: string | null) => void
  disabled?: boolean
}

interface CommitmentWithOutcome extends Commitment {
  outcome?: { id: string; title: string; horizon: string } | null
}

const HORIZON_COLOR_MAP: Record<string, string> = {
  weekly: '#10b981',
  monthly: '#1D9BF0',
  quarterly: '#8b5cf6',
}

export default function ParentSelector({
  selectedOutcomeId,
  selectedCommitmentId,
  onSelect,
  disabled = false,
}: ParentSelectorProps) {
  const supabase = createClient()
  const [tab, setTab] = useState<ParentSelectorTab>('outcome')
  const [outcomes, setOutcomes] = useState<Outcome[]>([])
  const [commitments, setCommitments] = useState<CommitmentWithOutcome[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        return
      }

      const [outcomesRes, commitmentsRes] = await Promise.all([
        supabase
          .from('outcomes')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .order('priority_rank', { ascending: true }),
        supabase
          .from('commitments')
          .select(`
            *,
            outcome:outcomes(id, title, horizon)
          `)
          .eq('user_id', session.user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
      ])

      setOutcomes(outcomesRes.data || [])
      setCommitments(commitmentsRes.data || [])
    } catch (error) {
      console.error('Failed to load parent options:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredOutcomes = outcomes.filter(o =>
    o.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredCommitments = commitments.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.outcome?.title?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleOutcomeSelect = (id: string) => {
    if (disabled) return
    onSelect(id, null)
  }

  const handleCommitmentSelect = (id: string) => {
    if (disabled) return
    const commitment = commitments.find(c => c.id === id)
    onSelect(commitment?.outcome_id || null, id)
  }

  const handleClear = () => {
    if (disabled) return
    onSelect(null, null)
  }

  // Show current selection summary
  const getSelectionSummary = (): string | null => {
    if (selectedCommitmentId) {
      const commitment = commitments.find(c => c.id === selectedCommitmentId)
      if (commitment) {
        return `${commitment.title} (in ${commitment.outcome?.title || 'Unknown'})`
      }
    }
    if (selectedOutcomeId) {
      const outcome = outcomes.find(o => o.id === selectedOutcomeId)
      if (outcome) {
        return outcome.title
      }
    }
    return null
  }

  const selectionSummary = getSelectionSummary()

  return (
    <div className="parent-selector">
      {/* Current Selection */}
      {selectionSummary && (
        <div className="current-selection">
          <span className="selection-label">Linked to:</span>
          <span className="selection-value">{selectionSummary}</span>
          {!disabled && (
            <button className="clear-btn" onClick={handleClear} type="button">
              Change
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      {!selectionSummary && (
        <>
          <div className="tabs">
            <button
              type="button"
              className={`tab ${tab === 'outcome' ? 'active' : ''}`}
              onClick={() => setTab('outcome')}
              disabled={disabled}
            >
              Outcome
            </button>
            <button
              type="button"
              className={`tab ${tab === 'commitment' ? 'active' : ''}`}
              onClick={() => setTab('commitment')}
              disabled={disabled}
            >
              Commitment
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${tab}s...`}
            className="search-input"
            disabled={disabled}
          />

          {/* List */}
          <div className="list">
            {loading ? (
              <div className="empty">Loading...</div>
            ) : tab === 'outcome' ? (
              filteredOutcomes.length === 0 ? (
                <div className="empty">
                  {outcomes.length === 0
                    ? 'No outcomes yet. Create one first!'
                    : 'No outcomes match your search'}
                </div>
              ) : (
                filteredOutcomes.map(outcome => (
                  <button
                    key={outcome.id}
                    type="button"
                    className={`list-item ${selectedOutcomeId === outcome.id ? 'selected' : ''}`}
                    onClick={() => handleOutcomeSelect(outcome.id)}
                    disabled={disabled}
                  >
                    <span
                      className="horizon-badge"
                      style={{ backgroundColor: HORIZON_COLOR_MAP[outcome.horizon] }}
                    >
                      {outcome.horizon}
                    </span>
                    <span className="title">{outcome.title}</span>
                  </button>
                ))
              )
            ) : (
              filteredCommitments.length === 0 ? (
                <div className="empty">
                  {commitments.length === 0
                    ? 'No commitments yet. Create one under an outcome!'
                    : 'No commitments match your search'}
                </div>
              ) : (
                filteredCommitments.map(commitment => (
                  <button
                    key={commitment.id}
                    type="button"
                    className={`list-item ${selectedCommitmentId === commitment.id ? 'selected' : ''}`}
                    onClick={() => handleCommitmentSelect(commitment.id)}
                    disabled={disabled}
                  >
                    <span className="title">{commitment.title}</span>
                    <span className="parent-label">
                      in {commitment.outcome?.title || 'Unknown'}
                    </span>
                  </button>
                ))
              )
            )}
          </div>
        </>
      )}

      <style jsx>{`
        .parent-selector {
          background: white;
          border-radius: 14px;
          padding: 16px;
          border: 1px solid #e5e7eb;
        }

        .current-selection {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .selection-label {
          font-size: 13px;
          color: #6b7280;
        }

        .selection-value {
          font-size: 14px;
          font-weight: 500;
          color: #1f2937;
        }

        .clear-btn {
          font-size: 12px;
          color: #1D9BF0;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 6px;
        }

        .clear-btn:hover {
          background: rgba(29, 155, 240, 0.1);
        }

        .tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .tab {
          flex: 1;
          padding: 10px;
          border: none;
          background: #f3f4f6;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          color: #374151;
        }

        .tab:hover:not(:disabled) {
          background: #e5e7eb;
        }

        .tab.active {
          background: #1D9BF0;
          color: white;
        }

        .tab:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .search-input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 12px;
          outline: none;
          transition: border-color 0.15s ease;
        }

        .search-input:focus {
          border-color: #1D9BF0;
        }

        .search-input:disabled {
          background: #f9fafb;
          cursor: not-allowed;
        }

        .list {
          max-height: 200px;
          overflow-y: auto;
        }

        .list-item {
          width: 100%;
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: white;
          text-align: left;
          cursor: pointer;
          margin-bottom: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          transition: all 0.15s ease;
        }

        .list-item:hover:not(:disabled) {
          border-color: #1D9BF0;
          background: rgba(29, 155, 240, 0.02);
        }

        .list-item.selected {
          border-color: #1D9BF0;
          background: rgba(29, 155, 240, 0.05);
        }

        .list-item:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .horizon-badge {
          font-size: 11px;
          color: white;
          padding: 2px 8px;
          border-radius: 100px;
          width: fit-content;
          text-transform: capitalize;
        }

        .title {
          font-weight: 500;
          color: #1f2937;
        }

        .parent-label {
          font-size: 12px;
          color: #6b7280;
        }

        .empty {
          text-align: center;
          padding: 20px;
          color: #6b7280;
          font-size: 14px;
        }
      `}</style>
    </div>
  )
}
