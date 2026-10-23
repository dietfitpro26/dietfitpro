import { createRootRoute, Outlet, redirect } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import { ToastProvider } from '../components/ui/use-toast'
import { ErrorBoundary } from '../lib/error-page'

interface Profile {
  id: string
  role: 'pro' | 'patient' | 'subscriber'
  profile_complete: boolean
  subscription_tier: 'basic' | 'premium'
}

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: ErrorBoundary,
})

function RootComponent() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Charger session initiale
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Écouter changements auth (session expiré·´e, logout, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChanged(async (event, session) => {
      console.log('Auth event:', event, session?.user?.id)
      
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        setLoading(false)
        window.location.href = '/login'
        return
      }

      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setUser(session?.user ?? null)
        if (session?.user) {
          await loadProfile(session.user.id)
        }
      }

      if (event === 'INITIAL_SESSION') {
        setUser(session?.user ?? null)
        if (session?.user) {
          await loadProfile(session.user.id)
        } else {
          setLoading(false)
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function loadProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, profile_complete, subscription_tier')
        .eq('id', userId)
        .single()

      if (error || !data) {
        console.error('Profile not found:', error)
        setProfile(null)
        setLoading(false)
        return
      }

      setProfile(data)

      // Redirection si profil incomplet
      if (!data.profile_complete && window.location.pathname !== '/bienvenue') {
        window.location.href = '/bienvenue'
        return
      }

      setLoading(false)
    } catch (err) {
      console.error('Error loading profile:', err)
      setLoading(false)
    }
  }

  // Vérifier accès routes protégé·´es
  useEffect(() => {
    if (loading || !user || !profile) return

    const path = window.location.pathname
    const isProRoute = path.startsWith('/pro')
    const isPatientRoute = path.startsWith('/patient')
    const isSubscriberRoute = path.startsWith('/subscriber')

    // Si profil incomplet → redirection vers /bienvenue
    if (!profile.profile_complete && path !== '/bienvenue') {
      window.location.href = '/bienvenue'
      return
    }

    // Vérifier rôle
    if (isProRoute && profile.role !== 'pro') {
      window.location.href = '/unauthorized'
      return
    }

    if (isPatientRoute && profile.role !== 'patient') {
      window.location.href = '/unauthorized'
      return
    }

    if (isSubscriberRoute && profile.role !== 'subscriber') {
      window.location.href = '/unauthorized'
      return
    }
  }, [user, profile, loading])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <ToastProvider>
      <div className="relative">
        <Outlet />
      </div>
    </ToastProvider>
  )
}
