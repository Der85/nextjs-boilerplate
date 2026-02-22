'use client'

import { useState, useRef, useEffect } from 'react'
import type { Category, TaskStatus } from '@/lib/types'
import SaveViewModal from './SaveViewModal'
import {
  type TaskFilters,
  type DueRange,
  type SavedView,
  DEFAULT_FILTERS,
  SYSTEM_VIEWS,
  DUE_RANGE_LABELS,
  STATUS_LABELS,
  PRIORITY_LABELS,
  hasActiveFilters,
  filtersMatchView,
  loadSavedViews,
  addSavedView,
  deleteSavedView,
  MAX_CUSTOM_VIEWS,
} from '@/lib/utils/filters'

interface FilterBarProps {
  categories: Category[]
  filters: TaskFilters
  onFilterChange: (filters: TaskFilters) => void
  totalCount: number
  filteredCount: number
}

export default function FilterBar({
  categories,
  filters,
  onFilterChange,
  totalCount,
  filteredCount,
}: FilterBarProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [newViewName, setNewViewName] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load saved views on mount
  useEffect(() => {
    setSavedViews(loadSavedViews())
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const allViews = [...SYSTEM_VIEWS, ...savedViews]
  const activeView = allViews.find(v => filtersMatchView(filters, v))
  const isFiltered = hasActiveFilters(filters)
  const canSaveView = isFiltered && savedViews.length < MAX_CUSTOM_VIEWS && !activeView

  const handleClearAll = () => {
    onFilterChange({ ...DEFAULT_FILTERS })
    setOpenDropdown(null)
  }

  const handleViewSelect = (view: SavedView) => {
    onFilterChange({ ...view.filters })
    setOpenDropdown(null)
  }

  const handleSaveView = () => {
    if (!newViewName.trim()) return
    try {
      const updated = addSavedView(savedViews, newViewName.trim(), filters)
      setSavedViews(updated)
      setNewViewName('')
      setShowSaveModal(false)
    } catch {
      // Max views reached
    }
  }

  const handleDeleteView = (viewId: string) => {
    const updated = deleteSavedView(savedViews, viewId)
    setSavedViews(updated)
  }

  const toggleCategory = (catId: string) => {
    const current = filters.categories
    const updated = current.includes(catId)
      ? current.filter(c => c !== catId)
      : [...current, catId]
    onFilterChange({ ...filters, categories: updated })
  }

  const toggleStatus = (status: TaskStatus) => {
    const current = filters.statuses
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status]
    onFilterChange({ ...filters, statuses: updated })
  }

  const togglePriority = (priority: 'low' | 'medium' | 'high') => {
    const current = filters.priorities
    const updated = current.includes(priority)
      ? current.filter(p => p !== priority)
      : [...current, priority]
    onFilterChange({ ...filters, priorities: updated })
  }

  const setDueRange = (range: DueRange | null) => {
    onFilterChange({ ...filters, dueRange: range })
  }

  const setRecurring = (value: boolean | null) => {
    onFilterChange({ ...filters, isRecurring: value })
  }

  const pillStyle = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
    borderRadius: 'var(--radius-full)',
    background: active ? 'var(--color-accent-light)' : 'var(--color-bg)',
    color: active ? 'var(--color-accent)' : 'var(--color-text-secondary)',
    fontSize: 'var(--text-small)',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s',
  })

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    zIndex: 50,
    marginTop: '4px',
    padding: '8px',
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-lg)',
    minWidth: '180px',
    maxHeight: '280px',
    overflowY: 'auto',
  }

  const checkboxStyle = (checked: boolean): React.CSSProperties => ({
    width: '16px',
    height: '16px',
    borderRadius: '3px',
    border: `2px solid ${checked ? 'var(--color-accent)' : 'var(--color-border)'}`,
    background: checked ? 'var(--color-accent)' : 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  })

  const optionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 'var(--text-caption)',
    color: 'var(--color-text-primary)',
  }

  return (
    <div style={{ marginBottom: '16px' }} ref={dropdownRef}>
      {/* View Switcher */}
      <div style={{
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '8px',
        marginBottom: '8px',
        WebkitOverflowScrolling: 'touch',
      }}>
        {allViews.map(view => {
          const isActive = filtersMatchView(filters, view)
          return (
            <div
              key={view.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <button
                onClick={() => handleViewSelect(view)}
                style={{
                  ...pillStyle(isActive),
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                {view.name}
              </button>
              {!view.isSystem && (
                <button
                  onClick={() => handleDeleteView(view.id)}
                  aria-label={`Delete ${view.name}`}
                  style={{
                    width: '20px',
                    height: '20px',
                    border: 'none',
                    background: 'none',
                    color: 'var(--color-text-tertiary)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          )
        })}

        {/* Save View button */}
        {canSaveView && (
          <button
            onClick={() => setShowSaveModal(true)}
            style={{
              ...pillStyle(false),
              borderStyle: 'dashed',
            }}
          >
            + Save View
          </button>
        )}
      </div>

      {/* Filter Pills */}
      <div style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        overflowX: 'auto',
        paddingBottom: '4px',
        WebkitOverflowScrolling: 'touch',
      }}>
        {/* Category Filter */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setOpenDropdown(openDropdown === 'category' ? null : 'category')}
            style={pillStyle(filters.categories.length > 0)}
          >
            {filters.categories.length > 0 ? (
              <>
                {filters.categories.length === 1
                  ? categories.find(c => c.id === filters.categories[0])?.name || 'Category'
                  : `${filters.categories.length} categories`
                }
              </>
            ) : (
              'Category'
            )}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {openDropdown === 'category' && (
            <div style={dropdownStyle}>
              <button
                onClick={() => onFilterChange({ ...filters, categories: [] })}
                style={{
                  ...optionStyle,
                  width: '100%',
                  marginBottom: '4px',
                  color: 'var(--color-text-tertiary)',
                  fontSize: 'var(--text-small)',
                }}
              >
                Clear
              </button>
              <div
                onClick={() => toggleCategory('uncategorized')}
                style={optionStyle}
              >
                <div style={checkboxStyle(filters.categories.includes('uncategorized'))}>
                  {filters.categories.includes('uncategorized') && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span>Uncategorized</span>
              </div>
              {categories.map(cat => (
                <div
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  style={optionStyle}
                >
                  <div style={checkboxStyle(filters.categories.includes(cat.id))}>
                    {filters.categories.includes(cat.id) && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span style={{ marginRight: '4px' }}>{cat.icon}</span>
                  <span>{cat.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status Filter */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
            style={pillStyle(filters.statuses.length > 0)}
          >
            {filters.statuses.length > 0 ? (
              filters.statuses.length === 1
                ? STATUS_LABELS[filters.statuses[0]]
                : `${filters.statuses.length} statuses`
            ) : (
              'Status'
            )}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {openDropdown === 'status' && (
            <div style={dropdownStyle}>
              <button
                onClick={() => onFilterChange({ ...filters, statuses: [] })}
                style={{
                  ...optionStyle,
                  width: '100%',
                  marginBottom: '4px',
                  color: 'var(--color-text-tertiary)',
                  fontSize: 'var(--text-small)',
                }}
              >
                Clear
              </button>
              {(['active', 'done', 'dropped', 'skipped'] as TaskStatus[]).map(status => (
                <div
                  key={status}
                  onClick={() => toggleStatus(status)}
                  style={optionStyle}
                >
                  <div style={checkboxStyle(filters.statuses.includes(status))}>
                    {filters.statuses.includes(status) && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span>{STATUS_LABELS[status]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Priority Filter */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setOpenDropdown(openDropdown === 'priority' ? null : 'priority')}
            style={pillStyle(filters.priorities.length > 0)}
          >
            {filters.priorities.length > 0 ? (
              filters.priorities.length === 1
                ? PRIORITY_LABELS[filters.priorities[0]]
                : `${filters.priorities.length} priorities`
            ) : (
              'Priority'
            )}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {openDropdown === 'priority' && (
            <div style={dropdownStyle}>
              <button
                onClick={() => onFilterChange({ ...filters, priorities: [] })}
                style={{
                  ...optionStyle,
                  width: '100%',
                  marginBottom: '4px',
                  color: 'var(--color-text-tertiary)',
                  fontSize: 'var(--text-small)',
                }}
              >
                Clear
              </button>
              {(['high', 'medium', 'low'] as const).map(priority => (
                <div
                  key={priority}
                  onClick={() => togglePriority(priority)}
                  style={optionStyle}
                >
                  <div style={checkboxStyle(filters.priorities.includes(priority))}>
                    {filters.priorities.includes(priority) && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span>{PRIORITY_LABELS[priority]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Due Date Filter */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setOpenDropdown(openDropdown === 'due' ? null : 'due')}
            style={pillStyle(filters.dueRange !== null)}
          >
            {filters.dueRange ? DUE_RANGE_LABELS[filters.dueRange] : 'Due'}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {openDropdown === 'due' && (
            <div style={dropdownStyle}>
              <button
                onClick={() => { setDueRange(null); setOpenDropdown(null) }}
                style={{
                  ...optionStyle,
                  width: '100%',
                  marginBottom: '4px',
                  color: 'var(--color-text-tertiary)',
                  fontSize: 'var(--text-small)',
                }}
              >
                Clear
              </button>
              {(['overdue', 'today', 'tomorrow', 'this_week', 'next_week', 'no_date'] as DueRange[]).map(range => (
                <div
                  key={range}
                  onClick={() => { setDueRange(range); setOpenDropdown(null) }}
                  style={{
                    ...optionStyle,
                    background: filters.dueRange === range ? 'var(--color-accent-light)' : 'transparent',
                  }}
                >
                  <span>{DUE_RANGE_LABELS[range]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recurring Filter */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setOpenDropdown(openDropdown === 'recurring' ? null : 'recurring')}
            style={pillStyle(filters.isRecurring !== null)}
          >
            {filters.isRecurring === true ? 'Recurring' : filters.isRecurring === false ? 'One-time' : 'Recurring'}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {openDropdown === 'recurring' && (
            <div style={dropdownStyle}>
              <button
                onClick={() => { setRecurring(null); setOpenDropdown(null) }}
                style={{
                  ...optionStyle,
                  width: '100%',
                  marginBottom: '4px',
                  color: 'var(--color-text-tertiary)',
                  fontSize: 'var(--text-small)',
                }}
              >
                Clear
              </button>
              <div
                onClick={() => { setRecurring(true); setOpenDropdown(null) }}
                style={{
                  ...optionStyle,
                  background: filters.isRecurring === true ? 'var(--color-accent-light)' : 'transparent',
                }}
              >
                <span>Recurring only</span>
              </div>
              <div
                onClick={() => { setRecurring(false); setOpenDropdown(null) }}
                style={{
                  ...optionStyle,
                  background: filters.isRecurring === false ? 'var(--color-accent-light)' : 'transparent',
                }}
              >
                <span>One-time only</span>
              </div>
            </div>
          )}
        </div>

        {/* Clear All + Count */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isFiltered && (
            <button
              onClick={handleClearAll}
              style={{
                ...pillStyle(false),
                color: 'var(--color-danger)',
                borderColor: 'var(--color-danger)',
              }}
            >
              Clear All
            </button>
          )}
          <span style={{
            fontSize: 'var(--text-small)',
            color: 'var(--color-text-tertiary)',
            whiteSpace: 'nowrap',
          }}>
            {isFiltered ? `${filteredCount} of ${totalCount}` : `${totalCount} tasks`}
          </span>
        </div>
      </div>

      {showSaveModal && (
        <SaveViewModal
          value={newViewName}
          onChange={setNewViewName}
          onSave={handleSaveView}
          onClose={() => { setShowSaveModal(false); setNewViewName('') }}
        />
      )}
    </div>
  )
}
