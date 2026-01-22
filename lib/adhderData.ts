// ADHDer.net - Shared Data & Types
// Micro-actions, impulse responses, executive function blocks

// ============================================
// TYPES
// ============================================

export interface MicroAction {
  id: string
  text: string
  category: 'food' | 'rest' | 'exercise' | 'enjoyment' | 'social' | 'general'
  why: string
}

export interface BlockType {
  id: string
  label: string
  description: string
  icon: string
}

export interface EmotionTag {
  id: string
  label: string
  icon: string
}

export interface ImpulseResponse {
  id: string
  text: string
  why: string
  forCategories: string[]
}

// ============================================
// EXECUTIVE FUNCTION BLOCKS (Attuned Ally)
// ============================================

export const executiveBlocks: BlockType[] = [
  {
    id: 'activation',
    label: 'Activation',
    description: "Can't start / Procrastinating",
    icon: '🚀'
  },
  {
    id: 'focus',
    label: 'Focus',
    description: 'Distracted / Zoning out',
    icon: '🎯'
  },
  {
    id: 'effort',
    label: 'Effort/Alertness',
    description: 'Tired / Brain fog / Slow processing',
    icon: '⚡'
  },
  {
    id: 'emotion',
    label: 'Emotion',
    description: 'Frustrated / Sensitive / Overwhelmed',
    icon: '💙'
  },
  {
    id: 'memory',
    label: 'Memory',
    description: 'Forgot the goal / Juggling too much',
    icon: '🧠'
  },
  {
    id: 'action',
    label: 'Action',
    description: "Restless / Impulsive / Can't stop",
    icon: '🌊'
  }
]

// ============================================
// DRILL SERGEANT THOUGHTS (Attuned Ally)
// ============================================

export const drillSergeantThoughts = [
  { id: 'lazy', text: "I'm just lazy." },
  { id: 'harder', text: 'I need to try harder.' },
  { id: 'excuses', text: "I'm making excuses." },
  { id: 'messy', text: "I'm messy/disorganised." },
  { id: 'broken', text: "Something is wrong with me." },
  { id: 'should', text: "I should be able to do this." }
]

// ============================================
// MICRO-ACTIONS BY BLOCK (Attuned Ally)
// ============================================

export const microActions: Record<string, MicroAction[]> = {
  effort: [
    { id: 'water', text: 'Drink one large glass of water right now.', category: 'food', why: 'Dehydration impacts executive functioning and mood.' },
    { id: 'protein', text: 'Add one source of protein to your next meal.', category: 'food', why: 'Protein prevents blood sugar crashes that worsen focus.' },
    { id: 'fruit-pouch', text: 'Eat a fruit pouch or a handful of nuts.', category: 'food', why: 'Quick nutrients with minimal effort.' },
    { id: 'rest-5', text: 'Rest with your eyes closed for 5 minutes.', category: 'rest', why: 'Brief rest can restore mental energy.' },
    { id: 'stretch', text: 'Stand up and stretch for 30 seconds.', category: 'exercise', why: 'Movement increases blood flow and alertness.' }
  ],
  activation: [
    { id: 'timer-5', text: 'Set a timer for just 5 minutes and start.', category: 'general', why: 'Starting is the hardest part; tiny commitments help.' },
    { id: 'one-thing', text: 'Write down just ONE thing you need to do next.', category: 'general', why: 'Narrows focus to a single action.' },
    { id: 'body-double', text: 'Text a friend or put on a "study with me" video.', category: 'social', why: 'Body doubling provides accountability.' },
    { id: 'change-location', text: 'Move to a different spot to work.', category: 'general', why: 'Environmental change triggers mental reset.' },
    { id: 'coffee-check', text: 'Ask: Will caffeine help or spike anxiety?', category: 'food', why: 'Caffeine affects ADHD brains differently.' }
  ],
  focus: [
    { id: 'phone-away', text: 'Put your phone in another room for 15 minutes.', category: 'general', why: 'Removing distractions reduces effort to focus.' },
    { id: 'one-tab', text: 'Close all browser tabs except one.', category: 'general', why: 'Visual clutter competes for attention.' },
    { id: 'music', text: 'Put on instrumental music or brown noise.', category: 'enjoyment', why: 'Background noise can mask distractions.' },
    { id: 'water-focus', text: 'Drink a glass of water.', category: 'food', why: 'Dehydration impacts focus.' },
    { id: 'write-distraction', text: "Write down what's distracting you, then return.", category: 'general', why: 'Externalising thoughts frees working memory.' }
  ],
  emotion: [
    { id: 'breathe', text: 'Take 3 slow, deep breaths right now.', category: 'rest', why: 'Activates parasympathetic nervous system.' },
    { id: 'name-feeling', text: "Name the emotion you're feeling out loud.", category: 'general', why: 'Naming emotions reduces their intensity.' },
    { id: 'cold-water', text: 'Splash cold water on your face or hold ice.', category: 'general', why: 'Cold activates the dive reflex, calming you.' },
    { id: 'text-friend', text: 'Send one text to someone who feels safe.', category: 'social', why: 'Social connection regulates the nervous system.' },
    { id: 'sugar-swap', text: 'Swap a sugary snack for fruit or cheese.', category: 'food', why: 'Steady energy helps emotional regulation.' }
  ],
  memory: [
    { id: 'write-goal', text: 'Write your main goal on a sticky note.', category: 'general', why: 'External reminders reduce working memory load.' },
    { id: 'whiteboard', text: 'Write what you need to remember somewhere visible.', category: 'general', why: 'Externalising frees mental bandwidth.' },
    { id: 'alarm', text: 'Set an alarm for your next important task.', category: 'general', why: 'Counteracts time blindness.' },
    { id: 'voice-memo', text: 'Record a quick voice memo to yourself.', category: 'general', why: 'Speaking aids memory encoding.' },
    { id: 'lunch-alarm', text: 'Set an alarm to remind you to eat.', category: 'food', why: 'Prevents hyperfocus meal-skipping.' }
  ],
  action: [
    { id: 'walk', text: 'Take a 5-minute walk, even around your home.', category: 'exercise', why: 'Movement channels restless energy.' },
    { id: 'fidget', text: 'Pick up something to fidget with.', category: 'general', why: 'Fidgeting helps regulate hyperactive energy.' },
    { id: 'pause-10', text: 'Before your next action, count to 10.', category: 'general', why: 'Creates space between impulse and action.' },
    { id: 'jumping-jacks', text: 'Do 10 jumping jacks or star jumps.', category: 'exercise', why: 'Burns excess physical energy quickly.' },
    { id: 'one-pot', text: 'Simplify: one-pot meals, one task at a time.', category: 'food', why: 'Reduces executive function demands.' }
  ]
}

