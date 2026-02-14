'use client'

import { useState, useEffect, useMemo } from 'react'
import type { TaskTemplateWithCategory } from '@/lib/types'

interface TemplatePickerProps {
  onSelect: (template: TaskTemplateWithCategory) => void
  onClose: () => void
  multiSelect?: boolean
  onMultiSelect?: (templates: TaskTemplateWithCategory[]) => void
}

export default function TemplatePicker({
  onSelect,
  onClose,
  multiSelect = false,
  onMultiSelect,
}: TemplatePickerProps) {
  const [templates, setTemplates] = useState<TaskTemplateWithCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch('/api/templates')
        if (res.ok) {
          const data = await res.json()
          setTemplates(data.templates || [])
        }
      } catch (err) {
        console.error('Failed to fetch templates:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchTemplates()
  }, [])

  const filteredTemplates = useMemo(() => {
    if (!search.trim()) return templates
    const searchLower = search.toLowerCase()
    return templates.filter(t =>
      t.name.toLowerCase().includes(searchLower) ||
      t.task_name.toLowerCase().includes(searchLower)
    )
  }, [templates, search])

  const handleSelect = (template: TaskTemplateWithCategory) => {
    if (multiSelect) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        if (next.has(template.id)) {
          next.delete(template.id)
        } else {
          next.add(template.id)
        }
        return next
      })
    } else {
      onSelect(template)
      onClose()
    }
  }

  const handleConfirmMulti = () => {
    if (onMultiSelect) {
      const selected = templates.filter(t => selectedIds.has(t.id))
      onMultiSelect(selected)
    }
    onClose()
  }

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'high': return 'var(--color-danger)'
      case 'medium': return 'var(--color-warning)'
      case 'low': return 'var(--color-success)'
      default: return 'var(--color-text-tertiary)'
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '16px',
    }}>
      <div style={{
        background: 'var(--color-bg)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: '400px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{
            fontSize: 'var(--text-subheading)',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            margin: 0,
          }}>
            {multiSelect ? 'Select Templates' : 'Use Template'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: '32px',
              height: '32px',
              border: 'none',
              background: 'none',
              color: 'var(--color-text-tertiary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-body)',
              background: 'var(--color-bg)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>

        {/* Template List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 16px 16px',
        }}>
          {loading ? (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <span style={{ color: 'var(--color-text-tertiary)' }}>Loading...</span>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              <span style={{ color: 'var(--color-text-tertiary)' }}>
                {templates.length === 0 ? 'No templates yet' : 'No matching templates'}
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredTemplates.map(template => {
                const isSelected = selectedIds.has(template.id)
                return (
                  <button
                    key={template.id}
                    onClick={() => handleSelect(template)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      border: `1px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'var(--color-accent-light)' : 'var(--color-surface)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    {/* Category Icon or Checkbox */}
                    <span style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius-sm)',
                      background: template.category ? `${template.category.color}20` : 'var(--color-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                    }}>
                      {multiSelect ? (
                        isSelected ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-accent)" stroke="white" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <polyline points="9 12 12 15 16 10" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-border)" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                          </svg>
                        )
                      ) : (
                        template.category?.icon || '📋'
                      )}
                    </span>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 'var(--text-body)',
                        fontWeight: 500,
                        color: 'var(--color-text-primary)',
                        marginBottom: '2px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {template.name}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: 'var(--text-small)',
                        color: 'var(--color-text-tertiary)',
                      }}>
                        {template.category && (
                          <span style={{ color: template.category.color }}>
                            {template.category.name}
                          </span>
                        )}
                        {template.priority && (
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: getPriorityColor(template.priority),
                          }} />
                        )}
                        {template.is_recurring_default && (
                          <span title="Recurring">↻</span>
                        )}
                        {template.use_count > 0 && (
                          <span>Used {template.use_count}x</span>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    {!multiSelect && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Multi-select footer */}
        {multiSelect && selectedIds.size > 0 && (
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{
              fontSize: 'var(--text-caption)',
              color: 'var(--color-text-secondary)',
            }}>
              {selectedIds.size} selected
            </span>
            <button
              onClick={handleConfirmMulti}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-accent)',
                color: '#fff',
                fontSize: 'var(--text-caption)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Add Tasks
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
