import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @google/generative-ai before importing the module under test
vi.mock('@google/generative-ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@google/generative-ai')>()
  const generateContent = vi.fn()
  const getGenerativeModel = vi.fn(() => ({ generateContent }))
  const GoogleGenerativeAI = vi.fn(() => ({ getGenerativeModel }))
  return { ...actual, GoogleGenerativeAI }
})

import { parseBrainDump, categorizeTask } from '@/lib/ai/gemini'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ============================================
// Helpers
// ============================================

function mockGenerateContent(responseText: string) {
  const instance = new (GoogleGenerativeAI as ReturnType<typeof vi.fn>)('')
  const model = instance.getGenerativeModel()
  ;(model.generateContent as ReturnType<typeof vi.fn>).mockResolvedValue({
    response: { text: () => responseText },
  })
}

function getGenerateContentMock() {
  const instance = new (GoogleGenerativeAI as ReturnType<typeof vi.fn>)('')
  return instance.getGenerativeModel().generateContent as ReturnType<typeof vi.fn>
}

// ============================================
// parseBrainDump
// ============================================

describe('parseBrainDump', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses a valid AI response into tasks', async () => {
    mockGenerateContent(JSON.stringify({
      tasks: [
        {
          title: 'Buy groceries',
          due_date: '2024-03-15',
          due_time: null,
          priority: 'medium',
          confidence: 0.9,
          original_fragment: 'buy groceries',
          category: 'Home',
          category_confidence: 0.95,
        },
      ],
    }))

    const result = await parseBrainDump('buy groceries')
    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0].title).toBe('Buy groceries')
    expect(result.tasks[0].category).toBe('Home')
  })

  it('filters out tasks with empty titles', async () => {
    mockGenerateContent(JSON.stringify({
      tasks: [
        { title: '', due_date: null, due_time: null, priority: 'medium', confidence: 0.9, original_fragment: '', category: 'Admin', category_confidence: 0.5 },
        { title: 'Valid task', due_date: null, due_time: null, priority: 'medium', confidence: 0.9, original_fragment: 'valid', category: 'Work', category_confidence: 0.8 },
      ],
    }))

    const result = await parseBrainDump('some text')
    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0].title).toBe('Valid task')
  })

  it('falls back to "Admin" for invalid categories', async () => {
    mockGenerateContent(JSON.stringify({
      tasks: [
        { title: 'Do something', due_date: null, due_time: null, priority: 'medium', confidence: 0.9, original_fragment: 'do something', category: 'InvalidCategory', category_confidence: 0.5 },
      ],
    }))

    const result = await parseBrainDump('do something')
    expect(result.tasks[0].category).toBe('Admin')
  })

  it('falls back to "medium" for invalid priority', async () => {
    mockGenerateContent(JSON.stringify({
      tasks: [
        { title: 'Task', due_date: null, due_time: null, priority: 'urgent', confidence: 0.9, original_fragment: 'task', category: 'Work', category_confidence: 0.8 },
      ],
    }))

    const result = await parseBrainDump('task')
    expect(result.tasks[0].priority).toBe('medium')
  })

  it('clamps confidence between 0 and 1', async () => {
    mockGenerateContent(JSON.stringify({
      tasks: [
        { title: 'Task', due_date: null, due_time: null, priority: 'high', confidence: 999, original_fragment: 'task', category: 'Work', category_confidence: -5 },
      ],
    }))

    const result = await parseBrainDump('task')
    expect(result.tasks[0].confidence).toBe(1)
    expect(result.tasks[0].category_confidence).toBe(0)
  })

  it('truncates title to 500 characters', async () => {
    const longTitle = 'A'.repeat(600)
    mockGenerateContent(JSON.stringify({
      tasks: [
        { title: longTitle, due_date: null, due_time: null, priority: 'medium', confidence: 0.8, original_fragment: 'a', category: 'Admin', category_confidence: 0.5 },
      ],
    }))

    const result = await parseBrainDump('long title')
    expect(result.tasks[0].title.length).toBe(500)
  })

  it('truncates original_fragment to 1000 characters', async () => {
    const longFragment = 'B'.repeat(1200)
    mockGenerateContent(JSON.stringify({
      tasks: [
        { title: 'Task', due_date: null, due_time: null, priority: 'medium', confidence: 0.8, original_fragment: longFragment, category: 'Admin', category_confidence: 0.5 },
      ],
    }))

    const result = await parseBrainDump('long fragment')
    expect(result.tasks[0].original_fragment.length).toBe(1000)
  })

  it('handles empty tasks array from AI', async () => {
    mockGenerateContent(JSON.stringify({ tasks: [] }))
    const result = await parseBrainDump('nothing here')
    expect(result.tasks).toHaveLength(0)
  })

  it('handles missing tasks key from AI', async () => {
    mockGenerateContent(JSON.stringify({}))
    const result = await parseBrainDump('nothing')
    expect(result.tasks).toHaveLength(0)
  })

  it('accepts all valid categories', async () => {
    const validCategories = ['Work', 'Health', 'Home', 'Finance', 'Social', 'Personal Growth', 'Admin', 'Family']

    for (const cat of validCategories) {
      mockGenerateContent(JSON.stringify({
        tasks: [{ title: 'Task', due_date: null, due_time: null, priority: 'medium', confidence: 0.8, original_fragment: 'task', category: cat, category_confidence: 0.9 }],
      }))

      const result = await parseBrainDump('task')
      expect(result.tasks[0].category).toBe(cat)
    }
  })

  it('sets due_date to null for non-string values', async () => {
    mockGenerateContent(JSON.stringify({
      tasks: [{ title: 'Task', due_date: 12345, due_time: null, priority: 'medium', confidence: 0.8, original_fragment: 'task', category: 'Work', category_confidence: 0.9 }],
    }))

    const result = await parseBrainDump('task')
    expect(result.tasks[0].due_date).toBeNull()
  })
})

// ============================================
// categorizeTask
// ============================================

describe('categorizeTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the AI-suggested category and confidence', async () => {
    mockGenerateContent(JSON.stringify({ category: 'Health', confidence: 0.95 }))

    const result = await categorizeTask('Go for a run')
    expect(result.category).toBe('Health')
    expect(result.confidence).toBe(0.95)
  })

  it('falls back to "Admin" for invalid category in response', async () => {
    mockGenerateContent(JSON.stringify({ category: 'Fitness', confidence: 0.8 }))

    const result = await categorizeTask('Go for a run')
    expect(result.category).toBe('Admin')
  })

  it('clamps confidence to [0, 1]', async () => {
    mockGenerateContent(JSON.stringify({ category: 'Work', confidence: 1.5 }))

    const result = await categorizeTask('Finish report')
    expect(result.confidence).toBe(1)
  })

  it('falls back to Admin with confidence 0.3 on AI error', async () => {
    getGenerateContentMock().mockRejectedValue(new Error('API error'))

    const result = await categorizeTask('Something')
    expect(result.category).toBe('Admin')
    expect(result.confidence).toBe(0.3)
  })

  it('defaults confidence to 0.5 when not a number', async () => {
    mockGenerateContent(JSON.stringify({ category: 'Work', confidence: 'high' }))

    const result = await categorizeTask('Finish report')
    expect(result.confidence).toBe(0.5)
  })
})
