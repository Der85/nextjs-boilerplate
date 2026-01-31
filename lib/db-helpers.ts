// Database Helper Utilities
// Provides consistent error handling for Supabase operations

import { SupabaseClient, PostgrestError } from '@supabase/supabase-js'

export interface DbResult<T> {
  data: T | null
  error: PostgrestError | null
  success: boolean
}

/**
 * Wraps a Supabase insert operation with proper error handling
 */
export async function dbInsert<T>(
  supabase: SupabaseClient,
  table: string,
  data: Record<string, unknown>,
  options?: { returning?: boolean }
): Promise<DbResult<T>> {
  try {
    const query = supabase.from(table).insert(data)
    
    if (options?.returning !== false) {
      const { data: result, error } = await query.select().single()
      return {
        data: result as T | null,
        error,
        success: !error
      }
    } else {
      const { error } = await query
      return {
        data: null,
        error,
        success: !error
      }
    }
  } catch (e) {
    console.error(`Database insert error (${table}):`, e)
    return {
      data: null,
      error: { message: String(e), code: 'UNKNOWN', details: '', hint: '' } as PostgrestError,
      success: false
    }
  }
}

/**
 * Wraps a Supabase update operation with proper error handling
 * IMPORTANT: Always include user_id in filters for defense-in-depth
 */
export async function dbUpdate<T>(
  supabase: SupabaseClient,
  table: string,
  data: Record<string, unknown>,
  filters: { id: string; user_id: string; [key: string]: unknown }
): Promise<DbResult<T>> {
  try {
    let query = supabase.from(table).update(data)
    
    // Apply all filters
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value)
    }
    
    const { data: result, error } = await query.select().single()
    
    return {
      data: result as T | null,
      error,
      success: !error
    }
  } catch (e) {
    console.error(`Database update error (${table}):`, e)
    return {
      data: null,
      error: { message: String(e), code: 'UNKNOWN', details: '', hint: '' } as PostgrestError,
      success: false
    }
  }
}

/**
 * Wraps a Supabase delete operation with proper error handling
 * IMPORTANT: Always include user_id in filters for defense-in-depth
 */
export async function dbDelete(
  supabase: SupabaseClient,
  table: string,
  filters: { id: string; user_id: string; [key: string]: unknown }
): Promise<DbResult<null>> {
  try {
    let query = supabase.from(table).delete()
    
    // Apply all filters
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value)
    }
    
    const { error } = await query
    
    return {
      data: null,
      error,
      success: !error
    }
  } catch (e) {
    console.error(`Database delete error (${table}):`, e)
    return {
      data: null,
      error: { message: String(e), code: 'UNKNOWN', details: '', hint: '' } as PostgrestError,
      success: false
    }
  }
}

/**
 * Safe fetch with user scoping
 */
export async function dbFetch<T>(
  supabase: SupabaseClient,
  table: string,
  userId: string,
  options?: {
    filters?: Record<string, unknown>
    orderBy?: { column: string; ascending?: boolean }
    limit?: number
    single?: boolean
  }
): Promise<DbResult<T | T[]>> {
  try {
    let query = supabase.from(table).select('*').eq('user_id', userId)
    
    // Apply additional filters
    if (options?.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        query = query.eq(key, value)
      }
    }
    
    // Apply ordering
    if (options?.orderBy) {
      query = query.order(options.orderBy.column, { 
        ascending: options.orderBy.ascending ?? false 
      })
    }
    
    // Apply limit
    if (options?.limit) {
      query = query.limit(options.limit)
    }
    
    // Single or multiple
    if (options?.single) {
      const { data, error } = await query.single()
      return { data: data as T | null, error, success: !error }
    } else {
      const { data, error } = await query
      return { data: (data || []) as T[], error, success: !error }
    }
  } catch (e) {
    console.error(`Database fetch error (${table}):`, e)
    return {
      data: options?.single ? null : [],
      error: { message: String(e), code: 'UNKNOWN', details: '', hint: '' } as PostgrestError,
      success: false
    }
  }
}

/**
 * Handle database errors in UI - returns user-friendly message
 */
export function getErrorMessage(error: PostgrestError | null): string {
  if (!error) return 'An unknown error occurred'
  
  // Common Supabase error codes
  switch (error.code) {
    case '23505':
      return 'This item already exists'
    case '23503':
      return 'Referenced item not found'
    case '42501':
      return 'You don\'t have permission to do this'
    case 'PGRST116':
      return 'Item not found'
    case '22P02':
      return 'Invalid data format'
    default:
      return error.message || 'Something went wrong. Please try again.'
  }
}
