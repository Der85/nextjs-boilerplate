import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: {
    default: 'ADHDer.io',
    template: '%s | ADHDer.io',
  },
  description: 'Your location is your voice. Post, reply, and connect from where you stand.',
  applicationName: 'ADHDer.io',
  openGraph: {
    type: 'website',
    siteName: 'ADHDer.io',
    title: 'ADHDer.io',
    description: 'Your location is your voice. Post, reply, and connect from where you stand.',
  },
  twitter: {
    card: 'summary',
    title: 'ADHDer.io',
    description: 'Your location is your voice. Post, reply, and connect from where you stand.',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ADHDer.io',
  },
}

export const viewport: Viewport = {
  themeColor: '#0D9488',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
