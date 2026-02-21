'use client'

import { useState, useRef, useEffect } from 'react'
import type { Category, TaskStatus } from '@/lib/types'
import SaveViewModal from './SaveViewModal'
import FilterDropdown, { pillStyle, optionStyle, CheckMark } from './FilterDropdown'
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

  const clearButtonStyle: React.CSSProperties = {
    ...optionStyle,
    width: '100%',
    marginBottom: '4px',
    color: 'var(--color-text-tertiary)',
    fontSize: 'var(--text-small)',
  }

  const categoryDisplayValue = filters.categories.length === 1
    ? categories.find(c => c.id === filters.categories[0])?.name || 'Category'
    : `${filters.categories.length} categories`

  const statusDisplayValue = filters.statuses.length === 1
    ? STATUS_LABELS[filters.statuses[0]]
    : `${filters.statuses.length} statuses`

  const priorityDisplayValue = filters.priorities.length === 1
    ? PRIORITY_LABELS[filters.priorities[0]]
    : `${filters.priorities.length} priorities`

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
        <FilterDropdown
          label="Category"
          isActive={filters.categories.length > 0}
          displayValue={categoryDisplayValue}
          isOpen={openDropdown === 'category'}
          onToggle={() => setOpenDropdown(openDropdown === 'category' ? null : 'category')}
        >
          <button onClick={() => onFilterChange({ ...filters, categories: [] })} style={clearButtonStyle}>
            Clear
          </button>
          <div onClick={() => toggleCategory('uncategorized')} style={optionStyle} role="option" aria-selected={filters.categories.includes('uncategorized')}>
            <CheckMark checked={filters.categories.includes('uncategorized')} />
            <span>Uncategorized</span>
          </div>
          {categories.map(cat => (
            <div key={cat.id} onClick={() => toggleCategory(cat.id)} style={optionStyle} role="option" aria-selected={filters.categories.includes(cat.id)}>
              <CheckMark checked={filters.categories.includes(cat.id)} />
              <span style={{ marginRight: '4px' }}>{cat.icon}</span>
              <span>{cat.name}</span>
            </div>
          ))}
        </FilterDropdown>

        {/* Status Filter */}
        <FilterDropdown
          label="Status"
          isActive={filters.statuses.length > 0}
          displayValue={statusDisplayValue}
          isOpen={openDropdown === 'status'}
          onToggle={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
        >
          <button onClick={() => onFilterChange({ ...filters, statuses: [] })} style={clearButtonStyle}>
            Clear
          </button>
          {(['active', 'done', 'dropped', 'skipped'] as TaskStatus[]).map(status => (
            <div key={status} onClick={() => toggleStatus(status)} style={optionStyle} role="option" aria-selected={filters.statuses.includes(status)}>
              <CheckMark checked={filters.statuses.includes(status)} />
              <span>{STATUS_LABELS[status]}</span>
            </div>
          ))}
        </FilterDropdown>

        {/* Priority Filter */}
        <FilterDropdown
          label="Priority"
          isActive={filters.priorities.length > 0}
          displayValue={priorityDisplayValue}
          isOpen={openDropdown === 'priority'}
          onToggle={() => setOpenDropdown(openDropdown === 'priority' ? null : 'priority')}
        >
          <button onClick={() => onFilterChange({ ...filters, priorities: [] })} style={clearButtonStyle}>
            Clear
          </button>
          {(['high', 'medium', 'low'] as const).map(priority => (
            <div key={priority} onClick={() => togglePriority(priority)} style={optionStyle} role="option" aria-selected={filters.priorities.includes(priority)}>
              <CheckMark checked={filters.priorities.includes(priority)} />
              <span>{PRIORITY_LABELS[priority]}</span>
            </div>
          ))}
        </FilterDropdown>

        {/* Due Date Filter */}
        <FilterDropdown
          label="Due"
          isActive={filters.dueRange !== null}
          displayValue={filters.dueRange ? DUE_RANGE_LABELS[filters.dueRange] : undefined}
          isOpen={openDropdown === 'due'}
          onToggle={() => setOpenDropdown(openDropdown === 'due' ? null : 'due')}
        >
          <button onClick={() => { setDueRange(null); setOpenDropdown(null) }} style={clearButtonStyle}>
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
              role="option"
              aria-selected={filters.dueRange === range}
            >
              <span>{DUE_RANGE_LABELS[range]}</span>
            </div>
          ))}
        </FilterDropdown>

        {/* Recurring Filter */}
        <FilterDropdown
          label="Recurring"
          isActive={filters.isRecurring !== null}
          displayValue={filters.isRecurring === true ? 'Recurring' : filters.isRecurring === false ? 'One-time' : undefined}
          isOpen={openDropdown === 'recurring'}
          onToggle={() => setOpenDropdown(openDropdown === 'recurring' ? null : 'recurring')}
        >
          <button onClick={() => { setRecurring(null); setOpenDropdown(null) }} style={clearButtonStyle}>
            Clear
          </button>
          <div
            onClick={() => { setRecurring(true); setOpenDropdown(null) }}
            style={{
              ...optionStyle,
              background: filters.isRecurring === true ? 'var(--color-accent-light)' : 'transparent',
            }}
            role="option"
            aria-selected={filters.isRecurring === true}
          >
            <span>Recurring only</span>
          </div>
          <div
            onClick={() => { setRecurring(false); setOpenDropdown(null) }}
            style={{
              ...optionStyle,
              background: filters.isRecurring === false ? 'var(--color-accent-light)' : 'transparent',
            }}
            role="option"
            aria-selected={filters.isRecurring === false}
          >
            <span>One-time only</span>
          </div>
        </FilterDropdown>

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
