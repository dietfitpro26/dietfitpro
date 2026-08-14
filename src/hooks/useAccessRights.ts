import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

interface Profile {
  id: string
  role: 'pro' | 'patient' | 'subscriber'
  profile_complete: boolean
  subscription_tier: 'basic' | 'premium'
}

export function useAccessRights() {
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user || authLoading) {
      setLoading(authLoading)
      return
    }

    async function loadProfile() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, role, profile_complete, subscription_tier')
          .eq('id', user.id)
          .single()

        if (error || !data) {
          console.error('Profile not found:', error)
          setProfile(null)
          setLoading(false)
          return
        }

        setProfile(data)
        setLoading(false)
      } catch (err) {
        console.error('Error loading profile:', err)
        setLoading(false)
      }
    }

    loadProfile()
  }, [user, authLoading])

  // Vérifications
  const isPro = profile?.role === 'pro'
  const isPatient = profile?.role === 'patient'
  const isSubscriber = profile?.role === 'subscriber'
  const isPremium = profile?.subscription_tier === 'premium'
  const profileComplete = profile?.profile_complete ?? false

  // Hooks de redirection
  const requireAuth = () => {
    if (!user && !loading) {
      navigate({ to: '/login' })
      return false
    }
    return true
  }

  const requireProfileComplete = () => {
    if (!profileComplete && !loading) {
      navigate({ to: '/bienvenue' })
      return false
    }
    return true
  }

  const requireRole = (allowedRoles: ('pro' | 'patient' | 'subscriber')[]) => {
    if (!profile && !loading) {
      navigate({ to: '/login' })
      return false
    }

    if (profile && !allowedRoles.includes(profile.role)) {
      navigate({ to: '/unauthorized' })
      return false
    }

    return true
  }

  const requirePremium = () => {
    if (!isPremium && !loading) {
      // Option: rediriger vers page upgrade
      navigate({ to: '/unauthorized' })
      return false
    }
    return true
  }

  // Redirection automatique selon rôle
  const redirectToDashboard = () => {
    if (!profile || loading) return

    if (!profileComplete) {
      navigate({ to: '/bienvenue' })
      return
    }

    switch (profile.role) {
      case 'pro':
        navigate({ to: '/pro/dashboard' })
        break
      case 'patient':
        navigate({ to: '/patient/dashboard' })
        break
      case 'subscriber':
        navigate({ to: '/subscriber/nutrition' })
        break
    }
  }

  return {
    user,
    profile,
    loading: loading || authLoading,
    isPro,
    isPatient,
    isSubscriber,
    isPremium,
    profileComplete,
    requireAuth,
    requireProfileComplete,
    requireRole,
    requirePremium,
    redirectToDashboard,
  }
}
