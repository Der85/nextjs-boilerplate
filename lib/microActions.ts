// Micro-Actions Database
// Based on FREES (Food, Rest, Exercise, Enjoyment, Socialisation) framework

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

export const drillSergeantThoughts = [
  { id: 'lazy', text: "I'm just lazy." },
  { id: 'harder', text: 'I need to try harder.' },
  { id: 'excuses', text: "I'm making excuses." },
  { id: 'messy', text: "I'm messy/disorganised." },
  { id: 'broken', text: "Something is wrong with me." },
  { id: 'should', text: "I should be able to do this." }
]

// Micro-actions organized by which blocks they help with
export const microActions: Record<string, MicroAction[]> = {
  // Effort/Alertness focused
  effort: [
    {
      id: 'water',
      text: 'Drink one large glass of water right now.',
      category: 'food',
      why: 'Dehydration impacts executive functioning and mood; water supports brain connection.'
    },
    {
      id: 'protein',
      text: 'Add one source of protein (eggs, beans, nuts, fish) to your next meal.',
      category: 'food',
      why: 'Protein prevents blood sugar surges that can spike hyperactivity and impulsivity.'
    },
    {
      id: 'fruit-pouch',
      text: 'Eat a fruit pouch or a handful of nuts.',
      category: 'food',
      why: 'Getting nutrients in can be hard; pouches reduce friction and effort.'
    },
    {
      id: 'rest-5',
      text: 'Rest with your eyes closed for 5 minutes.',
      category: 'rest',
      why: 'Brief rest can restore mental energy without full sleep.'
    },
    {
      id: 'stretch',
      text: 'Stand up and stretch your arms above your head for 30 seconds.',
      category: 'exercise',
      why: 'Movement increases blood flow and alertness.'
    }
  ],
  
  // Activation focused
  activation: [
    {
      id: 'timer-5',
      text: 'Set a timer for just 5 minutes and start the task.',
      category: 'general',
      why: 'Starting is often the hardest part; tiny commitments reduce activation energy.'
    },
    {
      id: 'one-thing',
      text: 'Write down just ONE thing you need to do next.',
      category: 'general',
      why: 'Reduces overwhelm by narrowing focus to a single action.'
    },
    {
      id: 'body-double',
      text: 'Text a friend or put on a "study with me" video.',
      category: 'social',
      why: 'Body doubling provides accountability and reduces isolation.'
    },
    {
      id: 'change-location',
      text: 'Move to a different spot in your home to work.',
      category: 'general',
      why: 'Environmental change can trigger a mental reset.'
    },
    {
      id: 'coffee-check',
      text: 'Pause before your next coffee. Ask: Will this support focus or spike anxiety?',
      category: 'food',
      why: 'Caffeine can be supportive or anxiety-inducing for ADHD brains.'
    }
  ],
  
  // Focus focused
  focus: [
    {
      id: 'phone-away',
      text: 'Put your phone in another room for 15 minutes.',
      category: 'general',
      why: 'Removing distractions reduces the effort needed to maintain focus.'
    },
    {
      id: 'one-tab',
      text: 'Close all browser tabs except one.',
      category: 'general',
      why: 'Visual clutter competes for attention.'
    },
    {
      id: 'music',
      text: 'Put on instrumental music or brown noise.',
      category: 'enjoyment',
      why: 'Background noise can help mask distractions and support focus.'
    },
    {
      id: 'water-focus',
      text: 'Drink a glass of water.',
      category: 'food',
      why: 'Dehydration impacts executive functioning and focus.'
    },
    {
      id: 'write-distraction',
      text: 'Write down what\'s distracting you, then return to your task.',
      category: 'general',
      why: 'Externalising intrusive thoughts frees up working memory.'
    }
  ],
  
  // Emotion focused
  emotion: [
    {
      id: 'breathe',
      text: 'Take 3 slow, deep breaths right now.',
      category: 'rest',
      why: 'Deep breathing activates the parasympathetic nervous system.'
    },
    {
      id: 'name-feeling',
      text: 'Name the emotion you\'re feeling out loud.',
      category: 'general',
      why: 'Naming emotions reduces their intensity (affect labelling).'
    },
    {
      id: 'cold-water',
      text: 'Splash cold water on your face or hold ice.',
      category: 'general',
      why: 'Cold activates the dive reflex, calming the nervous system.'
    },
    {
      id: 'text-friend',
      text: 'Send one text to someone who makes you feel safe.',
      category: 'social',
      why: 'Social connection regulates the nervous system.'
    },
    {
      id: 'sugar-swap',
      text: 'Swap a high-sugar snack for a piece of fruit or cheese.',
      category: 'food',
      why: 'Sugar can worsen emotional dysregulation; steady energy helps.'
    }
  ],
  
  // Memory focused
  memory: [
    {
      id: 'write-goal',
      text: 'Write your main goal on a sticky note and put it where you can see it.',
      category: 'general',
      why: 'External reminders reduce working memory load.'
    },
    {
      id: 'whiteboard',
      text: 'Write what you need to remember on a whiteboard or your hand.',
      category: 'general',
      why: 'Externalising information frees up mental bandwidth.'
    },
    {
      id: 'alarm',
      text: 'Set an alarm on your phone for your next important task.',
      category: 'general',
      why: 'Counteracts time blindness and reduces reliance on memory.'
    },
    {
      id: 'voice-memo',
      text: 'Record a quick voice memo to yourself.',
      category: 'general',
      why: 'Speaking out loud aids memory encoding.'
    },
    {
      id: 'lunch-alarm',
      text: 'Set an alarm to remind you to eat lunch.',
      category: 'food',
      why: 'Counteracts hyperfocus which leads to skipping meals.'
    }
  ],
  
  // Action focused (restlessness/impulsivity)
  action: [
    {
      id: 'walk',
      text: 'Take a 5-minute walk, even just around your home.',
      category: 'exercise',
      why: 'Movement channels restless energy productively.'
    },
    {
      id: 'fidget',
      text: 'Pick up something to fidget with while you think.',
      category: 'general',
      why: 'Fidgeting can help regulate hyperactive energy.'
    },
    {
      id: 'pause-10',
      text: 'Before your next action, pause and count to 10.',
      category: 'general',
      why: 'Creates space between impulse and action.'
    },
    {
      id: 'jumping-jacks',
      text: 'Do 10 jumping jacks or star jumps.',
      category: 'exercise',
      why: 'Burns off excess physical energy quickly.'
    },
    {
      id: 'one-pot',
      text: 'Cook a one-pot dinner to minimise washing up.',
      category: 'food',
      why: 'Reduces the executive function effort required for cleaning.'
    }
  ]
}

// Get random actions for a given block type
export function getRandomActions(blockType: string, count: number = 3): MicroAction[] {
  const actions = microActions[blockType] || microActions['effort']
  const shuffled = [...actions].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

// Generate the attuned reframe based on the block type
export function getAttunedReframe(blockType: string): string {
  const block = executiveBlocks.find(b => b.id === blockType)
  const blockLabel = block?.label.toLowerCase() || 'executive functioning'
  
  return `I have a neurodivergent brain. This challenge with ${blockLabel} isn't a character flaw; it's a difference in my executive functioning. I don't need to be neurotypical to be enough. I just need to support myself.`
}
