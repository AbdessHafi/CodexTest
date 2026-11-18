import { proofUrl } from "@/lib/owners/proof";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { authConfigured, requireRole } from "@/lib/auth";
import { pendingClaims } from "@/lib/owners/service";
import { ClaimDecisionForm } from "@/components/owners/forms";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Revendications à vérifier",
  robots: { index: false, follow: false },
};
export default async function Claims() {
  if (!authConfigured()) redirect("/connexion");
  const user = await requireRole(["ADMIN"]);
  if (!user) notFound();
  const items = await pendingClaims();
  return (
    <div className="content-page">
      <Link href="/admin/moderation" className="breadcrumb">
        ← Modération et journal des décisions
      </Link>
      <h1>Revendications à vérifier</h1>
      <p>
        {items.length} demande(s) en attente (100 maximum). Le contrôle de clé
        SIRET ne prouve ni l’activité réelle ni le droit de représenter le lieu.
      </p>
      <a
        href="https://annuaire-entreprises.data.gouv.fr/"
        target="_blank"
        rel="noreferrer"
      >
        Consulter le registre officiel des entreprises ↗
      </a>
      {items.map(({ claim: c, venueName }) => (
        <article className="review-card claim-card" key={c.id}>
          <h2>{venueName}</h2>
          <p>
            SIRET déclaré : <strong>{c.siret}</strong>
          </p>
          <p className="review-text">{c.statement}</p>
          <p>
            E-mail vérifié : {c.businessEmail} · Téléphone : {c.phone} ·
            Fonction : {c.applicantRole}
          </p>
          {c.documentKey && (
            <a href={proofUrl(c.id, user.id)} target="_blank" rel="noreferrer">
              Consulter le justificatif privé
            </a>
          )}
          <ClaimDecisionForm id={c.id} />
        </article>
      ))}
    </div>
  );
}
