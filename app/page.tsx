import { redirect } from 'next/navigation'

export default function Home() {
  // Redirect to onboarding for the landing experience
  redirect('/onboarding')
}
