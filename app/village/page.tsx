'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { usePresenceWithFallback } from '@/hooks/usePresence'
import UnifiedHeader from '@/components/UnifiedHeader'
import FABToolbox from '@/components/FABToolbox'

interface ContactLog {
  id: string
  date: string
  type: string
  note?: string
}

interface Contact {
  id: string
  name: string
  relationship: string | null
  phone: string | null
  email: string | null
  support_type: string[]
  is_favorite: boolean
  contact_log: ContactLog[]
}

const supportTypes = [
  { key: 'emotional', label: 'Emotional', icon: '💜' },
  { key: 'task', label: 'Task help', icon: '🤝' },
  { key: 'info', label: 'Advice', icon: '💡' },
  { key: 'fun', label: 'Fun', icon: '🎉' },
  { key: 'emergency', label: 'Emergency', icon: '🚨' },
]

const contactTypes = [
  { key: 'short_call', label: 'Short Call', icon: '📞' },
  { key: 'long_call', label: 'Long Call', icon: '📱' },
  { key: 'in_person', label: 'In Person', icon: '🤝' },
  { key: 'text_message', label: 'Text/Message', icon: '💬' },
  { key: 'video_call', label: 'Video Call', icon: '🎥' },
]

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 14) return '1 week ago'
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 60) return '1 month ago'
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return 'Over a year ago'
}

function getStalenessInfo(log: ContactLog[]): { color: string; label: string; className: string; daysSince: number } {
  if (!log || log.length === 0) {
    return { color: '#8899a6', label: 'No contact logged', className: 'stale-never', daysSince: Infinity }
  }

  const sorted = [...log].sort((a, b) => b.date.localeCompare(a.date))
  const latest = sorted[0]
  const date = new Date(latest.date + 'T00:00:00')
  const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))

  const typeInfo = contactTypes.find(t => t.key === latest.type)
  const typeLabel = typeInfo ? `${typeInfo.icon} ${typeInfo.label}` : latest.type

  if (diffDays <= 14) {
    return { color: '#00ba7c', label: `${getRelativeTime(latest.date)} · ${typeLabel}`, className: 'stale-fresh', daysSince: diffDays }
  }
  if (diffDays <= 30) {
    return { color: '#eab308', label: `${getRelativeTime(latest.date)} · ${typeLabel}`, className: 'stale-warm', daysSince: diffDays }
  }
  return { color: '#f4212e', label: `${getRelativeTime(latest.date)} · ${typeLabel}`, className: 'stale-cold', daysSince: diffDays }
}

