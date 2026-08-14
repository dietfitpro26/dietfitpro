import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Settings, User, ShieldCheck, LogOut } from "lucide-react";
import { ProLayout } from "@/layouts/ProLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";


export const Route = createFileRoute("/pro/settings")({
  head: () => ({ meta: [{ title: "Paramètres — DietFitPro" }] }),
  component: () => (
    <ProtectedRoute allow={["pro"]}>
      <ProLayout><SettingsContent /></ProLayout>
    </ProtectedRoute>
  ),
});


type Locale = "fr" | "en";
const LOCALE_LABEL: Record<Locale, string> = {
  fr: "Français",
  en: "English",
};

const PLAN_LABEL: Record<string, string> = {
  basic: "Basic",
  premium: "Premium",
  visio: "Visio",
  patient: "Patient",
};

const SUB_STATUS_LABEL: Record<string, string> = {
  active: "Actif",
  cancelled: "Annulé",
  past_due: "Paiement en retard",
  trialing: "Essai",
  none: "Aucun",
};

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  locale: string;
  role: string;
  plan: string;
  subscription_status: string;
}

function SettingsContent() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null | undefined>(undefined);

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, locale, role, plan, subscription_status")
      .eq("id", user.id)
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      setProfile(null);
      return;
    }
    setProfile((data as ProfileRow | null) ?? null);
  };

  useEffect(() => { void load(); }, [user]);

  return (
    <div className="flex flex-col">
      <header className="flex items-center gap-3 border-b bg-white px-6 py-4">
        <Settings className="h-6 w-6 text-[#6DB33F]" />
        <h1 className="text-xl font-semibold text-foreground">Paramètres</h1>
      </header>

      <div className="p-6 space-y-6 max-w-2xl">
        {profile === undefined ? (
          <Skeleton className="h-64 w-full" />
        ) : profile === null ? (
          <p className="text-sm text-destructive">Impossible de charger votre profil.</p>
        ) : (
          <>
            <ProfileCard profile={profile} onSaved={(updated) => setProfile(updated)} />
            <AccountCard profile={profile} />
            <PasswordCard />
            <LogoutCard onLogout={() => void signOut()} />
          </>
        )}
      </div>
    </div>
  );
}

function ProfileCard({
  profile, onSaved,
}: {
  profile: ProfileRow;
  onSaved: (updated: ProfileRow) => void;
}) {
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [locale, setLocale] = useState<Locale>((profile.locale as Locale) ?? "fr");
  const [saving, setSaving] = useState(false);

  const initials = (fullName || profile.email || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      full_name: fullName.trim() || null,
      avatar_url: avatarUrl.trim() || null,
      locale,
    };
    const { error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profil mis à jour");
    onSaved({ ...profile, ...payload });
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center gap-3">
        <User className="h-5 w-5 text-[#6DB33F]" />
        <CardTitle className="text-base">Profil professionnel</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt={fullName} /> : null}
              <AvatarFallback className="bg-[#6DB33F] text-white">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <Label>URL de l'avatar</Label>
              <Input
                placeholder="https://…"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Nom complet</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Langue</Label>
            <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(LOCALE_LABEL) as Locale[]).map((l) => (
                  <SelectItem key={l} value={l}>{LOCALE_LABEL[l]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={saving} className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white">
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AccountCard({ profile }: { profile: ProfileRow }) {
  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-[#6DB33F]" />
        <CardTitle className="text-base">Compte</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 text-sm">
        <Info label="Email" value={profile.email} />
        <Info label="Rôle" value="Professionnel" />
        <Info label="Plan" value={PLAN_LABEL[profile.plan] ?? profile.plan} />
        <Info label="Abonnement" value={SUB_STATUS_LABEL[profile.subscription_status] ?? profile.subscription_status} />
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function PasswordCard() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Mot de passe mis à jour");
    setPassword("");
    setConfirm("");
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-[#6DB33F]" />
        <CardTitle className="text-base">Mot de passe</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1">
            <Label>Nouveau mot de passe</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
            />
          </div>
          <div className="space-y-1">
            <Label>Confirmer le mot de passe</Label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
            />
          </div>
          <Button type="submit" disabled={saving} className="bg-[#6DB33F] hover:bg-[#2D7A1F] text-white">
            {saving ? "Enregistrement…" : "Mettre à jour le mot de passe"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function LogoutCard({ onLogout }: { onLogout: () => void }) {
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-center justify-between py-4">
        <div>
          <p className="text-sm font-medium">Déconnexion</p>
          <p className="text-xs text-muted-foreground">Vous serez redirigé vers la page de connexion.</p>
        </div>
        <Button variant="outline" onClick={onLogout} className="gap-2">
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </Button>
      </CardContent>
    </Card>
  );
}