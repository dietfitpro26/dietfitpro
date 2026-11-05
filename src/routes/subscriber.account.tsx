import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, Mail, ShieldCheck, User } from "lucide-react";
import { SubscriberLayout } from "@/layouts/SubscriberLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <div className="min-h-full p-4 sm:p-6">
        <div className="mx-auto max-w-4xl">
          <Skeleton className="h-64 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-[#1F5A2E] p-6 text-white shadow-lg sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-white/10 blur-2xl" />

          <div className="relative">
            <Button
              variant="ghost"
              className="mb-5 h-10 rounded-full text-white hover:bg-white/15 hover:text-white"
              onClick={() => navigate({ to: "/subscriber/profile" })}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour au profil
            </Button>

            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
                <User className="h-7 w-7 text-white" />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-bold uppercase tracking-wider text-white/80">
                  Espace personnel
                </p>
                <h1 className="text-3xl font-extrabold sm:text-4xl">
                  Mon compte
                </h1>
                <p className="mt-1 text-sm text-white/90 sm:text-base">
                  Gérez vos informations personnelles et votre sécurité.
                </p>
              </div>
            </div>
          </div>
        </section>

        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <User className="h-5 w-5" />
              </div>

              <div>
                <CardTitle className="text-xl">Informations personnelles</CardTitle>
                <CardDescription className="mt-1">
                  Modifiez votre nom complet associé à votre compte DietFitPro.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <form onSubmit={saveName} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="account-name" className="text-base font-semibold">
                  Nom complet
                </Label>
                <Input
                  id="account-name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  disabled={savingName}
                  className="h-12 rounded-xl text-base"
                />
              </div>

              <Button
                type="submit"
                className="h-12 w-full rounded-full px-6 text-base font-bold shadow-lg shadow-primary/20"
                disabled={savingName}
              >
                {savingName ? "Enregistrement…" : "Enregistrer mon nom"}
              </Button>
            </form>

            <div className="rounded-2xl border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Mail className="h-4 w-4 text-primary" />
                Adresse e-mail
              </div>

              <p className="mt-2 break-all text-sm text-muted-foreground">
                {profile?.email ?? "—"}
              </p>

              <p className="mt-2 text-xs text-muted-foreground">
                Votre adresse e-mail est utilisée pour vous connecter à votre compte.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border shadow-sm">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>

              <div>
                <CardTitle className="text-xl">Sécurité du compte</CardTitle>
                <CardDescription className="mt-1">
                  Modifiez votre mot de passe pour protéger votre espace personnel.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={savePassword} className="space-y-5">
              <div className="space-y-2">
                <Label
                  htmlFor="account-current-password"
                  className="text-base font-semibold"
                >
                  Mot de passe actuel
                </Label>

                <div className="relative">
                  <Input
                    id="account-current-password"
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    disabled={savingPassword}
                    autoComplete="current-password"
                    className="h-12 rounded-xl pr-11 text-base"
                  />

                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setShowCurrent((value) => !value)}
                    aria-label={
                      showCurrent
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                  >
                    {showCurrent ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="account-password"
                  className="text-base font-semibold"
                >
                  Nouveau mot de passe
                </Label>

                <div className="relative">
                  <Input
                    id="account-password"
                    type={showNew ? "text" : "password"}
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={savingPassword}
                    autoComplete="new-password"
                    className="h-12 rounded-xl pr-11 text-base"
                  />

                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setShowNew((value) => !value)}
                    aria-label={
                      showNew
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                  >
                    {showNew ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Utilisez au minimum 8 caractères.
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="account-confirm"
                  className="text-base font-semibold"
                >
                  Confirmer le nouveau mot de passe
                </Label>

                <div className="relative">
                  <Input
                    id="account-confirm"
                    type={showConfirm ? "text" : "password"}
                    minLength={8}
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    disabled={savingPassword}
                    autoComplete="new-password"
                    className="h-12 rounded-xl pr-11 text-base"
                  />

                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setShowConfirm((value) => !value)}
                    aria-label={
                      showConfirm
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="h-12 w-full rounded-full px-6 text-base font-bold shadow-lg shadow-primary/20"
                disabled={savingPassword}
              >
                {savingPassword
                  ? "Mise à jour…"
                  : "Mettre à jour le mot de passe"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}