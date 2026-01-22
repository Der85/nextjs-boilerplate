// ADHDer.net - Enhanced Data & Types
// Phase 1: Added Coping Skills Database + Improved Compassion Reframes

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

export interface CopingSkill {
  id: string
  text: string
  category: 'distraction' | 'expression' | 'grounding' | 'physical'
  duration: 'quick' | 'medium' | 'long' // quick = <2min, medium = 2-10min, long = 10+min
  intensity: 'low' | 'medium' | 'high' // energy required
  why: string
}

export interface CompassionReframe {
  id: string
  drillSergeantThought: string
  attunedResponse: string
  affirmation: string
  forBlocks: string[] // which executive function blocks this applies to
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
// DRILL SERGEANT THOUGHTS + ATTUNED RESPONSES
// Enhanced with specific reframes per thought
// ============================================

export const drillSergeantThoughts = [
  { id: 'lazy', text: "I'm just lazy." },
  { id: 'harder', text: 'I need to try harder.' },
  { id: 'excuses', text: "I'm making excuses." },
  { id: 'messy', text: "I'm messy/disorganised." },
  { id: 'broken', text: "Something is wrong with me." },
  { id: 'should', text: "I should be able to do this." }
]

export const compassionReframes: CompassionReframe[] = [
  {
    id: 'lazy-reframe',
    drillSergeantThought: "I'm just lazy.",
    attunedResponse: "Laziness isn't real for ADHD brains. What you're experiencing is an activation problem—your brain struggles to generate the neurochemicals needed to start tasks, especially boring ones. This is neurology, not character.",
    affirmation: "I'm not lazy. My brain needs different fuel to get started.",
    forBlocks: ['activation', 'effort']
  },
  {
    id: 'harder-reframe',
    drillSergeantThought: 'I need to try harder.',
    attunedResponse: "You've been trying hard your whole life. The issue isn't effort—it's that you're using neurotypical strategies for a neurodivergent brain. You need different approaches, not more willpower.",
    affirmation: "I don't need to try harder. I need to try differently.",
    forBlocks: ['activation', 'focus', 'effort']
  },
  {
    id: 'excuses-reframe',
    drillSergeantThought: "I'm making excuses.",
    attunedResponse: "Explaining how your brain works isn't making excuses. Understanding your challenges is the first step to working with them. Self-awareness is a strength, not a weakness.",
    affirmation: "Understanding my brain isn't making excuses—it's making progress.",
    forBlocks: ['activation', 'memory', 'focus']
  },
  {
    id: 'messy-reframe',
    drillSergeantThought: "I'm messy/disorganised.",
    attunedResponse: "ADHD brains often use 'visual filing systems'—if you can't see it, it doesn't exist. What looks like mess might actually be your brain's way of keeping track of things. Organisation can look different for different brains.",
    affirmation: "My system doesn't have to look like everyone else's to work for me.",
    forBlocks: ['memory', 'activation', 'focus']
  },
  {
    id: 'broken-reframe',
    drillSergeantThought: "Something is wrong with me.",
    attunedResponse: "You're not broken—you have a brain that works differently in a world designed for neurotypical people. The struggle you feel is real, but it's not a reflection of your worth or potential.",
    affirmation: "I'm not broken. I'm running different software in a world built for a different operating system.",
    forBlocks: ['emotion', 'activation', 'effort', 'focus', 'memory', 'action']
  },
  {
    id: 'should-reframe',
    drillSergeantThought: "I should be able to do this.",
    attunedResponse: "'Should' based on whose brain? Comparing yourself to neurotypical standards is like judging a fish by its ability to climb trees. You have different strengths and challenges.",
    affirmation: "I release the 'shoulds' that don't fit my brain. I embrace what works for me.",
    forBlocks: ['activation', 'focus', 'effort', 'emotion']
  }
]

// Get the specific reframe for a drill sergeant thought
export function getCompassionReframe(thoughtText: string, blockType: string): CompassionReframe | null {
  // Find exact match first
  let reframe = compassionReframes.find(r => r.drillSergeantThought === thoughtText)
  
  // If no exact match, find one that applies to this block
  if (!reframe) {
    reframe = compassionReframes.find(r => r.forBlocks.includes(blockType))
  }
  
  return reframe || null
}

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
// COPING SKILLS DATABASE (Impulse Brake)
// Categorized by type: Distraction vs Expression
// ============================================

export const copingSkills: CopingSkill[] = [
  // === DISTRACTION SKILLS ===
  // Quick distractions (<2 min)
  {
    id: 'cold-water',
    text: 'Splash cold water on your face',
    category: 'distraction',
    duration: 'quick',
    intensity: 'low',
    why: 'Activates the dive reflex, instantly calming your nervous system.'
  },
  {
    id: 'ice-cube',
    text: 'Hold an ice cube in your hand',
    category: 'distraction',
    duration: 'quick',
    intensity: 'low',
    why: 'The intense cold sensation redirects your brain from emotional pain.'
  },
  {
    id: 'count-backwards',
    text: 'Count backwards from 100 by 7s',
    category: 'distraction',
    duration: 'quick',
    intensity: 'low',
    why: 'Engages your prefrontal cortex, interrupting the emotional hijack.'
  },
  {
    id: 'name-5-things',
    text: 'Name 5 blue things you can see',
    category: 'distraction',
    duration: 'quick',
    intensity: 'low',
    why: 'Grounding technique that shifts focus to the present moment.'
  },
  {
    id: 'smell-something',
    text: 'Smell something strong (coffee, perfume, mint)',
    category: 'distraction',
    duration: 'quick',
    intensity: 'low',
    why: 'Scent bypasses the thinking brain and can shift your state instantly.'
  },
  
  // Medium distractions (2-10 min)
  {
    id: 'puzzle-game',
    text: 'Play a quick puzzle game (Wordle, Sudoku)',
    category: 'distraction',
    duration: 'medium',
    intensity: 'low',
    why: 'Occupies the problem-solving brain, leaving less room for rumination.'
  },
  {
    id: 'tidy-one-spot',
    text: 'Tidy one small area (desk, drawer)',
    category: 'distraction',
    duration: 'medium',
    intensity: 'medium',
    why: 'Creates a sense of control and accomplishment.'
  },
  {
    id: 'funny-video',
    text: 'Watch one funny video',
    category: 'distraction',
    duration: 'medium',
    intensity: 'low',
    why: 'Laughter releases endorphins and breaks the emotional spiral.'
  },
  {
    id: 'pet-animal',
    text: 'Pet an animal or look at animal photos',
    category: 'distraction',
    duration: 'medium',
    intensity: 'low',
    why: 'Interacting with animals lowers cortisol and blood pressure.'
  },
  
  // Long distractions (10+ min)
  {
    id: 'take-shower',
    text: 'Take a shower (try alternating hot/cold)',
    category: 'distraction',
    duration: 'long',
    intensity: 'medium',
    why: 'Water is naturally regulating; temperature changes reset your nervous system.'
  },
  {
    id: 'go-for-drive',
    text: 'Go for a drive or walk with music',
    category: 'distraction',
    duration: 'long',
    intensity: 'medium',
    why: 'Movement + music + scenery change is a powerful combination.'
  },
  
  // === EXPRESSION SKILLS ===
  // Quick expression (<2 min)
  {
    id: 'scream-pillow',
    text: 'Scream into a pillow',
    category: 'expression',
    duration: 'quick',
    intensity: 'high',
    why: 'Releases pent-up energy without harming anyone.'
  },
  {
    id: 'tear-paper',
    text: 'Tear up paper or cardboard',
    category: 'expression',
    duration: 'quick',
    intensity: 'medium',
    why: 'Physical destruction in a safe way releases anger.'
  },
  {
    id: 'squeeze-fists',
    text: 'Squeeze your fists tight for 10 seconds, then release',
    category: 'expression',
    duration: 'quick',
    intensity: 'low',
    why: 'Progressive muscle relaxation releases physical tension.'
  },
  
  // Medium expression (2-10 min)
  {
    id: 'voice-note-rant',
    text: 'Record a voice note rant (then delete it)',
    category: 'expression',
    duration: 'medium',
    intensity: 'medium',
    why: 'Gets the thoughts out of your head without consequences.'
  },
  {
    id: 'angry-playlist',
    text: 'Listen to an angry playlist and move your body',
    category: 'expression',
    duration: 'medium',
    intensity: 'high',
    why: 'Music validates the feeling; movement processes it through the body.'
  },
  {
    id: 'write-burn',
    text: 'Write what you want to say, then tear it up',
    category: 'expression',
    duration: 'medium',
    intensity: 'medium',
    why: 'Externalises the thoughts; destroying it is symbolic release.'
  },
  {
    id: 'draw-feeling',
    text: 'Scribble or draw what you\'re feeling',
    category: 'expression',
    duration: 'medium',
    intensity: 'low',
    why: 'Non-verbal expression can access emotions words can\'t reach.'
  },
  
  // Long expression (10+ min)
  {
    id: 'intense-workout',
    text: 'Do an intense workout (punching bag, sprints)',
    category: 'expression',
    duration: 'long',
    intensity: 'high',
    why: 'Burns off adrenaline and cortisol; exhaustion brings calm.'
  },
  {
    id: 'cry-it-out',
    text: 'Let yourself cry (put on a sad song if needed)',
    category: 'expression',
    duration: 'long',
    intensity: 'medium',
    why: 'Tears release stress hormones; crying is self-soothing.'
  },
  
  // === GROUNDING SKILLS ===
  {
    id: '5-4-3-2-1',
    text: '5-4-3-2-1: See 5, Touch 4, Hear 3, Smell 2, Taste 1',
    category: 'grounding',
    duration: 'quick',
    intensity: 'low',
    why: 'Engages all senses to anchor you in the present moment.'
  },
  {
    id: 'feet-on-floor',
    text: 'Press your feet firmly into the floor',
    category: 'grounding',
    duration: 'quick',
    intensity: 'low',
    why: 'Physical grounding reminds your body you are safe right now.'
  },
  {
    id: 'box-breathing',
    text: 'Box breathe: In 4, Hold 4, Out 4, Hold 4',
    category: 'grounding',
    duration: 'quick',
    intensity: 'low',
    why: 'Regulates the nervous system through controlled breathing.'
  },
  {
    id: 'body-scan',
    text: 'Scan your body from toes to head, noticing sensations',
    category: 'grounding',
    duration: 'medium',
    intensity: 'low',
    why: 'Reconnects mind and body; reduces dissociation.'
  },
  
  // === PHYSICAL SKILLS ===
  {
    id: 'jumping-jacks',
    text: 'Do 20 jumping jacks',
    category: 'physical',
    duration: 'quick',
    intensity: 'high',
    why: 'Burns off excess adrenaline quickly.'
  },
  {
    id: 'wall-push-ups',
    text: 'Do wall push-ups until tired',
    category: 'physical',
    duration: 'quick',
    intensity: 'medium',
    why: 'Uses large muscle groups to discharge tension.'
  },
  {
    id: 'shake-it-out',
    text: 'Shake your whole body for 60 seconds',
    category: 'physical',
    duration: 'quick',
    intensity: 'medium',
    why: 'Animals shake after stress; it releases trauma from the body.'
  },
  {
    id: 'dance-one-song',
    text: 'Dance wildly to one song',
    category: 'physical',
    duration: 'medium',
    intensity: 'high',
    why: 'Movement + music + play is a powerful mood shifter.'
  },
  {
    id: 'stretch-routine',
    text: 'Do a 5-minute stretch routine',
    category: 'physical',
    duration: 'medium',
    intensity: 'low',
    why: 'Releases physical tension held in muscles.'
  }
]

// Get coping skills filtered by category and/or duration
export function getCopingSkills(
  category?: 'distraction' | 'expression' | 'grounding' | 'physical',
  duration?: 'quick' | 'medium' | 'long',
  intensity?: 'low' | 'medium' | 'high'
): CopingSkill[] {
  let skills = [...copingSkills]
  
  if (category) {
    skills = skills.filter(s => s.category === category)
  }
  if (duration) {
    skills = skills.filter(s => s.duration === duration)
  }
  if (intensity) {
    skills = skills.filter(s => s.intensity === intensity)
  }
  
  return skills
}

// Get random coping skills for the brake flow
export function getRandomCopingSkills(count: number = 4): CopingSkill[] {
  const shuffled = [...copingSkills].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

// Get coping skills by emotion (smart matching)
export function getCopingSkillsForEmotion(emotions: string[]): CopingSkill[] {
  // High arousal emotions need physical/expression
  const highArousal = ['anger', 'frustration', 'anxiety']
  // Low arousal emotions need grounding/distraction
  const lowArousal = ['sadness', 'shame', 'overwhelm']
  
  const hasHighArousal = emotions.some(e => highArousal.includes(e))
  const hasLowArousal = emotions.some(e => lowArousal.includes(e))
  
  let skills: CopingSkill[] = []
  
  if (hasHighArousal) {
    // Suggest physical and expression skills
    skills = copingSkills.filter(s => 
      s.category === 'physical' || s.category === 'expression'
    )
  } else if (hasLowArousal) {
    // Suggest grounding and distraction skills
    skills = copingSkills.filter(s => 
      s.category === 'grounding' || s.category === 'distraction'
    )
  } else {
    // Mix of all
    skills = [...copingSkills]
  }
  
  // Shuffle and return top 4
  return skills.sort(() => Math.random() - 0.5).slice(0, 4)
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
  { id: 'do_nothing', text: 'Do nothing until calm', icon: '🧘' },
  { id: 'use_coping', text: 'Use a coping skill first', icon: '🛠️' }
]

// ============================================
// SHAME AFFIRMATIONS (Enhanced)
// ============================================

export const shameAffirmations = [
  "Mistakes are a natural part of growth.",
  "I am learning, not failing.",
  "My worth isn't determined by my productivity.",
  "I am enough, exactly as I am right now.",
  "Having ADHD doesn't make me broken.",
  "Struggling doesn't mean I'm not trying.",
  "I deserve the same compassion I'd give a friend.",
  "This feeling will pass. Feelings are visitors, not residents.",
  "I am not my worst moment.",
  "It's okay to be a work in progress.",
  "I can be both imperfect and worthy of love.",
  "My brain works differently, not wrongly."
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
