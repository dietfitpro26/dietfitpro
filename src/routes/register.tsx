import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/register')({
  component: RegisterComponent,
})

function RegisterComponent() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'patient' as 'pro' | 'patient' | 'subscriber',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validations
    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    if (formData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractè·´res')
      return
    }

    setLoading(true)

    try {
      // 1. Créer utilisateur
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('Erreur création compte')

      // 2. Créer profil avec profile_complete=false et subscription_tier=basic
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        email: formData.email,
        role: formData.role,
        profile_complete: false,
        subscription_tier: 'basic',
      })

      if (profileError) throw profileError

      // 3. Rediriger vers bienvenue pour compléter profil
      navigate({ to: '/bienvenue' })
    } catch (err: any) {
      console.error('Register error:', err)
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Cré·´er un compte</CardTitle>
          <CardDescription>
            Rejoignez DietFitPro pour commencer votre parcours santé
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>Je suis</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['pro', 'patient', 'subscriber'] as const).map((role) => (
                  <Button
                    key={role}
                    type="button"
                    variant={formData.role === role ? 'default' : 'outline'}
                    className="w-full"
                    onClick={() => setFormData({ ...formData, role })}
                    disabled={loading}
                  >
                    {role === 'pro' && 'Pro'}
                    {role === 'patient' && 'Patient'}
                    {role === 'subscriber' && 'Subscriber'}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              S'inscrire
            </Button>
          </CardFooter>
        </form>
        <div className="px-6 pb-6 text-center text-sm text-muted-foreground">
          Déjà·´ un compte ?{' '}
          <Button variant="link" className="p-0" onClick={() => navigate({ to: '/login' })}>
            Se connecter
          </Button>
        </div>
      </Card>
    </div>
  )
}
