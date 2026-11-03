import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, Mail, ShieldCheck, User } from "lucide-react";
import { SubscriberLayout } from "@/layouts/SubscriberLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/subscriber/account")({
  head: () => ({ meta: [{ title: "Mon compte — DietFitPro" }] }),
  component: () => (
    <ProtectedRoute allow={["subscriber"]}>
      <SubscriberLayout>
        <SubscriberAccountPage />
      </SubscriberLayout>
    </ProtectedRoute>
  ),
});

function SubscriberAccountPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    setFullName(profile?.full_name ?? "");
    setLoading(false);
  }, [user, profile]);

  const saveName = async (event: FormEvent) => {
    event.preventDefault();

    if (!user) return;

    const name = fullName.trim();

    if (!name) {
      toast.error("Indiquez votre nom complet.");
      return;
    }

    setSavingName(true);

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name })
      .eq("id", user.id);

    setSavingName(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Nom complet mis à jour ✅");
  };

  const savePassword = async (event: FormEvent) => {
    event.preventDefault();

    if (!currentPassword) {
      toast.error("Indiquez votre mot de passe actuel.");
      return;
    }

    if (password.length < 8) {
      toast.error("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (password !== confirm) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }

    if (password === currentPassword) {
      toast.error("Le nouveau mot de passe doit être différent de l’actuel.");
      return;
    }

    setSavingPassword(true);

    const { error } = await supabase.auth.updateUser({
  password,
  current_password: currentPassword,
});

    setSavingPassword(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Mot de passe mis à jour ✅");
    setCurrentPassword("");
    setPassword("");
    setConfirm("");
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-2xl">
          <Skeleton className="h-64 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-background to-muted/20 p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <Button
          variant="ghost"
          className="rounded-2xl"
          onClick={() => navigate({ to: "/subscriber/profile" })}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour au profil
        </Button>

        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <User className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Mon compte</CardTitle>
                <CardDescription className="mt-1">
                  Gérez votre nom complet et votre mot de passe.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <form onSubmit={saveName} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="account-name">Nom complet</Label>
                <Input
                  id="account-name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  disabled={savingName}
                />
              </div>

              <Button
                type="submit"
                className="w-full rounded-2xl bg-[#6DB33F] text-white hover:bg-[#2D7A1F]"
                disabled={savingName}
              >
                {savingName ? "Enregistrement…" : "Enregistrer mon nom"}
              </Button>
            </form>

            <div className="rounded-2xl border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4" />
                Adresse e-mail
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {profile?.email ?? "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Mot de passe</CardTitle>
                <CardDescription className="mt-1">
                  Indiquez votre mot de passe actuel, puis choisissez-en un nouveau.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={savePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="account-current-password">Mot de passe actuel</Label>
                <div className="relative">
                  <Input
                    id="account-current-password"
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    disabled={savingPassword}
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowCurrent((value) => !value)}
                    aria-label={showCurrent ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-password">Nouveau mot de passe</Label>
                <div className="relative">
                  <Input
                    id="account-password"
                    type={showNew ? "text" : "password"}
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={savingPassword}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowNew((value) => !value)}
                    aria-label={showNew ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-confirm">Confirmer le nouveau mot de passe</Label>
                <div className="relative">
                  <Input
                    id="account-confirm"
                    type={showConfirm ? "text" : "password"}
                    minLength={8}
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    disabled={savingPassword}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirm((value) => !value)}
                    aria-label={showConfirm ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full rounded-2xl bg-[#6DB33F] text-white hover:bg-[#2D7A1F]"
                disabled={savingPassword}
              >
                {savingPassword ? "Mise à jour…" : "Mettre à jour le mot de passe"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}