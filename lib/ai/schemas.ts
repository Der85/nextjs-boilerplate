import { SchemaType } from '@google/generative-ai'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GeminiSchema = any

export const dumpParseSchema: GeminiSchema = {
  type: SchemaType.OBJECT,
  properties: {
    tasks: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          due_date: { type: SchemaType.STRING, nullable: true },
          due_time: { type: SchemaType.STRING, nullable: true },
          priority: { type: SchemaType.STRING, enum: ['low', 'medium', 'high'] },
          confidence: { type: SchemaType.NUMBER },
          original_fragment: { type: SchemaType.STRING },
        },
        required: ['title', 'priority', 'confidence', 'original_fragment'],
      },
    },
  },
  required: ['tasks'],
}

export const categorizeSchema: GeminiSchema = {
  type: SchemaType.OBJECT,
  properties: {
    categories: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          icon: { type: SchemaType.STRING },
          color: { type: SchemaType.STRING },
          task_ids: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          reasoning: { type: SchemaType.STRING },
        },
        required: ['name', 'icon', 'color', 'task_ids', 'reasoning'],
      },
    },
  },
  required: ['categories'],
}
