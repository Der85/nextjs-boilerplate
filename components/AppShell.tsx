'use client'

import { usePathname } from 'next/navigation'
import BottomTabBar from './BottomTabBar'

// Pages that should NOT show the bottom tab bar
const PUBLIC_ROUTES = ['/login', '/register', '/onboarding']

export default function AppShell() {
  const pathname = usePathname()

  // Don't show tab bar on public/auth routes or root page
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))
  const isRootPage = pathname === '/'

  if (isPublicRoute || isRootPage) return null

  return <BottomTabBar />
}
