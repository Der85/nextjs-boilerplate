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
      <div className="app-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <span style={{ 
            width: '32px', 
            height: '32px', 
            border: '3px solid var(--primary)', 
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      {/* Top Bar */}
      <div className="top-bar">
        <div className="top-bar-inner">
          <button
            onClick={() => router.push('/dashboard')}
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--dark-gray)'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
            Back
          </button>
          <h1 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--black)' }}>
            👥 My Village
          </h1>
          <div style={{ width: '60px' }}></div>
        </div>
      </div>

      <div className="main-content">
        {/* List View */}
        {view === 'list' && (
          <>
            {/* Add Contact Button */}
            <div className="card">
              <p style={{ fontSize: '14px', color: 'var(--dark-gray)', marginBottom: '12px' }}>
                Your support network — the people who help you thrive.
              </p>
              <button
                onClick={() => { resetForm(); setView('create') }}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                + Add Someone
              </button>
            </div>

            {/* Filter by support type */}
            {contacts.length > 0 && (
              <div style={{ 
                display: 'flex', 
                gap: '8px', 
                overflowX: 'auto',
                padding: '4px 0',
                marginBottom: '8px'
              }}>
                <button
                  onClick={() => setFilterType(null)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '20px',
                    border: 'none',
                    background: filterType === null ? 'var(--primary)' : 'var(--bg-gray)',
                    color: filterType === null ? 'white' : 'var(--dark-gray)',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
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
                      style={{
                        padding: '8px 12px',
                        borderRadius: '20px',
                        border: 'none',
                        background: filterType === type.key ? 'var(--primary)' : 'var(--bg-gray)',
                        color: filterType === type.key ? 'white' : 'var(--dark-gray)',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {type.icon} {type.label} ({count})
                    </button>
                  )
                })}
              </div>
            )}

            {/* Contacts List */}
            {filteredContacts.length === 0 ? (
              <div className="card text-center" style={{ padding: '40px 15px' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>👥</div>
                <p className="text-muted">
                  {filterType ? 'No contacts for this support type' : 'No contacts yet'}
                </p>
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <div key={contact.id} className="card">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    {/* Avatar */}
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: 'var(--primary)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      fontWeight: 700,
                      flexShrink: 0
                    }}>
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Name & Favorite */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '16px' }}>{contact.name}</span>
                        <button
                          onClick={() => toggleFavorite(contact.id, contact.is_favorite)}
                          style={{ 
                            background: 'none', 
                            border: 'none', 
                            cursor: 'pointer',
                            fontSize: '16px',
                            padding: 0
                          }}
                        >
                          {contact.is_favorite ? '⭐' : '☆'}
                        </button>
                      </div>
                      
                      {/* Relationship */}
                      {contact.relationship && (
                        <p style={{ fontSize: '13px', color: 'var(--dark-gray)', marginBottom: '8px' }}>
                          {contact.relationship}
                        </p>
                      )}
                      
                      {/* Support Types */}
                      {contact.support_type && contact.support_type.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                          {contact.support_type.map(type => {
                            const st = supportTypes.find(s => s.key === type)
                            if (!st) return null
                            return (
                              <span
                                key={type}
                                style={{
                                  fontSize: '11px',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  background: 'var(--bg-gray)',
                                  color: 'var(--dark-gray)'
                                }}
                              >
                                {st.icon} {st.label}
                              </span>
                            )
                          })}
                        </div>
                      )}
                      
                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {(contact.phone || contact.email) && (
                          <button
                            onClick={() => contactPerson(contact)}
                            className="btn btn-outline"
                            style={{ fontSize: '13px', padding: '6px 12px' }}
                          >
                            📞 Contact
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(contact)}
                          className="btn btn-outline"
                          style={{ fontSize: '13px', padding: '6px 12px' }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDelete(contact.id)}
                          style={{ 
                            fontSize: '13px', 
                            padding: '6px 12px',
                            background: 'none',
                            border: '1px solid var(--extra-light-gray)',
                            borderRadius: '20px',
                            color: 'var(--danger)',
                            cursor: 'pointer'
                          }}
                        >
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
          <div className="card">
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600 }}>
                {view === 'edit' ? '✏️ Edit Contact' : '➕ Add to Village'}
              </h2>
              <button
                onClick={() => { resetForm(); setView('list') }}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer',
                  fontSize: '20px',
                  color: 'var(--light-gray)'
                }}
              >
                ×
              </button>
            </div>

            {/* Name */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--dark-gray)', display: 'block', marginBottom: '6px' }}>
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Their name"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid var(--extra-light-gray)',
                  borderRadius: '12px',
                  fontSize: '15px'
                }}
              />
            </div>

            {/* Relationship */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--dark-gray)', display: 'block', marginBottom: '6px' }}>
                Relationship
              </label>
              <input
                type="text"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder="e.g., Friend, Sister, Therapist"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid var(--extra-light-gray)',
                  borderRadius: '12px',
                  fontSize: '15px'
                }}
              />
            </div>

            {/* Phone */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--dark-gray)', display: 'block', marginBottom: '6px' }}>
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid var(--extra-light-gray)',
                  borderRadius: '12px',
                  fontSize: '15px'
                }}
              />
            </div>

            {/* Email */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--dark-gray)', display: 'block', marginBottom: '6px' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid var(--extra-light-gray)',
                  borderRadius: '12px',
                  fontSize: '15px'
                }}
              />
            </div>

            {/* Support Types */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--dark-gray)', display: 'block', marginBottom: '8px' }}>
                How do they support you?
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {supportTypes.map(type => (
                  <button
                    key={type.key}
                    onClick={() => toggleSupport(type.key)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '20px',
                      border: supports.includes(type.key) 
                        ? '2px solid var(--primary)' 
                        : '1px solid var(--extra-light-gray)',
                      background: supports.includes(type.key) 
                        ? 'rgba(29, 161, 242, 0.1)' 
                        : 'var(--white)',
                      color: supports.includes(type.key) 
                        ? 'var(--primary)' 
                        : 'var(--dark-gray)',
                      fontSize: '14px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {type.icon} {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => { resetForm(); setView('list') }}
                className="btn btn-outline"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                onClick={view === 'edit' ? handleUpdate : handleAdd}
                disabled={!name.trim() || saving}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                {saving ? 'Saving...' : view === 'edit' ? 'Save Changes' : 'Add Contact'}
              </button>
            </div>
          </div>
        )}

        {/* ADHD Tip */}
        <div className="card" style={{
          background: 'rgba(29, 161, 242, 0.05)',
          borderLeft: '3px solid var(--primary)'
        }}>
          <div style={{ 
            fontSize: '13px', 
            fontWeight: 600, 
            color: 'var(--primary)',
            marginBottom: '4px'
          }}>
            💡 ADHD & Support Networks
          </div>
          <p style={{ fontSize: '14px', color: 'var(--dark-gray)', lineHeight: 1.5 }}>
            Building a "village" helps with ADHD challenges. Different people help in different ways — 
            some for emotional support, others for practical help. Knowing who to call makes it easier 
            to reach out when you need it.
          </p>
        </div>

        {/* Bottom Navigation */}
        <nav className="bottom-nav">
          <button onClick={() => router.push('/dashboard')} className="nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            <span>Dashboard</span>
          </button>
          <button onClick={() => router.push('/focus')} className="nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            <span>Focus</span>
          </button>
          <button onClick={() => router.push('/goals')} className="nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
            </svg>
            <span>Goals</span>
          </button>
          <button onClick={() => router.push('/burnout')} className="nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 1 0 10 10H12V2z"/><path d="M12 2a10 10 0 0 1 10 10"/>
            </svg>
            <span>Energy</span>
          </button>
          <button className="nav-item nav-item-active">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span>Village</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
