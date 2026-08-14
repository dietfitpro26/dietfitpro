import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const Route = createFileRoute('/')({
  component: IndexComponent,
})

function IndexComponent() {
  useEffect(() => {
    async function checkAuthAndRedirect() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        // Pas connecté → login
        window.location.href = '/login'
        return
      }

      // Connecté·´e → charger profil et rediriger selon rôle
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, profile_complete')
        .eq('id', session.user.id)
        .single()

      if (!profile) {
        // Profil introuvable → logout + login
        await supabase.auth.signOut()
        window.location.href = '/login'
        return
      }

      if (!profile.profile_complete) {
        // Profil incomplet → bienvenue
        window.location.href = '/bienvenue'
        return
      }

      // Redirection selon rôle
      switch (profile.role) {
        case 'pro':
          window.location.href = '/pro/dashboard'
          break
        case 'patient':
          window.location.href = '/patient/dashboard'
          break
        case 'subscriber':
          window.location.href = '/subscriber/nutrition'
          break
        default:
          window.location.href = '/login'
      }
    }

    checkAuthAndRedirect()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirection...</p>
      </div>
    </div>
  )
}