export default function VillagePage() {
  const supabase = createClient()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [filterType, setFilterType] = useState<string | null>(null)

  // Real-time presence from usePresence hook
  const { 
    onlineCount, 
    focusingCount, 
    otherUsers, 
    isConnected,
    isSimulated 
  } = usePresenceWithFallback({ isFocusing: false })

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [supports, setSupports] = useState<string[]>([])

  // Contact log state
  const [loggingContactId, setLoggingContactId] = useState<string | null>(null)
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0])
  const [logType, setLogType] = useState<string | null>(null)
  const [logNote, setLogNote] = useState('')
  const [showHistoryId, setShowHistoryId] = useState<string | null>(null)
  const [logSaving, setLogSaving] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)
      await fetchContacts(session.user.id)
      setLoading(false)
    }
    init()
  }, [router])

  const fetchContacts = async (userId: string) => {
    const { data } = await supabase
      .from('village_contacts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('is_favorite', { ascending: false })
      .order('name')

    if (data) setContacts(data.map(c => ({ ...c, support_type: c.support_type || [], contact_log: c.contact_log || [] })))
  }

  const toggleSupport = (key: string) => {
    setSupports(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    )
  }

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setRelationship('')
    setPhone('')
    setEmail('')
    setSupports([])
  }

  const handleAdd = async () => {
    if (!user || !name.trim()) return
    setSaving(true)

    await supabase.from('village_contacts').insert({
      user_id: user.id,
      name,
      relationship: relationship || null,
      phone: phone || null,
      email: email || null,
      support_type: supports,
      is_favorite: false,
      is_archived: false
    })

    resetForm()
    setView('list')
    if (user) await fetchContacts(user.id)
    setSaving(false)
  }

  const handleEdit = (contact: Contact) => {
    setEditingId(contact.id)
    setName(contact.name)
    setRelationship(contact.relationship || '')
    setPhone(contact.phone || '')
    setEmail(contact.email || '')
    setSupports(contact.support_type || [])
    setView('edit')
  }

  const handleUpdate = async () => {
    if (!user || !editingId || !name.trim()) return
    setSaving(true)

    await supabase
      .from('village_contacts')
      .update({
        name,
        relationship: relationship || null,
        phone: phone || null,
        email: email || null,
        support_type: supports,
      })
      .eq('id', editingId)
      .eq('user_id', user.id)

    resetForm()
    setView('list')
    if (user) await fetchContacts(user.id)
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!user) return
    if (!confirm('Are you sure you want to remove this contact?')) return

    await supabase
      .from('village_contacts')
      .update({ is_archived: true })
      .eq('id', id)
      .eq('user_id', user.id)

    await fetchContacts(user.id)
  }

  const toggleFavorite = async (id: string, current: boolean) => {
    if (!user) return
    await supabase.from('village_contacts').update({ is_favorite: !current }).eq('id', id).eq('user_id', user.id)
    await fetchContacts(user.id)
  }

  const resetLogForm = () => {
    setLoggingContactId(null)
    setLogDate(new Date().toISOString().split('T')[0])
    setLogType(null)
    setLogNote('')
  }

  const startLogging = (contactId: string) => {
    setLoggingContactId(contactId)
    setLogDate(new Date().toISOString().split('T')[0])
    setLogType(null)
    setLogNote('')
  }

  const handleLogContact = async (contactId: string) => {
    if (!user || !logType) return
    setLogSaving(true)

    const contact = contacts.find(c => c.id === contactId)
    if (!contact) return

    const newEntry: ContactLog = {
      id: `log_${Date.now()}`,
      date: logDate,
      type: logType,
      ...(logNote.trim() ? { note: logNote.trim() } : {}),
    }

    const updatedLog = [...(contact.contact_log || []), newEntry]

    await supabase
      .from('village_contacts')
      .update({ contact_log: updatedLog })
      .eq('id', contactId)
      .eq('user_id', user.id)

    resetLogForm()
    setLogSaving(false)
    await fetchContacts(user.id)
  }

  const deleteLogEntry = async (contactId: string, logId: string) => {
    if (!user) return
    const contact = contacts.find(c => c.id === contactId)
    if (!contact) return

    const updatedLog = contact.contact_log.filter(l => l.id !== logId)

    await supabase
      .from('village_contacts')
      .update({ contact_log: updatedLog })
      .eq('id', contactId)
      .eq('user_id', user.id)

    await fetchContacts(user.id)
  }

  const getContactsForType = (type: string) => {
    return contacts.filter(c => c.support_type?.includes(type))
  }

  const sortedContacts = [...contacts].sort((a, b) => {
    // Favorites first
    if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1
    // Then by staleness (most overdue first)
    const aStale = getStalenessInfo(a.contact_log).daysSince
    const bStale = getStalenessInfo(b.contact_log).daysSince
    if (aStale !== bStale) return bStale - aStale
    // Then alphabetical
    return a.name.localeCompare(b.name)
  })

  const filteredContacts = filterType
    ? sortedContacts.filter(c => c.support_type?.includes(filterType))
    : sortedContacts

  if (loading) {
    return (
      <div className="village-page">
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading your village...</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    )
  }

  return (
    <div className="village-page">
      <UnifiedHeader subtitle="Your support village" />

      <main className="main">
        {/* Page Title */}
        <div className="page-header-title">
          <h1>👥 My Village</h1>
        </div>

        {/* ===== LIVE VILLAGE CARD ===== */}
        <div className="live-village-card">
          <div className="radar-container">
            <div className="radar-ring ring-1"></div>
            <div className="radar-ring ring-2"></div>
            <div className="radar-ring ring-3"></div>
            <div className="radar-center">{isConnected ? '🌍' : '📡'}</div>
          </div>
          <div className="live-stats">
            <div className="stat-row primary">
              <span className="stat-number">{onlineCount}</span>
              <span className="stat-label">Villagers online right now</span>
            </div>
            <div className="stat-row secondary">
              <span className="stat-icon">⏱️</span>
              <span className="stat-number small">{focusingCount}</span>
              <span className="stat-label">currently in Focus Mode</span>
            </div>
          </div>
          <p className="village-message">
            {isSimulated 
              ? "You're not alone. We're all working through it together."
              : isConnected 
                ? "🟢 Live connection — real ADHDers, right now!"
                : "Connecting to the village..."
            }
          </p>
        </div>

        {/* ===== BODY DOUBLES GRID ===== */}
        <div className="body-doubles-section">
          <div className="section-header-row">
            <h2 className="section-title">🐾 Body Doubles Online</h2>
            <span className="section-badge">{isSimulated ? 'Simulated' : 'Live'}</span>
          </div>
          <p className="section-desc">Fellow ADHDers in the village right now. You're never alone.</p>
          
          <div className="avatars-grid">
            {otherUsers.slice(0, 24).map((user) => (
              <div 
                key={user.id} 
                className={`avatar-bubble ${user.is_focusing ? 'focusing' : ''}`}
                title={user.is_focusing ? 'Currently focusing' : 'Online'}
              >
                <span className="avatar-emoji">{user.spirit_animal || '🐾'}</span>
                {user.is_focusing && <span className="focus-indicator">⏱️</span>}
              </div>
            ))}
            {otherUsers.length > 24 && (
              <div className="avatar-bubble more">
                <span className="more-count">+{otherUsers.length - 24}</span>
              </div>
            )}
          </div>
        </div>

        {/* ===== MY TRIBE SECTION ===== */}
        <div className="tribe-section">
          <div className="section-header-row">
            <h2 className="section-title">💜 My Tribe</h2>
            <button 
              onClick={() => { resetForm(); setView('create') }} 
              className="add-btn"
            >
              + Add
            </button>
          </div>
          <p className="section-desc">Your personal support network — the people who help you thrive.</p>
        </div>

        {/* List View */}
        {view === 'list' && (
          <>
            {/* Filter Pills */}
            {contacts.length > 0 && (
              <div className="filter-row">
                <button
                  onClick={() => setFilterType(null)}
                  className={`filter-pill ${filterType === null ? 'active' : ''}`}
                >
                  All ({contacts.length})
                </button>
                {supportTypes.map(type => {
                  const count = getContactsForType(type.key).length
                  if (count === 0) return null
                  return (
                    <button
                      key={type.key}
                      onClick={() => setFilterType(type.key)}
                      className={`filter-pill ${filterType === type.key ? 'active' : ''}`}
                    >
                      {type.icon} {type.label} ({count})
                    </button>
                  )
                })}
              </div>
            )}

            {/* Contacts List */}
            {filteredContacts.length === 0 ? (
              <div className="card empty-state">
                <span className="empty-emoji">👥</span>
                <p className="empty-title">
                  {filterType ? 'No contacts for this type' : 'No contacts yet'}
                </p>
                <p className="empty-subtitle">Add the people who support you</p>
                <button 
                  onClick={() => { resetForm(); setView('create') }} 
                  className="btn-primary compact"
                >
                  + Add Someone
                </button>
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const staleness = getStalenessInfo(contact.contact_log)
                const isLogging = loggingContactId === contact.id
                const isShowingHistory = showHistoryId === contact.id
                const sortedLog = [...(contact.contact_log || [])].sort((a, b) => b.date.localeCompare(a.date))

                return (
                  <div key={contact.id} className="support-card">
                    <div className="support-card-header">
                      {/* Avatar */}
                      <div className="contact-avatar">
                        {contact.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="contact-main">
                        <div className="name-row">
                          <span className="contact-name">{contact.name}</span>
                          <button
                            onClick={() => toggleFavorite(contact.id, contact.is_favorite)}
                            className="fav-btn"
                          >
                            {contact.is_favorite ? '⭐' : '☆'}
                          </button>
                        </div>
                        {contact.relationship && (
                          <p className="contact-relationship">{contact.relationship}</p>
                        )}
                      </div>
                    </div>

                    {/* Staleness Indicator */}
                    <div className={`staleness-row ${staleness.className}`}>
                      <span className="staleness-dot" style={{ background: staleness.color }} />
                      <span className="staleness-label">{staleness.label}</span>
                      {sortedLog.length > 0 && (
                        <button
                          className="history-toggle"
                          onClick={() => setShowHistoryId(isShowingHistory ? null : contact.id)}
                        >
                          {isShowingHistory ? 'Hide' : `${sortedLog.length} log${sortedLog.length !== 1 ? 's' : ''}`}
                        </button>
                      )}
                    </div>

                    {/* Contact History */}
                    {isShowingHistory && sortedLog.length > 0 && (
                      <div className="contact-history">
                        {sortedLog.map((entry) => {
                          const typeInfo = contactTypes.find(t => t.key === entry.type)
                          return (
                            <div key={entry.id} className="history-entry">
                              <span className="history-icon">{typeInfo?.icon || '📋'}</span>
                              <div className="history-info">
                                <span className="history-type">{typeInfo?.label || entry.type}</span>
                                <span className="history-date">{getRelativeTime(entry.date)}</span>
                                {entry.note && <span className="history-note">{entry.note}</span>}
                              </div>
                              <button
                                className="history-delete"
                                onClick={() => deleteLogEntry(contact.id, entry.id)}
                                title="Remove entry"
                              >
                                ×
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Support Types */}
                    {contact.support_type && contact.support_type.length > 0 && (
                      <div className="support-tags">
                        {contact.support_type.map(type => {
                          const st = supportTypes.find(s => s.key === type)
                          if (!st) return null
                          return (
                            <span key={type} className="support-tag">
                              {st.icon} {st.label}
                            </span>
                          )
                        })}
                      </div>
                    )}

                    {/* Inline Log Form */}
                    {isLogging && (
                      <div className="log-form">
                        <div className="log-form-header">
                          <span className="log-form-title">Log contact</span>
                          <button className="log-form-close" onClick={resetLogForm}>×</button>
                        </div>
                        <div className="log-form-group">
                          <label className="log-form-label">Date</label>
                          <input
                            type="date"
                            value={logDate}
                            onChange={(e) => setLogDate(e.target.value)}
                            className="log-date-input"
                            max={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                        <div className="log-form-group">
                          <label className="log-form-label">Type</label>
                          <div className="log-type-chips">
                            {contactTypes.map((ct) => (
                              <button
                                key={ct.key}
                                className={`log-type-chip ${logType === ct.key ? 'selected' : ''}`}
                                onClick={() => setLogType(ct.key)}
                                type="button"
                              >
                                {ct.icon} {ct.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="log-form-group">
                          <label className="log-form-label">Note (optional)</label>
                          <input
                            type="text"
                            value={logNote}
                            onChange={(e) => setLogNote(e.target.value)}
                            placeholder="How did it go?"
                            className="log-note-input"
                            maxLength={200}
                          />
                        </div>
                        <div className="log-form-actions">
                          <button className="btn-secondary compact" onClick={resetLogForm}>Cancel</button>
                          <button
                            className="btn-primary compact"
                            disabled={!logType || logSaving}
                            onClick={() => handleLogContact(contact.id)}
                          >
                            {logSaving ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="quick-actions">
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="quick-action-btn call">
                          📞 Call
                        </a>
                      )}
                      {contact.phone && (
                        <a href={`sms:${contact.phone}`} className="quick-action-btn text">
                          💬 Text
                        </a>
                      )}
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="quick-action-btn email">
                          ✉️ Email
                        </a>
                      )}
                      <button
                        onClick={() => isLogging ? resetLogForm() : startLogging(contact.id)}
                        className={`quick-action-btn log ${isLogging ? 'active' : ''}`}
                      >
                        📋 Log
                      </button>
                      <button onClick={() => handleEdit(contact)} className="quick-action-btn edit">
                        ✏️
                      </button>
                      <button onClick={() => handleDelete(contact.id)} className="quick-action-btn delete">
                        🗑️
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}

        {/* Create/Edit View */}
        {(view === 'create' || view === 'edit') && (
          <div className="card form-card">
            <div className="form-header">
              <h2 className="form-title">
                {view === 'edit' ? '✏️ Edit Contact' : '➕ Add to Tribe'}
              </h2>
              <button onClick={() => { resetForm(); setView('list') }} className="close-btn">×</button>
            </div>

            {/* Name */}
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Their name"
                className="form-input"
              />
            </div>

            {/* Relationship */}
            <div className="form-group">
              <label className="form-label">Relationship</label>
              <input
                type="text"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder="e.g., Friend, Sister, Therapist"
                className="form-input"
              />
            </div>

            {/* Phone */}
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                className="form-input"
              />
            </div>

            {/* Email */}
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="form-input"
              />
            </div>

            {/* Support Types */}
            <div className="form-group">
              <label className="form-label">How do they support you?</label>
              <div className="support-options">
                {supportTypes.map(type => (
                  <button
                    key={type.key}
                    onClick={() => toggleSupport(type.key)}
                    className={`support-option ${supports.includes(type.key) ? 'active' : ''}`}
                  >
                    {type.icon} {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="form-buttons">
              <button onClick={() => { resetForm(); setView('list') }} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={view === 'edit' ? handleUpdate : handleAdd}
                disabled={!name.trim() || saving}
                className="btn-primary"
              >
                {saving ? 'Saving...' : view === 'edit' ? 'Save Changes' : 'Add Contact'}
              </button>
            </div>
          </div>
        )}

        {/* ADHD Tip */}
        <div className="card tip-card">
          <div className="tip-label">💡 ADHD & Body Doubling</div>
          <p className="tip-text">
            Body doubling works! Just knowing others are working alongside you — even virtually — 
            can help with focus and motivation. That's why we show who's online.
          </p>
        </div>
      </main>

      <FABToolbox mode="maintenance" />

      <style jsx>{styles}</style>
    </div>
  )
}

// ============================================
// RESPONSIVE STYLES
// ============================================
const styles = `
  .village-page {
    --primary: #1D9BF0;
    --success: #00ba7c;
    --danger: #f4212e;
    --bg-gray: #f7f9fa;
    --dark-gray: #536471;
    --light-gray: #8899a6;
    --extra-light-gray: #eff3f4;

    background: var(--bg-gray);
    min-height: 100vh;
    min-height: 100dvh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  /* ===== LOADING ===== */
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    min-height: 100dvh;
    color: var(--light-gray);
  }

  .spinner {
    width: clamp(24px, 5vw, 32px);
    height: clamp(24px, 5vw, 32px);
    border: 3px solid var(--success);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 12px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ===== MAIN CONTENT ===== */
  .main {
    padding: clamp(12px, 4vw, 20px);
    padding-bottom: clamp(16px, 4vw, 24px);
    max-width: 600px;
    margin: 0 auto;
  }

  .page-header-title {
    margin-bottom: clamp(14px, 4vw, 20px);
  }

  .page-header-title h1 {
    font-size: clamp(22px, 6vw, 28px);
    font-weight: 700;
    margin: 0;
  }

  /* ===== LIVE VILLAGE CARD ===== */
  .live-village-card {
    background: linear-gradient(135deg, rgba(0, 186, 124, 0.08) 0%, rgba(0, 186, 124, 0.15) 100%);
    border: 1px solid rgba(0, 186, 124, 0.2);
    border-radius: clamp(16px, 4.5vw, 24px);
    padding: clamp(20px, 5.5vw, 32px);
    margin-bottom: clamp(16px, 4.5vw, 24px);
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  .radar-container {
    position: relative;
    width: clamp(80px, 22vw, 100px);
    height: clamp(80px, 22vw, 100px);
    margin: 0 auto clamp(16px, 4vw, 24px);
  }

  .radar-ring {
    position: absolute;
    border: 2px solid rgba(0, 186, 124, 0.3);
    border-radius: 50%;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .ring-1 {
    width: 100%;
    height: 100%;
    animation: radarPulse 2s ease-out infinite;
  }

  .ring-2 {
    width: 70%;
    height: 70%;
    animation: radarPulse 2s ease-out infinite 0.5s;
  }

  .ring-3 {
    width: 40%;
    height: 40%;
    animation: radarPulse 2s ease-out infinite 1s;
  }

  @keyframes radarPulse {
    0% {
      transform: translate(-50%, -50%) scale(0.8);
      opacity: 0.8;
    }
    100% {
      transform: translate(-50%, -50%) scale(1.4);
      opacity: 0;
    }
  }

  .radar-center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: clamp(28px, 8vw, 36px);
  }

  .live-stats {
    margin-bottom: clamp(10px, 3vw, 16px);
  }

  .stat-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(6px, 2vw, 10px);
  }

  .stat-row.primary {
    margin-bottom: clamp(6px, 2vw, 10px);
  }

  .stat-row.secondary {
    opacity: 0.8;
  }

  .stat-number {
    font-size: clamp(32px, 9vw, 44px);
    font-weight: 800;
    color: var(--success);
  }

  .stat-number.small {
    font-size: clamp(20px, 5.5vw, 26px);
  }

  .stat-icon {
    font-size: clamp(16px, 4.5vw, 20px);
  }

  .stat-label {
    font-size: clamp(14px, 3.8vw, 16px);
    color: var(--dark-gray);
    font-weight: 500;
  }

  .village-message {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--light-gray);
    margin: 0;
    font-style: italic;
  }

  /* ===== BODY DOUBLES SECTION ===== */
  .body-doubles-section {
    background: white;
    border-radius: clamp(14px, 4vw, 20px);
    padding: clamp(16px, 4.5vw, 24px);
    margin-bottom: clamp(16px, 4.5vw, 24px);
  }

  .section-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: clamp(4px, 1.2vw, 8px);
  }

  .section-title {
    font-size: clamp(16px, 4.5vw, 20px);
    font-weight: 700;
    margin: 0;
  }

  .section-badge {
    font-size: clamp(10px, 2.8vw, 12px);
    padding: clamp(3px, 1vw, 5px) clamp(8px, 2.2vw, 12px);
    background: var(--extra-light-gray);
    color: var(--light-gray);
    border-radius: 100px;
    font-weight: 500;
  }

  .section-desc {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--light-gray);
    margin: 0 0 clamp(14px, 4vw, 20px) 0;
  }

  .avatars-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(clamp(40px, 11vw, 52px), 1fr));
    gap: clamp(8px, 2.2vw, 12px);
  }

  .avatar-bubble {
    width: clamp(40px, 11vw, 52px);
    height: clamp(40px, 11vw, 52px);
    border-radius: 50%;
    background: var(--bg-gray);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    transition: transform 0.15s ease;
  }

  .avatar-bubble:hover {
    transform: scale(1.1);
  }

  .avatar-bubble.focusing {
    background: rgba(29, 155, 240, 0.1);
    border: 2px solid var(--primary);
  }

  .avatar-emoji {
    font-size: clamp(20px, 5.5vw, 26px);
  }

  .focus-indicator {
    position: absolute;
    bottom: -2px;
    right: -2px;
    font-size: clamp(10px, 2.8vw, 12px);
    background: white;
    border-radius: 50%;
    padding: 2px;
  }

  .avatar-bubble.more {
    background: var(--extra-light-gray);
  }

  .more-count {
    font-size: clamp(12px, 3.2vw, 14px);
    font-weight: 600;
    color: var(--light-gray);
  }

  /* ===== TRIBE SECTION ===== */
  .tribe-section {
    margin-bottom: clamp(12px, 3.5vw, 18px);
  }

  .add-btn {
    padding: clamp(6px, 1.8vw, 10px) clamp(12px, 3.5vw, 18px);
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 100px;
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 600;
    cursor: pointer;
  }

  /* ===== CARDS ===== */
  .card {
    background: white;
    border-radius: clamp(14px, 4vw, 20px);
    padding: clamp(16px, 4.5vw, 24px);
    margin-bottom: clamp(12px, 3.5vw, 18px);
  }

  /* ===== SUPPORT CARDS ===== */
  .support-card {
    background: white;
    border-radius: clamp(14px, 4vw, 20px);
    padding: clamp(16px, 4.5vw, 24px);
    margin-bottom: clamp(12px, 3.5vw, 18px);
    border: 1px solid var(--extra-light-gray);
  }

  .support-card-header {
    display: flex;
    align-items: flex-start;
    gap: clamp(10px, 3vw, 14px);
    margin-bottom: clamp(10px, 3vw, 14px);
  }

  .contact-avatar {
    width: clamp(44px, 12vw, 56px);
    height: clamp(44px, 12vw, 56px);
    border-radius: 50%;
    background: linear-gradient(135deg, var(--primary) 0%, #805ad5 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: clamp(18px, 5vw, 24px);
    font-weight: 700;
    flex-shrink: 0;
  }

  .contact-main {
    flex: 1;
    min-width: 0;
  }

  .name-row {
    display: flex;
    align-items: center;
    gap: clamp(6px, 2vw, 10px);
    margin-bottom: clamp(2px, 1vw, 4px);
  }

  .contact-name {
    font-size: clamp(16px, 4.5vw, 20px);
    font-weight: 700;
  }

  .fav-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: clamp(16px, 4.5vw, 20px);
    padding: 0;
    line-height: 1;
  }

  .contact-relationship {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--light-gray);
    margin: 0;
  }

  .support-tags {
    display: flex;
    flex-wrap: wrap;
    gap: clamp(6px, 1.8vw, 10px);
    margin-bottom: clamp(12px, 3.5vw, 16px);
  }

  .support-tag {
    font-size: clamp(11px, 3vw, 13px);
    padding: clamp(4px, 1.2vw, 6px) clamp(10px, 2.8vw, 14px);
    border-radius: 100px;
    background: var(--bg-gray);
    color: var(--dark-gray);
  }

  .quick-actions {
    display: flex;
    flex-wrap: wrap;
    gap: clamp(8px, 2.2vw, 12px);
  }

  .quick-action-btn {
    display: inline-flex;
    align-items: center;
    gap: clamp(4px, 1.2vw, 6px);
    padding: clamp(8px, 2.2vw, 12px) clamp(14px, 3.8vw, 20px);
    border-radius: 100px;
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .quick-action-btn.call {
    background: rgba(0, 186, 124, 0.1);
    border: 1px solid rgba(0, 186, 124, 0.3);
    color: var(--success);
  }

  .quick-action-btn.text {
    background: rgba(29, 155, 240, 0.1);
    border: 1px solid rgba(29, 155, 240, 0.3);
    color: var(--primary);
  }

  .quick-action-btn.email {
    background: rgba(128, 90, 213, 0.1);
    border: 1px solid rgba(128, 90, 213, 0.3);
    color: #805ad5;
  }

  .quick-action-btn.edit {
    background: var(--bg-gray);
    border: 1px solid var(--extra-light-gray);
    color: var(--dark-gray);
    padding: clamp(8px, 2.2vw, 12px);
  }

  .quick-action-btn.delete {
    background: rgba(244, 33, 46, 0.05);
    border: 1px solid rgba(244, 33, 46, 0.2);
    color: var(--danger);
    padding: clamp(8px, 2.2vw, 12px);
  }

  .quick-action-btn.log {
    background: rgba(234, 179, 8, 0.1);
    border: 1px solid rgba(234, 179, 8, 0.3);
    color: #b45309;
  }

  .quick-action-btn.log.active {
    background: rgba(234, 179, 8, 0.2);
    border-color: #eab308;
  }

  /* ===== STALENESS INDICATOR ===== */
  .staleness-row {
    display: flex;
    align-items: center;
    gap: clamp(6px, 1.8vw, 10px);
    margin-bottom: clamp(10px, 3vw, 14px);
    padding: clamp(6px, 1.8vw, 10px) clamp(10px, 2.8vw, 14px);
    border-radius: clamp(8px, 2vw, 12px);
    background: var(--bg-gray);
    font-size: clamp(12px, 3.2vw, 14px);
  }

  .staleness-dot {
    width: clamp(8px, 2.2vw, 10px);
    height: clamp(8px, 2.2vw, 10px);
    border-radius: 50%;
    flex-shrink: 0;
  }

  .stale-fresh .staleness-dot { box-shadow: 0 0 0 3px rgba(0, 186, 124, 0.2); }
  .stale-warm .staleness-dot { box-shadow: 0 0 0 3px rgba(234, 179, 8, 0.2); }
  .stale-cold .staleness-dot { box-shadow: 0 0 0 3px rgba(244, 33, 46, 0.2); animation: pulseDot 2s ease-in-out infinite; }
  .stale-never .staleness-dot { box-shadow: 0 0 0 3px rgba(136, 153, 166, 0.2); }

  @keyframes pulseDot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .staleness-label {
    flex: 1;
    color: var(--dark-gray);
    font-weight: 500;
  }

  .stale-never .staleness-label {
    color: var(--light-gray);
    font-style: italic;
  }

  .history-toggle {
    background: none;
    border: none;
    color: var(--primary);
    font-size: clamp(11px, 3vw, 13px);
    font-weight: 600;
    cursor: pointer;
    padding: clamp(2px, 0.5vw, 4px) clamp(6px, 1.5vw, 10px);
    border-radius: 100px;
    transition: background 0.15s ease;
    flex-shrink: 0;
  }

  .history-toggle:hover {
    background: rgba(29, 155, 240, 0.08);
  }

  /* ===== CONTACT HISTORY ===== */
  .contact-history {
    display: flex;
    flex-direction: column;
    gap: clamp(4px, 1.2vw, 8px);
    margin-bottom: clamp(10px, 3vw, 14px);
    padding: clamp(8px, 2.2vw, 12px);
    background: var(--bg-gray);
    border-radius: clamp(10px, 2.5vw, 14px);
    max-height: 200px;
    overflow-y: auto;
  }

  .history-entry {
    display: flex;
    align-items: flex-start;
    gap: clamp(8px, 2vw, 12px);
    padding: clamp(6px, 1.5vw, 8px);
    border-radius: clamp(6px, 1.5vw, 10px);
    background: white;
  }

  .history-icon {
    font-size: clamp(14px, 3.8vw, 18px);
    flex-shrink: 0;
    margin-top: 1px;
  }

  .history-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .history-type {
    font-size: clamp(12px, 3.2vw, 14px);
    font-weight: 600;
    color: #0f1419;
  }

  .history-date {
    font-size: clamp(11px, 2.8vw, 12px);
    color: var(--light-gray);
  }

  .history-note {
    font-size: clamp(11px, 2.8vw, 12px);
    color: var(--dark-gray);
    font-style: italic;
    margin-top: 2px;
  }

  .history-delete {
    background: none;
    border: none;
    color: var(--light-gray);
    font-size: clamp(16px, 4vw, 20px);
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    flex-shrink: 0;
    transition: color 0.15s ease;
  }

  .history-delete:hover {
    color: var(--danger);
  }

  /* ===== LOG FORM ===== */
  .log-form {
    background: rgba(234, 179, 8, 0.05);
    border: 1px solid rgba(234, 179, 8, 0.2);
    border-radius: clamp(10px, 2.5vw, 14px);
    padding: clamp(12px, 3.5vw, 18px);
    margin-bottom: clamp(10px, 3vw, 14px);
  }

  .log-form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: clamp(10px, 3vw, 14px);
  }

  .log-form-title {
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 600;
    color: #0f1419;
  }

  .log-form-close {
    background: none;
    border: none;
    font-size: clamp(18px, 5vw, 22px);
    color: var(--light-gray);
    cursor: pointer;
    padding: 0;
    line-height: 1;
  }

  .log-form-group {
    margin-bottom: clamp(10px, 3vw, 14px);
  }

  .log-form-label {
    display: block;
    font-size: clamp(11px, 3vw, 13px);
    font-weight: 600;
    color: var(--dark-gray);
    margin-bottom: clamp(4px, 1.2vw, 6px);
  }

  .log-date-input {
    width: 100%;
    padding: clamp(8px, 2.2vw, 12px);
    border: 1px solid var(--extra-light-gray);
    border-radius: clamp(8px, 2vw, 12px);
    font-size: clamp(13px, 3.5vw, 15px);
    font-family: inherit;
    box-sizing: border-box;
    background: white;
  }

  .log-date-input:focus {
    outline: none;
    border-color: var(--primary);
  }

  .log-type-chips {
    display: flex;
    flex-wrap: wrap;
    gap: clamp(6px, 1.5vw, 8px);
  }

  .log-type-chip {
    padding: clamp(6px, 1.5vw, 10px) clamp(10px, 2.5vw, 14px);
    border-radius: 100px;
    border: 1px solid var(--extra-light-gray);
    background: white;
    color: var(--dark-gray);
    font-size: clamp(12px, 3.2vw, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
  }

  .log-type-chip:hover {
    border-color: var(--primary);
  }

  .log-type-chip.selected {
    border-color: var(--primary);
    background: rgba(29, 155, 240, 0.1);
    color: var(--primary);
    font-weight: 600;
  }

  .log-note-input {
    width: 100%;
    padding: clamp(8px, 2.2vw, 12px);
    border: 1px solid var(--extra-light-gray);
    border-radius: clamp(8px, 2vw, 12px);
    font-size: clamp(13px, 3.5vw, 15px);
    font-family: inherit;
    box-sizing: border-box;
    background: white;
  }

  .log-note-input:focus {
    outline: none;
    border-color: var(--primary);
  }

  .log-form-actions {
    display: flex;
    gap: clamp(8px, 2vw, 12px);
    margin-top: clamp(4px, 1vw, 6px);
  }

  .log-form-actions .btn-primary,
  .log-form-actions .btn-secondary {
    flex: 1;
    padding: clamp(8px, 2.2vw, 12px);
    font-size: clamp(13px, 3.5vw, 15px);
  }

  .btn-secondary.compact {
    width: auto;
    padding: clamp(8px, 2.2vw, 12px) clamp(16px, 4vw, 22px);
  }

  /* ===== FILTER PILLS ===== */
  .filter-row {
    display: flex;
    gap: clamp(6px, 2vw, 10px);
    overflow-x: auto;
    padding: clamp(4px, 1vw, 6px) 0;
    margin-bottom: clamp(12px, 3.5vw, 18px);
    -webkit-overflow-scrolling: touch;
  }

  .filter-row::-webkit-scrollbar { display: none; }

  .filter-pill {
    padding: clamp(8px, 2vw, 10px) clamp(12px, 3vw, 16px);
    border-radius: 100px;
    border: none;
    background: white;
    color: var(--dark-gray);
    font-size: clamp(12px, 3.2vw, 14px);
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    border: 1px solid var(--extra-light-gray);
  }

  .filter-pill.active {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
  }

  /* ===== EMPTY STATE ===== */
  .empty-state {
    text-align: center;
    padding: clamp(30px, 8vw, 50px) clamp(16px, 4vw, 24px);
  }

  .empty-emoji {
    font-size: clamp(40px, 12vw, 56px);
    display: block;
    margin-bottom: clamp(10px, 3vw, 14px);
  }

  .empty-title {
    font-size: clamp(16px, 4.5vw, 20px);
    font-weight: 700;
    margin: 0 0 clamp(4px, 1.2vw, 8px) 0;
  }

  .empty-subtitle {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--light-gray);
    margin: 0 0 clamp(16px, 4.5vw, 24px) 0;
  }

  /* ===== BUTTONS ===== */
  .btn-primary {
    width: 100%;
    padding: clamp(12px, 3.5vw, 16px);
    background: var(--primary);
    color: white;
    border: none;
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(14px, 4vw, 17px);
    font-weight: 600;
    cursor: pointer;
  }

  .btn-primary.compact {
    width: auto;
    padding: clamp(10px, 3vw, 14px) clamp(20px, 5.5vw, 28px);
  }

  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-secondary {
    flex: 1;
    padding: clamp(12px, 3.5vw, 16px);
    background: white;
    color: var(--dark-gray);
    border: 1px solid var(--extra-light-gray);
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(14px, 4vw, 17px);
    font-weight: 600;
    cursor: pointer;
  }

  /* ===== FORM ===== */
  .form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: clamp(16px, 4vw, 22px);
  }

  .form-title {
    font-size: clamp(16px, 4.5vw, 20px);
    font-weight: 600;
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--light-gray);
    font-size: clamp(20px, 5vw, 26px);
    line-height: 1;
    padding: 4px;
  }

  .form-group {
    margin-bottom: clamp(14px, 4vw, 20px);
  }

  .form-label {
    font-size: clamp(12px, 3.2vw, 14px);
    font-weight: 500;
    color: var(--dark-gray);
    display: block;
    margin-bottom: clamp(6px, 1.5vw, 8px);
  }

  .form-input {
    width: 100%;
    padding: clamp(10px, 3vw, 14px);
    border: 1px solid var(--extra-light-gray);
    border-radius: clamp(10px, 2.5vw, 14px);
    font-size: clamp(14px, 3.8vw, 16px);
    font-family: inherit;
    box-sizing: border-box;
  }

  .form-input:focus {
    outline: none;
    border-color: var(--primary);
  }

  .support-options {
    display: flex;
    flex-wrap: wrap;
    gap: clamp(6px, 2vw, 10px);
  }

  .support-option {
    padding: clamp(8px, 2.5vw, 12px) clamp(12px, 3.5vw, 16px);
    border-radius: 100px;
    border: 1px solid var(--extra-light-gray);
    background: white;
    color: var(--dark-gray);
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .support-option.active {
    border: 2px solid var(--primary);
    background: rgba(29, 155, 240, 0.1);
    color: var(--primary);
  }

  .form-buttons {
    display: flex;
    gap: clamp(10px, 3vw, 14px);
  }

  .form-buttons .btn-primary { flex: 1; }

  /* ===== TIP CARD ===== */
  .tip-card {
    background: rgba(29, 155, 240, 0.05);
    border-left: 3px solid var(--primary);
  }

  .tip-label {
    font-size: clamp(12px, 3.2vw, 14px);
    font-weight: 600;
    color: var(--primary);
    margin-bottom: clamp(4px, 1vw, 6px);
  }

  .tip-text {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    line-height: 1.5;
    margin: 0;
  }

  /* ===== TABLET/DESKTOP ===== */
  @media (min-width: 768px) {
    .main {
      padding: 24px;
      padding-bottom: 24px;
    }

    .avatars-grid {
      grid-template-columns: repeat(8, 1fr);
    }

    .quick-action-btn:hover {
      transform: translateY(-2px);
    }
  }

  @media (min-width: 1024px) {
    .main { max-width: 680px; }
  }
`
