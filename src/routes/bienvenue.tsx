import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export const Route = createFileRoute('/bienvenue')({
  component: BienvenueComponent,
})

function BienvenueComponent() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    birthDate: '',
    gender: '',
    height: '',
    weight: '',
    goal: '',
  })

  // Vérifier que l'utilisateur est connecté
  useEffect(() => {
    if (!user) {
      navigate({ to: '/login' })
    }
  }, [user, navigate])

  async function handleNext(e: React.FormEvent) {
    e.preventDefault()
    
    if (step === 1) {
      if (!formData.firstName || !formData.lastName || !formData.birthDate) {
        setError('Veuillez remplir tous les champs')
        return
      }
      setStep(2)
      setError(null)
    } else if (step === 2) {
      if (!formData.height || !formData.weight || !formData.goal) {
        setError('Veuillez remplir tous les champs')
        return
      }
      setStep(3)
      setError(null)
    }
  }

  async function handleComplete() {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      // Mettre à jour le profil avec les informations
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          birth_date: formData.birthDate,
          gender: formData.gender || null,
          height_cm: formData.height ? parseFloat(formData.height) : null,
          weight_kg: formData.weight ? parseFloat(formData.weight) : null,
          goal: formData.goal || null,
          profile_complete: true, // ← IMPORTANT: marque le profil comme complet
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      // Rėcupėrer le rôle pour rediriger vers le bon dashboard
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile) throw new Error('Profil introuvable')

      // Redirection selon rôle
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
    } catch (err: any) {
      console.error('Bienvenue error:', err)
      setError(err.message || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-6 w-6 text-primary" />
            <CardTitle>Bienvenue !</CardTitle>
          </div>
          <CardDescription>
            Complé·´tez votre profil pour accéder à votre espace
          </CardDescription>
        </CardHeader>
        <form>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prėnom</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Date de naissance</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    disabled={loading}
                  />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="height">Taille (cm)</Label>
                  <Input
                    id="height"
                    type="number"
                    placeholder="170"
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight">Poids (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    placeholder="70"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goal">Objectif principal</Label>
                  <Input
                    id="goal"
                    placeholder="Perte de poids, Prise de masse, etc."
                    value={formData.goal}
                    onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                    disabled={loading}
                  />
                </div>
              </>
            )}

            {step === 3 && (
              <div className="text-center py-8">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Profil prêt !</h3>
                <p className="text-muted-foreground">
                  Vous allez être redirigé·´e vers votre espace personnel.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex gap-2">
            {step > 1 && step < 3 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(step - 1)}
                disabled={loading}
              >
                Retour
              </Button>
            )}
            {step < 3 ? (
              <Button type="button" onClick={handleNext} className="flex-1" disabled={loading}>
                {step === 2 ? 'Suivant' : 'Continuer'}
              </Button>
            ) : (
              <Button onClick={handleComplete} className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Accé·´der à mon espace
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
