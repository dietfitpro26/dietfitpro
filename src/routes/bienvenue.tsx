import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/bienvenue")({
  component: BienvenuePage,
});

function BienvenuePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"loading" | "form" | "done">("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
  // Vérifie si une session existe déjà au chargement
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) setStep("form");
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        setStep("form");
      }
      if (event === "USER_UPDATED" && session) {
        await supabase.rpc("link_patient_account", {
          p_user_id: session.user.id,
          p_email: session.user.email ?? "",
        });
        setStep("done");
        setTimeout(() => navigate({ to: "/patient/dashboard" }), 2000);
      }
    }
  );
  return () => subscription.unsubscribe();
 }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError("8 caractères minimum."); return; }
    if (password !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (err) { setError(err.message); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f7eb", padding: "1rem" }}>
      <div style={{ background: "white", borderRadius: "1rem", padding: "2rem", width: "100%", maxWidth: "400px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ width: 56, height: 56, background: "#6DB33F", borderRadius: "0.75rem", margin: "0 auto 1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "white", fontSize: 28 }}>🥗</span>
          </div>
          <h1 style={{ color: "#2D7A1F", fontWeight: 700, fontSize: "1.4rem" }}>DietFitPro</h1>
          <p style={{ color: "#888", fontSize: "0.85rem" }}>Votre espace santé personnalisé</p>
        </div>

        {step === "loading" && (
          <p style={{ textAlign: "center", color: "#666" }}>⏳ Vérification de votre invitation…</p>
        )}

        {step === "form" && (
          <form onSubmit={handleSubmit}>
            <p style={{ fontWeight: 600, marginBottom: "1rem", textAlign: "center" }}>Créez votre mot de passe</p>
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={{ fontSize: "0.8rem", color: "#666", display: "block", marginBottom: 4 }}>Mot de passe</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="8 caractères minimum" required
                style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #ddd", borderRadius: "0.5rem", fontSize: "0.9rem", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.8rem", color: "#666", display: "block", marginBottom: 4 }}>Confirmer</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Répétez le mot de passe" required
                style={{ width: "100%", padding: "0.5rem 0.75rem", border: "1px solid #ddd", borderRadius: "0.5rem", fontSize: "0.9rem", boxSizing: "border-box" }} />
            </div>
            {error && <p style={{ color: "#e53e3e", fontSize: "0.85rem", marginBottom: "0.75rem" }}>⚠️ {error}</p>}
            <button type="submit" disabled={saving}
              style={{ width: "100%", padding: "0.65rem", background: "#6DB33F", color: "white", border: "none", borderRadius: "0.5rem", fontWeight: 600, fontSize: "1rem", cursor: "pointer" }}>
              {saving ? "Enregistrement…" : "Accéder à mon espace"}
            </button>
          </form>
        )}

        {step === "done" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: "0.5rem" }}>🎉</div>
            <p style={{ fontWeight: 600 }}>Bienvenue !</p>
            <p style={{ color: "#888", fontSize: "0.85rem" }}>Redirection en cours…</p>
          </div>
        )}
      </div>
    </div>
  );
}