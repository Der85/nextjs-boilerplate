'use client'

import type { TaskTemplateWithCategory } from '@/lib/types'

interface TemplateCardProps {
  template: TaskTemplateWithCategory
  onEdit: (template: TaskTemplateWithCategory) => void
  onDelete: (template: TaskTemplateWithCategory) => void
  onUse: (template: TaskTemplateWithCategory) => void
}

export default function TemplateCard({
  template,
  onEdit,
  onDelete,
  onUse,
}: TemplateCardProps) {
  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'high': return 'var(--color-danger)'
      case 'medium': return 'var(--color-warning)'
      case 'low': return 'var(--color-success)'
      default: return 'var(--color-text-tertiary)'
    }
  }

  const getPriorityLabel = (priority: string | null) => {
    switch (priority) {
      case 'high': return 'High'
      case 'medium': return 'Medium'
      case 'low': return 'Low'
      default: return null
    }
  }

  const formatRecurrence = (rule: typeof template.recurrence_rule) => {
    if (!rule) return null
    const freq = rule.frequency
    const interval = rule.interval || 1
    if (interval === 1) {
      return freq.charAt(0).toUpperCase() + freq.slice(1)
    }
    return `Every ${interval} ${freq}s`
  }

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      {/* Header: Name + Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '12px',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            fontSize: 'var(--text-body)',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            margin: 0,
            marginBottom: '4px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {template.name}
          </h3>
          <p style={{
            fontSize: 'var(--text-small)',
            color: 'var(--color-text-secondary)',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {template.task_name}
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => onUse(template)}
            title="Create task from template"
            style={{
              width: '32px',
              height: '32px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-accent)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            onClick={() => onEdit(template)}
            title="Edit template"
            style={{
              width: '32px',
              height: '32px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(template)}
            title="Delete template"
            style={{
              width: '32px',
              height: '32px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg)',
              color: 'var(--color-text-tertiary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Meta info row */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '8px',
        fontSize: 'var(--text-small)',
      }}>
        {/* Category */}
        {template.category && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            background: `${template.category.color}20`,
            color: template.category.color,
          }}>
            <span>{template.category.icon}</span>
            <span>{template.category.name}</span>
          </span>
        )}

        {/* Priority */}
        {template.priority && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            background: `${getPriorityColor(template.priority)}20`,
            color: getPriorityColor(template.priority),
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'currentColor',
            }} />
            <span>{getPriorityLabel(template.priority)}</span>
          </span>
        )}

        {/* Recurring */}
        {template.is_recurring_default && template.recurrence_rule && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}>
            <span>↻</span>
            <span>{formatRecurrence(template.recurrence_rule)}</span>
          </span>
        )}

        {/* Use count */}
        <span style={{
          color: 'var(--color-text-tertiary)',
          marginLeft: 'auto',
        }}>
          {template.use_count > 0 ? `Used ${template.use_count}x` : 'Never used'}
        </span>
      </div>

      {/* Tags */}
      {template.tags && template.tags.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
        }}>
          {template.tags.map(tag => (
            <span
              key={tag}
              style={{
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-tertiary)',
                fontSize: 'var(--text-caption)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Description */}
      {template.description && (
        <p style={{
          fontSize: 'var(--text-small)',
          color: 'var(--color-text-tertiary)',
          margin: 0,
          lineHeight: 1.4,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {template.description}
        </p>
      )}
    </div>
  )
}
