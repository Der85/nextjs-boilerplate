'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { Category } from '@/lib/types'

interface CategoriesContextValue {
  categories: Category[]
  loading: boolean
  refetch: () => Promise<void>
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>
}

const CategoriesContext = createContext<CategoriesContextValue | null>(null)

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories')
      if (res.ok) {
        const data = await res.json()
        setCategories(data.categories || [])
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  return (
    <CategoriesContext.Provider value={{ categories, loading, refetch: fetchCategories, setCategories }}>
      {children}
    </CategoriesContext.Provider>
  )
}

export function useCategories(): CategoriesContextValue {
  const context = useContext(CategoriesContext)
  if (!context) {
    throw new Error('useCategories must be used within a CategoriesProvider')
  }
  return context
}
