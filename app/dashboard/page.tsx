'use client'

import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import BottomNav from '@/components/BottomNav'

interface Tool {
  id: string
  path: string
  name: string
  description: string
  icon: string
  time: string
  color: string
}

const hotTools: Tool[] = [
  {
    id: 'ally',
    path: '/ally',
    name: 'Attuned Ally',
    description: "Can't start or focus",
    icon: '💜',
    time: '2-3 min',
    color: 'purple',
  },
  {
    id: 'brake',
    path: '/brake',
    name: 'Impulse Brake',
    description: 'About to react impulsively',
    icon: '🛑',
    time: '2-5 min',
    color: 'amber',
  },
  {
    id: 'sos',
    path: '/village',
    name: 'SOS Support',
    description: 'Need to reach out for help',
    icon: '🆘',
    time: '1 min',
    color: 'orange',
  },
]

const coolTools: Tool[] = [
  {
    id: 'mood',
    path: '/dashboard#mood-section',
    name: 'Mood Check-In',
    description: 'Log how you\'re feeling',
    icon: '📊',
    time: '30 sec',
    color: 'teal',
  },
  {
    id: 'focus',
    path: '/focus',
    name: 'Focus Foundry',
    description: 'Break down a scary task',
    icon: '🔨',
    time: '5-10 min',
    color: 'blue',
  },
  {
    id: 'burnout',
    path: '/burnout',
    name: 'Burnout Check',
    description: 'Weekly energy assessment',
    icon: '🔋',
    time: '2 min',
    color: 'slate',
  },
]

const getColorClasses = (color: string, isCard = false) => {
  const colorMap: Record<string, { bg: string; border: string; text: string }> = {
    purple: { 
      bg: isCard ? 'bg-purple-50' : 'bg-purple-100', 
      border: 'border-purple-200', 
      text: 'text-purple-700' 
    },
    amber: { 
      bg: isCard ? 'bg-amber-50' : 'bg-amber-100', 
      border: 'border-amber-200', 
      text: 'text-amber-700' 
    },
    orange: { 
      bg: isCard ? 'bg-orange-50' : 'bg-orange-100', 
      border: 'border-orange-200', 
      text: 'text-orange-700' 
    },
    teal: { 
      bg: isCard ? 'bg-teal-50' : 'bg-teal-100', 
      border: 'border-teal-200', 
      text: 'text-teal-700' 
    },
    blue: { 
      bg: isCard ? 'bg-blue-50' : 'bg-blue-100', 
      border: 'border-blue-200', 
      text: 'text-blue-700' 
    },
    slate: { 
      bg: isCard ? 'bg-slate-50' : 'bg-slate-100', 
      border: 'border-slate-200', 
      text: 'text-slate-700' 
    },
    green: { 
      bg: isCard ? 'bg-green-50' : 'bg-green-100', 
      border: 'border-green-200', 
      text: 'text-green-700' 
    },
  }
  return colorMap[color] || colorMap.slate
}

export default function ToolsPage() {
  const router = useRouter()

  const handleToolClick = (tool: Tool) => {
    if (tool.path.includes('#')) {
      // Handle anchor links
      router.push(tool.path)
    } else {
      router.push(tool.path)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <PageHeader 
        title="Tools" 
        backPath="/dashboard"
        backLabel="Home"
      />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        
        {/* Hot Tools - Reactive */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-800">
              🔥 Need help right now?
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              For when you're struggling in the moment
            </p>
          </div>

          <div className="space-y-3">
            {hotTools.map((tool) => {
              const colors = getColorClasses(tool.color, true)
              return (
                <button
                  key={tool.id}
                  onClick={() => handleToolClick(tool)}
                  className={`w-full p-4 rounded-xl border-2 ${colors.bg} ${colors.border} text-left transition-transform active:scale-[0.98]`}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-3xl" aria-hidden="true">{tool.icon}</span>
                    <div className="flex-1">
                      <h3 className={`font-semibold ${colors.text}`}>
                        {tool.name}
                      </h3>
                      <p className="text-sm text-slate-600 mt-0.5">
                        {tool.description}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500 bg-white/50 px-2 py-1 rounded-full">
                      {tool.time}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Cool Tools - Proactive */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-800">
              🧊 Planning & check-ins
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              For when you have a moment to prepare
            </p>
          </div>

          <div className="space-y-3">
            {coolTools.map((tool) => {
              const colors = getColorClasses(tool.color, true)
              return (
                <button
                  key={tool.id}
                  onClick={() => handleToolClick(tool)}
                  className={`w-full p-4 rounded-xl border-2 ${colors.bg} ${colors.border} text-left transition-transform active:scale-[0.98]`}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-3xl" aria-hidden="true">{tool.icon}</span>
                    <div className="flex-1">
                      <h3 className={`font-semibold ${colors.text}`}>
                        {tool.name}
                      </h3>
                      <p className="text-sm text-slate-600 mt-0.5">
                        {tool.description}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500 bg-white/50 px-2 py-1 rounded-full">
                      {tool.time}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Help text */}
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-600 text-center">
            💡 <strong>Tip:</strong> Not sure which tool? Start with how you feel right now.
            Struggling = 🔥 Hot tools. Planning ahead = 🧊 Cool tools.
          </p>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