// ============================================
// EMOTIONS & SENSATIONS (Impulse Brake)
// ============================================

export const emotions: EmotionTag[] = [
  { id: 'anger', label: 'Anger', icon: '😤' },
  { id: 'anxiety', label: 'Anxiety', icon: '😰' },
  { id: 'sadness', label: 'Sadness', icon: '😢' },
  { id: 'shame', label: 'Shame', icon: '😔' },
  { id: 'overwhelm', label: 'Overwhelm', icon: '🤯' },
  { id: 'frustration', label: 'Frustration', icon: '😤' },
  { id: 'rejection', label: 'Rejection', icon: '💔' }
]

export const physicalSensations: EmotionTag[] = [
  { id: 'heart_racing', label: 'Heart racing', icon: '💓' },
  { id: 'jaw_clenched', label: 'Jaw clenched', icon: '😬' },
  { id: 'shaking', label: 'Shaking', icon: '🫨' },
  { id: 'hot', label: 'Feeling hot', icon: '🔥' },
  { id: 'tight_chest', label: 'Tight chest', icon: '😮‍💨' },
  { id: 'nausea', label: 'Nausea', icon: '🤢' }
]

export const externalTriggers: EmotionTag[] = [
  { id: 'loud_noises', label: 'Loud noises', icon: '🔊' },
  { id: 'criticism', label: 'Criticism', icon: '👎' },
  { id: 'demands', label: 'Too many demands', icon: '📋' },
  { id: 'rejection', label: 'Feeling rejected', icon: '🚫' },
  { id: 'waiting', label: 'Having to wait', icon: '⏰' },
  { id: 'interruption', label: 'Being interrupted', icon: '✋' }
]

// ============================================
// STEP BACK ACTIONS (Impulse Brake)
// ============================================

export const stepBackActions = [
  { id: 'breathe', text: 'Take 3 deep breaths', icon: '🌬️' },
  { id: 'leave_room', text: 'Physically leave the room', icon: '🚪' },
  { id: 'count', text: 'Count to 10 slowly', icon: '🔢' },
  { id: 'stretch', text: 'Put the phone down and stretch', icon: '🧘' }
]

// ============================================
// PROCEED RESPONSES (Impulse Brake)
// ============================================

export const proceedResponses = [
  { id: 'let_go', text: 'Let it go and walk away', icon: '🚶' },
  { id: 'communicate', text: 'Communicate calmly', icon: '💬' },
  { id: 'timeout', text: 'Ask for a timeout', icon: '⏸️' },
  { id: 'do_nothing', text: 'Do nothing until calm', icon: '🧘' }
]

// ============================================
// MINDFUL RESPONSES BY CATEGORY (Impulse Brake)
// ============================================

