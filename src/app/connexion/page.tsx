import { authConfigured } from "@/lib/auth";
import Login from "@/components/login";
export const dynamic = "force-dynamic";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  return (
    <div className="auth-page">
      <span className="eyebrow">BIENVENUE À VOTRE PAUSE</span>
      <h1>On fait connaissance ?</h1>
      <p>Connectez-vous pour préparer vos prochaines découvertes.</p>
      {erreur && (
        <p className="error">
          {erreur === "profil"
            ? "Le profil n’a pas pu être créé. Vérifiez la connexion à la base de données."
            : "Ce lien est invalide ou expiré. Demandez un nouveau lien."}
        </p>
      )}
      <Login configured={authConfigured()} />
    </div>
  );
}
