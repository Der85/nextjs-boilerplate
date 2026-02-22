'use client'

import { useState, useRef, useEffect, memo } from 'react'
import type { Category } from '@/lib/types'

interface CategoryDropdownProps {
  categories: Category[]
  selectedId: string | null
  confidence?: number | null
  onSelect: (categoryId: string | null) => void
  onManageCategories?: () => void
}

export default memo(function CategoryDropdown({
  categories,
  selectedId,
  confidence,
  onSelect,
  onManageCategories,
}: CategoryDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedCategory = categories.find(c => c.id === selectedId)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const showLowConfidence = confidence !== null && confidence !== undefined && confidence < 0.7

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          borderRadius: 'var(--radius-full)',
          border: 'none',
          background: selectedCategory ? `${selectedCategory.color}20` : 'var(--color-surface)',
          color: selectedCategory?.color || 'var(--color-text-tertiary)',
          fontSize: 'var(--text-small)',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
      >
        <span>{selectedCategory?.icon || '📁'}</span>
        <span>{selectedCategory?.name || 'Uncategorized'}</span>
        {showLowConfidence && (
          <span
            title="AI wasn't sure about this category"
            style={{
              fontSize: '10px',
              color: 'var(--color-warning)',
            }}
          >
            ?
          </span>
        )}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.15s',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 50,
            marginTop: '4px',
            minWidth: '180px',
            maxHeight: '280px',
            overflowY: 'auto',
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            animation: 'fade-in 0.15s ease',
          }}
        >
          {/* Uncategorized option */}
          <button
            onClick={() => {
              onSelect(null)
              setIsOpen(false)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '10px 12px',
              border: 'none',
              background: selectedId === null ? 'var(--color-surface)' : 'none',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface)'}
            onMouseLeave={(e) => e.currentTarget.style.background = selectedId === null ? 'var(--color-surface)' : 'transparent'}
          >
            <span style={{ fontSize: '14px' }}>📁</span>
            <span style={{
              fontSize: 'var(--text-body)',
              color: 'var(--color-text-secondary)',
            }}>
              Uncategorized
            </span>
          </button>

          {/* Divider */}
          <div style={{
            height: '1px',
            background: 'var(--color-border)',
            margin: '4px 0',
          }} />

          {/* Category options */}
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                onSelect(cat.id)
                setIsOpen(false)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '10px 12px',
                border: 'none',
                background: selectedId === cat.id ? 'var(--color-surface)' : 'none',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface)'}
              onMouseLeave={(e) => e.currentTarget.style.background = selectedId === cat.id ? 'var(--color-surface)' : 'transparent'}
            >
              <span style={{ fontSize: '14px' }}>{cat.icon}</span>
              <span style={{
                flex: 1,
                fontSize: 'var(--text-body)',
                color: 'var(--color-text-primary)',
              }}>
                {cat.name}
              </span>
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: cat.color,
                  flexShrink: 0,
                }}
              />
            </button>
          ))}

          {/* Manage Categories link */}
          {onManageCategories && (
            <>
              <div style={{
                height: '1px',
                background: 'var(--color-border)',
                margin: '4px 0',
              }} />
              <button
                onClick={() => {
                  onManageCategories()
                  setIsOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '10px 12px',
                  border: 'none',
                  background: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                <span style={{
                  fontSize: 'var(--text-body)',
                  color: 'var(--color-text-tertiary)',
                }}>
                  Manage Categories...
                </span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
})
