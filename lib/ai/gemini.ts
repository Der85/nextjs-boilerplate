import { GoogleGenerativeAI } from '@google/generative-ai'
import type { DumpParseResult, ParsedTask } from '@/lib/types'
import { DEFAULT_CATEGORY_NAMES } from '@/lib/utils/categories'
import { getDumpParsePrompt } from './prompts'
import { dumpParseSchema } from './schemas'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function parseBrainDump(rawText: string): Promise<DumpParseResult> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
      responseSchema: dumpParseSchema,
    },
  })

  const result = await model.generateContent([
    { text: getDumpParsePrompt() },
    { text: `Brain dump:\n${rawText}` },
  ])

  const response = result.response
  const text = response.text()
  const parsed = JSON.parse(text)

  // Validate and sanitize each task
  const tasks: ParsedTask[] = (parsed.tasks || [])
    .map((t: Record<string, unknown>) => ({
      title: String(t.title || '').trim().slice(0, 500),
      due_date: typeof t.due_date === 'string' && t.due_date ? t.due_date : null,
      due_time: typeof t.due_time === 'string' && t.due_time ? t.due_time : null,
      priority: (['low', 'medium', 'high'].includes(t.priority as string) ? t.priority : 'medium') as 'low' | 'medium' | 'high',
      confidence: typeof t.confidence === 'number' ? Math.min(Math.max(t.confidence, 0), 1) : 0.8,
      original_fragment: String(t.original_fragment || '').trim().slice(0, 1000),
      category: DEFAULT_CATEGORY_NAMES.includes(t.category as string) ? (t.category as string) : 'Admin',
      category_confidence: typeof t.category_confidence === 'number' ? Math.min(Math.max(t.category_confidence, 0), 1) : 0.5,
    }))
    .filter((t: ParsedTask) => t.title.length > 0)

  return { tasks }
}

/**
 * Categorize a single task using AI
 * Used for quick capture and manual task creation
 */
export async function categorizeTask(taskTitle: string): Promise<{ category: string; confidence: number }> {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 256,
        responseMimeType: 'application/json',
      },
    })

    const prompt = `Categorize this task into one life category.

Task: "${taskTitle}"

Categories: Work, Health, Home, Finance, Social, Personal Growth, Admin, Family

Return JSON: { "category": string, "confidence": number (0-1) }
- confidence 0.9-1.0: Very clear match
- confidence 0.7-0.9: Likely correct
- confidence 0.5-0.7: Ambiguous
- confidence below 0.5: Very uncertain`

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const parsed = JSON.parse(text)

    const category = DEFAULT_CATEGORY_NAMES.includes(parsed.category) ? parsed.category : 'Admin'
    const confidence = typeof parsed.confidence === 'number' ? Math.min(Math.max(parsed.confidence, 0), 1) : 0.5

    return { category, confidence }
  } catch {
    // Fallback to Admin with low confidence on any error
    return { category: 'Admin', confidence: 0.3 }
  }
}
