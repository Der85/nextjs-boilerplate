'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type View = 'village' | 'add' | 'edit' | 'sos' | 'sos-result'

interface Contact {
  id: string
  name: string
  relationship: string | null
  phone: string | null
  email: string | null
  other_contact: string | null
  preferred_method: string | null
  support_emotional: boolean
  support_task: boolean
  support_info: boolean
  support_fun: boolean
  support_emergency: boolean
  notes: string | null
  best_times: string | null
  is_favorite: boolean
  times_contacted: number
  last_contacted_at: string | null
}

interface SosMessage {
  type: string
  template: string
}

const supportTypes = [
  { 
    id: 'emotional', 
    label: 'Emotional', 
    icon: '💙', 
    description: 'Listening & validating',
    color: 'bg-blue-100 text-blue-700 border-blue-300'
  },
  { 
    id: 'task', 
    label: 'Task Help', 
    icon: '🤝', 
    description: 'Body doubling & chores',
    color: 'bg-green-100 text-green-700 border-green-300'
  },
  { 
    id: 'info', 
    label: 'Info/Advice', 
    icon: '💡', 
    description: 'Mentoring & guidance',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-300'
  },
  { 
    id: 'fun', 
    label: 'Fun/Distraction', 
    icon: '🎉', 
    description: 'Companionship & play',
    color: 'bg-pink-100 text-pink-700 border-pink-300'
  },
  { 
    id: 'emergency', 
    label: 'Emergency', 
    icon: '🆘', 
    description: 'Crisis support',
    color: 'bg-red-100 text-red-700 border-red-300'
  }
]

const sosTemplates: Record<string, SosMessage[]> = {
  emotional: [
    { type: 'text', template: "Hey, I'm having a rough time. Do you have a few minutes to talk or just listen?" },
    { type: 'text', template: "Hi, feeling overwhelmed right now. Could use some support if you're free." },
    { type: 'text', template: "Hey, my brain is being mean to me today. Would you mind reminding me I'm okay?" }
  ],
  task: [
    { type: 'text', template: "Hey! I'm stuck on a task. Any chance you could body double with me for 15-20 mins?" },
    { type: 'text', template: "Hi! Would you be free to help me with something? Even just being on a call while I work would help." },
    { type: 'text', template: "Hey, I need accountability. Can I text you when I start and finish a task?" }
  ],
  info: [
    { type: 'text', template: "Hey, I could use your advice on something when you have time. No rush!" },
    { type: 'text', template: "Hi! You're good at [topic]. Could I pick your brain for a few minutes?" },
    { type: 'text', template: "Hey, I'm trying to figure something out. Would you mind being a sounding board?" }
  ],
  fun: [
    { type: 'text', template: "Hey! I need a distraction. Want to hang out or chat about something random?" },
    { type: 'text', template: "Hi! I need to get out of my head. Got any funny memes or want to play something?" },
    { type: 'text', template: "Hey, I need some fun energy. What's something good that happened to you lately?" }
  ],
  emergency: [
    { type: 'text', template: "I'm not doing well and could really use your help right now. Are you available?" },
    { type: 'text', template: "Hey, I'm in a bad place mentally. Can you talk?" },
    { type: 'text', template: "I need support right now. Please call me when you can." }
  ]
}

