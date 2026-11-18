import { proofUrl } from "@/lib/owners/proof";
import { CodeVerification } from "@/components/owners/forms";
import Link from "next/link";
import { authConfigured, requireRole } from "@/lib/auth";
import { isDemo } from "@/lib/venues";
import { db } from "@/lib/db";
import { venueOwners, venues, venueClaims } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Espace professionnel",
  robots: { index: false, follow: false },
};
export default async function Professionals() {
  const user = authConfigured()
    ? await requireRole(["CONSUMER", "OWNER", "ADMIN"])
    : null;
  const owned =
    user && !isDemo()
      ? await db
          .select({ id: venues.id, name: venues.name })
          .from(venueOwners)
          .innerJoin(venues, eq(venues.id, venueOwners.venueId))
          .where(
            and(
              eq(venueOwners.userId, user.id),
              eq(venueOwners.status, "APPROVED"),
            ),
          )
      : [];
  const claims =
    user && !isDemo()
      ? await db
          .select({
            id: venueClaims.id,
            status: venueClaims.status,
            reason: venueClaims.reason,
            verified: venueClaims.emailVerifiedAt,
            document: venueClaims.documentKey,
            name: venues.name,
          })
          .from(venueClaims)
          .innerJoin(venues, eq(venues.id, venueClaims.venueId))
          .where(eq(venueClaims.userId, user.id))
          .orderBy(desc(venueClaims.createdAt))
          .limit(50)
      : [];
  return (
    <div className="content-page">
      <span className="eyebrow">POUR LES BELLES ADRESSES</span>
      <h1>Votre espace professionnel.</h1>
      <p>
        Revendiquez votre fiche avec son SIRET, un e-mail professionnel vérifié
        et un justificatif facultatif de votre habilitation. Un administrateur
        examine la demande avant de vous donner accès.
      </p>
      {!user && (
        <Link className="primary" href="/connexion">
          Se connecter pour commencer
        </Link>
      )}
      {isDemo() && (
        <p className="notice">
          La revendication et l’édition nécessitent la base de données et un
          compte vérifié. Les lieux du catalogue démo sont fictifs.
        </p>
      )}
      <h2>Mes établissements</h2>
      {owned.length ? (
        <div className="seo-list">
          {owned.map((v) => (
            <Link key={v.id} href={`/professionnels/etablissements/${v.id}`}>
              <h3>{v.name}</h3>
              <p>Gérer la fiche, les horaires, la carte et les photos →</p>
            </Link>
          ))}
        </div>
      ) : (
        <p>
          Aucun établissement validé pour votre compte. Retrouvez votre fiche
          dans la recherche pour la revendiquer.
        </p>
      )}
      <Link className="breadcrumb" href="/">
        Rechercher mon établissement
      </Link>
      {!!claims.length && (
        <>
          <h2>Mes demandes</h2>
          {claims.map((c) => (
            <article className="review-card" key={c.id}>
              <h3>{c.name}</h3>
              <p>
                {c.status === "PENDING"
                  ? "En cours d’examen"
                  : c.status === "APPROVED"
                    ? "Validée"
                    : "Rejetée"}
              </p>
              {c.reason && <p>Motif : {c.reason}</p>}
              {c.status === "PENDING" && !c.verified && (
                <CodeVerification id={c.id} />
              )}
              {c.document && (
                <a href={proofUrl(c.id, user!.id)}>Mon justificatif privé</a>
              )}
            </article>
          ))}
        </>
      )}
      {user?.role === "ADMIN" && (
        <nav className="seo-nav">
          <Link href="/admin/revendications">Examiner les revendications</Link>
          <Link href="/admin/moderation">Modérer les avis</Link>
        </nav>
      )}
      <p className="notice">
        Aucun abonnement ni paiement n’est collecté à cette phase. Les
        réservations et la facturation seront ajoutées dans les phases
        suivantes.
      </p>
    </div>
  );
}
