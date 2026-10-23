import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { AlertCircle } from 'lucide-react'

export const Route = createFileRoute('/unauthorized')({
  component: UnauthorizedComponent,
})

function UnauthorizedComponent() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <CardTitle className="text-2xl">Accè·´s refusé·´e</CardTitle>
          <CardDescription>
            Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground">
          <p>
            Cette zone est réservé·´e à un autre type d'utilisateur.
            Si vous pensez qu'il s'agit d'une erreur, contactez le support.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button asChild className="w-full">
            <Link to="/login">Retour à la connexion</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/">Page d'accueil</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