export default function VillagePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // View state
  const [view, setView] = useState<View>('village')
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  
  // Contacts data
  const [contacts, setContacts] = useState<Contact[]>([])
  
  // SOS state
  const [sosType, setSosType] = useState<string | null>(null)
  const [sosContacts, setSosContacts] = useState<Contact[]>([])
  const [selectedSosContact, setSelectedSosContact] = useState<Contact | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [customMessage, setCustomMessage] = useState('')
  
  // Add/Edit form state
  const [formData, setFormData] = useState({
    name: '',
    relationship: '',
    phone: '',
    email: '',
    other_contact: '',
    preferred_method: 'text' as string,
    support_emotional: false,
    support_task: false,
    support_info: false,
    support_fun: false,
    support_emergency: false,
    notes: '',
    best_times: '',
    is_favorite: false
  })

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)
      await fetchContacts()
      setLoading(false)
    }
    checkUser()
  }, [router])

  const fetchContacts = async () => {
    const { data, error } = await supabase
      .from('village_contacts')
      .select('*')
      .eq('is_archived', false)
      .order('is_favorite', { ascending: false })
      .order('name', { ascending: true })
    
    if (!error && data) {
      setContacts(data)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      relationship: '',
      phone: '',
      email: '',
      other_contact: '',
      preferred_method: 'text',
      support_emotional: false,
      support_task: false,
      support_info: false,
      support_fun: false,
      support_emergency: false,
      notes: '',
      best_times: '',
      is_favorite: false
    })
    setEditingContact(null)
  }

  const handleAddContact = () => {
    resetForm()
    setView('add')
  }

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact)
    setFormData({
      name: contact.name,
      relationship: contact.relationship || '',
      phone: contact.phone || '',
      email: contact.email || '',
      other_contact: contact.other_contact || '',
      preferred_method: contact.preferred_method || 'text',
      support_emotional: contact.support_emotional,
      support_task: contact.support_task,
      support_info: contact.support_info,
      support_fun: contact.support_fun,
      support_emergency: contact.support_emergency,
      notes: contact.notes || '',
      best_times: contact.best_times || '',
      is_favorite: contact.is_favorite
    })
    setView('edit')
  }

  const saveContact = async () => {
    setSaving(true)
    
    const contactData = {
      user_id: user.id,
      name: formData.name,
      relationship: formData.relationship || null,
      phone: formData.phone || null,
      email: formData.email || null,
      other_contact: formData.other_contact || null,
      preferred_method: formData.preferred_method,
      support_emotional: formData.support_emotional,
      support_task: formData.support_task,
      support_info: formData.support_info,
      support_fun: formData.support_fun,
      support_emergency: formData.support_emergency,
      notes: formData.notes || null,
      best_times: formData.best_times || null,
      is_favorite: formData.is_favorite
    }

    if (editingContact) {
      await supabase
        .from('village_contacts')
        .update(contactData)
        .eq('id', editingContact.id)
    } else {
      await supabase
        .from('village_contacts')
        .insert(contactData)
    }

    await fetchContacts()
    resetForm()
    setView('village')
    setSaving(false)
  }

  const deleteContact = async (id: string) => {
    if (!confirm('Remove this person from your village?')) return
    
    await supabase
      .from('village_contacts')
      .update({ is_archived: true })
      .eq('id', id)
    
    await fetchContacts()
  }

  const toggleFavorite = async (contact: Contact) => {
    await supabase
      .from('village_contacts')
      .update({ is_favorite: !contact.is_favorite })
      .eq('id', contact.id)
    
    await fetchContacts()
  }

  const startSOS = (type: string) => {
    setSosType(type)
    
    // Filter contacts by support type
    const supportField = `support_${type}` as keyof Contact
    const filtered = contacts.filter(c => c[supportField] === true)
    setSosContacts(filtered)
    
    // Set default template
    const templates = sosTemplates[type] || []
    if (templates.length > 0) {
      setSelectedTemplate(templates[0].template)
    }
    
    setView('sos')
  }

  const selectSosContact = (contact: Contact) => {
    setSelectedSosContact(contact)
  }

  const sendSOS = async () => {
    if (!selectedSosContact || !sosType) return
    
    const message = customMessage || selectedTemplate
    
    // Log the SOS
    await supabase
      .from('village_sos_logs')
      .insert({
        user_id: user.id,
        support_type: sosType,
        contact_id: selectedSosContact.id,
        contact_name: selectedSosContact.name
      })
    
    // Update contact's last_contacted_at and times_contacted
    await supabase
      .from('village_contacts')
      .update({
        last_contacted_at: new Date().toISOString(),
        times_contacted: (selectedSosContact.times_contacted || 0) + 1
      })
      .eq('id', selectedSosContact.id)
    
    // Open the appropriate app based on preferred method
    const phone = selectedSosContact.phone?.replace(/\D/g, '')
    const email = selectedSosContact.email
    
    if (selectedSosContact.preferred_method === 'text' && phone) {
      window.open(`sms:${phone}?body=${encodeURIComponent(message)}`, '_blank')
    } else if (selectedSosContact.preferred_method === 'phone' && phone) {
      window.open(`tel:${phone}`, '_blank')
    } else if (selectedSosContact.preferred_method === 'email' && email) {
      window.open(`mailto:${email}?body=${encodeURIComponent(message)}`, '_blank')
    } else if (phone) {
      window.open(`sms:${phone}?body=${encodeURIComponent(message)}`, '_blank')
    }
    
    setView('sos-result')
  }

  const getSupportBadges = (contact: Contact) => {
    const badges = []
    if (contact.support_emotional) badges.push({ icon: '💙', label: 'Emotional' })
    if (contact.support_task) badges.push({ icon: '🤝', label: 'Task' })
    if (contact.support_info) badges.push({ icon: '💡', label: 'Info' })
    if (contact.support_fun) badges.push({ icon: '🎉', label: 'Fun' })
    if (contact.support_emergency) badges.push({ icon: '🆘', label: 'Emergency' })
    return badges
  }

  const getContactsForType = (type: string) => {
    const supportField = `support_${type}` as keyof Contact
    return contacts.filter(c => c[supportField] === true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-100 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <button 
            onClick={() => {
              if (view !== 'village') {
                setView('village')
                resetForm()
                setSosType(null)
                setSelectedSosContact(null)
              } else {
                router.push('/dashboard')
              }
            }}
            className="text-orange-600 hover:text-orange-800 font-medium flex items-center gap-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {view === 'village' ? 'Back' : 'Village'}
          </button>
          <h1 className="text-lg font-bold text-orange-700">The Village</h1>
          <div className="w-16"></div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        
        {/* VILLAGE VIEW */}
        {view === 'village' && (
          <div className="space-y-6 animate-fadeIn">
            {/* SOS Quick Access */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-2">🆘 I need help with...</h2>
              <p className="text-sm text-slate-500 mb-4">Quick-connect to someone who can help</p>
              
              <div className="grid grid-cols-2 gap-2">
                {supportTypes.slice(0, 4).map((type) => {
                  const count = getContactsForType(type.id).length
                  return (
                    <button
                      key={type.id}
                      onClick={() => startSOS(type.id)}
                      disabled={count === 0}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        count > 0 
                          ? `${type.color} hover:scale-[1.02]` 
                          : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <span className="text-2xl">{type.icon}</span>
                      <p className="font-medium text-sm mt-1">{type.label}</p>
                      <p className="text-xs opacity-75">
                        {count > 0 ? `${count} contact${count > 1 ? 's' : ''}` : 'No contacts'}
                      </p>
                    </button>
                  )
                })}
              </div>
              
              {/* Emergency row */}
              {getContactsForType('emergency').length > 0 && (
                <button
                  onClick={() => startSOS('emergency')}
                  className="w-full mt-3 p-4 rounded-xl border-2 bg-red-50 border-red-200 text-red-700 hover:bg-red-100 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🆘</span>
                    <div className="text-left">
                      <p className="font-semibold">Emergency Support</p>
                      <p className="text-xs text-red-600">
                        {getContactsForType('emergency').length} crisis contact{getContactsForType('emergency').length > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </button>
              )}
            </div>

            {/* My Village */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800">👥 My Village</h2>
                <button
                  onClick={handleAddContact}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2 rounded-xl transition text-sm"
                >
                  + Add
                </button>
              </div>

              {contacts.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-5xl">🏘️</span>
                  <h3 className="text-lg font-medium text-slate-800 mt-4">Your village is empty</h3>
                  <p className="text-slate-500 text-sm mt-1">
                    Add the people who support you
                  </p>
                  <button
                    onClick={handleAddContact}
                    className="mt-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3 rounded-xl transition"
                  >
                    Add Your First Person
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="p-4 bg-orange-50 rounded-xl border border-orange-100"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-800">{contact.name}</h3>
                            {contact.is_favorite && <span className="text-yellow-500">⭐</span>}
                          </div>
                          {contact.relationship && (
                            <p className="text-sm text-slate-500">{contact.relationship}</p>
                          )}
                          
                          {/* Support badges */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {getSupportBadges(contact).map((badge, i) => (
                              <span
                                key={i}
                                className="text-xs px-2 py-0.5 bg-white rounded-full border border-orange-200"
                              >
                                {badge.icon} {badge.label}
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex gap-1">
                          <button
                            onClick={() => toggleFavorite(contact)}
                            className="p-2 hover:bg-orange-100 rounded-lg transition"
                          >
                            {contact.is_favorite ? '⭐' : '☆'}
                          </button>
                          <button
                            onClick={() => handleEditContact(contact)}
                            className="p-2 hover:bg-orange-100 rounded-lg transition text-slate-500"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => deleteContact(contact.id)}
                            className="p-2 hover:bg-red-100 rounded-lg transition text-slate-400 hover:text-red-500"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tip */}
            <div className="bg-orange-100 rounded-2xl p-4 border border-orange-200">
              <p className="text-orange-800 text-sm">
                💡 <strong>Tip:</strong> It takes a village! Having different people for different needs 
                means you won't burn out any single relationship.
              </p>
            </div>
          </div>
        )}

        {/* ADD/EDIT VIEW */}
        {(view === 'add' || view === 'edit') && (
          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5 animate-fadeIn">
            <div className="text-center space-y-2">
              <span className="text-4xl">{view === 'add' ? '👋' : '✏️'}</span>
              <h2 className="text-xl font-bold text-slate-800">
                {view === 'add' ? 'Add to Your Village' : 'Edit Contact'}
              </h2>
            </div>

            {/* Name & Relationship */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Their name"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Relationship</label>
                <input
                  type="text"
                  value={formData.relationship}
                  onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                  placeholder="Friend, Partner..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 outline-none"
                />
              </div>
            </div>

            {/* Contact Info */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Phone number"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Email address"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 outline-none"
              />
            </div>

            {/* Preferred Method */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Preferred Contact Method</label>
              <div className="flex gap-2">
                {[
                  { id: 'text', label: '💬 Text' },
                  { id: 'phone', label: '📞 Call' },
                  { id: 'email', label: '📧 Email' }
                ].map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setFormData({ ...formData, preferred_method: method.id })}
                    className={`flex-1 py-2 px-3 rounded-xl border-2 text-sm transition ${
                      formData.preferred_method === method.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {method.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Support Types */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                What can they help with? (select all that apply)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {supportTypes.map((type) => {
                  const fieldName = `support_${type.id}` as keyof typeof formData
                  return (
                    <button
                      key={type.id}
                      onClick={() => setFormData({ 
                        ...formData, 
                        [fieldName]: !formData[fieldName] 
                      })}
                      className={`p-3 rounded-xl border-2 text-left transition ${
                        formData[fieldName]
                          ? `${type.color}`
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="text-lg">{type.icon}</span>
                      <p className="text-sm font-medium mt-1">{type.label}</p>
                      <p className="text-xs opacity-75">{type.description}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="e.g., Don't call after 10pm, Great listener..."
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 outline-none resize-none"
              />
            </div>

            {/* Best Times */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Best times to reach (optional)</label>
              <input
                type="text"
                value={formData.best_times}
                onChange={(e) => setFormData({ ...formData, best_times: e.target.value })}
                placeholder="e.g., Weekday evenings, Anytime"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 outline-none"
              />
            </div>

            {/* Favorite toggle */}
            <button
              onClick={() => setFormData({ ...formData, is_favorite: !formData.is_favorite })}
              className={`w-full p-3 rounded-xl border-2 transition ${
                formData.is_favorite
                  ? 'border-yellow-400 bg-yellow-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="text-xl">{formData.is_favorite ? '⭐' : '☆'}</span>
              <span className="ml-2">{formData.is_favorite ? 'Favorite' : 'Mark as favorite'}</span>
            </button>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setView('village')
                  resetForm()
                }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={saveContact}
                disabled={!formData.name || saving}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : (view === 'add' ? 'Add to Village' : 'Save Changes')}
              </button>
            </div>
          </div>
        )}

        {/* SOS VIEW */}
        {view === 'sos' && sosType && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="text-center space-y-2 mb-4">
                <span className="text-4xl">
                  {supportTypes.find(t => t.id === sosType)?.icon}
                </span>
                <h2 className="text-xl font-bold text-slate-800">
                  {supportTypes.find(t => t.id === sosType)?.label} Support
                </h2>
                <p className="text-slate-500 text-sm">Who do you want to reach out to?</p>
              </div>

              {/* Contact Selection */}
              <div className="space-y-2 mb-4">
                {sosContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => selectSosContact(contact)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition ${
                      selectedSosContact?.id === contact.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800">{contact.name}</p>
                        {contact.relationship && (
                          <p className="text-sm text-slate-500">{contact.relationship}</p>
                        )}
                      </div>
                      {contact.is_favorite && <span>⭐</span>}
                    </div>
                  </button>
                ))}
              </div>

              {/* Message Templates */}
              {selectedSosContact && (
                <>
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-slate-700 mb-2">Quick message:</p>
                    <div className="space-y-2">
                      {(sosTemplates[sosType] || []).map((template, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setSelectedTemplate(template.template)
                            setCustomMessage('')
                          }}
                          className={`w-full p-3 rounded-xl border text-left text-sm transition ${
                            selectedTemplate === template.template && !customMessage
                              ? 'border-orange-500 bg-orange-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {template.template}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3">
                    <p className="text-sm font-medium text-slate-700 mb-2">Or write your own:</p>
                    <textarea
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      placeholder="Type your message..."
                      rows={2}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 outline-none resize-none text-sm"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Send Button */}
            {selectedSosContact && (
              <button
                onClick={sendSOS}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 rounded-2xl transition text-lg shadow-lg"
              >
                📤 Open Message to {selectedSosContact.name}
              </button>
            )}

            {/* Note about what happens */}
            <div className="bg-orange-100 rounded-xl p-3 text-center">
              <p className="text-orange-800 text-sm">
                This will open your messaging app with the message ready to send
              </p>
            </div>
          </div>
        )}

        {/* SOS RESULT VIEW */}
        {view === 'sos-result' && (
          <div className="bg-white rounded-2xl shadow-lg p-6 text-center space-y-5 animate-fadeIn">
            <span className="text-5xl">💌</span>
            <h2 className="text-xl font-bold text-slate-800">You reached out!</h2>
            <p className="text-slate-600">
              Asking for help is a strength, not a weakness. You're taking care of yourself.
            </p>

            <div className="bg-green-50 p-4 rounded-xl border border-green-200">
              <p className="text-green-800">
                Messaged <strong>{selectedSosContact?.name}</strong> for {sosType} support
              </p>
            </div>

            <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
              <p className="text-orange-800 text-sm">
                💡 Remember: If they can't help right now, it's not personal. 
                You have other people in your village too.
              </p>
            </div>

            <button
              onClick={() => {
                setView('village')
                setSosType(null)
                setSelectedSosContact(null)
                setSelectedTemplate('')
                setCustomMessage('')
              }}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition"
            >
              Back to Village
            </button>
          </div>
        )}
      </main>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
