/* eslint-disable @next/next/no-img-element -- Same-origin, access-controlled images must be fetched without optimization caching. */
import Link from "next/link";
import { publishedReviews } from "@/lib/reviews/queries";
import { criteria, labels, reviewScore } from "@/lib/reviews/policy";
import { ReviewForm, ReviewActions } from "./forms";
import { isDemo } from "@/lib/venues";
import { authConfigured, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { venueOwners } from "@/db/schema";
import { and, eq } from "drizzle-orm";
export default async function ReviewSection({ venueId }: { venueId: string }) {
  const { items, summary } = await publishedReviews(venueId);
  let canReply = false;
  if (!isDemo() && authConfigured()) {
    const user = await requireRole(["OWNER"]);
    if (user) {
      const [owner] = await db
        .select()
        .from(venueOwners)
        .where(
          and(
            eq(venueOwners.userId, user.id),
            eq(venueOwners.venueId, venueId),
            eq(venueOwners.status, "APPROVED"),
          ),
        );
      canReply = !!owner;
    }
  }
  return (
    <section id="avis">
      <h2>Les avis de la communauté</h2>
      <p className="review-rules">
        Avis après visite, avec compte et e-mail vérifié. Publication après
        modération, sans rémunération ni avantage lié à la note. Tri : les plus
        récents d’abord.{" "}
        <Link href="/avis-et-moderation">Notre politique d’avis</Link>
      </p>
      {summary.count ? (
        <>
          <p className="review-average">
            <strong>{summary.average.toFixed(1)} / 5</strong> · {summary.count}{" "}
            avis publié{summary.count > 1 ? "s" : ""}
          </p>
          <dl className="rating-breakdown">
            {criteria.map((k) => (
              <div key={k}>
                <dt>{labels[k]}</dt>
                <dd>{summary.criteria[k].toFixed(1)} / 5</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p>Aucun avis publié pour le moment.</p>
      )}
      <ReviewForm venueId={venueId} demo={isDemo()} />
      {items.map((r) => (
        <article className="review-card" key={r.id}>
          <header>
            <strong>Visiteur de la communauté</strong>
            <span>{reviewScore(r).toFixed(1)} / 5</span>
          </header>
          <p className="demo-note">
            Visite du{" "}
            {new Intl.DateTimeFormat("fr-FR", {
              timeZone: "Europe/Paris",
            }).format(new Date(`${r.visitDate}T12:00:00Z`))}{" "}
            · Déposé le{" "}
            {new Intl.DateTimeFormat("fr-FR", {
              timeZone: "Europe/Paris",
            }).format(new Date(r.createdAt))}{" "}
            ·{" "}
            <strong>
              {r.verified ? "Visite vérifiée" : "Visite non vérifiée"}
            </strong>
          </p>
          <p className="review-text">{r.text}</p>
          <details>
            <summary>Voir les notes par critère</summary>
            <dl className="rating-breakdown">
              {criteria.map((k) => (
                <div key={k}>
                  <dt>{labels[k]}</dt>
                  <dd>{r[k]} / 5</dd>
                </div>
              ))}
            </dl>
          </details>
          <div className="review-photos">
            {r.photos.map((p) => (
              <a href={`/api/reviews/${r.id}/photos/${p.id}`} key={p.id}>
                <img
                  src={`/api/reviews/${r.id}/photos/${p.id}`}
                  alt={p.alt}
                  width={160}
                  height={120}
                  loading="lazy"
                />
              </a>
            ))}
          </div>
          {r.reply && (
            <blockquote>
              <strong>Réponse de l’établissement</strong>
              <p className="review-text">{r.reply}</p>
            </blockquote>
          )}
          <ReviewActions id={r.id} canReply={canReply && !r.reply} />
        </article>
      ))}
      {summary.count > 50 && (
        <p>
          Les 50 avis les plus récents sont affichés. La moyenne porte sur tous
          les avis publiés.
        </p>
      )}
    </section>
  );
}
