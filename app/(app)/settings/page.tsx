'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import CategoryManager from '@/components/CategoryManager'
import type { Category, ReminderPreferences } from '@/lib/types'

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
]

export default function SettingsPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [reminderPrefs, setReminderPrefs] = useState<ReminderPreferences | null>(null)
  const [savingReminders, setSavingReminders] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch profile, categories, and reminder preferences in parallel
        const [profileRes, categoriesRes, remindersRes] = await Promise.all([
          fetch('/api/profile'),
          fetch('/api/categories'),
          fetch('/api/reminders/preferences'),
        ])

        if (profileRes.ok) {
          const data = await profileRes.json()
          setEmail(data.email || '')
          setDisplayName(data.profile?.display_name || '')
          setTimezone(data.profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
        }

        if (categoriesRes.ok) {
          const data = await categoriesRes.json()
          setCategories(data.categories || [])
        }

        if (remindersRes.ok) {
          const data = await remindersRes.json()
          setReminderPrefs(data.preferences || null)
        }
      } catch (err) {
        console.error('Failed to fetch data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaveMessage(null)

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName, timezone }),
      })

      if (res.ok) {
        setSaveMessage({ type: 'success', text: 'Settings saved.' })
        setTimeout(() => setSaveMessage(null), 3000)
      } else {
        const data = await res.json()
        setSaveMessage({ type: 'error', text: data.error || 'Failed to save.' })
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Something went wrong.' })
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleCategoryUpdate = async (id: string, updates: Partial<Category>) => {
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (res.ok) {
        const data = await res.json()
        setCategories(prev => prev.map(c => c.id === id ? data.category : c))
      }
    } catch (err) {
      console.error('Failed to update category:', err)
    }
  }

  const handleCategoryCreate = async (category: { name: string; color: string; icon: string }) => {
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(category),
      })

      if (res.ok) {
        const data = await res.json()
        setCategories(prev => [...prev, data.category])
      }
    } catch (err) {
      console.error('Failed to create category:', err)
    }
  }

  const handleCategoryDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setCategories(prev => prev.filter(c => c.id !== id))
      }
    } catch (err) {
      console.error('Failed to delete category:', err)
    }
  }

  const handleReminderPrefChange = async (key: keyof ReminderPreferences, value: unknown) => {
    if (!reminderPrefs) return

    // Optimistic update
    const updatedPrefs = { ...reminderPrefs, [key]: value }
    setReminderPrefs(updatedPrefs)
    setSavingReminders(true)

    try {
      const res = await fetch('/api/reminders/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      })

      if (!res.ok) {
        // Revert on error
        setReminderPrefs(reminderPrefs)
      }
    } catch (err) {
      console.error('Failed to update reminder preferences:', err)
      setReminderPrefs(reminderPrefs)
    } finally {
      setSavingReminders(false)
    }
  }

  if (loading) {
    return (
      <div style={{ paddingTop: '24px' }}>
        <div className="skeleton" style={{ height: '28px', width: '100px', marginBottom: '32px' }} />
        <div className="skeleton" style={{ height: '18px', width: '60px', marginBottom: '8px' }} />
        <div className="skeleton" style={{ height: '48px', width: '100%', marginBottom: '20px' }} />
        <div className="skeleton" style={{ height: '18px', width: '40px', marginBottom: '8px' }} />
        <div className="skeleton" style={{ height: '48px', width: '100%', marginBottom: '20px' }} />
        <div className="skeleton" style={{ height: '18px', width: '70px', marginBottom: '8px' }} />
        <div className="skeleton" style={{ height: '48px', width: '100%' }} />
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    fontSize: 'var(--text-body)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--color-bg)',
    color: 'var(--color-text-primary)',
    outline: 'none',
    transition: 'border-color 0.15s',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 'var(--text-caption)',
    fontWeight: 500,
    color: 'var(--color-text-secondary)',
    marginBottom: '6px',
  }

  const sectionStyle: React.CSSProperties = {
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    padding: '20px',
    marginBottom: '16px',
  }

  return (
    <div style={{ paddingTop: '20px', paddingBottom: '24px' }}>
      <h1 style={{
        fontSize: 'var(--text-heading)',
        fontWeight: 'var(--font-heading)',
        color: 'var(--color-text-primary)',
        marginBottom: '24px',
      }}>
        Settings
      </h1>

      {/* Profile Section */}
      <div style={sectionStyle}>
        <h2 style={{
          fontSize: 'var(--text-body)',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          marginBottom: '16px',
        }}>
          Profile
        </h2>

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="displayName" style={labelStyle}>Display Name</label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            maxLength={100}
            style={inputStyle}
            onFocus={(e) => e.target.style.borderColor = 'var(--color-accent)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="email" style={labelStyle}>Email</label>
          <input
            id="email"
            type="email"
            value={email}
            readOnly
            style={{
              ...inputStyle,
              background: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
              cursor: 'not-allowed',
            }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="timezone" style={labelStyle}>Timezone</label>
          <select
            id="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            style={{
              ...inputStyle,
              cursor: 'pointer',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%236B7280' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 14px center',
              paddingRight: '40px',
            }}
          >
            {COMMON_TIMEZONES.map(tz => (
              <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 24px',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-accent)',
            color: '#fff',
            fontSize: 'var(--text-caption)',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
            transition: 'background 0.15s, opacity 0.15s',
            minHeight: '44px',
          }}
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>

        {saveMessage && (
          <div style={{
            marginTop: '12px',
            padding: '10px 14px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 'var(--text-caption)',
            background: saveMessage.type === 'success' ? 'var(--color-success-light)' : 'var(--color-danger-light)',
            color: saveMessage.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
          }}>
            {saveMessage.text}
          </div>
        )}
      </div>

      {/* Categories Section */}
      <div style={sectionStyle}>
        <h2 style={{
          fontSize: 'var(--text-body)',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          marginBottom: '8px',
        }}>
          Categories
        </h2>
        <p style={{
          fontSize: 'var(--text-caption)',
          color: 'var(--color-text-tertiary)',
          marginBottom: '16px',
        }}>
          Organize your tasks with custom categories. AI will auto-categorize new tasks.
        </p>

        <CategoryManager
          categories={categories}
          onUpdate={handleCategoryUpdate}
          onCreate={handleCategoryCreate}
          onDelete={handleCategoryDelete}
        />
      </div>

      {/* Priorities Section */}
      <div style={sectionStyle}>
        <h2 style={{
          fontSize: 'var(--text-body)',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          marginBottom: '8px',
        }}>
          Life Priorities
        </h2>
        <p style={{
          fontSize: 'var(--text-caption)',
          color: 'var(--color-text-tertiary)',
          marginBottom: '16px',
        }}>
          Rank what matters most to you. Helps us suggest tasks and track balance.
        </p>

        <button
          onClick={() => router.push('/priorities')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '12px 14px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--text-body)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>🎯</span>
            Set Priorities
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Templates Section */}
      <div style={sectionStyle}>
        <h2 style={{
          fontSize: 'var(--text-body)',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          marginBottom: '8px',
        }}>
          Templates
        </h2>
        <p style={{
          fontSize: 'var(--text-caption)',
          color: 'var(--color-text-tertiary)',
          marginBottom: '16px',
        }}>
          Create reusable templates for tasks you repeat often.
        </p>

        <button
          onClick={() => router.push('/templates')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '12px 14px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-bg)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--text-body)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            Manage Templates
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Reminders Section */}
      {reminderPrefs && (
        <div style={sectionStyle}>
          <h2 style={{
            fontSize: 'var(--text-body)',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            marginBottom: '8px',
          }}>
            Reminders
          </h2>
          <p style={{
            fontSize: 'var(--text-caption)',
            color: 'var(--color-text-tertiary)',
            marginBottom: '16px',
          }}>
            Configure how and when you receive task reminders.
          </p>

          {/* Enable reminders toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0',
            borderBottom: '1px solid var(--color-border)',
          }}>
            <div>
              <div style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                Enable reminders
              </div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}>
                Get notified about upcoming and overdue tasks
              </div>
            </div>
            <button
              onClick={() => handleReminderPrefChange('reminders_enabled', !reminderPrefs.reminders_enabled)}
              disabled={savingReminders}
              style={{
                width: '48px',
                height: '28px',
                borderRadius: '14px',
                border: 'none',
                background: reminderPrefs.reminders_enabled ? 'var(--color-accent)' : 'var(--color-border)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.2s',
              }}
            >
              <span style={{
                position: 'absolute',
                top: '2px',
                left: reminderPrefs.reminders_enabled ? '22px' : '2px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>

          {/* Quiet hours */}
          <div style={{
            padding: '12px 0',
            borderBottom: '1px solid var(--color-border)',
          }}>
            <div style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-primary)', fontWeight: 500, marginBottom: '4px' }}>
              Quiet hours
            </div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-tertiary)', marginBottom: '12px' }}>
              No reminders during these hours
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="time"
                value={reminderPrefs.quiet_hours_start}
                onChange={(e) => handleReminderPrefChange('quiet_hours_start', e.target.value)}
                style={{
                  ...inputStyle,
                  width: 'auto',
                  padding: '8px 12px',
                }}
              />
              <span style={{ color: 'var(--color-text-tertiary)' }}>to</span>
              <input
                type="time"
                value={reminderPrefs.quiet_hours_end}
                onChange={(e) => handleReminderPrefChange('quiet_hours_end', e.target.value)}
                style={{
                  ...inputStyle,
                  width: 'auto',
                  padding: '8px 12px',
                }}
              />
            </div>
          </div>

          {/* Max reminders per day */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0',
            borderBottom: '1px solid var(--color-border)',
          }}>
            <div>
              <div style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                Max reminders per day
              </div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}>
                Limit cognitive overload
              </div>
            </div>
            <select
              value={reminderPrefs.max_reminders_per_day}
              onChange={(e) => handleReminderPrefChange('max_reminders_per_day', parseInt(e.target.value))}
              style={{
                ...inputStyle,
                width: 'auto',
                padding: '8px 32px 8px 12px',
              }}
            >
              {[1, 2, 3, 5, 7, 10, 15].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          {/* Lead time */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0',
            borderBottom: '1px solid var(--color-border)',
          }}>
            <div>
              <div style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                Remind me before
              </div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}>
                How early to remind before task due time
              </div>
            </div>
            <select
              value={reminderPrefs.reminder_lead_time_minutes}
              onChange={(e) => handleReminderPrefChange('reminder_lead_time_minutes', parseInt(e.target.value))}
              style={{
                ...inputStyle,
                width: 'auto',
                padding: '8px 32px 8px 12px',
              }}
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={60}>1 hour</option>
              <option value={120}>2 hours</option>
            </select>
          </div>

          {/* Weekend reminders toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0',
            borderBottom: '1px solid var(--color-border)',
          }}>
            <div>
              <div style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                Weekend reminders
              </div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}>
                Allow reminders on Saturday and Sunday
              </div>
            </div>
            <button
              onClick={() => handleReminderPrefChange('weekend_reminders', !reminderPrefs.weekend_reminders)}
              disabled={savingReminders}
              style={{
                width: '48px',
                height: '28px',
                borderRadius: '14px',
                border: 'none',
                background: reminderPrefs.weekend_reminders ? 'var(--color-accent)' : 'var(--color-border)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.2s',
              }}
            >
              <span style={{
                position: 'absolute',
                top: '2px',
                left: reminderPrefs.weekend_reminders ? '22px' : '2px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>

          {/* High priority override toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0',
          }}>
            <div>
              <div style={{ fontSize: 'var(--text-body)', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                Urgent task override
              </div>
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-tertiary)' }}>
                Important tasks can break quiet hours (not sleep time)
              </div>
            </div>
            <button
              onClick={() => handleReminderPrefChange('high_priority_override', !reminderPrefs.high_priority_override)}
              disabled={savingReminders}
              style={{
                width: '48px',
                height: '28px',
                borderRadius: '14px',
                border: 'none',
                background: reminderPrefs.high_priority_override ? 'var(--color-accent)' : 'var(--color-border)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.2s',
              }}
            >
              <span style={{
                position: 'absolute',
                top: '2px',
                left: reminderPrefs.high_priority_override ? '22px' : '2px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>
        </div>
      )}

      {/* Account Section */}
      <div style={sectionStyle}>
        <h2 style={{
          fontSize: 'var(--text-body)',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          marginBottom: '16px',
        }}>
          Account
        </h2>

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          style={{
            padding: '10px 24px',
            border: '1px solid var(--color-danger)',
            borderRadius: 'var(--radius-md)',
            background: 'transparent',
            color: 'var(--color-danger)',
            fontSize: 'var(--text-caption)',
            fontWeight: 600,
            cursor: signingOut ? 'not-allowed' : 'pointer',
            opacity: signingOut ? 0.6 : 1,
            transition: 'background 0.15s, opacity 0.15s',
            minHeight: '44px',
          }}
        >
          {signingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </div>

      {/* About Section */}
      <div style={sectionStyle}>
        <h2 style={{
          fontSize: 'var(--text-body)',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          marginBottom: '12px',
        }}>
          About
        </h2>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          fontSize: 'var(--text-caption)',
          color: 'var(--color-text-secondary)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Version</span>
            <span style={{ color: 'var(--color-text-tertiary)' }}>2.0.0</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Built for</span>
            <span style={{ color: 'var(--color-text-tertiary)' }}>ADHD brains</span>
          </div>
        </div>

        <p style={{
          marginTop: '16px',
          fontSize: 'var(--text-small)',
          color: 'var(--color-text-tertiary)',
          lineHeight: 1.6,
        }}>
          Brain dump. Get tasks. Check them off. That&apos;s it.
        </p>
      </div>
    </div>
  )
}
