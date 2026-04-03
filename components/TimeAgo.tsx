'use client'

import { useState, useEffect } from 'react'
import { timeAgo } from '@/lib/utils/time'

interface TimeAgoProps {
  timestamp: string
}

export function TimeAgo({ timestamp }: TimeAgoProps) {
  const [label, setLabel] = useState(() => timeAgo(timestamp))

  useEffect(() => {
    setLabel(timeAgo(timestamp))
    const id = setInterval(() => setLabel(timeAgo(timestamp)), 30_000)
    return () => clearInterval(id)
  }, [timestamp])

  return <span suppressHydrationWarning>{label}</span>
}