export const mindfulResponses: Record<string, ImpulseResponse[]> = {
  social: [
    { id: 'excuse', text: 'Excuse yourself momentarily to the bathroom or outside.', why: 'Taking a step back creates necessary distance from the trigger.', forCategories: ['social'] },
    { id: 'breathe-social', text: 'Take 3 breaths before responding to anyone.', why: 'Prevents reactive communication.', forCategories: ['social'] }
  ],
  anger: [
    { id: 'count-anger', text: 'Count to 10 slowly before speaking.', why: 'Slowing down prevents reacting purely on emotion.', forCategories: ['anger'] },
    { id: 'write-anger', text: 'Write down what you want to say before saying it.', why: 'Externalising thoughts creates reflection space.', forCategories: ['anger'] }
  ],
  anxiety: [
    { id: 'observe-anxiety', text: 'Name 3 things you can see and 3 things you can hear.', why: 'Shifts focus from internal thoughts to external reality.', forCategories: ['anxiety'] },
    { id: 'ground-anxiety', text: 'Feel your feet on the floor. You are here, now.', why: 'Grounding reduces spiralling thoughts.', forCategories: ['anxiety'] }
  ],
  buying: [
    { id: 'wait-24', text: 'Wait 24 hours. If you still need it tomorrow, come back.', why: 'Aligns actions with long-term wellbeing.', forCategories: ['buying'] },
    { id: 'list-check', text: 'Check: Is this on my planned list?', why: 'Reduces impulse purchases.', forCategories: ['buying'] }
  ],
  rsd: [
    { id: 'mantra-rsd', text: "Read your mantra: 'I am enough just as I am.'", why: 'Affirmations counteract shameful thoughts.', forCategories: ['rsd'] },
    { id: 'reality-rsd', text: "Ask: What evidence do I have that I'm being rejected?", why: 'Reality-checking interrupts RSD spirals.', forCategories: ['rsd'] }
  ],
  sensory: [
    { id: 'headphones', text: 'Put on noise-cancelling headphones or find a quiet space.', why: 'Reducing stimuli is a valid mindful response.', forCategories: ['sensory'] },
    { id: 'dark-room', text: 'Find a dark or dimly lit room for a few minutes.', why: 'Visual rest helps sensory overload.', forCategories: ['sensory'] }
  ]
}

// ============================================
// SHAME AFFIRMATIONS (Logic Rule 1)
// ============================================

export const shameAffirmations = [
  "Mistakes are a natural part of growth.",
  "I am learning, not failing.",
  "My worth isn't determined by my productivity.",
  "I am enough, exactly as I am right now.",
  "Having ADHD doesn't make me broken.",
  "Struggling doesn't mean I'm not trying."
]

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getRandomActions(blockType: string, count: number = 3): MicroAction[] {
  const actions = microActions[blockType] || microActions['effort']
  const shuffled = [...actions].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export function getAttunedReframe(blockType: string): string {
  const block = executiveBlocks.find(b => b.id === blockType)
  const blockLabel = block?.label.toLowerCase() || 'executive functioning'
  
  return `I have a neurodivergent brain. This challenge with ${blockLabel} isn't a character flaw; it's a difference in my executive functioning. I don't need to be neurotypical to be enough. I just need to support myself.`
}

export function getMindfulResponse(emotions: string[], triggers: string[]): ImpulseResponse {
  // Determine category based on emotions and triggers
  let category = 'anxiety' // default
  
  if (emotions.includes('anger') || emotions.includes('frustration')) {
    category = 'anger'
  } else if (emotions.includes('rejection') || emotions.includes('shame')) {
    category = 'rsd'
  } else if (triggers.includes('loud_noises') || triggers.includes('overwhelm')) {
    category = 'sensory'
  } else if (triggers.includes('criticism') || triggers.includes('demands')) {
    category = 'social'
  }
  
  const responses = mindfulResponses[category] || mindfulResponses['anxiety']
  return responses[Math.floor(Math.random() * responses.length)]
}

export function getRandomAffirmation(): string {
  return shameAffirmations[Math.floor(Math.random() * shameAffirmations.length)]
}

// ============================================
// MOOD HELPERS
// ============================================

export function getMoodEmoji(score: number): string {
  if (score <= 2) return '😢'
  if (score <= 4) return '😔'
  if (score <= 6) return '😐'
  if (score <= 8) return '😊'
  return '😄'
}

export function getMoodColor(score: number): string {
  if (score <= 3) return 'text-red-500'
  if (score <= 6) return 'text-yellow-500'
  return 'text-green-500'
}

export function getMoodBgColor(score: number): string {
  if (score <= 3) return 'bg-red-100'
  if (score <= 6) return 'bg-yellow-100'
  return 'bg-green-100'
}
