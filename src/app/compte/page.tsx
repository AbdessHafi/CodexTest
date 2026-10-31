import { redirect } from "next/navigation";
import { authConfigured, supabase } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function Account() {
  if (!authConfigured()) redirect("/connexion");
  const auth = await supabase();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) redirect("/connexion");
  return (
    <div className="content-page">
      <h1>Votre petite pause.</h1>
      <p>Connecté avec {user.email}</p>
      <p>
        Vos favoris, listes et réservations seront disponibles dans les
        prochaines phases.
      </p>
      <form action="/api/auth/logout" method="post">
        <button className="primary">Se déconnecter</button>
      </form>
    </div>
  );
}
