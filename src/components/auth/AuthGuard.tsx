'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import { LoadingScreen } from '../../components/ui/Loading'

interface AuthGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
  redirectTo?: string
}

export function AuthGuard({ 
  children, 
  requireAuth = true,
  redirectTo = '/auth/signin' 
}: AuthGuardProps) {
  const [isChecking, setIsChecking] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        setIsAuthenticated(!!user)

        if (requireAuth && !user) {
          router.push(redirectTo)
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        if (requireAuth) {
          router.push(redirectTo)
        }
      } finally {
        setIsChecking(false)
      }
    }

    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsAuthenticated(!!session?.user)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router, requireAuth, redirectTo])

  if (isChecking) {
    return <LoadingScreen message="Checking authentication..." />
  }

  if (requireAuth && !isAuthenticated) {
    return null
  }

  return <>{children}</>
}
