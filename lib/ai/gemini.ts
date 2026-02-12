import { GoogleGenerativeAI } from '@google/generative-ai'
import type { DumpParseResult, ParsedTask } from '@/lib/types'
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
    }))
    .filter((t: ParsedTask) => t.title.length > 0)

  return { tasks }
}
