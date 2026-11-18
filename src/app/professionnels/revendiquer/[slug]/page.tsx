import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getVenue, isDemo } from "@/lib/venues";
import { authConfigured, requireRole } from "@/lib/auth";
import { ClaimForm } from "@/components/owners/forms";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Revendiquer un établissement",
  robots: { index: false, follow: false },
};
export default async function Claim({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const v = await getVenue((await params).slug);
  if (!v) notFound();
  if (isDemo())
    return (
      <div className="content-page">
        <h1>{v.name}</h1>
        <p>
          Cette fiche fait partie du catalogue fictif. La revendication
          nécessite le mode base de données.
        </p>
        <Link href="/professionnels">Retour à l’espace professionnel</Link>
      </div>
    );
  if (!authConfigured() || !(await requireRole(["CONSUMER", "OWNER", "ADMIN"])))
    redirect("/connexion");
  return (
    <div className="content-page">
      <Link className="breadcrumb" href={`/lieux/${v.slug}`}>
        ← Voir la fiche
      </Link>
      <h1>Revendiquer {v.name}</h1>
      {v.claimed ? (
        <p>Cette fiche possède déjà un propriétaire validé.</p>
      ) : (
        <>
          <p>
            SIRET et justificatif obligatoires. La vérification du registre et
            de votre habilitation est manuelle. Aucune modification de la fiche
            ne sera possible avant validation.
          </p>
          <ClaimForm venueId={v.id} />
        </>
      )}
    </div>
  );
}
