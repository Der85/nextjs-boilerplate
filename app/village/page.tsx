'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Contact {
  id: string
  name: string
  relationship: string | null
  phone: string | null
  email: string | null
  support_type: string[]
  is_favorite: boolean
}

const supportTypes = [
  { key: 'emotional', label: 'Emotional', icon: '💜' },
  { key: 'task', label: 'Task help', icon: '🤝' },
  { key: 'info', label: 'Advice', icon: '💡' },
  { key: 'fun', label: 'Fun', icon: '🎉' },
  { key: 'emergency', label: 'Emergency', icon: '🚨' },
]

export default function VillagePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [filterType, setFilterType] = useState<string | null>(null)
  const [showMenu, setShowMenu] = useState(false)

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [supports, setSupports] = useState<string[]>([])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
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

    if (data) setContacts(data.map(c => ({ ...c, support_type: c.support_type || [] })))
  }

  const toggleSupport = (key: string) => {
    setSupports(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key])
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

  const getContactsForType = (type: string) => {
    return contacts.filter(c => c.support_type?.includes(type))
  }

  const contactPerson = (contact: Contact) => {
    if (contact.phone) {
      window.open(`tel:${contact.phone}`)
    } else if (contact.email) {
      window.open(`mailto:${contact.email}`)
    }
  }

  const filteredContacts = filterType
    ? contacts.filter(c => c.support_type?.includes(filterType))
    : contacts

  if (loading) {
    return (
      <div className="village-page">
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading...</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    )
  }

  return (
    <div className="village-page">
      {/* Header - Consistent with Dashboard */}
      <header className="header">
        <button onClick={() => router.push('/dashboard')} className="logo">
          ADHDer.io
        </button>
        
        <div className="header-actions">
          <button onClick={() => router.push('/ally')} className="icon-btn purple" title="I'm stuck">
            💜
          </button>
          <button onClick={() => router.push('/brake')} className="icon-btn red" title="Need to pause">
            🛑
          </button>
          <button onClick={() => setShowMenu(!showMenu)} className="icon-btn menu">
            ☰
          </button>
        </div>

        {showMenu && (
          <div className="dropdown-menu">
            <button onClick={() => { router.push('/dashboard'); setShowMenu(false) }} className="menu-item">
              🏠 Dashboard
            </button>
            <button onClick={() => { router.push('/focus'); setShowMenu(false) }} className="menu-item">
              ⏱️ Focus Mode
            </button>
            <button onClick={() => { router.push('/goals'); setShowMenu(false) }} className="menu-item">
              🎯 Goals
            </button>
            <button onClick={() => { router.push('/burnout'); setShowMenu(false) }} className="menu-item">
              ⚡ Energy Tracker
            </button>
            <button onClick={() => { setShowMenu(false) }} className="menu-item active">
              👥 My Village
            </button>
            <div className="menu-divider" />
            <button 
              onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
              className="menu-item logout"
            >
              Log out
            </button>
          </div>
        )}
      </header>

      {showMenu && <div className="menu-overlay" onClick={() => setShowMenu(false)} />}

      <main className="main">
        {/* Page Title */}
        <div className="page-header-title">
          <h1>👥 My Village</h1>
        </div>

        {/* List View */}
        {view === 'list' && (
          <>
            {/* Add Contact Card */}
            <div className="card">
              <p className="card-desc">Your support network — the people who help you thrive.</p>
              <button onClick={() => { resetForm(); setView('create') }} className="btn-primary">
                + Add Someone
              </button>
            </div>

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
                <p className="empty-text">
                  {filterType ? 'No contacts for this support type' : 'No contacts yet'}
                </p>
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <div key={contact.id} className="card contact-card">
                  <div className="contact-row">
                    {/* Avatar */}
                    <div className="avatar">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    
                    <div className="contact-info">
                      {/* Name & Favorite */}
                      <div className="name-row">
                        <span className="contact-name">{contact.name}</span>
                        <button 
                          onClick={() => toggleFavorite(contact.id, contact.is_favorite)}
                          className="fav-btn"
                        >
                          {contact.is_favorite ? '⭐' : '☆'}
                        </button>
                      </div>

                      {/* Relationship */}
                      {contact.relationship && (
                        <p className="contact-relationship">{contact.relationship}</p>
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

                      {/* Action Buttons */}
                      <div className="action-buttons">
                        {(contact.phone || contact.email) && (
                          <button onClick={() => contactPerson(contact)} className="action-btn">
                            📞 Contact
                          </button>
                        )}
                        <button onClick={() => handleEdit(contact)} className="action-btn">
                          ✏️ Edit
                        </button>
                        <button onClick={() => handleDelete(contact.id)} className="action-btn delete">
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* Create/Edit View */}
        {(view === 'create' || view === 'edit') && (
          <div className="card form-card">
            <div className="form-header">
              <h2 className="form-title">
                {view === 'edit' ? '✏️ Edit Contact' : '➕ Add to Village'}
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
          <div className="tip-label">💡 ADHD & Support Networks</div>
          <p className="tip-text">
            Building a "village" helps with ADHD challenges. Different people help in different ways — 
            some for emotional support, others for practical help. Knowing who to call makes it easier 
            to reach out when you need it.
          </p>
        </div>
      </main>

      {/* Bottom Nav */}
      <nav className="bottom-nav">
        <button onClick={() => router.push('/dashboard')} className="nav-btn">
          <span className="nav-icon">🏠</span>
          <span className="nav-label">Home</span>
        </button>
        <button onClick={() => router.push('/focus')} className="nav-btn">
          <span className="nav-icon">⏱️</span>
          <span className="nav-label">Focus</span>
        </button>
        <button onClick={() => router.push('/history')} className="nav-btn">
          <span className="nav-icon">📊</span>
          <span className="nav-label">Insights</span>
        </button>
      </nav>

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
    border: 3px solid var(--primary);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 12px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ===== HEADER ===== */
  .header {
    position: sticky;
    top: 0;
    background: white;
    border-bottom: 1px solid #eee;
    padding: clamp(10px, 2.5vw, 14px) clamp(12px, 4vw, 20px);
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 100;
  }

  .logo {
    background: none;
    border: none;
    cursor: pointer;
    font-size: clamp(16px, 4vw, 20px);
    font-weight: 800;
    color: var(--primary);
  }

  .header-actions {
    display: flex;
    gap: clamp(6px, 2vw, 10px);
  }

  .icon-btn {
    width: clamp(32px, 8vw, 42px);
    height: clamp(32px, 8vw, 42px);
    border-radius: 50%;
    border: none;
    cursor: pointer;
    font-size: clamp(14px, 3.5vw, 18px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-btn.purple { background: rgba(128, 90, 213, 0.1); }
  .icon-btn.red { background: rgba(239, 68, 68, 0.1); }
  .icon-btn.menu { 
    background: white; 
    border: 1px solid #ddd;
    font-size: clamp(12px, 3vw, 16px);
  }

  .dropdown-menu {
    position: absolute;
    top: clamp(50px, 12vw, 60px);
    right: clamp(12px, 4vw, 20px);
    background: white;
    border-radius: clamp(10px, 2.5vw, 14px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    padding: clamp(6px, 1.5vw, 10px);
    min-width: clamp(140px, 40vw, 180px);
    z-index: 200;
  }

  .menu-item {
    display: block;
    width: 100%;
    padding: clamp(8px, 2.5vw, 12px) clamp(10px, 3vw, 14px);
    text-align: left;
    background: none;
    border: none;
    border-radius: clamp(6px, 1.5vw, 10px);
    cursor: pointer;
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
  }

  .menu-item:hover, .menu-item.active { background: var(--bg-gray); }
  .menu-item.logout { color: #ef4444; }
  .menu-divider { border-top: 1px solid #eee; margin: 8px 0; }
  .menu-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 99;
  }

  /* ===== MAIN CONTENT ===== */
  .main {
    padding: clamp(12px, 4vw, 20px);
    padding-bottom: clamp(80px, 20vw, 110px);
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

  /* ===== CARDS ===== */
  .card {
    background: white;
    border-radius: clamp(14px, 4vw, 20px);
    padding: clamp(16px, 4.5vw, 24px);
    margin-bottom: clamp(12px, 3.5vw, 18px);
  }

  .card-desc {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--dark-gray);
    margin: 0 0 clamp(12px, 3.5vw, 16px) 0;
    line-height: 1.5;
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

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

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

  /* ===== FILTER PILLS ===== */
  .filter-row {
    display: flex;
    gap: clamp(6px, 2vw, 10px);
    overflow-x: auto;
    padding: clamp(4px, 1vw, 6px) 0;
    margin-bottom: clamp(10px, 3vw, 14px);
    -webkit-overflow-scrolling: touch;
  }

  .filter-row::-webkit-scrollbar {
    display: none;
  }

  .filter-pill {
    padding: clamp(8px, 2vw, 10px) clamp(12px, 3vw, 16px);
    border-radius: 100px;
    border: none;
    background: var(--bg-gray);
    color: var(--dark-gray);
    font-size: clamp(12px, 3.2vw, 14px);
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .filter-pill.active {
    background: var(--primary);
    color: white;
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

  .empty-text {
    font-size: clamp(13px, 3.5vw, 15px);
    color: var(--light-gray);
    margin: 0;
  }

  /* ===== CONTACT CARDS ===== */
  .contact-card {
    /* inherits from .card */
  }

  .contact-row {
    display: flex;
    align-items: flex-start;
    gap: clamp(10px, 3vw, 14px);
  }

  .avatar {
    width: clamp(40px, 11vw, 52px);
    height: clamp(40px, 11vw, 52px);
    border-radius: 50%;
    background: var(--primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: clamp(16px, 4.5vw, 20px);
    font-weight: 700;
    flex-shrink: 0;
  }

  .contact-info {
    flex: 1;
    min-width: 0;
  }

  .name-row {
    display: flex;
    align-items: center;
    gap: clamp(6px, 2vw, 10px);
    margin-bottom: clamp(2px, 1vw, 6px);
  }

  .contact-name {
    font-size: clamp(15px, 4vw, 18px);
    font-weight: 600;
  }

  .fav-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: clamp(14px, 4vw, 18px);
    padding: 0;
    line-height: 1;
  }

  .contact-relationship {
    font-size: clamp(12px, 3.2vw, 14px);
    color: var(--dark-gray);
    margin: 0 0 clamp(6px, 2vw, 10px) 0;
  }

  .support-tags {
    display: flex;
    flex-wrap: wrap;
    gap: clamp(4px, 1vw, 6px);
    margin-bottom: clamp(10px, 3vw, 14px);
  }

  .support-tag {
    font-size: clamp(10px, 2.8vw, 12px);
    padding: clamp(2px, 0.5vw, 4px) clamp(6px, 2vw, 10px);
    border-radius: 100px;
    background: var(--bg-gray);
    color: var(--dark-gray);
  }

  .action-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: clamp(6px, 2vw, 10px);
  }

  .action-btn {
    font-size: clamp(12px, 3.2vw, 14px);
    padding: clamp(6px, 1.5vw, 8px) clamp(10px, 3vw, 14px);
    background: white;
    border: 1px solid var(--extra-light-gray);
    border-radius: 100px;
    cursor: pointer;
    color: var(--dark-gray);
  }

  .action-btn.delete {
    color: var(--danger);
  }

  /* ===== FORM ===== */
  .form-card {
    /* inherits from .card */
  }

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

  .form-buttons .btn-primary {
    flex: 1;
  }

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

  /* ===== BOTTOM NAV ===== */
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: white;
    border-top: 1px solid #eee;
    display: flex;
    justify-content: space-around;
    padding: clamp(6px, 2vw, 10px) 0;
    padding-bottom: max(clamp(6px, 2vw, 10px), env(safe-area-inset-bottom));
    z-index: 100;
  }

  .nav-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(2px, 1vw, 4px);
    background: none;
    border: none;
    cursor: pointer;
    padding: clamp(6px, 2vw, 10px) clamp(14px, 4vw, 20px);
    color: var(--light-gray);
  }

  .nav-btn.active {
    color: var(--primary);
  }

  .nav-icon {
    font-size: clamp(18px, 5vw, 24px);
  }

  .nav-label {
    font-size: clamp(10px, 2.8vw, 12px);
    font-weight: 400;
  }

  .nav-btn.active .nav-label {
    font-weight: 600;
  }

  /* ===== TABLET/DESKTOP ===== */
  @media (min-width: 768px) {
    .main {
      padding: 24px;
      padding-bottom: 120px;
    }
    
    .support-options {
      gap: 12px;
    }

    .action-btn:hover {
      background: var(--bg-gray);
    }
  }

  @media (min-width: 1024px) {
    .header {
      padding: 16px 32px;
    }
    
    .main {
      max-width: 680px;
    }
  }
`
