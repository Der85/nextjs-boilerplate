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
  { key: 'emotional', label: 'Emotional', icon: '💙' },
  { key: 'task', label: 'Task help', icon: '🤝' },
  { key: 'info', label: 'Advice', icon: '💡' },
  { key: 'fun', label: 'Fun', icon: '🎉' },
  { key: 'emergency', label: 'Emergency', icon: '🆘' },
]

export default function VillagePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [view, setView] = useState<'list' | 'add' | 'sos'>('list')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [sosType, setSosType] = useState<string | null>(null)
  
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
      await fetchContacts()
      setLoading(false)
    }
    init()
  }, [router])

  const fetchContacts = async () => {
    const { data } = await supabase
      .from('village_contacts')
      .select('*')
      .eq('is_archived', false)
      .order('is_favorite', { ascending: false })
      .order('name')
    if (data) setContacts(data.map(c => ({ ...c, support_type: c.support_type || [] })))
  }

  const toggleSupport = (key: string) => {
    setSupports(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key])
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

    setName('')
    setRelationship('')
    setPhone('')
    setEmail('')
    setSupports([])
    setView('list')
    await fetchContacts()
    setSaving(false)
  }

  const toggleFavorite = async (id: string, current: boolean) => {
    await supabase.from('village_contacts').update({ is_favorite: !current }).eq('id', id)
    await fetchContacts()
  }

  const getContactsForType = (type: string) => {
    return contacts.filter(c => c.support_type?.includes(type))
  }

  const contactPerson = (contact: Contact) => {
    if (contact.phone) window.location.href = `tel:${contact.phone}`
    else if (contact.email) window.location.href = `mailto:${contact.email}`
  }

  if (loading) {
    return (
      <div className="app-container flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="app-container">
      <div className="top-bar">
        <div className="top-bar-inner">
          <button onClick={() => router.push('/dashboard')} className="btn btn-ghost btn-icon">←</button>
          <h1 style={{ fontSize: '19px', fontWeight: 800 }}>My Village</h1>
          <div style={{ width: '36px' }} />
        </div>
      </div>

      <div className="main-content">
        <div className="tabs">
          <button className={`tab ${view === 'list' ? 'tab-active' : ''}`} onClick={() => { setView('list'); setSosType(null) }}>People</button>
          <button className={`tab ${view === 'sos' ? 'tab-active' : ''}`} onClick={() => setView('sos')}>SOS</button>
          <button className={`tab ${view === 'add' ? 'tab-active' : ''}`} onClick={() => setView('add')}>Add</button>
        </div>

        {view === 'sos' && !sosType && (
          <>
            <div className="page-header">
              <h2 className="page-title">What do you need?</h2>
              <p className="page-subtitle">Tap to find someone who can help</p>
            </div>
            {supportTypes.map((type) => (
              <div key={type.key} className="card card-clickable" onClick={() => setSosType(type.key)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '32px' }}>{type.icon}</span>
                  <p className="font-bold" style={{ flex: 1 }}>{type.label}</p>
                  <span className="text-muted">→</span>
                </div>
              </div>
            ))}
          </>
        )}

        {view === 'sos' && sosType && (
          <>
            <div className="page-header">
              <button onClick={() => setSosType(null)} className="btn btn-ghost text-sm mb-2">← Back</button>
              <h2 className="page-title">{supportTypes.find(t => t.key === sosType)?.icon} Who can help?</h2>
            </div>
            {getContactsForType(sosType).length === 0 ? (
              <div className="card text-center" style={{ padding: '40px 15px' }}>
                <p className="text-muted">No contacts for this type</p>
                <button onClick={() => setView('add')} className="btn btn-primary mt-3">Add someone</button>
              </div>
            ) : (
              getContactsForType(sosType).map((c) => (
                <div key={c.id} className="card card-clickable" onClick={() => contactPerson(c)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-gray)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700 }}>
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p className="font-bold">{c.name}</p>
                      {c.relationship && <p className="text-sm text-muted">{c.relationship}</p>}
                    </div>
                    <span style={{ color: 'var(--primary)' }}>{c.phone ? '📞' : '✉️'}</span>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {view === 'add' && (
          <div className="compose-box">
            <p className="font-bold mb-2">Name</p>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Their name" className="input mb-4" />

            <p className="font-bold mb-2">Relationship (optional)</p>
            <input type="text" value={relationship} onChange={(e) => setRelationship(e.target.value)}
              placeholder="e.g., Friend, Sister, Therapist" className="input mb-4" />

            <p className="font-bold mb-2">Contact info</p>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number" className="input mb-2" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Email" className="input mb-4" />

            <p className="font-bold mb-2">They can help with:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {supportTypes.map((type) => (
                <button key={type.key} onClick={() => toggleSupport(type.key)}
                  className={supports.includes(type.key) ? 'btn btn-primary' : 'btn btn-outline'}
                  style={{ fontSize: '14px', padding: '8px 12px', height: 'auto' }}>
                  {type.icon} {type.label}
                </button>
              ))}
            </div>

            <button onClick={handleAdd} disabled={!name.trim() || saving} className="btn btn-primary w-full">
              {saving ? 'Adding...' : 'Add to village'}
            </button>
          </div>
        )}

        {view === 'list' && (
          <>
            {contacts.length === 0 ? (
              <div className="card text-center" style={{ padding: '40px 15px' }}>
                <span className="emoji-large">👥</span>
                <p className="font-bold mt-3">Your village is empty</p>
                <p className="text-sm text-muted mt-1">Add people who support you</p>
                <button onClick={() => setView('add')} className="btn btn-primary mt-4">Add first person</button>
              </div>
            ) : (
              contacts.map((c) => (
                <div key={c.id} className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-gray)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700 }}>
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p className="font-bold">{c.name} {c.is_favorite && '⭐'}</p>
                      {c.relationship && <p className="text-sm text-muted">{c.relationship}</p>}
                      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                        {c.support_type?.map(t => (
                          <span key={t}>{supportTypes.find(s => s.key === t)?.icon}</span>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => toggleFavorite(c.id, c.is_favorite)} className="btn btn-ghost btn-icon">
                      {c.is_favorite ? '⭐' : '☆'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        <div style={{ height: '50px' }} />
      </div>
    </div>
  )
}