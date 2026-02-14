'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import TemplateCard from '@/components/TemplateCard'
import EmptyState from '@/components/EmptyState'
import type { TaskTemplateWithCategory, Category } from '@/lib/types'

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<TaskTemplateWithCategory[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplateWithCategory | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<TaskTemplateWithCategory | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [templatesRes, catsRes] = await Promise.all([
        fetch('/api/templates'),
        fetch('/api/categories'),
      ])

      if (templatesRes.ok) {
        const data = await templatesRes.json()
        setTemplates(data.templates || [])
      }
      if (catsRes.ok) {
        const data = await catsRes.json()
        setCategories(data.categories || [])
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filteredTemplates = search.trim()
    ? templates.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.task_name.toLowerCase().includes(search.toLowerCase())
      )
    : templates

  const handleUse = async (template: TaskTemplateWithCategory) => {
    try {
      const res = await fetch(`/api/templates/${template.id}/create-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        // Update use count locally
        setTemplates(prev => prev.map(t =>
          t.id === template.id
            ? { ...t, use_count: t.use_count + 1, last_used_at: new Date().toISOString() }
            : t
        ))
        router.push('/tasks')
      }
    } catch (err) {
      console.error('Failed to create task from template:', err)
    }
  }

  const handleDelete = async (template: TaskTemplateWithCategory) => {
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setTemplates(prev => prev.filter(t => t.id !== template.id))
        setDeleteConfirm(null)
      }
    } catch (err) {
      console.error('Failed to delete template:', err)
    }
  }

  if (loading) {
    return (
      <div style={{ paddingTop: '24px' }}>
        <div className="skeleton" style={{ height: '28px', width: '120px', marginBottom: '24px' }} />
        <div style={{ display: 'grid', gap: '12px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: '120px', borderRadius: 'var(--radius-md)' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ paddingTop: '20px', paddingBottom: '24px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
      }}>
        <h1 style={{
          fontSize: 'var(--text-heading)',
          fontWeight: 'var(--font-heading)',
          color: 'var(--color-text-primary)',
          margin: 0,
        }}>
          Templates
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-accent)',
            color: '#fff',
            fontSize: 'var(--text-small)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Template
        </button>
      </div>

      {/* Search */}
      {templates.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
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
      )}

      {/* Template list or empty state */}
      {filteredTemplates.length > 0 ? (
        <div style={{ display: 'grid', gap: '12px' }}>
          {filteredTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={() => setEditingTemplate(template)}
              onDelete={() => setDeleteConfirm(template)}
              onUse={() => handleUse(template)}
            />
          ))}
        </div>
      ) : templates.length > 0 ? (
        <EmptyState
          icon="🔍"
          title="No matching templates"
          message="Try a different search term."
          actionLabel="Clear search"
          onAction={() => setSearch('')}
        />
      ) : (
        <EmptyState
          icon="📋"
          title="No templates yet"
          message="Create templates for tasks you repeat often. Save time and stay consistent."
          actionLabel="Create template"
          onAction={() => setShowCreateModal(true)}
        />
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingTemplate) && (
        <TemplateModal
          template={editingTemplate}
          categories={categories}
          onClose={() => {
            setShowCreateModal(false)
            setEditingTemplate(null)
          }}
          onSave={(saved) => {
            if (editingTemplate) {
              setTemplates(prev => prev.map(t => t.id === saved.id ? saved : t))
            } else {
              setTemplates(prev => [saved, ...prev])
            }
            setShowCreateModal(false)
            setEditingTemplate(null)
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
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
            padding: '24px',
            maxWidth: '340px',
            width: '100%',
          }}>
            <h3 style={{
              fontSize: 'var(--text-subheading)',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              margin: '0 0 8px',
            }}>
              Delete template?
            </h3>
            <p style={{
              fontSize: 'var(--text-body)',
              color: 'var(--color-text-secondary)',
              margin: '0 0 20px',
            }}>
              "{deleteConfirm.name}" will be permanently deleted. Tasks created from this template won't be affected.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--text-small)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-danger)',
                  color: '#fff',
                  fontSize: 'var(--text-small)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Template Create/Edit Modal
interface TemplateModalProps {
  template: TaskTemplateWithCategory | null
  categories: Category[]
  onClose: () => void
  onSave: (template: TaskTemplateWithCategory) => void
}

function TemplateModal({ template, categories, onClose, onSave }: TemplateModalProps) {
  const [name, setName] = useState(template?.name || '')
  const [taskName, setTaskName] = useState(template?.task_name || '')
  const [description, setDescription] = useState(template?.description || '')
  const [priority, setPriority] = useState<string>(template?.priority || '')
  const [categoryId, setCategoryId] = useState(template?.category_id || '')
  const [isRecurring, setIsRecurring] = useState(template?.is_recurring_default || false)
  const [recurrenceFreq, setRecurrenceFreq] = useState(template?.recurrence_rule?.frequency || 'daily')
  const [recurrenceInterval, setRecurrenceInterval] = useState(template?.recurrence_rule?.interval || 1)
  const [tagsInput, setTagsInput] = useState(template?.tags?.join(', ') || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!name.trim() || !taskName.trim()) {
      setError('Name and task name are required.')
      return
    }

    setSaving(true)
    setError('')

    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)

    const payload = {
      name: name.trim(),
      task_name: taskName.trim(),
      description: description.trim() || null,
      priority: priority || null,
      category_id: categoryId || null,
      is_recurring_default: isRecurring,
      recurrence_rule: isRecurring ? { frequency: recurrenceFreq, interval: recurrenceInterval } : null,
      tags,
    }

    try {
      const url = template ? `/api/templates/${template.id}` : '/api/templates'
      const method = template ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await res.json()
        onSave(data.template)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save template.')
      }
    } catch {
      setError('Something went wrong.')
    } finally {
      setSaving(false)
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
        maxWidth: '440px',
        maxHeight: '90vh',
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
            {template ? 'Edit Template' : 'New Template'}
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

        {/* Form */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          {error && (
            <div style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-danger-light, #fef2f2)',
              color: 'var(--color-danger)',
              fontSize: 'var(--text-small)',
            }}>
              {error}
            </div>
          )}

          {/* Template Name */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 'var(--text-small)',
              fontWeight: 500,
              color: 'var(--color-text-secondary)',
              marginBottom: '6px',
            }}>
              Template Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Morning Routine"
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

          {/* Task Name */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 'var(--text-small)',
              fontWeight: 500,
              color: 'var(--color-text-secondary)',
              marginBottom: '6px',
            }}>
              Task Name *
            </label>
            <input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="e.g., Complete morning routine"
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

          {/* Description */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 'var(--text-small)',
              fontWeight: 500,
              color: 'var(--color-text-secondary)',
              marginBottom: '6px',
            }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes or steps..."
              rows={2}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--text-body)',
                background: 'var(--color-bg)',
                color: 'var(--color-text-primary)',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Category & Priority row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: 'var(--text-small)',
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                marginBottom: '6px',
              }}>
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-body)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text-primary)',
                }}
              >
                <option value="">None</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{
                display: 'block',
                fontSize: 'var(--text-small)',
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                marginBottom: '6px',
              }}>
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-body)',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text-primary)',
                }}
              >
                <option value="">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          {/* Recurring toggle */}
          <div>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
            }}>
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{
                fontSize: 'var(--text-body)',
                color: 'var(--color-text-primary)',
              }}>
                Recurring by default
              </span>
            </label>

            {isRecurring && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span style={{ fontSize: 'var(--text-small)', color: 'var(--color-text-secondary)' }}>
                  Every
                </span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={recurrenceInterval}
                  onChange={(e) => setRecurrenceInterval(parseInt(e.target.value) || 1)}
                  style={{
                    width: '50px',
                    padding: '6px 8px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--text-small)',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text-primary)',
                    textAlign: 'center',
                  }}
                />
                <select
                  value={recurrenceFreq}
                  onChange={(e) => setRecurrenceFreq(e.target.value as 'daily' | 'weekly' | 'monthly')}
                  style={{
                    padding: '6px 8px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--text-small)',
                    background: 'var(--color-bg)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <option value="daily">day(s)</option>
                  <option value="weekly">week(s)</option>
                  <option value="monthly">month(s)</option>
                </select>
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 'var(--text-small)',
              fontWeight: 500,
              color: 'var(--color-text-secondary)',
              marginBottom: '6px',
            }}>
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g., morning, health, routine"
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
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 16px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--text-body)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-accent)',
              color: '#fff',
              fontSize: 'var(--text-body)',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving...' : template ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  )
}
